/**
 * Source Manager Component
 *
 * NotebookLM-style source management interface.
 * Users provide sources (990s, QSR, Provider Profile, Website)
 * and the system analyzes what they give - no magic guessing.
 */

import React, { useState, useCallback } from 'react';
import { UploadedFile } from '../types';
import { validateFile, fileToBase64 } from './FileUploadSection';

const API_BASE =
  (import.meta as { env?: Record<string, string> }).env?.VITE_DDS_API_BASE_URL ||
  'http://127.0.0.1:8000';

// Source types
export type SourceType = 'form990' | 'quality' | 'provider' | 'website';
export type SourceStatus = 'empty' | 'loading' | 'ready' | 'error';

export interface Source {
  type: SourceType;
  status: SourceStatus;
  files?: UploadedFile[];  // For uploaded PDFs
  url?: string;            // For website or ProPublica URL
  error?: string;
  metadata?: {
    orgName?: string;
    ein?: string;
    years?: string[];
    providerName?: string;
  };
}

export interface FinancialYear {
  year: string;
  revenue: string;
  expenses: string;
  netIncome: string;
  assets: string;
  netAssets: string;
  raw?: {
    revenue: number | null;
    expenses: number | null;
    netIncome: number | null;
    totalAssets: number | null;
    netAssets: number | null;
  };
}

export interface ProPublicaFinancials {
  ein: string;
  name: string;
  city: string;
  state: string;
  financialHistory: FinancialYear[];
  yearsAvailable: number;
  latestYear: string | null;
  propublicaUrl: string;
}

interface SourceManagerProps {
  onSourcesChange: (sources: Source[]) => void;
  onFilesReady: (files: UploadedFile[]) => void;
  onFinancialsReady: (financials: ProPublicaFinancials | null) => void;
  onWebsiteChange: (url: string) => void;
  onError: (error: string) => void;
}

