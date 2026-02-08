/**
 * API Key Settings Modal Component
 *
 * Modal dialog for configuring the Gemini API key.
 */

import React from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  apiKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  apiKey,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-key text-indigo-500" aria-hidden="true"></i>
            API Key Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close settings"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Enter your Google Gemini API key to use the analysis features. Your key is stored
          locally in your browser and never sent to our servers.
        </p>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="api-key-input"
              className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
            >
              Gemini API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              placeholder="Enter your API key..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
              value={apiKey}
              onChange={(e) => onSave(e.target.value)}
            />
          </div>
          {apiKey && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
              <span>API key saved locally</span>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">Don't have an API key?</strong><br />
              Get one free from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
