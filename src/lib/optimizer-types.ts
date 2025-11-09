export type OptimizerRunStatus =
  | 'idle'
  | 'precheck'
  | 'sampling'
  | 'diagnostics'
  | 'prompting'
  | 'review'
  | 'error';

export type OptimizerStep = 'Comparison' | 'Sampling' | 'Diagnostics' | 'Prompting' | 'Review';

export const OPTIMIZER_STEPS: OptimizerStep[] = [
  'Comparison',
  'Sampling',
  'Diagnostics',
  'Prompting',
  'Review',
];

export type OptimizerDocumentTheory = {
  docId: string;
  docName: string;
  theories: Record<string, string>;
  error?: string;
};

export type OptimizerFieldSummary = {
  fieldKey: string;
  accuracyBefore: number;
  sampledDocIds: string[];
  newPrompt?: string;
  promptTheory?: string;
  error?: string;
};

export interface OptimizerRunSummary {
  sampledDocs: OptimizerDocumentTheory[];
  fieldSummaries: OptimizerFieldSummary[];
  startedAt?: number;
  completedAt?: number;
  autoRanComparison?: boolean;
  runId: string;
}

export interface OptimizerState {
  status: OptimizerRunStatus;
  stepIndex: number;
  sampledDocs: OptimizerDocumentTheory[];
  fieldSummaries: OptimizerFieldSummary[];
  startedAt?: number;
  completedAt?: number;
  autoRanComparison?: boolean;
  lastToast?: 'success' | 'skip' | 'error';
  errorMessage?: string;
  runId?: string;
}

export type FieldFailureDetail = {
  docId: string;
  docName: string;
  groundTruth: string;
  extractedValue: string;
  comparisonReason?: string;
};

export type FieldFailureMap = Record<string, FieldFailureDetail[]>;

export type OptimizerSamplingDoc = {
  docId: string;
  docName: string;
  fieldKeys: string[];
};

export type OptimizerSamplingResult = {
  docs: OptimizerSamplingDoc[];
  fieldToDocIds: Record<string, string[]>;
};

export type OptimizerDocumentDiagnosticsInput = {
  fileId: string;
  fileName: string;
  templateKey?: string;
  fieldFailures: Array<{
    fieldKey: string;
    fieldName: string;
    groundTruth: string;
    extractedValue: string;
  }>;
};

export type OptimizerPromptHistoryItem = {
  id: string;
  prompt: string;
  savedAt: string;
};

export type OptimizerPromptRequest = {
  fieldKey: string;
  fieldName: string;
  fieldType: string;
  currentPrompt: string;
  previousPrompts: OptimizerPromptHistoryItem[];
  theories: Array<{ docId: string; docName: string; theory: string }>;
  context?: string;
};
