/**
 * Analyzing Spinner Component
 *
 * Loading state displayed while the AI analysis is in progress.
 */

import React from 'react';

const AnalyzingSpinner: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
      <div className="relative">
        <div className="w-32 h-32 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className="fa-solid fa-brain text-indigo-600 text-2xl animate-pulse"></i>
        </div>
      </div>
      <h2 className="text-2xl font-bold mt-8 text-slate-800 tracking-tight">
        Intelligence Gathering in Progress...
      </h2>
      <div className="mt-6 max-w-sm space-y-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-500 animate-pulse">
          <i className="fa-solid fa-check text-emerald-500"></i>
          <span>Parsing Tax Documents (Form 990)</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500 animate-pulse delay-150">
          <i className="fa-solid fa-search text-indigo-500"></i>
          <span>Deep Search: Fetching News & Sentiment</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500 animate-pulse delay-300">
          <i className="fa-solid fa-calculator text-slate-400"></i>
          <span>Calculating 5-Year Financial History</span>
        </div>
      </div>
    </div>
  );
};

export default AnalyzingSpinner;
