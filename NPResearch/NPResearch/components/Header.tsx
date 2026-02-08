/**
 * Header Component
 *
 * Application header with logo, settings, and lead list toggle.
 */

import React from 'react';
import { AnalysisStatus } from '../types';

interface HeaderProps {
  apiKey: string;
  savedLeadsCount: number;
  showLeadList: boolean;
  status: AnalysisStatus;
  onReset: () => void;
  onToggleApiKey: () => void;
  onToggleLeadList: () => void;
}

const Header: React.FC<HeaderProps> = ({
  apiKey,
  savedLeadsCount,
  showLeadList,
  status,
  onReset,
  onToggleApiKey,
  onToggleLeadList,
}) => {
  return (
    <header className="bg-slate-900 text-white py-6 px-4 shadow-xl mb-8 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <button
          type="button"
          className="flex items-center gap-4 cursor-pointer bg-transparent border-none"
          onClick={onReset}
          aria-label="Reset and return to start"
        >
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fa-solid fa-file-invoice-dollar text-xl" aria-hidden="true"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Lead Gen Dossier</h1>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleApiKey}
            className={`p-2 rounded-lg text-sm font-semibold transition-all border ${
              apiKey
                ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                : 'bg-amber-600/20 border-amber-500/30 text-amber-400 hover:bg-amber-600/30'
            }`}
            aria-label={apiKey ? 'API key configured - click to change' : 'Configure API key'}
            title={apiKey ? 'API key configured' : 'API key required'}
          >
            <i className={`fa-solid ${apiKey ? 'fa-key' : 'fa-gear'}`} aria-hidden="true"></i>
          </button>
          <button
            onClick={onToggleLeadList}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border border-slate-700 relative"
            aria-expanded={showLeadList}
            aria-label={`${showLeadList ? 'Hide' : 'Show'} saved leads (${savedLeadsCount} saved)`}
          >
            <i className="fa-solid fa-list-ul" aria-hidden="true"></i>
            My Leads
            {savedLeadsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-indigo-600 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-lg">
                {savedLeadsCount}
              </span>
            )}
          </button>
          {status === AnalysisStatus.COMPLETED && (
            <button
              onClick={onReset}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold transition-colors"
            >
              New Analysis
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
