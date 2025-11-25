/**
 * Type definitions for Agent-Alpha agentic prompt optimization
 */

export type AgentAlphaStatus = 'idle' | 'running' | 'preview' | 'error';

export type ProcessedFieldInfo = {
  fieldName: string;
  iterationCount: number;
  initialAccuracy: number;
  finalAccuracy: number;
  finalPrompt: string;
  timeMs: number; // Time taken for this field
};

export type AgentAlphaState = {
  status: AgentAlphaStatus;
  selectedModel: string | null; // User-selected model for testing extractions
  currentField: string | null; // Key of the current field being processed
  currentFieldName: string | null; // Name of the current field being processed
  currentIteration: number; // Current iteration number for the field
  currentAccuracy: number; // Current accuracy for the field (0-1)
  fieldsProcessed: number; // Number of fields completed
  totalFields: number; // Total number of fields to process
  startTime?: number; // Timestamp when run started
  runId?: string;
  errorMessage?: string;
  // Track all processed fields for the table
  processedFields: ProcessedFieldInfo[];
};

export type AgentAlphaFieldResult = {
  fieldKey: string;
  fieldName: string;
  initialAccuracy: number; // Accuracy before Agent-Alpha
  finalAccuracy: number; // Accuracy after Agent-Alpha
  iterationCount: number; // Number of iterations used
  finalPrompt: string; // The optimized prompt
  initialPrompt: string; // The original prompt
  converged: boolean; // True if reached 100% accuracy
  sampledDocIds: string[]; // Documents used for testing
};

export type AgentAlphaPendingResults = {
  runId: string;
  results: AgentAlphaFieldResult[];
  timestamp: string;
  testModel: string; // Model used for testing extractions
  sampledDocIds: string[]; // Documents used for testing
  sampledDocNames?: Record<string, string>; // docId -> docName mapping
  startTime: number; // Timestamp when run started
  endTime: number; // Timestamp when run completed
  estimatedTimeMs: number; // Estimated time in milliseconds
  actualTimeMs: number; // Actual time taken in milliseconds
};

export type AgentAlphaIterationResult = {
  newPrompt: string;
  accuracy: number;
  converged: boolean; // True if accuracy >= TARGET_ACCURACY
  failureExamples?: Array<{
    docId: string;
    predicted: string;
    expected: string;
  }>;
};

