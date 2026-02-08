/**
 * Gemini AI Analysis Prompt Template
 *
 * This file contains the structured prompt for generating executive lead dossiers.
 * Kept separate from service logic for easier maintenance and versioning.
 */

import { ProPublicaFinancials } from "../organizationService";

export interface PromptParams {
  websiteUrl: string;
  deepResearch: boolean;
  preloadedFinancials?: ProPublicaFinancials;
}

/**
 * Format pre-loaded financial data into a string for the prompt
 */
const formatFinancialsForPrompt = (financials: ProPublicaFinancials): string => {
  if (!financials.financialHistory || financials.financialHistory.length === 0) {
    return "No financial data available from ProPublica.";
  }

  const rows = financials.financialHistory.map(fy =>
    `  - ${fy.year}: Revenue=${fy.revenue}, Expenses=${fy.expenses}, Net Income=${fy.netIncome}, Assets=${fy.assets}, Net Assets=${fy.netAssets}`
  ).join('\n');

  // Calculate burn rate and runway from latest year
  const latest = financials.financialHistory[0];
  let burnRateInfo = "";
  if (latest.raw.expenses && latest.raw.expenses > 0) {
    const monthlyBurn = Math.round(latest.raw.expenses / 12);
    const runway = latest.raw.netAssets && latest.raw.netAssets > 0
      ? Math.round(latest.raw.netAssets / monthlyBurn)
      : "N/A";
    burnRateInfo = `
  Calculated Metrics (from ${latest.year}):
  - Monthly Burn Rate: $${monthlyBurn.toLocaleString()}/month
  - Operating Runway: ${typeof runway === 'number' ? runway + ' months' : runway}`;
  }

  return `
PRE-LOADED FINANCIAL DATA (from ProPublica API - USE THIS DATA):
Organization: ${financials.name}
EIN: ${financials.ein}
Location: ${financials.city}, ${financials.state}
Years Available: ${financials.yearsAvailable}

5-Year Financial History:
${rows}
${burnRateInfo}
`;
};

export const buildAnalysisPrompt = ({ websiteUrl, deepResearch, preloadedFinancials }: PromptParams): string => {
  const deepResearchSection = deepResearch ? `
    DEEP RESEARCH INSTRUCTIONS:
    - Perform an exhaustive web search for the organization: "${websiteUrl}".
    - Find recent news articles (last 24 months).
    - Analyze public sentiment (Glassdoor reviews, social media mentions, local news).
    - Identify community reputation and strategic context (major partnerships, recent expansions, or leadership scandals).

    CRITICAL - ENTITY VERIFICATION:
    - ONLY include news/information that EXACTLY matches the organization name from the uploaded documents.
    - If the org is "MARCH Inc", do NOT include results for "MARC Inc", "March Foundation", or similar names.
    - Verify the EIN, state, or city matches before including any web search results.
    - If you cannot find verified news for this EXACT organization, return "No verified news found for this organization" rather than guessing.
    - When in doubt, EXCLUDE the result rather than risk mixing up similar-named organizations.
    ` : '';

  const researchTask = deepResearch
    ? 'QUALITATIVE DEEP RESEARCH (Sentiments, News, Reputation).'
    : 'BASIC STRATEGIC OVERVIEW.';

  // If we have pre-loaded financials, include them and tell Gemini to use them
  const financialsSection = preloadedFinancials
    ? `
    IMPORTANT - PRE-LOADED FINANCIAL DATA:
    The following financial data has been fetched directly from ProPublica's API.
    YOU MUST USE THIS DATA EXACTLY AS PROVIDED for the financialHistory array.
    DO NOT search for or modify these numbers - they are authoritative.

    ${formatFinancialsForPrompt(preloadedFinancials)}

    For the financialHealth summary section, use the latest year's data and the calculated metrics above.
    `
    : `
    FINANCIAL DATA INSTRUCTIONS:
    - Extract 5-year financial history from the uploaded Form 990 documents.
    - Use googleSearch to find missing years on ProPublica Nonprofit Explorer.
    - Calculate Net Income = Revenue - Expenses.
    - Calculate Burn Rate = Annual Expenses / 12.
    - Calculate Runway = Net Assets / Monthly Burn Rate.
    `;

  return `
    ACT AS: Expert Business Development Analyst and Private Sector Researcher.

    OBJECTIVE:
    Generate a comprehensive "Executive Lead Generation Dossier" for the organization.

    ${financialsSection}

    ${deepResearchSection}

    INSTRUCTIONS FOR QUALITY REPORT ANALYSIS:
    - Analyze the provided Quality Service Review (QSR) PDF.
    - Extract the "FOCUS AREA" table: Description and Percent Met.
    - Categorize status: 'low' (<80%), 'medium' (80-89%), 'high' (>=90%).
    - DERIVE STRENGTHS: List 2-4 focus areas with scores >= 90% as strengths.
    - DERIVE CONCERNS: List 2-4 focus areas with scores < 80% as concerns requiring attention.

    TASKS:
    1. FINANCIAL SUMMARY (Use pre-loaded data if provided, otherwise extract from docs).
    2. QUALITY SCORECARD (Full table extraction from QSR PDF).
    3. SERVICE IDENTIFICATION (DDS Service Types from Provider Profile).
    4. ${researchTask}
    5. STRATEGIC DOSSIER (Pain Points, Decision Maker, Cold Outreach).

    DATA SOURCES:
    - Pre-loaded Financial Data (if provided above - USE THIS).
    - Uploaded Files (990s, Provider Profile, QSR PDF).
    - Web Search (Google Search Tool) - for news/reputation only.
    - Website: ${websiteUrl}

    CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no code blocks.

    JSON STRUCTURE:
    {
      "targetName": "Organization Name from documents",
      "financialHealth": {
        "revenue": "$X,XXX,XXX (latest year)",
        "netAssets": "$X,XXX,XXX (latest year)",
        "professionalFees": "$X,XXX (if available from 990)",
        "verdict": "Healthy/At Risk/Critical",
        "burnRate": "$X,XXX/month (calculated: annual expenses / 12)",
        "runway": "X months (calculated: net assets / monthly burn)"
      },
      "financialHistory": [
        { "year": "2023", "revenue": "$X", "expenses": "$X", "netIncome": "$X", "assets": "$X", "netAssets": "$X", "liabilities": "$X" }
      ],
      "qualityAssessment": {
        "rating": "A/B/C/D/F",
        "summary": "2-3 sentences about quality trends",
        "strengths": ["Specific strength with score >= 90%"],
        "concerns": ["Specific concern with score < 80%"],
        "allFocusAreas": [
          { "description": "Focus Area Name", "percentMet": "95%", "status": "high/medium/low" }
        ]
      },
      "serviceSummary": "Brief description of services",
      "serviceTypes": ["Community Living", "Day Services", "etc"],
      "painPoints": [
        { "symptom": "Identified issue", "evidence": "From documents", "pitch": "How to address it" }
      ],
      "decisionMaker": {
        "name": "Name from 990 Part VII",
        "role": "Title",
        "why": "Why they make decisions"
      },
      "coldEmailHook": "Opening line based on their specific situation",
      "deepResearchData": {
        "sentiment": "Based on web search findings",
        "recentNews": ["News item 1", "News item 2"],
        "reputation": "Community reputation summary",
        "strategicContext": "Strategic context from research"
      },
      "rawAnalysis": "Any additional observations"
    }
  `.trim();
};
