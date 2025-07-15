"use client";

import { useState } from 'react';
import { storeAllData, downloadAllDataZip, importDataFromZip } from '../utils/importExportAll';

export default function ImportExportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openDialog = () => {
    setErrorMsg('');
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
  };

  const handleExport = async () => {
    try {
      await downloadAllDataZip();
      setIsOpen(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMsg(err.message || 'Export failed');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.endsWith('.zip')) {
        await importDataFromZip(file);
      } else {
        // Legacy JSON support
        const text = await file.text();
        const data = JSON.parse(text);
        await storeAllData(data);
      }
      // Force refresh so that other components pick up new data
      window.location.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMsg('Invalid file format');
    }
  };

  return (
    <>
      <button type="button" onClick={openDialog} className="text-gray-700 hover:text-blue-600">
        Import/Export
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 relative space-y-6">
            <h2 className="text-lg font-semibold">Import / Export All Data</h2>

            {/* Export section */}
            <div className="border rounded p-4 flex flex-col gap-3">
              <p className="text-sm">Download all stored data (object registry, annotations, PDFs &amp; images) as ZIP.</p>
              <button
                type="button"
                onClick={handleExport}
                className="bg-blue-600 text-white px-3 py-1 rounded self-start"
              >
                Download ZIP
              </button>
            </div>

            {/* Import section */}
            <div className="border rounded p-4 flex flex-col gap-3">
              <p className="text-sm">Import data from a previously exported ZIP (or legacy JSON) file.</p>
              <input type="file" accept=".zip,application/zip,application/json" onChange={handleImportFile} />
              <p className="text-xs text-gray-500">
                Import will overwrite your current local data. The page will reload automatically.
              </p>
            </div>

            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeDialog}
                className="bg-gray-500 text-white px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 