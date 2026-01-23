/**
 * Type definitions for Agent-Alpha agentic prompt optimization
 */

import type { AgentAlphaRuntimeConfig } from './agent-alpha-config';
import type { FieldCompareConfig } from './compare-types';

export type AgentAlphaStatus = 'idle' | 'configure' | 'running' | 'preview' | 'error';

export type ProcessedFieldInfo = {
  fieldName: string;
  fieldKey: string;
  iterationCount: number;
  initialAccuracy: number;
  finalAccuracy: number;
  finalPrompt: string;
  timeMs: number; // Time taken for this field
};

export type ProcessingFieldInfo = {
  fieldKey: string;
  fieldName: string;
  initialAccuracy: number;
  startTime: number; // When processing started
};

export type AgentAlphaState = {
  status: AgentAlphaStatus;
  selectedModel: string | null; // User-selected model for testing extractions
  currentField: string | null; // Key of the current field being processed (legacy, for single field)
  currentFieldName: string | null; // Name of the current field being processed (legacy)
  currentIteration: number; // Current iteration number for the field
  currentAccuracy: number; // Current accuracy for the field (0-1)
  fieldsProcessed: number; // Number of fields completed
  totalFields: number; // Total number of fields to process
  startTime?: number; // Timestamp when run started
  runId?: string;
  errorMessage?: string;
  // Track all processed fields for the table
  processedFields: ProcessedFieldInfo[];
  // Track fields currently being processed in parallel
  processingFields: ProcessingFieldInfo[];
  // Runtime configuration (set during configure phase)
  runtimeConfig?: AgentAlphaRuntimeConfig;
  // Actual number of documents being tested (may be less than maxDocs)
  actualDocCount?: number;
};

/**
 * Experiment metadata for auditability and reproducibility
 * Captures all parameters that affect optimization results
 */
export type PromptExperimentMetadata = {
  testModel: string;
  compareConfig?: FieldCompareConfig;
  trainDocIds: string[];
  holdoutDocIds: string[];
  groundTruthHash?: string; // Hash of GT values used (for change detection)
  iterationResults?: Array<{
    iteration: number;
    trainAccuracy: number;
    holdoutAccuracy?: number;
    promptLength: number;
  }>;
};

export type AgentAlphaFieldResult = {
  fieldKey: string;
  fieldName: string;
  initialAccuracy: number; // Accuracy before Agent-Alpha
  finalAccuracy: number; // Accuracy after Agent-Alpha
  iterationCount: number; // Number of iterations used
  finalPrompt: string; // The optimized prompt
  initialPrompt: string; // The prompt used to start optimization (may be example if user had none)
  userOriginalPrompt: string | null; // The actual user prompt before agent ran (null if none/generic)
  converged: boolean; // True if reached 100% accuracy
  sampledDocIds: string[]; // Documents used for testing
  improved: boolean; // True if finalAccuracy >= initialAccuracy (prompt should be applied)
  hasGroundTruth?: boolean; // True if field had ground truth data to measure against
  // Experiment metadata for auditability
  experimentMetadata?: PromptExperimentMetadata;
};

export type AgentAlphaPendingResults = {
  runId: string;
  results: AgentAlphaFieldResult[];
  timestamp: string;
  testModel: string; // Model used for testing extractions
  sampledDocIds: string[]; // Documents used for testing
  trainDocIds?: string[]; // Training docs (subset of sampled)
  holdoutDocIds?: string[]; // Holdout validation docs
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

