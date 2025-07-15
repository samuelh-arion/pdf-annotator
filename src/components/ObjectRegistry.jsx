"use client";

import { useState, useEffect } from 'react';
import ObjectBuilder from './ObjectBuilder';
import DiffPreviewModal from './DiffPreviewModal';
import { migrateAnnotations } from '../utils/migrateAnnotations';
import { diffObjects } from '../utils/objectDiff';

export default function ObjectRegistry() {
  // Helper to load & normalise the registry from localStorage
  const loadObjectsFromStorage = () => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('objectRegistry') || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
    } catch {
      return [];
    }
  };

  // To ensure the server-rendered HTML matches the initial client render and avoid hydration
  // mismatches, always initialise with an empty array. We load the actual data from
  // localStorage in the useEffect below once the component has mounted on the client.
  const [objects, setObjects] = useState([]);
  const [initialised, setInitialised] = useState(false); // track first load complete

  // Index of object currently being edited; null when creating new; -1 when not editing
  const [editingIndex, setEditingIndex] = useState(-1);

  // Diff modal state
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffSummary, setDiffSummary] = useState([]);
  const [pendingUpdate, setPendingUpdate] = useState(null); // {oldObj,newObj,updatedPdfData,objectsAfter}

  // Reload from storage on mount & when the tab regains focus OR storage event fires (other tab)
  useEffect(() => {
    // Function used in several places
    const refresh = () => {
      setObjects(loadObjectsFromStorage());
      setInitialised(true);
    };

    // One-time initial load in case state was initialised on the server
    refresh();

    // Refresh when window re-focuses (navigation back or tab switch)
    window.addEventListener('focus', refresh);

    // Refresh when objectRegistry is changed from another tab
    const onStorage = (e) => {
      if (e.key === 'objectRegistry') {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Persist whenever objects change (skip the very first render before init)
  useEffect(() => {
    if (!initialised) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('objectRegistry', JSON.stringify(objects));
    }
  }, [objects, initialised]);

  const handleAdd = () => {
    setEditingIndex(null);
  };

  const handleSave = (obj) => {
    if (editingIndex === null) {
      // New object – version already 1 in obj
      setObjects((prev) => [...prev, obj]);
      setEditingIndex(-1);
      return;
    }

    if (editingIndex >= 0 && editingIndex < objects.length) {
      const oldObj = objects[editingIndex];

      // Compute migration preview
      try {
        const raw = localStorage.getItem('pdfData') || '{}';
        const pdfData = JSON.parse(raw);
        const { updatedPdfData, summary } = migrateAnnotations(pdfData, oldObj, obj);
        const subDiff = obj.isSubobject ? diffObjects(oldObj, obj) : null;

        let combinedPdfData = updatedPdfData;
        let combinedSummary = [...summary];
        let updatedObjects = [...objects];
        updatedObjects[editingIndex] = obj;

        // If the edited object is (or remains) a subobject, propagate to parents
        if (obj.isSubobject) {
          const oldSubName = oldObj.name;
          const newSubName = obj.name;

          // Find parent objects referencing this subobject (old name or new name, in case name unchanged)
          const parentsIdx = updatedObjects.reduce((acc, o, idx) => {
            if (idx === editingIndex) return acc; // skip the subobject itself
            const refsOld = o.fields.some((f) => f.type === oldSubName || f.type === `array_${oldSubName}`);
            const refsNew = newSubName !== oldSubName && (o.fields.some((f) => f.type === newSubName || f.type === `array_${newSubName}`));
            if (refsOld || refsNew) acc.push(idx);
            return acc;
          }, []);

          parentsIdx.forEach((pIdx) => {
            const parentOld = updatedObjects[pIdx];

            // If subobject change is minor (e.g., renameField), propagate those changes into nested values
            if (subDiff && subDiff.classification === 'minor') {
              const renameOps = subDiff.minorOps.filter((op) => op.type === 'renameField');
              if (renameOps.length) {
                Object.entries(combinedPdfData).forEach(([, entry]) => {
                  entry.annotations.forEach((ann) => {
                    if (ann.objectName !== parentOld.name) return;
                    const newVals = { ...ann.values };
                    let touched = false;
                    parentOld.fields.forEach((fld) => {
                      const baseType = fld.type.startsWith('array_') ? fld.type.replace('array_', '') : fld.type;
                      if (baseType !== oldSubName) return;
                      const val = newVals[fld.name];
                      if (!val) return;
                      renameOps.forEach((op) => {
                        const applyRename = (obj) => {
                          if (obj && typeof obj === 'object' && op.from in obj) {
                            obj[op.to] = obj[op.from];
                            delete obj[op.from];
                            touched = true;
                          }
                        };
                        if (Array.isArray(val)) {
                          val.forEach(applyRename);
                        } else {
                          applyRename(val);
                        }
                      });
                    });
                    if (touched) {
                      ann.values = newVals;
                    }
                  });
                });
              }
            }

            // Clone and update field types if subobject was renamed
            let parentUpdatedFields = parentOld.fields;
            if (oldSubName !== newSubName) {
              parentUpdatedFields = parentOld.fields.map((f) => {
                if (f.type === oldSubName) return { ...f, type: newSubName };
                if (f.type === `array_${oldSubName}`) return { ...f, type: `array_${newSubName}` };
                return f;
              });
            }

            const parentNew = {
              ...parentOld,
              version: (parentOld.version || 1) + 1,
              fields: parentUpdatedFields,
            };

            // Mark as major only if the subobject diff was major
            if (subDiff && subDiff.classification === 'major') {
              parentNew.migrationOps = [{ op: 'typeChange', field: '__subobjectUpdate', from: 'none', to: 'none' }];
            }

            const { updatedPdfData: updPdf, summary: sum } = migrateAnnotations(
              combinedPdfData,
              parentOld,
              parentNew,
            );
            combinedPdfData = updPdf;
            combinedSummary = [...combinedSummary, ...sum];
            updatedObjects[pIdx] = parentNew;
          });
        }

        if (combinedSummary.length === 0) {
          // No annotations affected – save immediately
          setObjects(updatedObjects);
          localStorage.setItem('pdfData', JSON.stringify(combinedPdfData));
          setEditingIndex(-1);
          return;
        }

        setPendingUpdate({ oldObj, newObj: obj, updatedPdfData: combinedPdfData, objectsAfter: updatedObjects });
        setDiffSummary(combinedSummary);
        setDiffModalOpen(true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Migration preview failed', e);
        // Fallback – just save
        setObjects((prev) => {
          const copy = [...prev];
          copy[editingIndex] = obj;
          return copy;
        });
        setEditingIndex(-1);
      }
      return;
    }

    // default fallback
    setEditingIndex(-1);
  };

  const handleCancel = () => {
    setEditingIndex(-1);
  };

  const handleDelete = (idx) => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Are you sure you want to delete this object?')) {
      setObjects((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleEdit = (idx) => {
    setEditingIndex(idx);
  };

  const applyPendingUpdate = () => {
    if (!pendingUpdate) return;
    try {
      // Persist objects
      setObjects(pendingUpdate.objectsAfter);
      // Persist updated pdfData
      localStorage.setItem('pdfData', JSON.stringify(pendingUpdate.updatedPdfData));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to apply migration', e);
    }
    setDiffModalOpen(false);
    setEditingIndex(-1);
    setPendingUpdate(null);
  };

  const cancelPendingUpdate = () => {
    setDiffModalOpen(false);
    setPendingUpdate(null);
    // Keep editing state to allow user to continue editing or cancel
  };

  // Determine subobject names for builder (all other object names)
  const subobjectNames = objects.map((o) => o.name);

  const initialData = editingIndex === null || editingIndex === -1 ? null : objects[editingIndex];

  return (
    <>
      {editingIndex !== -1 ? (
        <ObjectBuilder
          subobjectNames={subobjectNames.filter((name, idx) => idx !== editingIndex)}
          initialData={initialData}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {objects.length ? (
            <div className="flex flex-col gap-4">
              {objects.map((obj, idx) => (
                <div
                  key={obj.name + idx}
                  className="border p-4 rounded flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{obj.name}</p>
                    <p className="text-sm text-gray-600">{obj.fields.length} fields</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(idx)}
                      className="bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="italic text-gray-600">No objects saved yet.</p>
          )}

          <button
            type="button"
            onClick={handleAdd}
            className="self-start bg-green-600 text-white px-4 py-2 rounded"
          >
            + Add Object
          </button>
        </div>
      )}

      {/* Diff preview modal should always be mounted at root level so it can overlay both list and builder views */}
      <DiffPreviewModal
        open={diffModalOpen}
        summary={diffSummary}
        onConfirm={applyPendingUpdate}
        onCancel={cancelPendingUpdate}
      />
    </>
  );
} 