/**
 * Export Panel Component
 *
 * Provides export options for analysis results.
 * Primary: CSV download for spreadsheet/CRM import.
 */

import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import {
  exportToCSV,
  downloadCSV,
  copyToClipboard,
  formatAsText
} from '../services/exportService';

interface ExportPanelProps {
  result: AnalysisResult | null;
  websiteUrl?: string;
  orgName?: string;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  result,
  websiteUrl,
  orgName
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  if (!result) {
    return null;
  }

  const handleDownloadCSV = () => {
    const csv = exportToCSV(result, { websiteUrl });
    const filename = orgName
      ? `${orgName.replace(/[^a-zA-Z0-9]/g, '_')}_lead.csv`
      : 'lead-export.csv';
    downloadCSV(csv, filename);
  };

  const handleCopyToClipboard = async () => {
    const text = formatAsText(result, websiteUrl);
    const success = await copyToClipboard(text);
    setCopyStatus(success ? 'copied' : 'error');

    // Reset status after 2 seconds
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const getCopyButtonText = () => {
    switch (copyStatus) {
      case 'copied':
        return 'Copied!';
      case 'error':
        return 'Failed';
      default:
        return 'Copy Summary';
    }
  };

  const getCopyButtonIcon = () => {
    switch (copyStatus) {
      case 'copied':
        return 'fa-check';
      case 'error':
        return 'fa-xmark';
      default:
        return 'fa-clipboard';
    }
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
        <i className="fa-solid fa-download text-indigo-500"></i>
        Export
      </h2>

      <div className="flex flex-wrap gap-3">
        {/* Primary: CSV Download */}
        <button
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors"
        >
          <i className="fa-solid fa-file-csv"></i>
          Download CSV
        </button>

        {/* Secondary: Copy to Clipboard */}
        <button
          onClick={handleCopyToClipboard}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors border ${
            copyStatus === 'copied'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : copyStatus === 'error'
              ? 'bg-red-100 text-red-700 border-red-300'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <i className={`fa-solid ${getCopyButtonIcon()}`}></i>
          {getCopyButtonText()}
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        CSV includes: Organization info, financials, quality scores, decision maker, pain points, and pitch angles.
      </p>
    </section>
  );
};

export default ExportPanel;
