/**
 * Organization Service
 *
 * Handles API calls for unified search and document fetching.
 */

// API base URL - uses environment variable in production, localhost in dev
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface DDSProvider {
  name: string;
  url: string;
  town: string;
}

export interface SearchResult {
  ein: string | number;  // Backend returns number, but we treat as string
  name: string;
  city: string;
  state: string;
  ntee_code: string | null;
  propublica_url: string;
  dds_provider: DDSProvider | null;
  has_form990: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  state: string;
}

export interface Filing {
  tax_period: string;
  pdf_url: string | null;
  total_revenue: number | null;
  total_expenses: number | null;
  total_assets: number | null;
}

export interface OrganizationDetails {
  ein: string;
  name: string;
  city: string;
  state: string;
  ntee_code: string | null;
  filings: Filing[];
  latest_filing: Filing | null;
}

export interface FetchedDocuments {
  form990: string | null;       // base64
  form990_year: string | null;
  provider_profile: string | null;  // base64
  quality_report: string | null;    // base64
  org_name: string | null;
  errors: string[];
}

/**
 * Search for organizations across ProPublica and DDS providers.
 */
export const searchOrganizations = async (
  query: string,
  state: string = 'CT'
): Promise<SearchResult[]> => {
  if (!query || query.length < 2) {
    return [];
  }

  const params = new URLSearchParams({ q: query, state });
  const response = await fetch(`${API_BASE}/api/search/unified?${params}`);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data: SearchResponse = await response.json();
  return data.results;
};

/**
 * Get detailed organization info from ProPublica.
 */
export const getOrganizationDetails = async (
  ein: string
): Promise<OrganizationDetails> => {
  const response = await fetch(`${API_BASE}/api/organization/${ein}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Organization not found');
    }
    throw new Error(`Failed to fetch organization: ${response.statusText}`);
  }

  const data = await response.json();
  return data.organization;
};

/**
 * Fetch all available documents for an organization.
 * Returns base64-encoded PDFs.
 *
 * Pass org_name and city to enable automatic DDS provider matching.
 */
export const fetchAllDocuments = async (
  ein: string | number,
  orgName?: string,
  city?: string,
  providerUrl?: string
): Promise<FetchedDocuments> => {
  const response = await fetch(`${API_BASE}/api/organization/fetch-docs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ein: String(ein),  // Ensure EIN is always a string
      org_name: orgName || null,
      city: city || null,
      provider_url: providerUrl || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Convert base64 document to UploadedFile format for Gemini service.
 */
export const base64ToUploadedFile = (
  base64: string,
  filename: string,
  mimeType: string = 'application/pdf'
): { name: string; type: string; base64: string } => {
  return {
    name: filename,
    type: mimeType,
    base64: `data:${mimeType};base64,${base64}`,
  };
};

/**
 * Format currency for display.
 */
export const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Financial year data from ProPublica API
 */
export interface FinancialYearData {
  year: number | string;  // API returns number, we convert to string
  revenue: string;
  expenses: string;
  netIncome: string;
  assets: string;
  netAssets: string;
  raw: {
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
  ntee_code: string | null;
  financialHistory: FinancialYearData[];
  yearsAvailable: number;
  latestYear: string | null;
  propublicaUrl: string;
  error?: string;
}

/**
 * Fetch 5-year financial history directly from ProPublica API.
 * This provides consistent, reliable data without AI parsing.
 */
export const fetchFinancials = async (
  ein: string | number,
  years: number = 5
): Promise<ProPublicaFinancials> => {
  const cleanEin = String(ein).replace('-', '');
  const response = await fetch(
    `${API_BASE}/api/propublica/financials/${cleanEin}?years=${years}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch financials: ${response.statusText}`);
  }

  return response.json();
};
