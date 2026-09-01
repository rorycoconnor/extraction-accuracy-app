/**
 * Calculates performance metrics for metadata extraction comparison.
 * Handles text-based comparisons with normalization and partial matching.
 */

import { NOT_PRESENT_VALUE } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { FieldCompareConfig } from './compare-types';
import { parseFlexibleDate } from './date-utils';
import {
  createConfusionCounts,
  isErrorPrediction,
  isPendingPrediction,
  isStrictMatch,
  metricsFromConfusion,
  outcomeForPair,
  recordConfusion,
  reliabilityFromCounts,
  type ConfusionCounts,
} from './scoring';

export type MetricsResult = {
  /** Strict channel (partial / different-format do not count as hits). */
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lenientAccuracy: number;
  lenientPrecision: number;
  lenientRecall: number;
  lenientF1: number;
  /** Completed extractions that were not errors / completed extractions. */
  reliability: number;
};

export type MetricsDebugInfo = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  totalValidPairs: number;
  errorPairs: number;
  pendingPairs: number;
  examples: {
    truePositives: Array<{predicted: string, actual: string}>;
    falsePositives: Array<{predicted: string, actual: string}>;
    falseNegatives: Array<{predicted: string, actual: string}>;
    trueNegatives: Array<{predicted: string, actual: string}>;
  };
  // Per-cell comparison results (index matches predictions/groundTruths arrays)
  comparisonResults?: any[];
};

function emptyExamples() {
  return {
    truePositives: [] as Array<{predicted: string, actual: string}>,
    falsePositives: [] as Array<{predicted: string, actual: string}>,
    falseNegatives: [] as Array<{predicted: string, actual: string}>,
    trueNegatives: [] as Array<{predicted: string, actual: string}>,
  };
}

function emptyMetricsResult(comparisonResults?: unknown[]): MetricsResult & { debug: MetricsDebugInfo } {
  return {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    lenientAccuracy: 0,
    lenientPrecision: 0,
    lenientRecall: 0,
    lenientF1: 0,
    reliability: 0,
    debug: {
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 0,
      totalValidPairs: 0,
      errorPairs: 0,
      pendingPairs: 0,
      examples: emptyExamples(),
      comparisonResults,
    },
  };
}

function metricsResultFromCounts(
  strict: ConfusionCounts,
  lenient: ConfusionCounts,
  errorPairs: number,
  pendingPairs: number,
  examples: ReturnType<typeof emptyExamples>,
  comparisonResults?: unknown[]
): MetricsResult & { debug: MetricsDebugInfo } {
  const strictMetrics = metricsFromConfusion(strict);
  const lenientMetrics = metricsFromConfusion(lenient);
  const completedPairs = strict.pairs;
  return {
    accuracy: strictMetrics.accuracy,
    precision: strictMetrics.precision,
    recall: strictMetrics.recall,
    f1Score: strictMetrics.f1Score,
    lenientAccuracy: lenientMetrics.accuracy,
    lenientPrecision: lenientMetrics.precision,
    lenientRecall: lenientMetrics.recall,
    lenientF1: lenientMetrics.f1Score,
    reliability: reliabilityFromCounts(errorPairs, completedPairs),
    debug: {
      truePositives: strict.truePositives,
      falsePositives: strict.falsePositives,
      falseNegatives: strict.falseNegatives,
      trueNegatives: strict.trueNegatives,
      totalValidPairs: strict.pairs,
      errorPairs,
      pendingPairs,
      examples,
      comparisonResults,
    },
  };
}

export type ComparisonResult = {
  isMatch: boolean;
  matchType: 'exact' | 'normalized' | 'partial' | 'date_format' | 'none';
  matchClassification: 'exact' | 'normalized' | 'partial' | 'different-format' | 'none';
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Normalizes text for comparison by trimming whitespace, converting to lowercase,
 * and handling common variations.
 */
function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove punctuation for better matching
    .trim();
}

/**
 * Checks if a string looks like a date.
 */
export function isDateLike(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // Enhanced date detection patterns
  const datePatterns = [
    // ISO format: 2025-05-07, 2025/05/07
    /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/,
    // US format: 05/07/2025, 5/7/2025, 05/07/25, 5/7/25
    /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/,
    // European format: 07/05/2025, 7/5/2025 (same pattern as US)
    // Abbreviated month formats: MAR-22-08, Mar-22-2008, etc.
    /^[A-Za-z]{3}[-\/]\d{1,2}[-\/]\d{2,4}$/,
    // Written format: May 7, 2025; May 7 2025; 7 May 2025
    /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/,
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/,
    // Short format: May 7, May 2025, etc.
    /^[A-Za-z]{3,9}\s+\d{1,2}$/,
    /^[A-Za-z]{3,9}\s+\d{4}$/,
  ];
  
  return datePatterns.some(pattern => pattern.test(text.trim()));
}