const SourceManager: React.FC<SourceManagerProps> = ({
  onSourcesChange,
  onFilesReady,
  onFinancialsReady,
  onWebsiteChange,
  onError,
}) => {
  const [sources, setSources] = useState<Source[]>([
    { type: 'form990', status: 'empty' },
    { type: 'quality', status: 'empty' },
    { type: 'provider', status: 'empty' },
    { type: 'website', status: 'empty' },
  ]);

  const [propublicaUrl, setPropublicaUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [financials, setFinancials] = useState<ProPublicaFinancials | null>(null);

  // Update a specific source
  const updateSource = useCallback((type: SourceType, updates: Partial<Source>) => {
    setSources(prev => {
      const updated = prev.map(s =>
        s.type === type ? { ...s, ...updates } : s
      );
      onSourcesChange(updated);
      return updated;
    });
  }, [onSourcesChange]);

  // Collect all files from sources and notify parent
  const collectAllFiles = useCallback((currentSources: Source[]) => {
    const allFiles: UploadedFile[] = [];
    currentSources.forEach(source => {
      if (source.files) {
        allFiles.push(...source.files);
      }
    });
    onFilesReady(allFiles);
  }, [onFilesReady]);

  // Handle file uploads for a source type
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    sourceType: SourceType
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    updateSource(sourceType, { status: 'loading' });

    try {
      const newFiles: UploadedFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const validationError = validateFile(file);
        if (validationError) {
          updateSource(sourceType, { status: 'error', error: validationError });
          onError(validationError);
          return;
        }
        const base64 = await fileToBase64(file);
        newFiles.push({
          name: file.name,
          type: file.type,
          base64
        });
      }

      const existingSource = sources.find(s => s.type === sourceType);
      const existingFiles = existingSource?.files || [];
      const allFiles = [...existingFiles, ...newFiles];

      updateSource(sourceType, {
        status: 'ready',
        files: allFiles,
        error: undefined
      });

      // Collect all files and notify parent
      const updatedSources = sources.map(s =>
        s.type === sourceType ? { ...s, files: allFiles, status: 'ready' as SourceStatus } : s
      );
      collectAllFiles(updatedSources);
    } catch (err) {
      updateSource(sourceType, {
        status: 'error',
        error: 'Failed to read file'
      });
      onError('Failed to read file');
    }

    // Reset input
    e.target.value = '';
  };

  // Remove a file from a source
  const removeFile = (sourceType: SourceType, fileIndex: number) => {
    const source = sources.find(s => s.type === sourceType);
    if (!source?.files) return;

    const newFiles = source.files.filter((_, i) => i !== fileIndex);
    const newStatus = newFiles.length > 0 ? 'ready' : 'empty';

    updateSource(sourceType, {
      status: newStatus,
      files: newFiles.length > 0 ? newFiles : undefined
    });

    // Update parent with new file list
    const updatedSources = sources.map(s =>
      s.type === sourceType ? { ...s, files: newFiles.length > 0 ? newFiles : undefined, status: newStatus as SourceStatus } : s
    );
    collectAllFiles(updatedSources);
  };

  // Fetch financials from ProPublica by EIN
  const fetchProPublicaFinancials = async () => {
    // Extract EIN from URL or direct input
    let ein = propublicaUrl.trim();

    // If it's a URL, extract the EIN
    const urlMatch = propublicaUrl.match(/organizations\/(\d{9})/);
    if (urlMatch) {
      ein = urlMatch[1];
    }

    // Remove any dashes
    ein = ein.replace(/-/g, '');

    if (!/^\d{9}$/.test(ein)) {
      onError('Please enter a valid 9-digit EIN or ProPublica URL');
      return;
    }

    updateSource('form990', { status: 'loading' });

    try {
      const resp = await fetch(`${API_BASE}/api/propublica/financials/${ein}`);
      if (!resp.ok) {
        throw new Error('Organization not found');
      }
      const data: ProPublicaFinancials = await resp.json();

      setFinancials(data);
      onFinancialsReady(data);

      updateSource('form990', {
        status: 'ready',
        url: data.propublicaUrl,
        metadata: {
          orgName: data.name,
          ein: data.ein,
          years: data.financialHistory.map(f => f.year)
        }
      });
    } catch (err) {
      updateSource('form990', {
        status: 'error',
        error: 'Failed to fetch from ProPublica'
      });
      onError('Failed to fetch financial data from ProPublica');
    }
  };

  // Handle website URL change
  const handleWebsiteChange = (url: string) => {
    setWebsiteUrl(url);
    onWebsiteChange(url);

    if (url.trim()) {
      updateSource('website', { status: 'ready', url });
    } else {
      updateSource('website', { status: 'empty', url: undefined });
    }
  };

  // Count ready sources
  const readyCount = sources.filter(s => s.status === 'ready').length;
  const totalSources = sources.length;

  // Get source by type
  const getSource = (type: SourceType) => sources.find(s => s.type === type)!;

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <i className="fa-solid fa-folder-open text-indigo-500"></i>
          Sources
        </h2>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">
            {readyCount}/{totalSources} ready
          </div>
          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(readyCount / totalSources) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Form 990 / Financials Source */}
        <SourceCard
          icon="fa-file-invoice-dollar"
          iconColor="text-emerald-500"
          title="Form 990 / Financials"
          description="Upload 990 PDFs or enter ProPublica URL"
          source={getSource('form990')}
          financials={financials}
        >
          <div className="space-y-3">
            {/* ProPublica URL input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="EIN or ProPublica URL..."
                value={propublicaUrl}
                onChange={e => setPropublicaUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={fetchProPublicaFinancials}
                disabled={!propublicaUrl.trim() || getSource('form990').status === 'loading'}
                className="px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg disabled:bg-emerald-300 hover:bg-emerald-700 transition-colors"
              >
                {getSource('form990').status === 'loading' ? 'Loading...' : 'Fetch'}
              </button>
            </div>

            {/* Or divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or upload PDFs</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* File upload */}
            <FileUploadZone
              sourceType="form990"
              accept="application/pdf"
              multiple
              onFileChange={handleFileUpload}
              files={getSource('form990').files}
              onRemove={(i) => removeFile('form990', i)}
            />
          </div>
        </SourceCard>

        {/* Quality Report Source */}
        <SourceCard
          icon="fa-chart-line"
          iconColor="text-blue-500"
          title="Quality Report (QSR)"
          description="Upload Quality Service Review PDF"
          source={getSource('quality')}
        >
          <FileUploadZone
            sourceType="quality"
            accept="application/pdf"
            multiple={false}
            onFileChange={handleFileUpload}
            files={getSource('quality').files}
            onRemove={(i) => removeFile('quality', i)}
          />
        </SourceCard>

        {/* Provider Profile Source */}
        <SourceCard
          icon="fa-building"
          iconColor="text-purple-500"
          title="Provider Profile"
          description="Upload DDS Provider PDF"
          source={getSource('provider')}
        >
          <FileUploadZone
            sourceType="provider"
            accept="application/pdf"
            multiple={false}
            onFileChange={handleFileUpload}
            files={getSource('provider').files}
            onRemove={(i) => removeFile('provider', i)}
          />
        </SourceCard>

        {/* Website Source */}
        <SourceCard
          icon="fa-globe"
          iconColor="text-orange-500"
          title="Website"
          description="Organization website URL"
          source={getSource('website')}
        >
          <input
            type="url"
            placeholder="https://example.org"
            value={websiteUrl}
            onChange={e => handleWebsiteChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </SourceCard>
      </div>
    </section>
  );
};

