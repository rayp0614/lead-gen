/**
 * Web Research Section Component
 *
 * Handles website URL input and deep research toggle.
 */

import React from 'react';

interface WebResearchSectionProps {
  websiteUrl: string;
  urlError: string | null;
  deepResearch: boolean;
  onUrlChange: (url: string, error: string | null) => void;
  onDeepResearchChange: (enabled: boolean) => void;
}

const isValidUrl = (url: string): boolean => {
  if (!url) return true; // Empty is OK
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const WebResearchSection: React.FC<WebResearchSectionProps> = ({
  websiteUrl,
  urlError,
  deepResearch,
  onUrlChange,
  onDeepResearchChange,
}) => {
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const error = url && !isValidUrl(url)
      ? 'Please enter a valid URL starting with http:// or https://'
      : null;
    onUrlChange(url, error);
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
        <i className="fa-solid fa-globe text-indigo-500"></i>
        Web Research & Context
      </h2>
      <div className="space-y-6">
        <div>
          <label
            htmlFor="website-url"
            className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
          >
            Website URL
          </label>
          <input
            id="website-url"
            type="url"
            placeholder="https://organization.org"
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none text-sm ${
              urlError ? 'border-red-300 bg-red-50' : 'border-slate-200'
            }`}
            value={websiteUrl}
            onChange={handleUrlChange}
            aria-invalid={!!urlError}
            aria-describedby={urlError ? 'url-error' : undefined}
          />
          {urlError && (
            <p id="url-error" className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
              {urlError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              deepResearch ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
            }`}>
              <i className="fa-solid fa-bolt"></i>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-700">Deep Research Mode</h4>
              <p className="text-[10px] text-slate-500">
                AI will scour the web for news, sentiment, and reputation.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={deepResearch}
              onChange={(e) => onDeepResearchChange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>
    </section>
  );
};

export default WebResearchSection;
