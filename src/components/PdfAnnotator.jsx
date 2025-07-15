"use client";

import { useState, useEffect } from "react";
import Thumbnails from "./Thumbnails";
import AnnotationInspector from "./AnnotationInspector";
// Dynamically load pdfjs only in the browser to avoid SSR issues
import { useRef } from "react";
const pdfjsLibRef = { current: null };
import ImageAnnotator from "./ImageAnnotator"; // new component
import { saveImages, loadImages, deleteImages } from "../utils/db";
import { savePdf, deletePdf } from "../utils/db";
import { useSearchParams } from "next/navigation";
import { parseTextToObject } from "../utils/openaiParser";

// Lazy import helper for tesseract
let tesseractWorkerPromise = null;
async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker({ logger: () => {} });
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

// Helper: simple rectangle overlap test (in relative coords 0-1)
function rectsOverlap(a, b) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

// pdfjs worker will be configured after dynamic import

// Generate stable file id using name+size+lastModified
function getFileId(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function PdfAnnotator() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const debugMode = searchParams?.get('debug') === '1';
  // Map of fileId -> { name, images: [], annotations: [] }
  const [pdfData, setPdfData] = useState({});
  const [currentFileId, setCurrentFileId] = useState("");

  const [objects, setObjects] = useState([]); // loaded object definitions
  const [selectedObject, setSelectedObject] = useState("");
  const [highlightId, setHighlightId] = useState("");
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const handleValuesChange = (newVals) => {
    if (!highlightId) return;
    setPdfData((prev) => {
      if (!currentFileId) return prev;
      const fe = prev[currentFileId];
      if (!fe) return prev;
      return {
        ...prev,
        [currentFileId]: {
          ...fe,
          annotations: fe.annotations.map((a) =>
            a.id === highlightId ? { ...a, values: newVals } : a
          ),
        },
      };
    });
  };
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const handleRemoveFile = async () => {
    if (!currentFileId) return;

    // Show confirmation dialog (skip in test environment)
    if (process.env.NODE_ENV !== "test" && typeof window !== "undefined") {
      const fname = pdfData[currentFileId]?.name || "this file";
      const confirmed = window.confirm(
        `Remove \"${fname}\" and all its annotations? This cannot be undone.`
      );
      if (!confirmed) return;
    }

    // Remove images & pdf from IndexedDB (fire and forget)
    deleteImages(currentFileId).catch(() => {});
    deletePdf(currentFileId).catch(() => {});

    setPdfData((prev) => {
      const { [currentFileId]: _removed, ...rest } = prev;
      return rest;
    });

    // Choose another file if available, otherwise clear selection
    setCurrentFileId((prev) => {
      const keys = Object.keys(pdfData).filter((k) => k !== prev);
      return keys[0] || "";
    });

    // Clear highlight to avoid pointing to removed annotation
    setHighlightId("");
  };

  // Load object registry once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const init = async () => {
        try {
          const stored = localStorage.getItem("objectRegistry") || "[]";
          const parsedObjects = JSON.parse(stored);
          // Handle legacy shape where data was stored as an object keyed by name.
          const normalizedObjects = Array.isArray(parsedObjects) ? parsedObjects : Object.values(parsedObjects || {});
          setObjects(normalizedObjects);

          const storedPdf = localStorage.getItem("pdfData") || "{}";
          const parsed = JSON.parse(storedPdf);

          // In the Jest test environment we skip heavy async image loading to avoid
          // state updates that fire outside React Testing Library's act() wrapper.
          if (process.env.NODE_ENV === "test") {
            setPdfData(parsed);
            const firstKey = Object.keys(parsed)[0] || "";
            setCurrentFileId(firstKey);
            return;
          }

          // Load images for each file from IndexedDB asynchronously
          const entries = await Promise.all(
            Object.keys(parsed).map(async (fid) => {
              const imgs = await loadImages(fid);
              return [fid, imgs];
            })
          );

          const withImages = { ...parsed };
          entries.forEach(([fid, imgs]) => {
            if (imgs.length) {
              withImages[fid] = {
                ...withImages[fid],
                images: imgs,
              };
            }
          });

          setPdfData(withImages);
          const firstKey = Object.keys(withImages)[0] || "";
          setCurrentFileId(firstKey);
        } catch {
          setObjects([]);
          setPdfData({});
          setCurrentFileId("");
        }
      };

      // Fire and forget.
      init();
    }
  }, []);

  // Persist a lightweight version of pdfData (exclude large image content)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const minimalData = {};
        Object.entries(pdfData).forEach(([fid, entry]) => {
          minimalData[fid] = {
            name: entry.name,
            // Images and textItems are intentionally omitted to avoid exceeding storage quotas.
            annotations: entry.annotations || [],
          };
        });
        localStorage.setItem("pdfData", JSON.stringify(minimalData));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to persist pdfData", e);
      }
    }
  }, [pdfData]);

  const handleFile = async (event) => {
    // Ensure pdfjs is loaded and configured
    if (!pdfjsLibRef.current) {
      const pdfjsLib = await import("pdfjs-dist/build/pdf");
      // Load worker script from local public folder for offline use
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      pdfjsLibRef.current = pdfjsLib;
    }

    const pdfjsLib = pdfjsLibRef.current;

    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    const fileId = getFileId(file);

    const arrayBuffer = await file.arrayBuffer();
    // Persist original PDF blob in IndexedDB (fire and forget)
    savePdf(fileId, new Blob([arrayBuffer], { type: 'application/pdf' })).catch(() => {});

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const renderedImages = [];
    const pageTextItems = []; // array per page

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      // eslint-disable-next-line no-await-in-loop
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      // Extract text items with accurate bounding boxes
      // eslint-disable-next-line no-await-in-loop
      const textContent = await page.getTextContent();
      const items = textContent.items.map((it) => {
        const tx = it.transform[4];
        const ty = it.transform[5];
        const width = it.width;
        const height = it.height || Math.abs(it.transform[3]);

        // Get viewport coords (origin top-left)
        const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
          tx,
          ty,
          tx + width,
          ty + height,
        ]);

        const x = vx1 / viewport.width;
        const y = vy1 / viewport.height;
        const wRel = (vx2 - vx1) / viewport.width;
        const hRel = (vy2 - vy1) / viewport.height;

        return { str: it.str, x, y, width: wRel, height: hRel };
      });
      pageTextItems.push(items);

      // Create a canvas to render the PDF page
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // eslint-disable-next-line no-await-in-loop
      await page.render({ canvasContext: context, viewport }).promise;
      renderedImages.push(canvas.toDataURL("image/png"));
    }

    // Persist heavy image data in IndexedDB
    saveImages(fileId, renderedImages).catch(() => {});

    setPdfData((prev) => ({
      ...prev,
      [fileId]: {
        name: file.name,
        images: renderedImages,
        annotations: [],
        textItems: pageTextItems,
      },
    }));

    setCurrentFileId(fileId);
    setSelectedObject("");
  };

  // Convenience getters for current file
  const currentImages = currentFileId && pdfData[currentFileId]?.images ? pdfData[currentFileId].images : [];
  const currentAnnotations = currentFileId && pdfData[currentFileId]?.annotations ? pdfData[currentFileId].annotations : [];
  const currentTextItems = currentFileId && pdfData[currentFileId]?.textItems ? pdfData[currentFileId].textItems : [];

  // Keep currentPageIdx in bounds when file changes
  useEffect(() => {
    if (currentPageIdx >= currentImages.length) {
      setCurrentPageIdx(0);
    }
  }, [currentImages.length, currentPageIdx]);

  // Keep the editor textarea in sync with selection / annotation updates
  useEffect(() => {
    if (!highlightId) {
      return;
    }

    const ann = currentAnnotations.find((a) => a.id === highlightId);
    if (ann) {
      // If this annotation is still being processed (OCR/OpenAI), block opening and inform the user.
      if (ann.ocrPending || ann.openaiPending) {
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-alert
          window.alert('This annotation is still processing. Please wait until it finishes before opening.');
        }
        return; // Do not open inspector while pending
      }
      setInspectorOpen(true);
    }
  }, [highlightId, currentAnnotations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // ignore typing

      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n' || e.key === 'PageDown') {
        setCurrentPageIdx((p) => Math.min(currentImages.length - 1, p + 1));
      }
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p' || e.key === 'PageUp') {
        setCurrentPageIdx((p) => Math.max(0, p - 1));
      }
      if (e.key === 'Delete') {
        if (highlightId) {
          handleDeleteAnnotation(highlightId);
          setHighlightId('');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentImages.length, highlightId]);

  // Helper: use OpenAI to parse text into structured values and attach them to an annotation
  const parseAndAttach = async (annotation, text) => {
    // Mark OpenAI work as started
    setPdfData((prev) => {
      const fe = prev[currentFileId];
      if (!fe) return prev;
      return {
        ...prev,
        [currentFileId]: {
          ...fe,
          annotations: fe.annotations.map((a) =>
            a.id === annotation.id ? { ...a, openaiPending: true } : a
          ),
        },
      };
    });

    if (!text?.trim() || !annotation.objectName) {
      // Nothing to parse – clear pending flag and exit
      setPdfData((prev) => {
        const fe = prev[currentFileId];
        if (!fe) return prev;
        return {
          ...prev,
          [currentFileId]: {
            ...fe,
            annotations: fe.annotations.map((a) =>
              a.id === annotation.id ? { ...a, openaiPending: false } : a
            ),
          },
        };
      });
      return;
    }

    try {
      let imageUrl = undefined;
      if (typeof window !== 'undefined' && window.OPENAI_FEED_IMAGE) {
        if (currentImages[annotation.pageIndex]) {
          try {
            // Generate a cropped canvas matching the annotation rectangle
            const baseImg = new Image();
            baseImg.src = currentImages[annotation.pageIndex];
            await baseImg.decode();

            const cropW = baseImg.width * annotation.width;
            const cropH = baseImg.height * annotation.height;
            if (cropW > 2 && cropH > 2) {
              const canvas = document.createElement('canvas');
              canvas.width = cropW;
              canvas.height = cropH;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(
                baseImg,
                baseImg.width * annotation.x,
                baseImg.height * annotation.y,
                cropW,
                cropH,
                0,
                0,
                cropW,
                cropH
              );
              imageUrl = canvas.toDataURL('image/png');
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Crop creation failed', e);
          }
        }
      }

      const parsed = await parseTextToObject(text, annotation.objectName, objects, imageUrl);

      setPdfData((prev) => {
        const fe = prev[currentFileId];
        if (!fe) return prev;
        return {
          ...prev,
          [currentFileId]: {
            ...fe,
            annotations: fe.annotations.map((a) => {
              if (a.id !== annotation.id) return a;
              const base = { ...a, openaiPending: false };
              return parsed ? { ...base, values: parsed } : base;
            }),
          },
        };
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('OpenAI parsing error', err);
      // Clear pending flag on error
      setPdfData((prev) => {
        const fe = prev[currentFileId];
        if (!fe) return prev;
        return {
          ...prev,
          [currentFileId]: {
            ...fe,
            annotations: fe.annotations.map((a) =>
              a.id === annotation.id ? { ...a, openaiPending: false } : a
            ),
          },
        };
      });
    }
  };

  const handleAddAnnotation = (ann) => {
    // Extract text for this annotation
    let extracted = "";
    if (currentTextItems[ann.pageIndex]) {
      const rectRel = { x: ann.x, y: ann.y, width: ann.width, height: ann.height };
      const texts = currentTextItems[ann.pageIndex]
        .filter((ti) => rectsOverlap(rectRel, ti))
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((ti) => ti.str);
      extracted = texts.join(" ");
    }

    const objectDef = objects.find((o) => o.name === ann.objectName);
    const newAnn = {
      ...ann,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: extracted,
      ocrPending: !extracted, // start OCR if no direct text
      openaiPending: !!(extracted && ann.objectName),
      objectVersion: objectDef?.version || 1,
      humanRevised: false,
      pendingValidation: false,
    };
    setPdfData((prev) => {
      if (!currentFileId) return prev;
      const fileEntry = prev[currentFileId];
      return {
        ...prev,
        [currentFileId]: {
          ...fileEntry,
          annotations: [...(fileEntry.annotations || []), newAnn],
        },
      };
    });

    // Immediately attempt to parse extracted text (if any)
    if (extracted && newAnn.objectName) {
      // Fire and forget – we don't await to keep UI responsive
      parseAndAttach(newAnn, extracted);
    }

    // If no text extracted, perform OCR asynchronously
    if (!extracted && currentImages[ann.pageIndex]) {
      (async () => {
        try {
          const worker = await getTesseractWorker();
          // Create cropped canvas
          const img = new Image();
          img.src = currentImages[ann.pageIndex];
          await img.decode();

          const canvas = document.createElement("canvas");
          const widthPx = img.width * ann.width;
          const heightPx = img.height * ann.height;
          if (widthPx <= 1 || heightPx <= 1) return; // tiny area skip
          canvas.width = widthPx;
          canvas.height = heightPx;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            img,
            img.width * ann.x,
            img.height * ann.y,
            widthPx,
            heightPx,
            0,
            0,
            widthPx,
            heightPx
          );

          const {
            data: { text: ocrText },
          } = await worker.recognize(canvas);

          if (ocrText && ocrText.trim()) {
            setPdfData((prev) => {
              const fe = prev[currentFileId];
              if (!fe) return prev;
              return {
                ...prev,
                [currentFileId]: {
                  ...fe,
                  annotations: fe.annotations.map((a) =>
                    a.id === newAnn.id
                      ? { ...a, text: ocrText.trim(), ocrPending: false, openaiPending: true }
                      : a
                  ),
                },
              };
            });

            // Parse the newly obtained OCR text
            parseAndAttach({ ...newAnn, text: ocrText.trim() }, ocrText.trim());
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("OCR error", e);
        }
      })();
    }
  };

  const handleDeleteAnnotation = (id) => {
    setPdfData((prev) => {
      if (!currentFileId) return prev;
      const fileEntry = prev[currentFileId];
      return {
        ...prev,
        [currentFileId]: {
          ...fileEntry,
          annotations: fileEntry.annotations.filter((a) => a.id !== id),
        },
      };
    });
  };

  const handleToggleReviewed = (checked) => {
    if (!highlightId) return;
    setPdfData((prev) => {
      const fe = prev[currentFileId];
      if (!fe) return prev;
      return {
        ...prev,
        [currentFileId]: {
          ...fe,
          annotations: fe.annotations.map((a) =>
            a.id === highlightId ? { ...a, humanRevised: checked, pendingValidation: checked ? false : a.pendingValidation } : a
          ),
        },
      };
    });
  };

  const handleInspectorClose = () => {
    // When the inspector is closed, automatically clear the pendingValidation flag
    // for the currently highlighted annotation (if any). This allows users to simply
    // open & review an annotation that required validation, then click "Done" to
    // confirm the review without having to toggle the checkbox.
    if (highlightId && currentFileId && pdfData[currentFileId]) {
      const fileEntry = pdfData[currentFileId];
      const ann = fileEntry.annotations.find((a) => a.id === highlightId);
      if (ann && ann.pendingValidation) {
        setPdfData((prev) => {
          const fe = prev[currentFileId];
          if (!fe) return prev;
          return {
            ...prev,
            [currentFileId]: {
              ...fe,
              annotations: fe.annotations.map((a) =>
                a.id === highlightId ? { ...a, pendingValidation: false, humanRevised: true } : a
              ),
            },
          };
        });
      }
    }
    setInspectorOpen(false);
  };

  // Keep only objects that are NOT marked as subobjects
  const primaryObjects = objects.filter((o) => !o.isSubobject);

  // Ensure we always have a valid default selection: first primary object
  useEffect(() => {
    // If nothing selected yet and we have at least one primary object, pick the first
    if (!selectedObject && primaryObjects.length) {
      setSelectedObject(primaryObjects[0].name);
      return;
    }
    // If the currently selected object is no longer in the list (e.g. it was turned into a subobject or deleted)
    if (selectedObject && !primaryObjects.find((o) => o.name === selectedObject)) {
      setSelectedObject(primaryObjects[0]?.name || "");
    }
  }, [primaryObjects, selectedObject]);

  // Annotations to render on the current page
  const pageAnnotations = currentAnnotations.filter(
    (a) =>
      a.pageIndex === currentPageIdx &&
      a.objectName === selectedObject &&
      (!showPendingOnly || a.pendingValidation)
  );

  // All annotations for sidebar listing (page-independent)
  const sidebarAnnotations = currentAnnotations.filter(
    (a) =>
      a.objectName === selectedObject &&
      (!showPendingOnly || a.pendingValidation)
  );

  // Build counts of annotations per object for dropdown labels
  const objectCounts = {};
  currentAnnotations.forEach((ann) => {
    objectCounts[ann.objectName] = (objectCounts[ann.objectName] || 0) + 1;
  });

  const processingIdsRef = useRef(new Set()); // Track annotations currently being (re)extracted to avoid duplicate calls

  // Trigger OpenAI (re)extraction when annotations are flagged with `openaiPending`
  useEffect(() => {
    if (!currentFileId) return;
    const fileEntry = pdfData[currentFileId];
    if (!fileEntry || !Array.isArray(fileEntry.annotations)) return;

    fileEntry.annotations.forEach((ann) => {
      // We can only parse if annotation explicitly requests it, we have some text to feed, and we are not already processing it.
      if (ann.openaiPending && ann.text && !processingIdsRef.current.has(ann.id)) {
        processingIdsRef.current.add(ann.id);
        // Fire-and-forget – parseAndAttach will clear the pending flag when finished
        parseAndAttach(ann, ann.text).finally(() => {
          processingIdsRef.current.delete(ann.id);
        });
      }
    });
    // We intentionally exclude parseAndAttach from deps to avoid recreating the effect unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData, currentFileId]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Sticky workspace header */}
      <div className="sticky top-0 z-30 bg-white border-b py-2 flex items-center gap-4 px-2">
        <input
          data-testid="file-input"
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          className="file:mr-2 file:px-3 file:py-1 file:border-0 file:rounded file:bg-blue-600 file:text-white file:cursor-pointer"
        />

        {/* File dropdown */}
        {Object.keys(pdfData).length > 0 && (
          <select
            value={currentFileId}
            onChange={(e) => setCurrentFileId(e.target.value)}
            className="border rounded p-1 text-sm"
          >
            {Object.entries(pdfData).map(([fid, { name }]) => (
              <option key={fid} value={fid}>{name}</option>
            ))}
          </select>
        )}

        {/* Remove file button */}
        {currentFileId && (
          <button
            type="button"
            onClick={handleRemoveFile}
            className="px-2 py-1 text-sm border rounded text-red-600"
            title="Remove current file"
          >
            Remove
          </button>
        )}

        {/* Page nav */}
        {currentImages.length > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <button type="button" onClick={() => setCurrentPageIdx((p) => Math.max(0, p - 1))} className="px-2 border rounded">‹</button>
            <span>{currentPageIdx + 1}/{currentImages.length}</span>
            <button type="button" onClick={() => setCurrentPageIdx((p) => Math.min(currentImages.length - 1, p + 1))} className="px-2 border rounded">›</button>
          </div>
        )}

        {/* Pending filter */}
        {currentAnnotations.some((a)=>a.pendingValidation) && (
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={showPendingOnly} onChange={(e)=>setShowPendingOnly(e.target.checked)} />
            Pending only
          </label>
        )}

        {/* Object selector */}
        {primaryObjects.length ? (
          <select
            value={selectedObject}
            onChange={(e) => setSelectedObject(e.target.value)}
            className="border rounded p-1 text-sm ml-auto"
          >
            {/* Default to first primary object; no explicit "No Object" option now */}
            {primaryObjects.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name} ({objectCounts[o.name] || 0})
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Main content area: thumbnails + page + sidebar */}
      <div className="flex w-full gap-4">
        {/* Thumbnails */}
        <aside className="w-28 border-r pr-2">
          <Thumbnails images={currentImages} current={currentPageIdx} onSelect={setCurrentPageIdx} />
        </aside>

        {/* Single page area */}
        <section className="flex-1 flex flex-col gap-4">
          {currentImages[currentPageIdx] && (
            <ImageAnnotator
              key={currentPageIdx}
              src={currentImages[currentPageIdx]}
              pageIndex={currentPageIdx}
              selectedObject={selectedObject}
              annotations={pageAnnotations}
              onAddAnnotation={handleAddAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              highlightedId={highlightId}
              debug={debugMode}
              textBoxes={currentTextItems[currentPageIdx] || []}
            />
          )}
        </section>

        {/* Sidebar */}
        <aside className="w-64 border-l pl-4 overflow-y-auto max-h-screen">
          <h2 className="text-lg font-semibold mb-2">Annotations</h2>
          {sidebarAnnotations.length ? (
            <ul className="flex flex-col gap-2">
              {sidebarAnnotations.map((ann) => (
                <li key={ann.id}>
                  <button
                    type="button"
                    className={`text-left w-full px-2 py-1 rounded ${
                      ann.id === highlightId ? "bg-blue-100" : "hover:bg-gray-100"
                    }`}
                    onClick={() => {
                      // Prevent opening inspector if annotation is still processing
                      if (ann.ocrPending || ann.openaiPending) {
                        if (typeof window !== 'undefined') {
                          // eslint-disable-next-line no-alert
                          window.alert('This annotation is still processing. Please wait until it finishes before opening.');
                        }
                        return;
                      }
                      // Switch to the correct page if necessary
                      if (ann.pageIndex !== currentPageIdx) {
                        setCurrentPageIdx(ann.pageIndex);
                      }
                      // Always open inspector, even if the same annotation is selected again
                      if (ann.id !== highlightId) {
                        setHighlightId(ann.id);
                      } else {
                        setInspectorOpen(true);
                      }
                    }}
                  >
                    {/* Pending indicators */}
                    {(ann.ocrPending || ann.openaiPending) && (
                      <span className="inline-block align-middle mr-1">
                        {ann.ocrPending ? (
                          <span className="inline-block w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="inline-block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </span>
                    )}
                    {ann.pendingValidation && (
                      <span className="inline-block align-middle mr-1 text-orange-600" title="Pending validation">⚠️</span>
                    )}
                    {ann.humanRevised && !ann.pendingValidation && (
                      <span className="inline-block align-middle mr-1 text-green-700" title="Reviewed">✔️</span>
                    )}
                    Pg {ann.pageIndex + 1} – {ann.objectName}
                    {ann.text ? (debugMode ? `: ${ann.text}` : `: ${ann.text.slice(0, 30)}...`) : ""}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">No annotations yet.</p>
          )}
        </aside>
      </div>

      {/* Inspector slide-over */}
      <AnnotationInspector
        open={inspectorOpen}
        onClose={handleInspectorClose}
        annotation={currentAnnotations.find((a) => a.id === highlightId)}
        objectDef={objects.find((o) => o.name === (currentAnnotations.find((a)=>a.id===highlightId)?.objectName))}
        registry={objects}
        onSave={handleValuesChange}
        onToggleReviewed={handleToggleReviewed}
      />
    </div>
  );
} 