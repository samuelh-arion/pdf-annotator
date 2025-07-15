"use client";

import { useState, useEffect } from "react";

export default function OpenAIKeyDialog() {
  // Existing key related state
  const [isOpen, setIsOpen] = useState(false);
  const [tempKey, setTempKey] = useState("");
  const [storedKey, setStoredKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("openaiApiKey") || "";
  });

  // New: model / temperature / feed-image settings --------------------------
  const DEFAULT_MODEL = "gpt-4.1-mini";
  const DEFAULT_TEMPERATURE = 0;

  const [storedModel, setStoredModel] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    return localStorage.getItem("openaiModel") || DEFAULT_MODEL;
  });
  const [storedTemperature, setStoredTemperature] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TEMPERATURE;
    const t = localStorage.getItem("openaiTemperature");
    return t !== null ? Number(t) : DEFAULT_TEMPERATURE;
  });
  const [storedFeedImage, setStoredFeedImage] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("openaiFeedImage") === "true";
  });

  // Temporary (dialog field) state
  const [tempModel, setTempModel] = useState(storedModel);
  const [tempTemperature, setTempTemperature] = useState(storedTemperature);
  const [tempFeedImage, setTempFeedImage] = useState(storedFeedImage);

  // Available models fetched from OpenAI
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Keep global variable in sync whenever stored settings change -----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (storedKey) {
      window.OPENAI_API_KEY = storedKey;
    } else {
      delete window.OPENAI_API_KEY;
    }

    window.OPENAI_MODEL = storedModel;
    window.OPENAI_TEMPERATURE = storedTemperature;
    window.OPENAI_FEED_IMAGE = storedFeedImage;
  }, [storedKey, storedModel, storedTemperature, storedFeedImage]);

  // Fetch available models whenever we have an API key ---------------------
  useEffect(() => {
    if (!storedKey) return;

    const controller = new AbortController();
    const fetchModels = async () => {
      try {
        setIsLoadingModels(true);
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${storedKey}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Failed to load models – ${res.status}`);
        const data = await res.json();
        const ids = (data?.data || [])
          .map((m) => m.id)
          .filter((id) => /^gpt-/.test(id));

        setModels(ids.sort());
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();

    return () => controller.abort();
  }, [storedKey]);

  // Handlers ---------------------------------------------------------------
  const handleSaveKey = () => {
    const key = tempKey.trim();
    if (!key) return;
    localStorage.setItem("openaiApiKey", key);
    setStoredKey(key);
    setTempKey("");
    setIsOpen(false);
  };

  const handleClearKey = () => {
    localStorage.removeItem("openaiApiKey");
    setStoredKey("");
    setTempKey("");
    setIsOpen(false);
  };

  const handleSaveSettings = () => {
    localStorage.setItem("openaiModel", tempModel);
    localStorage.setItem("openaiTemperature", String(tempTemperature));
    localStorage.setItem("openaiFeedImage", tempFeedImage ? "true" : "false");

    setStoredModel(tempModel);
    setStoredTemperature(tempTemperature);
    setStoredFeedImage(tempFeedImage);

    setIsOpen(false);
  };

  // Reset temp state whenever dialog is opened ----------------------------
  const openDialog = () => {
    setTempModel(storedModel);
    setTempTemperature(storedTemperature);
    setTempFeedImage(storedFeedImage);
    setIsOpen(true);
  };

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={openDialog}
        className="text-gray-700 hover:text-blue-600"
      >
        Settings
      </button>

      {/* Modal dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 relative space-y-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-semibold">OpenAI Settings</h2>

            {/* API Key section ------------------------------------------------*/}
            {storedKey ? (
              <div className="border rounded p-4 flex flex-col gap-3">
                <p className="text-sm text-green-700 break-all">
                  API key is stored locally.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Clear Key
                  </button>
                </div>
              </div>
            ) : (
              <div className="border rounded p-4 flex flex-col gap-3">
                <label className="text-sm font-medium">OpenAI API Key</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  className="border rounded p-2 text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="bg-gray-500 text-white px-3 py-1 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            )}

            {/* Settings section (requires key) --------------------------------*/}
            {!!storedKey && (
              <div className="border rounded p-4 flex flex-col gap-4">
                <h3 className="text-sm font-medium">Model &amp; Parameters</h3>

                {/* Model select */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm">Model</label>
                  {isLoadingModels ? (
                    <p className="text-sm text-gray-500">Loading models…</p>
                  ) : (
                    <select
                      value={tempModel}
                      onChange={(e) => setTempModel(e.target.value)}
                      className="border rounded p-2 text-sm"
                    >
                      {[...new Set([DEFAULT_MODEL, ...models])].map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Temperature */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm">Temperature (0–2)</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={tempTemperature}
                    onChange={(e) => setTempTemperature(Number(e.target.value))}
                    className="border rounded p-2 text-sm"
                  />
                </div>

                {/* Feed image */}
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tempFeedImage}
                    onChange={(e) => setTempFeedImage(e.target.checked)}
                  />
                  <span className="text-sm">Feed image to extraction</span>
                </label>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="bg-gray-500 text-white px-3 py-1 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
} 