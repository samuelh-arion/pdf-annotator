// src/components/DiffPreviewModal.jsx
"use client";

import { useEffect } from 'react';

export default function DiffPreviewModal({ open, summary = [], onConfirm = () => {}, onCancel = () => {} }) {
  useEffect(() => {
    const esc = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    if (open) document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white w-[90vw] max-w-2xl max-h-[80vh] overflow-y-auto rounded shadow-xl p-6 z-10">
        <h2 className="text-lg font-semibold mb-4">Confirm Annotation Migration</h2>
        {summary.length ? (
          <ul className="text-sm list-disc pl-5 max-h-64 overflow-y-auto mb-4">
            {summary.map((item, idx) => (
              <li key={idx} className="mb-1">
                <span className="font-mono">{item.fileId}</span> page {item.page} – ann <span className="font-mono">{item.annotationId.slice(0,6)}</span>: {item.action || 'update'} {item.changes?.length ? `(${item.changes.join(', ')})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>No annotations affected.</p>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" className="px-4 py-2 rounded bg-gray-300" onClick={onCancel}>Cancel</button>
          <button type="button" className="px-4 py-2 rounded bg-green-600 text-white" onClick={onConfirm}>Apply</button>
        </div>
      </div>
    </div>
  );
} 