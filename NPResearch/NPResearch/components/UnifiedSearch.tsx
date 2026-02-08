/**
 * Unified Search Component
 *
 * Single search box that finds organizations across ProPublica and DDS providers.
 * Replaces the multi-step manual workflow.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  searchOrganizations,
  SearchResult,
} from '../services/organizationService';
import OrganizationCard from './OrganizationCard';

// Debounce delay for search input
const SEARCH_DEBOUNCE_MS = 400;

interface UnifiedSearchProps {
  onGenerateDossier: (org: SearchResult) => void;
  isGenerating: boolean;
}

const UnifiedSearch: React.FC<UnifiedSearchProps> = ({
  onGenerateDossier,
  isGenerating,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        const searchResults = await searchOrganizations(query, 'CT');
        setResults(searchResults);
        setHasSearched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setError(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
          <i className="fa-solid fa-magnifying-glass text-indigo-500"></i>
          Find Organization
        </h2>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by organization name (e.g., MARCH Inc)..."
            className="w-full px-4 py-4 pl-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            value={query}
            onChange={handleInputChange}
            aria-label="Search for nonprofit organizations"
          />
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>

          {query && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Clear search"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Search Connecticut nonprofits. Results show Form 990 data from ProPublica and DDS provider matches.
        </p>

        {/* Search Status */}
        {isSearching && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            Searching...
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation"></i>
            {error}
          </div>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && !isSearching && (
        <div className="space-y-4">
          {results.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
              <i className="fa-solid fa-building-circle-xmark text-4xl text-slate-300 mb-3"></i>
              <p className="text-slate-600 font-medium">No organizations found</p>
              <p className="text-sm text-slate-400 mt-1">
                Try a different search term or check the spelling
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Found <span className="font-semibold text-slate-700">{results.length}</span> organization{results.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid gap-4">
                {results.map((org) => (
                  <OrganizationCard
                    key={org.ein}
                    organization={org}
                    onGenerateDossier={() => onGenerateDossier(org)}
                    isGenerating={isGenerating}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Initial State - No Search Yet */}
      {!hasSearched && !isSearching && !query && (
        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 p-8 rounded-2xl border border-indigo-100 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-building-columns text-2xl text-indigo-500"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Streamlined Data Collection
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Search for a Connecticut nonprofit above. We'll automatically fetch their Form 990 from ProPublica,
            Provider Profile from DDS, and Quality Report — all with one click.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-file-invoice-dollar text-green-500"></i>
              Form 990
            </div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-id-card text-blue-500"></i>
              Provider Profile
            </div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-clipboard-check text-purple-500"></i>
              Quality Report
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedSearch;
