
export interface FinancialYear {
  year: string;
  revenue: string;
  expenses: string;
  netIncome: string;
  assets: string;
  netAssets: string;
  liabilities: string;
}

export interface QualityFocusArea {
  description: string;
  percentMet: string;
  status: 'low' | 'medium' | 'high';
}

export interface QualityAssessment {
  rating: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  allFocusAreas: QualityFocusArea[];
}

export interface AnalysisResult {
  targetName: string;
  id: string;
  timestamp: number;
  financialHealth: {
    revenue: string;
    netAssets: string;
    professionalFees: string;
    verdict: string;
    burnRate: string;
    runway: string;
  };
  financialHistory: FinancialYear[];
  qualityAssessment: QualityAssessment;
  serviceSummary: string;
  serviceTypes: string[];
  deepResearchData?: {
    sentiment: string;
    recentNews: string[];
    reputation: string;
    strategicContext: string;
  };
  painPoints: Array<{
    symptom: string;
    evidence: string;
    pitch: string;
  }>;
  decisionMaker: {
    name: string;
    role: string;
    why: string;
  };
  coldEmailHook: string;
  rawAnalysis: string;
}

export interface UploadedFile {
  name: string;
  base64: string;
  type: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