/**
 * Compares two date strings for equality using enhanced parsing.
 * Handles multiple date formats including abbreviated months and 2-digit years.
 */
export function compareDates(date1: string, date2: string): boolean {
  try {
    const parsedDate1 = parseFlexibleDate(date1);
    const parsedDate2 = parseFlexibleDate(date2);
    
    // Check if both parsed successfully
    if (!parsedDate1 || !parsedDate2) return false;
    
    // Compare using ISO date strings (ignoring time)
    const iso1 = parsedDate1.toISOString().split('T')[0];
    const iso2 = parsedDate2.toISOString().split('T')[0];
    
    return iso1 === iso2;
  } catch {
    return false;
  }
}

/**
 * Enhanced comparison function that provides detailed match information.
 */
export function compareValues(predicted: string, actual: string): ComparisonResult {
  // Convert to string to handle numbers and null/undefined values
  const predictedStr = predicted != null ? String(predicted) : '';
  const actualStr = actual != null ? String(actual) : '';
  
  if (!predictedStr || !actualStr) {
    return { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
  }
  
  // Skip pending/error states
  if (predictedStr.startsWith('Pending') || predictedStr.startsWith('Error') || predictedStr.startsWith('Not Found')) {
    return { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
  }
  
  // Handle "Not Present" values - they match if both are "Not Present"
  if (predictedStr === NOT_PRESENT_VALUE && actualStr === NOT_PRESENT_VALUE) {
    return { isMatch: true, matchType: 'exact', matchClassification: 'exact', confidence: 'high' };
  }
  
  // If one is "Not Present" and the other isn't, they don't match
  if (predictedStr === NOT_PRESENT_VALUE || actualStr === NOT_PRESENT_VALUE) {
    return { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
  }
  
  // Exact string match (case-sensitive)
  if (predictedStr === actualStr) {
    return { isMatch: true, matchType: 'exact', matchClassification: 'exact', confidence: 'high' };
  }
  
  const normalizedPredicted = normalizeText(predictedStr);
  const normalizedActual = normalizeText(actualStr);
  
  if (!normalizedPredicted || !normalizedActual) {
    return { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
  }
  
  // Exact match after normalization (case-insensitive, punctuation removed)
  if (normalizedPredicted === normalizedActual) {
    return { isMatch: true, matchType: 'normalized', matchClassification: 'normalized', confidence: 'high' };
  }
  
  // Handle multi-select fields (e.g., "A, B" matches "B, A")
  // Check if values contain commas (likely multi-select from Box)
  if (predictedStr.includes(',') || actualStr.includes(',')) {
    // Split by comma, trim whitespace, normalize, and sort
    const predictedItems = predictedStr.split(',').map(item => normalizeText(item.trim())).filter(item => item).sort();
    const actualItems = actualStr.split(',').map(item => normalizeText(item.trim())).filter(item => item).sort();
    
    // Compare as sorted arrays (order-independent)
    if (predictedItems.length === actualItems.length && 
        predictedItems.every((item, index) => item === actualItems[index])) {
      return { isMatch: true, matchType: 'normalized', matchClassification: 'normalized', confidence: 'high' };
    }
  }
  
  // Check for date format differences
  if (isDateLike(predictedStr) && isDateLike(actualStr)) {
    if (compareDates(predictedStr, actualStr)) {
      return { isMatch: true, matchType: 'date_format', matchClassification: 'different-format', confidence: 'high' };
    } else {
      return { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
    }
  }
  
  // Partial match - check if one contains the other (useful for addresses, names, etc.)
  if (normalizedPredicted.includes(normalizedActual) || normalizedActual.includes(normalizedPredicted)) {
    return { isMatch: true, matchType: 'partial', matchClassification: 'partial', confidence: 'medium' };
  }
  
  return { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
}

/**
 * Determines if two text values match, considering various matching strategies.
 * This is the legacy function used by metrics calculation.
 */
function isMatch(predicted: string, actual: string): boolean {
  const result = compareValues(predicted, actual);
  return result.isMatch;
}

/**
 * Compare values using configured compare type (async version for compare engine)
 * Returns whether values match based on the configured comparison strategy
 */
export async function isMatchWithCompareEngine(
  predicted: string,
  actual: string,
  compareConfig?: FieldCompareConfig
): Promise<boolean> {
  // If no compare config provided, fall back to legacy comparison
  if (!compareConfig) {
    return isMatch(predicted, actual);
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { compareValues: compareValuesEngine } = await import('./compare-engine');
    const result = await compareValuesEngine(predicted, actual, compareConfig);
    return result.isMatch;
  } catch (error) {
    logger.error('Compare engine failed, falling back to legacy comparison', {
      error: error as Error,
    });
    // Fall back to legacy comparison on error
    return isMatch(predicted, actual);
  }
}

/**
 * Calculates precision, recall, and F1 score for a single field across multiple files.
 * 
 * This function treats the problem as a multi-class classification where:
 * - True Positive (TP): Ground truth exists and prediction matches
 * - False Negative (FN): Ground truth exists but prediction doesn't match (wrong or "Not Present")
 * - True Negative (TN): Ground truth is "Not Present" and prediction is "Not Present"
 * - False Positive (FP): Ground truth is "Not Present" but prediction is something else
 * 
 * @param predictions Array of predicted values from the model
 * @param groundTruths Array of ground truth values
 * @returns MetricsResult containing all calculated metrics
 */
export function calculateFieldMetrics(
  predictions: string[], 
  groundTruths: string[]
): MetricsResult {
  const { debug: _debug, ...metrics } = calculateFieldMetricsWithDebug(predictions, groundTruths);
  return metrics;
}

/**
 * Calculates precision, recall, and F1 score with detailed debug information (async version with compare engine).
 *
 * Uses the compare engine with configured compare types for accurate field-level comparisons.
 *
 * @param predictions Array of predicted values from the model
 * @param groundTruths Array of ground truth values
 * @param compareConfig Optional compare configuration for the field
 * @param fileIds Optional array of file IDs (for LLM judge comparisons that need file context)
 * @returns MetricsResult and debug information
 */
export async function calculateFieldMetricsWithDebugAsync(
  predictions: string[],
  groundTruths: string[],
  compareConfig?: FieldCompareConfig,
  fileIds?: string[],
  scoringFileIds?: string[]
): Promise<MetricsResult & { debug: MetricsDebugInfo }> {
  if (predictions.length !== groundTruths.length) {
    throw new Error('Predictions and ground truths must have the same length');
  }

  if (predictions.length === 0) {
    return emptyMetricsResult();
  }

  const scoringSet = scoringFileIds && scoringFileIds.length > 0 ? new Set(scoringFileIds) : null;
  const strict = createConfusionCounts();
  const lenient = createConfusionCounts();
  const examples = emptyExamples();
  const comparisonResults: any[] = [];
  let errorPairs = 0;
  let pendingPairs = 0;

  for (let i = 0; i < predictions.length; i++) {
    const predictedStr = predictions[i] != null ? String(predictions[i]) : '';
    const actual = groundTruths[i];
    const inScoring = !scoringSet || (fileIds ? scoringSet.has(fileIds[i]) : true);

    if (isPendingPrediction(predictedStr)) {
      comparisonResults.push(null);
      if (inScoring) pendingPairs++;
      continue;
    }

    const isError = isErrorPrediction(predictedStr);
    const normalizedActual = !actual || normalizeText(actual) === '' ? NOT_PRESENT_VALUE : actual;
    const normalizedPredicted = !predictedStr || normalizeText(predictedStr) === '' ? NOT_PRESENT_VALUE : predictedStr;
    const groundTruthNotPresent = normalizedActual === NOT_PRESENT_VALUE;
    const predictedNotPresent = normalizedPredicted === NOT_PRESENT_VALUE;

    let comparisonResult: any = null;

    if (isError) {
      comparisonResult = {
        isMatch: false,
        matchType: 'none',
        matchClassification: 'none',
        confidence: 'high',
        error: 'extraction-error',
      };
    } else if (groundTruthNotPresent) {
      comparisonResult = predictedNotPresent
        ? { isMatch: true, matchType: 'exact', matchClassification: 'exact', confidence: 'high' }
        : { isMatch: false, matchType: 'none', matchClassification: 'none', confidence: 'high' };
    } else if (compareConfig) {
      const configWithFileId = { ...compareConfig };
      if (compareConfig.compareType === 'llm-judge' && fileIds && fileIds[i]) {
        configWithFileId.parameters = {
          ...compareConfig.parameters,
          fileId: fileIds[i],
        };
      }
      const { compareValues: compareValuesEngine } = await import('./compare-engine');
      comparisonResult = await compareValuesEngine(normalizedPredicted, normalizedActual, configWithFileId);
    } else {
      comparisonResult = compareValues(normalizedPredicted, normalizedActual);
    }

    comparisonResults.push(comparisonResult);

    if (!inScoring) {
      continue;
    }

    if (isError) {
      errorPairs++;
    }

    const pairArgs = {
      groundTruthNotPresent,
      predictedNotPresent,
      isError,
    };
    const lenientOutcome = outcomeForPair({ ...pairArgs, isMatch: Boolean(comparisonResult?.isMatch) });
    const strictOutcome = outcomeForPair({ ...pairArgs, isMatch: isStrictMatch(comparisonResult) });
    recordConfusion(lenient, lenientOutcome);
    recordConfusion(strict, strictOutcome);

    if (strictOutcome === 'tp') {
      examples.truePositives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    } else if (strictOutcome === 'tn') {
      examples.trueNegatives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    } else if (strictOutcome === 'fp') {
      examples.falsePositives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    } else {
      examples.falsePositives.push({ predicted: normalizedPredicted, actual: normalizedActual });
      examples.falseNegatives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    }
  }

  return metricsResultFromCounts(strict, lenient, errorPairs, pendingPairs, examples, comparisonResults);
}

/**
 * Calculates precision, recall, and F1 score with detailed debug information.
 *
 * FIXED: Wrong predictions now count as BOTH FP and FN for proper metrics calculation.
 *
 * @param predictions Array of predicted values from the model
 * @param groundTruths Array of ground truth values
 * @returns MetricsResult and debug information
 */
export function calculateFieldMetricsWithDebug(
  predictions: string[],
  groundTruths: string[]
): MetricsResult & { debug: MetricsDebugInfo } {
  if (predictions.length !== groundTruths.length) {
    throw new Error('Predictions and ground truths must have the same length');
  }

  if (predictions.length === 0) {
    return emptyMetricsResult();
  }

  const strict = createConfusionCounts();
  const lenient = createConfusionCounts();
  const examples = emptyExamples();
  let errorPairs = 0;
  let pendingPairs = 0;

  for (let i = 0; i < predictions.length; i++) {
    const predictedStr = predictions[i] != null ? String(predictions[i]) : '';
    const actual = groundTruths[i];

    if (isPendingPrediction(predictedStr)) {
      pendingPairs++;
      continue;
    }

    const isError = isErrorPrediction(predictedStr);
    const normalizedActual = !actual || normalizeText(actual) === '' ? NOT_PRESENT_VALUE : actual;
    const normalizedPredicted = !predictedStr || normalizeText(predictedStr) === '' ? NOT_PRESENT_VALUE : predictedStr;
    const groundTruthNotPresent = normalizedActual === NOT_PRESENT_VALUE;
    const predictedNotPresent = normalizedPredicted === NOT_PRESENT_VALUE;

    let comparisonResult: ReturnType<typeof compareValues> | null = null;
    if (!isError && !groundTruthNotPresent) {
      comparisonResult = compareValues(normalizedPredicted, normalizedActual);
    } else if (!isError && groundTruthNotPresent && predictedNotPresent) {
      comparisonResult = { isMatch: true, matchType: 'exact', matchClassification: 'exact', confidence: 'high' };
    }

    if (isError) {
      errorPairs++;
    }

    const pairArgs = {
      groundTruthNotPresent,
      predictedNotPresent,
      isError,
    };
    const lenientOutcome = outcomeForPair({ ...pairArgs, isMatch: Boolean(comparisonResult?.isMatch) });
    const strictOutcome = outcomeForPair({ ...pairArgs, isMatch: isStrictMatch(comparisonResult) });
    recordConfusion(lenient, lenientOutcome);
    recordConfusion(strict, strictOutcome);

    if (strictOutcome === 'tp') {
      examples.truePositives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    } else if (strictOutcome === 'tn') {
      examples.trueNegatives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    } else if (strictOutcome === 'fp') {
      examples.falsePositives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    } else {
      examples.falsePositives.push({ predicted: normalizedPredicted, actual: normalizedActual });
      examples.falseNegatives.push({ predicted: normalizedPredicted, actual: normalizedActual });
    }
  }

  const result = metricsResultFromCounts(strict, lenient, errorPairs, pendingPairs, examples);
  logger.debug('Confusion matrix', {
    matrix: {
      truePositives: result.debug.truePositives,
      falsePositives: result.debug.falsePositives,
      falseNegatives: result.debug.falseNegatives,
      trueNegatives: result.debug.trueNegatives,
    },
    metrics: {
      accuracy: (result.accuracy * 100).toFixed(1) + '%',
      lenientAccuracy: (result.lenientAccuracy * 100).toFixed(1) + '%',
      reliability: (result.reliability * 100).toFixed(1) + '%',
    },
  });
  return result;
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use calculateFieldMetrics instead
 */
export function calculateAccuracy(output: string, groundTruth: string): number {
  const result = calculateFieldMetrics([output], [groundTruth]);
  return result.accuracy;
}
