/**
 * App State Management with useReducer
 *
 * Centralizes all application state into a single reducer for better maintainability.
 */

import { useReducer, useEffect, useCallback } from 'react';
import { UploadedFile, AnalysisResult, AnalysisStatus } from '../types';
import { SearchResult, FetchedDocuments } from '../services/organizationService';

// ============================================================================
// State Types
// ============================================================================

export interface AppState {
  // File uploads (manual mode) - all documents in single array
  files: UploadedFile[];

  // Form inputs
  websiteUrl: string;
  urlError: string | null;
  deepResearch: boolean;

  // Analysis state
  status: AnalysisStatus;
  result: AnalysisResult | null;
  error: string | null;

  // Leads
  savedLeads: AnalysisResult[];
  showLeadList: boolean;

  // Settings
  apiKey: string;
  showApiKeyInput: boolean;

  // Unified search state
  selectedOrg: SearchResult | null;
  fetchedDocs: FetchedDocuments | null;
  isFetchingDocs: boolean;
  showManualUpload: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

export type AppAction =
  | { type: 'ADD_FILES'; payload: UploadedFile[] }
  | { type: 'REMOVE_FILE'; payload: number }
  | { type: 'CLEAR_FILES' }
  | { type: 'SET_WEBSITE_URL'; payload: { url: string; error: string | null } }
  | { type: 'SET_DEEP_RESEARCH'; payload: boolean }
  | { type: 'SET_STATUS'; payload: AnalysisStatus }
  | { type: 'SET_RESULT'; payload: AnalysisResult | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_LEAD'; payload: AnalysisResult }
  | { type: 'REMOVE_LEAD'; payload: string }
  | { type: 'SET_SAVED_LEADS'; payload: AnalysisResult[] }
  | { type: 'TOGGLE_LEAD_LIST' }
  | { type: 'SHOW_LEAD_LIST'; payload: boolean }
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'TOGGLE_API_KEY_INPUT' }
  | { type: 'RESET' }
  // Unified search actions
  | { type: 'SELECT_ORGANIZATION'; payload: SearchResult }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_FETCHED_DOCS'; payload: FetchedDocuments | null }
  | { type: 'SET_FETCHING_DOCS'; payload: boolean }
  | { type: 'TOGGLE_MANUAL_UPLOAD' };

// ============================================================================
// Initial State
// ============================================================================

export const initialState: AppState = {
  files: [],
  websiteUrl: '',
  urlError: null,
  deepResearch: false,
  status: AnalysisStatus.IDLE,
  result: null,
  error: null,
  savedLeads: [],
  showLeadList: false,
  apiKey: '',
  showApiKeyInput: false,
  // Unified search
  selectedOrg: null,
  fetchedDocs: null,
  isFetchingDocs: false,
  showManualUpload: false,
};

// ============================================================================
// Reducer
// ============================================================================

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_FILES':
      return { ...state, files: [...state.files, ...action.payload], error: null };

    case 'REMOVE_FILE':
      return { ...state, files: state.files.filter((_, idx) => idx !== action.payload) };

    case 'CLEAR_FILES':
      return { ...state, files: [] };

    case 'SET_WEBSITE_URL':
      return { ...state, websiteUrl: action.payload.url, urlError: action.payload.error };

    case 'SET_DEEP_RESEARCH':
      return { ...state, deepResearch: action.payload };

    case 'SET_STATUS':
      return { ...state, status: action.payload };

    case 'SET_RESULT':
      return { ...state, result: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'ADD_LEAD': {
      const exists = state.savedLeads.find(l => l.targetName === action.payload.targetName);
      if (exists) return state;
      return { ...state, savedLeads: [action.payload, ...state.savedLeads] };
    }

    case 'REMOVE_LEAD':
      return { ...state, savedLeads: state.savedLeads.filter(l => l.id !== action.payload) };

    case 'SET_SAVED_LEADS':
      return { ...state, savedLeads: action.payload };

    case 'TOGGLE_LEAD_LIST':
      return { ...state, showLeadList: !state.showLeadList };

    case 'SHOW_LEAD_LIST':
      return { ...state, showLeadList: action.payload };

    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };

    case 'TOGGLE_API_KEY_INPUT':
      return { ...state, showApiKeyInput: !state.showApiKeyInput };

    case 'RESET':
      return {
        ...state,
        files: [],
        websiteUrl: '',
        urlError: null,
        deepResearch: false,
        result: null,
        status: AnalysisStatus.IDLE,
        error: null,
        selectedOrg: null,
        fetchedDocs: null,
        isFetchingDocs: false,
      };

    // Unified search actions
    case 'SELECT_ORGANIZATION':
      return { ...state, selectedOrg: action.payload, error: null };

    case 'CLEAR_SELECTION':
      return { ...state, selectedOrg: null, fetchedDocs: null };

    case 'SET_FETCHED_DOCS':
      return { ...state, fetchedDocs: action.payload };

    case 'SET_FETCHING_DOCS':
      return { ...state, isFetchingDocs: action.payload };

    case 'TOGGLE_MANUAL_UPLOAD':
      return { ...state, showManualUpload: !state.showManualUpload };

    default:
      return state;
  }
}

// ============================================================================
// Custom Hook
// ============================================================================

const LEADS_STORAGE_KEY = 'saved_leads';
const API_KEY_STORAGE_KEY = 'gemini_api_key';

export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load persisted data on mount
  useEffect(() => {
    // Load saved leads
    const storedLeads = localStorage.getItem(LEADS_STORAGE_KEY);
    if (storedLeads) {
      try {
        dispatch({ type: 'SET_SAVED_LEADS', payload: JSON.parse(storedLeads) });
      } catch (e) {
        console.error('Failed to load saved leads:', e);
      }
    }

    // Load API key
    const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedApiKey) {
      dispatch({ type: 'SET_API_KEY', payload: storedApiKey });
    }
  }, []);

  // Persist leads when they change
  useEffect(() => {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(state.savedLeads));
  }, [state.savedLeads]);

  // Persist API key when it changes
  const saveApiKey = useCallback((key: string) => {
    dispatch({ type: 'SET_API_KEY', payload: key });
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }, []);

  return { state, dispatch, saveApiKey };
}
