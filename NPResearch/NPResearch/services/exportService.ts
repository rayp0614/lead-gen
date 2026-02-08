/**
 * Export Service
 *
 * Converts analysis results to CRM-ready formats.
 * Primary format: CSV for spreadsheet import.
 */

import { AnalysisResult } from '../types';

/**
 * CSV column headers for lead export
 */
const CSV_HEADERS = [
  'Organization Name',
  'EIN',
  'City',
  'State',
  'Latest Revenue',
  'Latest Expenses',
  'Net Income',
  'Total Assets',
  'Net Assets',
  'Financial Verdict',
  'Quality Rating',
  'Top Quality Concern',
  'Top Strength',
  'Services',
  'Decision Maker',
  'Decision Maker Title',
  'Primary Pain Point',
  'Suggested Pitch',
  'Cold Email Hook',
  'Website',
  'ProPublica URL',
  'Export Date'
];

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
const escapeCSV = (value: string | undefined | null): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Convert a single analysis result to a CSV row
 */
const resultToCSVRow = (result: AnalysisResult, websiteUrl?: string): string[] => {
  // Get latest financial year
  const latestFinancial = result.financialHistory?.[0];

  // Get top concern and strength
  const topConcern = result.qualityAssessment?.concerns?.[0] || 'None identified';
  const topStrength = result.qualityAssessment?.strengths?.[0] || 'None identified';

  // Get primary pain point
  const primaryPainPoint = result.painPoints?.[0];

  // Generate ProPublica URL if we have enough info
  // (In real usage, this would come from the source data)
  const propublicaUrl = ''; // Would need EIN to construct

  return [
    result.targetName || '',
    '', // EIN - would need to be passed separately
    '', // City - from source data
    '', // State - from source data
    latestFinancial?.revenue || '',
    latestFinancial?.expenses || '',
    latestFinancial?.netIncome || '',
    latestFinancial?.assets || '',
    latestFinancial?.netAssets || '',
    result.financialHealth?.verdict || '',
    result.qualityAssessment?.rating || '',
    topConcern,
    topStrength,
    result.serviceTypes?.join('; ') || result.serviceSummary || '',
    result.decisionMaker?.name || '',
    result.decisionMaker?.role || '',
    primaryPainPoint?.symptom || '',
    primaryPainPoint?.pitch || '',
    result.coldEmailHook || '',
    websiteUrl || '',
    propublicaUrl,
    new Date().toISOString().split('T')[0] // Export date
  ];
};

/**
 * Export a single analysis result to CSV string
 */
export const exportToCSV = (
  result: AnalysisResult,
  options?: {
    websiteUrl?: string;
    includeHeaders?: boolean;
  }
): string => {
  const { websiteUrl, includeHeaders = true } = options || {};

  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(CSV_HEADERS.map(escapeCSV).join(','));
  }

  const row = resultToCSVRow(result, websiteUrl);
  lines.push(row.map(escapeCSV).join(','));

  return lines.join('\n');
};

/**
 * Export multiple analysis results to CSV string (batch export)
 */
export const exportMultipleToCSV = (
  results: Array<{
    result: AnalysisResult;
    websiteUrl?: string;
  }>
): string => {
  const lines: string[] = [];

  // Add headers
  lines.push(CSV_HEADERS.map(escapeCSV).join(','));

  // Add each result as a row
  for (const { result, websiteUrl } of results) {
    const row = resultToCSVRow(result, websiteUrl);
    lines.push(row.map(escapeCSV).join(','));
  }

  return lines.join('\n');
};

/**
 * Trigger download of CSV file
 */
export const downloadCSV = (csvContent: string, filename: string = 'lead-export.csv'): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
};

/**
 * Format analysis result as plain text summary (for clipboard)
 */
export const formatAsText = (result: AnalysisResult, websiteUrl?: string): string => {
  const lines: string[] = [];

  lines.push(`=== LEAD DOSSIER: ${result.targetName} ===`);
  lines.push('');

  // Financial Summary
  lines.push('FINANCIAL HEALTH');
  lines.push(`  Revenue: ${result.financialHealth?.revenue || 'N/A'}`);
  lines.push(`  Net Assets: ${result.financialHealth?.netAssets || 'N/A'}`);
  lines.push(`  Verdict: ${result.financialHealth?.verdict || 'N/A'}`);
  lines.push('');

  // Quality Summary
  lines.push('QUALITY ASSESSMENT');
  lines.push(`  Rating: ${result.qualityAssessment?.rating || 'N/A'}`);
  lines.push(`  Summary: ${result.qualityAssessment?.summary || 'N/A'}`);
  if (result.qualityAssessment?.concerns?.length) {
    lines.push(`  Top Concerns:`);
    result.qualityAssessment.concerns.slice(0, 3).forEach(c => {
      lines.push(`    - ${c}`);
    });
  }
  lines.push('');

  // Decision Maker
  lines.push('DECISION MAKER');
  lines.push(`  ${result.decisionMaker?.name || 'Unknown'}, ${result.decisionMaker?.role || ''}`);
  lines.push('');

  // Pain Points & Pitch
  if (result.painPoints?.length) {
    lines.push('PAIN POINTS & PITCH ANGLES');
    result.painPoints.slice(0, 3).forEach((pp, i) => {
      lines.push(`  ${i + 1}. ${pp.symptom}`);
      lines.push(`     Evidence: ${pp.evidence}`);
      lines.push(`     Pitch: ${pp.pitch}`);
    });
    lines.push('');
  }

  // Cold Email Hook
  if (result.coldEmailHook) {
    lines.push('COLD EMAIL HOOK');
    lines.push(`  "${result.coldEmailHook}"`);
    lines.push('');
  }

  // Services
  if (result.serviceTypes?.length) {
    lines.push('SERVICES');
    lines.push(`  ${result.serviceTypes.join(', ')}`);
    lines.push('');
  }

  if (websiteUrl) {
    lines.push(`Website: ${websiteUrl}`);
  }

  lines.push(`Generated: ${new Date().toLocaleDateString()}`);

  return lines.join('\n');
};

export default {
  exportToCSV,
  exportMultipleToCSV,
  downloadCSV,
  copyToClipboard,
  formatAsText
};
