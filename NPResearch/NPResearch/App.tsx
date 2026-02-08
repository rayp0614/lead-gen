/**
 * Lead Gen Dossier - Main Application
 *
 * Streamlined workflow: Search → One-click Generate → View Dossier
 */

import React, { useCallback } from 'react';
import { AnalysisStatus, AnalysisResult, UploadedFile } from './types';
import { analyzeOrganization } from './services/geminiService';
import { useAppState } from './hooks/useAppState';
import {
  SearchResult,
  fetchAllDocuments,
  fetchFinancials,
  base64ToUploadedFile,
} from './services/organizationService';

// Components
import Header from './components/Header';
import ApiKeyModal from './components/ApiKeyModal';
import UnifiedSearch from './components/UnifiedSearch';
import FileUploadSection from './components/FileUploadSection';
import WebResearchSection from './components/WebResearchSection';
import DDSProviderWidget from './components/DDSProviderWidget';
import AnalyzingSpinner from './components/AnalyzingSpinner';
import AnalysisDisplay from './components/AnalysisDisplay';
import LeadList from './components/LeadList';

const App: React.FC = () => {
  const { state, dispatch, saveApiKey } = useAppState();

  // Action handlers
  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const handleToggleApiKey = useCallback(() => {
    dispatch({ type: 'TOGGLE_API_KEY_INPUT' });
  }, [dispatch]);

  const handleToggleLeadList = useCallback(() => {
    dispatch({ type: 'TOGGLE_LEAD_LIST' });
  }, [dispatch]);

  const handleError = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, [dispatch]);

  const handleSaveLead = useCallback((lead: AnalysisResult) => {
    const exists = state.savedLeads.find(l => l.targetName === lead.targetName);
    if (exists) {
      alert("This organization is already in your lead list.");
      return;
    }
    dispatch({ type: 'ADD_LEAD', payload: lead });
    alert("Saved to lead list!");
  }, [dispatch, state.savedLeads]);

  const handleRemoveLead = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_LEAD', payload: id });
  }, [dispatch]);

  const handleSelectLead = useCallback((lead: AnalysisResult) => {
    dispatch({ type: 'SET_RESULT', payload: lead });
    dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.COMPLETED });
    dispatch({ type: 'SHOW_LEAD_LIST', payload: false });
  }, [dispatch]);

  // Manual upload handlers (fallback)
  const handleFilesAdd = useCallback((files: UploadedFile[]) => {
    dispatch({ type: 'ADD_FILES', payload: files });
  }, [dispatch]);

  const handleFileRemove = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_FILE', payload: index });
  }, [dispatch]);

  const handleUrlChange = useCallback((url: string, error: string | null) => {
    dispatch({ type: 'SET_WEBSITE_URL', payload: { url, error } });
  }, [dispatch]);

  const handleDeepResearchChange = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_DEEP_RESEARCH', payload: enabled });
  }, [dispatch]);

  /**
   * Unified search workflow: Fetch docs + run analysis
   */
  const handleGenerateDossier = useCallback(async (org: SearchResult) => {
    if (!state.apiKey) {
      handleError("Please enter your Gemini API key in the settings (gear icon in the header).");
      return;
    }

    dispatch({ type: 'SELECT_ORGANIZATION', payload: org });
    dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.ANALYZING });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_FETCHING_DOCS', payload: true });

    try {
      // Step 1: Fetch all documents from backend
      // Pass org name and city for DDS provider matching
      const docs = await fetchAllDocuments(
        org.ein,
        org.name,
        org.city,
        org.dds_provider?.url
      );
      dispatch({ type: 'SET_FETCHED_DOCS', payload: docs });
      dispatch({ type: 'SET_FETCHING_DOCS', payload: false });

      // Check if we have at least Form 990
      if (!docs.form990) {
        throw new Error(
          `No Form 990 available for ${org.name}. ` +
          (docs.errors.length > 0 ? docs.errors.join('; ') : '')
        );
      }

      // Step 2: Convert base64 docs to UploadedFile format
      const files: UploadedFile[] = [];

      // Add Form 990
      files.push(base64ToUploadedFile(
        docs.form990,
        `Form990_${org.ein}_${docs.form990_year || 'latest'}.pdf`
      ));

      // Add Provider Profile if available
      if (docs.provider_profile) {
        files.push(base64ToUploadedFile(
          docs.provider_profile,
          `ProviderProfile_${org.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        ));
      }

      // Add Quality Report if available (same array - Gemini figures out document types)
      if (docs.quality_report) {
        files.push(base64ToUploadedFile(
          docs.quality_report,
          `QualityReport_${org.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        ));
      }

      // Step 3: Fetch financial data directly from ProPublica API
      // This provides consistent, reliable data instead of relying on Gemini's web search
      let financials;
      try {
        console.log(`Fetching financials for EIN: ${org.ein}`);
        financials = await fetchFinancials(org.ein);
        console.log(`SUCCESS: Fetched ${financials.yearsAvailable} years of financial data from ProPublica`, financials);
      } catch (finErr) {
        console.error('FAILED to fetch ProPublica financials:', finErr);
      }

      // Step 4: Run Gemini analysis with pre-loaded financials
      const websiteUrl = org.propublica_url;
      const analysisResult = await analyzeOrganization(
        files,
        websiteUrl,
        true, // Always enable deep research for unified flow
        state.apiKey,
        {}, // default config
        financials // Pass pre-loaded financials - Gemini will use these instead of searching
      );

      dispatch({ type: 'SET_RESULT', payload: analysisResult });
      dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.COMPLETED });

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "An unexpected error occurred during analysis.";
      handleError(message);
      dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.ERROR });
      dispatch({ type: 'SET_FETCHING_DOCS', payload: false });
    }
  }, [state.apiKey, dispatch, handleError]);

  /**
   * Extract EIN from ProPublica URL
   * URL format: https://projects.propublica.org/nonprofits/organizations/XXXXXXXXX
   */
  const extractEinFromUrl = (url: string): string | null => {
    const match = url.match(/nonprofits\/organizations\/(\d+)/);
    return match ? match[1] : null;
  };

  /**
   * Manual upload workflow
   * If a ProPublica URL is provided, extracts EIN and fetches 5-year financials
   */
  const runManualAnalysis = async () => {
    if (state.files.length === 0) {
      handleError("Please upload at least one financial document (Form 990).");
      return;
    }

    if (!state.apiKey) {
      handleError("Please enter your Gemini API key in the settings (gear icon in the header).");
      return;
    }

    if (state.urlError) {
      handleError("Please fix the website URL before running analysis.");
      return;
    }

    dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.ANALYZING });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Extract EIN from ProPublica URL and fetch 5-year financials
      let financials;
      const ein = extractEinFromUrl(state.websiteUrl);

      console.log('Website URL entered:', state.websiteUrl);

      if (ein) {
        try {
          console.log(`Extracted EIN ${ein} from ProPublica URL, fetching financials...`);
          financials = await fetchFinancials(ein);
          console.log(`SUCCESS: Fetched ${financials.yearsAvailable} years for ${financials.name}`);
          console.log('2023 Revenue from ProPublica:', financials.financialHistory[0]?.revenue);
        } catch (finErr) {
          console.warn('Could not fetch ProPublica financials:', finErr);
        }
      } else {
        console.log('No EIN found in URL - provide a ProPublica URL for 5-year financials');
        console.log('Expected format: https://projects.propublica.org/nonprofits/organizations/XXXXXXXXX');
      }

      const analysisResult = await analyzeOrganization(
        state.files,
        state.websiteUrl,
        state.deepResearch,
        state.apiKey,
        {}, // default config
        financials // Pass financials if we extracted EIN and fetched them
      );
      dispatch({ type: 'SET_RESULT', payload: analysisResult });
      dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.COMPLETED });
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "An unexpected error occurred during analysis.";
      handleError(message);
      dispatch({ type: 'SET_STATUS', payload: AnalysisStatus.ERROR });
    }
  };

  const isIdle = state.status === AnalysisStatus.IDLE || state.status === AnalysisStatus.ERROR;
  const showInputForm = isIdle && !state.showLeadList;
  const canRunManualAnalysis = state.files.length > 0 && state.apiKey && !state.urlError;

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <Header
        apiKey={state.apiKey}
        savedLeadsCount={state.savedLeads.length}
        showLeadList={state.showLeadList}
        status={state.status}
        onReset={handleReset}
        onToggleApiKey={handleToggleApiKey}
        onToggleLeadList={handleToggleLeadList}
      />

      <ApiKeyModal
        isOpen={state.showApiKeyInput}
        apiKey={state.apiKey}
        onClose={handleToggleApiKey}
        onSave={saveApiKey}
      />

      <main className="max-w-4xl mx-auto px-4 relative">
        {state.showLeadList && (
          <div className="mb-12">
            <LeadList
              leads={state.savedLeads}
              onRemove={handleRemoveLead}
              onSelect={handleSelectLead}
            />
          </div>
        )}

        {showInputForm ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Unified Search - Primary Flow */}
            <UnifiedSearch
              onGenerateDossier={handleGenerateDossier}
              isGenerating={state.status === AnalysisStatus.ANALYZING}
            />

            {/* Error Display */}
            {state.error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3">
                <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                <div>
                  <p className="font-medium">Analysis Error</p>
                  <p className="mt-1">{state.error}</p>
                </div>
              </div>
            )}

            {/* Manual Upload Fallback - Collapsed by Default */}
            <div className="border-t border-slate-200 pt-6">
              <button
                onClick={() => dispatch({ type: 'TOGGLE_MANUAL_UPLOAD' })}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <i className={`fa-solid fa-chevron-${state.showManualUpload ? 'up' : 'down'}`}></i>
                {state.showManualUpload ? 'Hide' : 'Show'} manual upload (advanced)
              </button>

              {state.showManualUpload && (
                <div className="mt-6 space-y-6">
                  {/* DDS Provider Widget for downloading provider PDFs */}
                  <DDSProviderWidget title="DDS Provider Finder" />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FileUploadSection
                      files={state.files}
                      onFilesAdd={handleFilesAdd}
                      onFileRemove={handleFileRemove}
                      onError={handleError}
                    />

                    <div className="space-y-6">
                      <WebResearchSection
                        websiteUrl={state.websiteUrl}
                        urlError={state.urlError}
                        deepResearch={state.deepResearch}
                        onUrlChange={handleUrlChange}
                        onDeepResearchChange={handleDeepResearchChange}
                      />

                      <button
                        onClick={runManualAnalysis}
                        disabled={!canRunManualAnalysis}
                        className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all ${
                          !canRunManualAnalysis ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                      >
                        <i className="fa-solid fa-microscope" aria-hidden="true"></i>
                        Generate from Uploaded Files
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : state.status === AnalysisStatus.ANALYZING ? (
          <div>
            <AnalyzingSpinner />
            {state.isFetchingDocs && (
              <p className="text-center text-sm text-slate-500 mt-4">
                <i className="fa-solid fa-download mr-2"></i>
                Fetching documents from ProPublica and DDS...
              </p>
            )}
          </div>
        ) : state.result ? (
          <AnalysisDisplay result={state.result} onSave={() => handleSaveLead(state.result!)} />
        ) : null}
      </main>
    </div>
  );
};

export default App;
