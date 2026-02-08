/**
 * Organization Card Component
 *
 * Displays a search result with data availability badges
 * and one-click "Generate Dossier" button.
 */

import React from 'react';
import { SearchResult } from '../services/organizationService';

interface OrganizationCardProps {
  organization: SearchResult;
  onGenerateDossier: () => void;
  isGenerating: boolean;
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({
  organization,
  onGenerateDossier,
  isGenerating,
}) => {
  const hasDDS = !!organization.dds_provider;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-lg truncate">
              {organization.name}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {organization.city}, {organization.state} &middot; EIN: {organization.ein}
            </p>
          </div>

          {/* NTEE Code Badge */}
          {organization.ntee_code && (
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-mono rounded">
              {organization.ntee_code}
            </span>
          )}
        </div>

        {/* Data Availability Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {/* Form 990 Badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            organization.has_form990
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-slate-50 text-slate-400 border border-slate-200'
          }`}>
            <i className={`fa-solid ${organization.has_form990 ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            Form 990
          </span>

          {/* DDS Provider Badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            hasDDS
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-slate-50 text-slate-400 border border-slate-200'
          }`}>
            <i className={`fa-solid ${hasDDS ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            DDS Provider
          </span>

          {/* Quality Report Badge (only if DDS provider exists) */}
          {hasDDS && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
              <i className="fa-solid fa-circle-check"></i>
              Quality Report
            </span>
          )}
        </div>

        {/* DDS Provider Info */}
        {hasDDS && organization.dds_provider && (
          <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-600 font-medium">
              <i className="fa-solid fa-building-user mr-1.5"></i>
              DDS Provider Match: {organization.dds_provider.name}
              <span className="text-blue-400 ml-1">({organization.dds_provider.town})</span>
            </p>
          </div>
        )}

        {/* No DDS Match Notice */}
        {!hasDDS && (
          <div className="mt-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
            <p className="text-xs text-amber-600">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
              Not found in DDS provider list. Dossier will use Form 990 data only.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
        {/* External Links */}
        <div className="flex items-center gap-3">
          <a
            href={organization.propublica_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
            ProPublica
          </a>
          {hasDDS && organization.dds_provider && (
            <a
              href={organization.dds_provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
              DDS Profile
            </a>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerateDossier}
          disabled={isGenerating}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
            isGenerating
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm hover:shadow'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Generating...
            </>
          ) : (
            <>
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Generate Dossier
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OrganizationCard;
