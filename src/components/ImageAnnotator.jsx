"use client";

// New component to allow drawing bounding box annotations on an image
// Supports selecting an object type before drawing. On mouse drag it will
// create a rectangle and report it back via onAddAnnotation callback in
// relative coordinates (0–1) so that annotations remain correct even when
// the image is resized.

import { useRef, useState } from "react";

export default function ImageAnnotator({
  src,
  pageIndex,
  selectedObject,
  annotations = [],
  onAddAnnotation = () => {},
  onDeleteAnnotation = () => {},
  highlightedId = null,
  debug = false,
  textBoxes = [], // for debug: array of {x,y,width,height}
}) {
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(null); // {startX,startY,currentX,currentY}

  const handleMouseDown = (e) => {
    if (!selectedObject) return; // Ignore if no object selected
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawing((prev) => ({ ...prev, currentX: x, currentY: y }));
  };

  const finishDrawing = () => {
    if (!drawing || !containerRef.current) {
      setDrawing(null);
      return;
    }

    const { startX, startY, currentX, currentY } = drawing;
    const rect = containerRef.current.getBoundingClientRect();

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Ignore tiny rectangles
    if (width < 3 || height < 3) {
      setDrawing(null);
      return;
    }

    // Convert to relative percentages (0-1)
    const rel = {
      x: x / rect.width,
      y: y / rect.height,
      width: width / rect.width,
      height: height / rect.height,
    };

    onAddAnnotation({ pageIndex, objectName: selectedObject, ...rel });
    setDrawing(null);
  };

  // Compute rectangles to render (existing + temp drawing)
  const renderRects = () => {
    const allRects = [...annotations];
    if (drawing && containerRef.current) {
      const { startX, startY, currentX, currentY } = drawing;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.min(startX, currentX) / rect.width;
      const y = Math.min(startY, currentY) / rect.height;
      const width = Math.abs(currentX - startX) / rect.width;
      const height = Math.abs(currentY - startY) / rect.height;
      allRects.push({ x, y, width, height, objectName: selectedObject, temp: true });
    }
    return allRects;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-auto border rounded shadow cursor-crosshair"
      style={{ outline: debug ? '1px dashed #d1d5db' : 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishDrawing}
      onMouseLeave={finishDrawing}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`PDF page ${pageIndex + 1}`}
        className="w-full h-auto select-none"
        draggable="false"
        onDragStart={(e) => e.preventDefault()}
      />

      {/* Debug: draw bounding boxes of each text element */}
      {debug &&
        textBoxes.map((tb, idx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="absolute border border-blue-300 opacity-50 pointer-events-none"
            style={{
              left: `${tb.x * 100}%`,
              top: `${tb.y * 100}%`,
              width: `${tb.width * 100}%`,
              height: `${tb.height * 100}%`,
            }}
          />
        ))}

      {/* Overlay annotations */}
      {renderRects().map((ann, idx) => {
        const isHighlighted = ann.id && ann.id === highlightedId;
        const commonStyle = {
          left: `${ann.x * 100}%`,
          top: `${ann.y * 100}%`,
          width: `${ann.width * 100}%`,
          height: `${ann.height * 100}%`,
          borderColor: ann.temp
            ? "#fbbf24" /* yellow-400 */
            : isHighlighted
            ? "#2563eb" /* blue-600 */
            : "#ef4444", /* red-500 */
        };

        if (ann.temp) {
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className="absolute border-2 rounded pointer-events-none"
              style={commonStyle}
            />
          );
        }

        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="absolute border-2 rounded pointer-events-none"
            style={commonStyle}
          >
            {/* Label */}
            <span className="absolute -top-5 left-0 bg-red-500 text-white text-xs px-1 rounded pointer-events-none flex items-center gap-1">
              {ann.ocrPending && (
                <span className="inline-block w-3 h-3 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin" />
              )}
              {ann.openaiPending && !ann.ocrPending && (
                <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              )}
              {ann.objectName}
            </span>
            {/* Delete button */}
            <button
              type="button"
              aria-label="Delete annotation"
              className="absolute -top-5 right-0 bg-gray-700 text-white text-xs px-1 rounded pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteAnnotation(ann.id);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

ImageAnnotator.defaultProps = {
  selectedObject: null,
  annotations: [],
  onAddAnnotation: () => {},
  highlightedId: null,
  debug: false,
  textBoxes: [],
} 