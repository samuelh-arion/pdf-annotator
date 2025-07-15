"use client";

import { useEffect } from "react";
import ValuesEditor from "./ValuesEditor";

export default function AnnotationInspector({ open, onClose = () => {}, annotation, objectDef, registry, onSave = () => {}, onToggleReviewed = () => {} }) {
  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", esc);
    }
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open || !annotation) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* panel */}
      <div className="w-96 bg-white shadow-xl p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Pg {annotation.pageIndex + 1} – {annotation.objectName}</h2>
        {annotation.pendingValidation && (
          <p className="text-orange-600 text-sm mb-2">This annotation requires validation due to major object changes.</p>
        )}
        <label className="flex items-center gap-2 mb-2 text-sm">
          <input type="checkbox" checked={annotation.humanRevised || false} onChange={(e)=> onToggleReviewed(e.target.checked)} />
          Mark as reviewed
        </label>
        <ValuesEditor
          objectDef={objectDef}
          values={annotation.values || {}}
          onChange={onSave}
          registry={registry}
        />
        <div className="flex gap-2 mt-4">
          <button type="button" className="bg-green-600 text-white px-3 py-1 rounded" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
} 