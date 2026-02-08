
import { GoogleGenAI } from "@google/genai";
import { UploadedFile, AnalysisResult } from "../types";
import { buildAnalysisPrompt } from "./prompts/analysisPrompt";
import { ProPublicaFinancials } from "./organizationService";

// Configuration - can be overridden via environment at build time
// Note: googleSearch tool cannot be combined with responseSchema (controlled generation)
// So we request JSON in the prompt and parse manually
const DEFAULT_MODEL = "gemini-2.0-flash";

export interface AnalysisConfig {
  model?: string;
  thinkingBudget?: number;
}

export const analyzeOrganization = async (
  files: UploadedFile[],
  websiteUrl: string,
  deepResearch: boolean,
  apiKey: string,
  config: AnalysisConfig = {},
  preloadedFinancials?: ProPublicaFinancials
): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error('API key is required. Please enter your Gemini API key in the settings.');
  }

  const model = config.model || DEFAULT_MODEL;
  const thinkingBudget = config.thinkingBudget || 4000;

  const ai = new GoogleGenAI({ apiKey });

  // All files (990s, Provider Profiles, QSRs) go into same parts array
  // Gemini determines document types from content
  const parts = files.map(file => ({
    inlineData: {
      data: file.base64.split(',')[1],
      mimeType: file.type
    }
  }));

  const prompt = buildAnalysisPrompt({ websiteUrl, deepResearch, preloadedFinancials });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...parts, { text: prompt }] },
    config: {
      tools: [{ googleSearch: {} }],
      // Note: Cannot use responseSchema with googleSearch tool
      // JSON structure is enforced via prompt instructions instead
    }
  });

  try {
    let responseText = response.text || '{}';

    // Clean up response - remove markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    const result: AnalysisResult = JSON.parse(responseText);
    result.id = result.id || crypto.randomUUID();
    result.timestamp = Date.now();

    // OVERRIDE financials with pre-loaded data from ProPublica API
    // This ensures consistent data regardless of what Gemini returns
    console.log('preloadedFinancials received:', preloadedFinancials ? `${preloadedFinancials.yearsAvailable} years` : 'NONE');
    if (preloadedFinancials && preloadedFinancials.financialHistory?.length > 0) {
      // Convert ProPublica format to our FinancialYear format
      result.financialHistory = preloadedFinancials.financialHistory.map(fy => ({
        year: String(fy.year),
        revenue: fy.revenue,
        expenses: fy.expenses,
        netIncome: fy.netIncome,
        assets: fy.assets,
        netAssets: fy.netAssets,
        liabilities: "N/A" // ProPublica doesn't provide this directly
      }));

      // Also update financialHealth with consistent calculated values
      const latest = preloadedFinancials.financialHistory[0];
      if (latest.raw.expenses && latest.raw.expenses > 0) {
        const monthlyBurn = Math.round(latest.raw.expenses / 12);
        const runway = latest.raw.netAssets && latest.raw.netAssets > 0
          ? Math.round(latest.raw.netAssets / monthlyBurn)
          : null;

        result.financialHealth = {
          ...result.financialHealth,
          revenue: latest.revenue,
          netAssets: latest.netAssets,
          burnRate: `$${monthlyBurn.toLocaleString()}/month`,
          runway: runway ? `${runway} months` : "N/A (no net assets data)"
        };
      }

      console.log(`Injected ${preloadedFinancials.financialHistory.length} years of financial data from ProPublica`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const responsePreview = response.text?.substring(0, 500) || 'empty response';
    console.error("Failed to parse analysis result:", {
      error: errorMessage,
      responsePreview,
      model,
    });
    throw new Error(
      `Analysis parsing failed: ${errorMessage}. ` +
      `Please ensure the uploaded PDFs are readable and try again.`
    );
  }
};