// Sub-component: Source Card wrapper
interface SourceCardProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  source: Source;
  financials?: ProPublicaFinancials | null;
  children: React.ReactNode;
}

const SourceCard: React.FC<SourceCardProps> = ({
  icon,
  iconColor,
  title,
  description,
  source,
  financials,
  children
}) => {
  const statusColors = {
    empty: 'border-slate-200',
    loading: 'border-indigo-300 bg-indigo-50/30',
    ready: 'border-emerald-300 bg-emerald-50/30',
    error: 'border-red-300 bg-red-50/30',
  };

  const statusIcons = {
    empty: null,
    loading: <i className="fa-solid fa-spinner fa-spin text-indigo-500" />,
    ready: <i className="fa-solid fa-check-circle text-emerald-500" />,
    error: <i className="fa-solid fa-exclamation-circle text-red-500" />,
  };

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${statusColors[source.status]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className={`fa-solid ${icon} ${iconColor}`} />
          <div>
            <h3 className="text-sm font-bold text-slate-700">{title}</h3>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
        {statusIcons[source.status]}
      </div>

      {children}

      {/* Show financial preview if available */}
      {financials && source.type === 'form990' && source.status === 'ready' && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <div className="text-xs font-bold text-slate-600 mb-2">
            {financials.name} (EIN: {financials.ein})
          </div>
          <div className="text-xs text-slate-500">
            {financials.yearsAvailable} years of data ({financials.financialHistory[0]?.year} - {financials.financialHistory[financials.financialHistory.length - 1]?.year})
          </div>
        </div>
      )}

      {/* Show error if any */}
      {source.error && (
        <div className="mt-2 text-xs text-red-500">
          {source.error}
        </div>
      )}
    </div>
  );
};

// Sub-component: File upload zone
interface FileUploadZoneProps {
  sourceType: SourceType;
  accept: string;
  multiple: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, sourceType: SourceType) => void;
  files?: UploadedFile[];
  onRemove: (index: number) => void;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  sourceType,
  accept,
  multiple,
  onFileChange,
  files,
  onRemove
}) => {
  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center hover:border-indigo-400 transition-colors cursor-pointer relative">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={e => onFileChange(e, sourceType)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <i className="fa-solid fa-cloud-arrow-up text-slate-300 text-lg" />
        <p className="text-xs text-slate-500 mt-1">Drop or click</p>
      </div>

      {files && files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 overflow-hidden">
                <i className="fa-solid fa-file-pdf text-red-400 text-xs" />
                <span className="text-xs text-slate-600 truncate">{f.name}</span>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="text-slate-400 hover:text-red-500 p-1"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceManager;
