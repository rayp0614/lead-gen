import React, { useEffect, useMemo, useState } from 'react';

type Town = { name: string; pdf_url: string };
type Provider = { name: string; url: string };

type Props = {
  apiBaseUrl?: string;
  title?: string;
};

const DEFAULT_API_BASE =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ||
  (import.meta as { env?: Record<string, string> }).env?.VITE_DDS_API_BASE_URL ||
  'http://localhost:8000';

const DDSProviderWidget: React.FC<Props> = ({ apiBaseUrl = DEFAULT_API_BASE, title }) => {
  const [towns, setTowns] = useState<Town[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('Loading towns...');
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [includeQualityReports, setIncludeQualityReports] = useState(true);

  const providersCount = providers.length;

  const hasSelection = useMemo(() => selectedUrls.size > 0, [selectedUrls]);

  useEffect(() => {
    let mounted = true;
    const loadTowns = async () => {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/towns`);
        if (!resp.ok) {
          throw new Error('Failed to load towns');
        }
        const data = await resp.json();
        if (mounted) {
          setTowns(data.towns || []);
          setStatus('Ready.');
        }
      } catch (err) {
        if (mounted) {
          setStatus('Failed to load towns. Check API.');
        }
      }
    };
    loadTowns();
    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  const toggleProvider = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedUrls(new Set(providers.map((p) => p.url)));
  };

  const clearAll = () => {
    setSelectedUrls(new Set());
  };

  const loadProviders = async (town: string) => {
    if (!town) {
      setProviders([]);
      setSelectedUrls(new Set());
      setStatus('Select a town to see providers.');
      return;
    }
    setLoadingProviders(true);
    setStatus(`Loading providers for ${town}...`);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/providers?town=${encodeURIComponent(town)}`);
      if (!resp.ok) {
        throw new Error('Failed to load providers');
      }
      const data = await resp.json();
      setProviders(data.providers || []);
      setSelectedUrls(new Set());
      setStatus(`Loaded ${data.providers?.length || 0} providers.`);
    } catch (err) {
      setProviders([]);
      setSelectedUrls(new Set());
      setStatus('Failed to load providers for that town.');
    } finally {
      setLoadingProviders(false);
    }
  };

  // Helper to download a base64 PDF
  const downloadBase64Pdf = (base64Data: string, filename: string) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const downloadSelected = async () => {
    if (!hasSelection) {
      setStatus('Select at least one provider.');
      return;
    }
    setDownloading(true);
    const selected = providers.filter((p) => selectedUrls.has(p.url));
    const totalExpected = includeQualityReports ? selected.length * 2 : selected.length;
    setStatus(`Downloading up to ${totalExpected} PDF(s)...`);

    let downloadedCount = 0;
    let qualityCount = 0;

    for (const provider of selected) {
      try {
        if (includeQualityReports) {
          // Use new endpoint that fetches both provider + quality report
          const resp = await fetch(
            `${apiBaseUrl}/api/fetch-provider-with-quality?url=${encodeURIComponent(
              provider.url
            )}&name=${encodeURIComponent(provider.name)}`
          );
          if (!resp.ok) {
            throw new Error('Failed to fetch provider with quality');
          }
          const data = await resp.json();

          // Download provider PDF
          if (data.provider_pdf) {
            downloadBase64Pdf(data.provider_pdf, `${provider.name}.pdf`);
            downloadedCount++;
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          // Download quality report if available
          if (data.quality_pdf) {
            downloadBase64Pdf(data.quality_pdf, `${provider.name}_QualityReport.pdf`);
            qualityCount++;
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        } else {
          // Original behavior - just fetch provider PDF
          const resp = await fetch(
            `${apiBaseUrl}/api/fetch-pdf?url=${encodeURIComponent(provider.url)}&name=${encodeURIComponent(
              provider.name
            )}`
          );
          if (!resp.ok) {
            throw new Error('Failed');
          }
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${provider.name}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(blobUrl);
          downloadedCount++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch {
        setStatus(`Failed to download ${provider.name}.`);
      }
    }
    setDownloading(false);
    const qualityMsg = includeQualityReports ? ` (${qualityCount} quality reports)` : '';
    setStatus(`Downloaded ${downloadedCount} provider PDF(s)${qualityMsg}.`);
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <i className="fa-solid fa-map-location-dot text-emerald-500"></i>
          {title || 'DDS Provider Finder'}
        </h2>
        <span className="text-xs text-slate-400">API: {apiBaseUrl}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Town
          </label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            value={selectedTown}
            onChange={(e) => {
              const town = e.target.value;
              setSelectedTown(town);
              loadProviders(town);
            }}
          >
            <option value="">Select a town</option>
            {towns.map((town) => (
              <option key={town.name} value={town.name}>
                {town.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">{status}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-2 text-xs font-semibold rounded-full border border-slate-200"
              disabled={!providersCount}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-2 text-xs font-semibold rounded-full border border-slate-200"
              disabled={!providersCount}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={downloadSelected}
              className="px-3 py-2 text-xs font-semibold rounded-full bg-emerald-600 text-white disabled:bg-emerald-300"
              disabled={!hasSelection || downloading}
            >
              {downloading ? 'Downloading...' : 'Download selected'}
            </button>
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 text-emerald-600 rounded"
              checked={includeQualityReports}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeQualityReports(e.target.checked)}
            />
            <span className="text-xs text-slate-600">
              Include Quality Reports
            </span>
            <span className="text-xs text-slate-400" title="Downloads the Quality Service Review PDF linked in each provider profile">
              <i className="fa-solid fa-circle-info"></i>
            </span>
          </label>
        </div>
        <div className="lg:col-span-2 max-h-80 overflow-auto space-y-2">
          {loadingProviders ? (
            <div className="text-sm text-slate-500">Loading providers...</div>
          ) : providersCount === 0 ? (
            <div className="text-sm text-slate-400 italic">No providers loaded.</div>
          ) : (
            providers.map((provider) => (
              <label
                key={provider.url}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 text-emerald-600"
                  checked={selectedUrls.has(provider.url)}
                  onChange={() => toggleProvider(provider.url)}
                />
                <span className="text-sm text-slate-700">{provider.name}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default DDSProviderWidget;
