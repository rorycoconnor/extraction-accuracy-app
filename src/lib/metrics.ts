/**
 * Calculates performance metrics for metadata extraction comparison.
 * Handles text-based comparisons with normalization and partial matching.
 */

import { NOT_PRESENT_VALUE } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { FieldCompareConfig } from './compare-types';

export type MetricsResult = {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
};

export type MetricsDebugInfo = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  totalValidPairs: number;
  examples: {
    truePositives: Array<{predicted: string, actual: string}>;
    falsePositives: Array<{predicted: string, actual: string}>;
    falseNegatives: Array<{predicted: string, actual: string}>;
    trueNegatives: Array<{predicted: string, actual: string}>;
  };
};

export type ComparisonResult = {
  isMatch: boolean;
  matchType: 'exact' | 'normalized' | 'partial' | 'date_format' | 'none';
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
 * Enhanced date parser that handles multiple formats including:
 * - 2008-09-30, 2008/09/30
 * - 09/30/08, 09-30-08
 * - MAR-22-08, Mar-22-08
 * - 30/09/2008 (European)
 * - May 7, 2025, etc.
 */
function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  // Month abbreviations mapping (case insensitive)
  const monthMap: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };
  
  // Try various date patterns
  const patterns = [
    // YYYY-MM-DD, YYYY/MM/DD
    {
      regex: /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/,
      parse: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    },
    
    // MM/DD/YY, MM-DD-YY (2-digit year)
    {
      regex: /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/,
      parse: (match: RegExpMatchArray) => {
        const year = parseInt(match[3]);
        const fullYear = year < 50 ? 2000 + year : 1900 + year; // 49 and below = 20xx, 50+ = 19xx
        return new Date(fullYear, parseInt(match[1]) - 1, parseInt(match[2]));
      }
    },
    
    // MM/DD/YYYY, MM-DD-YYYY (4-digit year)
    {
      regex: /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
      parse: (match: RegExpMatchArray) => new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]))
    },
    
    // MON-DD-YY format (e.g., MAR-22-08)
    {
      regex: /^([a-z]{3})[-\/](\d{1,2})[-\/](\d{2})$/i,
      parse: (match: RegExpMatchArray) => {
        const monthNum = monthMap[match[1].toLowerCase()];
        if (monthNum === undefined) return null;
        const year = parseInt(match[3]);
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        return new Date(fullYear, monthNum, parseInt(match[2]));
      }
    },
    
    // MON-DD-YYYY format (e.g., MAR-22-2008)
    {
      regex: /^([a-z]{3})[-\/](\d{1,2})[-\/](\d{4})$/i,
      parse: (match: RegExpMatchArray) => {
        const monthNum = monthMap[match[1].toLowerCase()];
        if (monthNum === undefined) return null;
        return new Date(parseInt(match[3]), monthNum, parseInt(match[2]));
      }
    },
    
    // Month Name DD, YYYY (e.g., March 22, 2008)
    {
      regex: /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i,
      parse: (match: RegExpMatchArray) => {
        const monthNum = monthMap[match[1].toLowerCase()];
        if (monthNum === undefined) return null;
        return new Date(parseInt(match[3]), monthNum, parseInt(match[2]));
      }
    },
    
    // DD/MM/YYYY (European format - be careful with ambiguous dates)
    {
      regex: /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
      parse: (match: RegExpMatchArray) => {
        // This is the same as MM/DD/YYYY pattern, so we need context
        // For now, we'll try both interpretations if one fails
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        
        // If day > 12, it must be DD/MM format
        if (day > 12) {
          return new Date(year, month - 1, day);
        }
        // If month > 12, it must be MM/DD format  
        if (month > 12) {
          return new Date(year, day - 1, month);
        }
        // Ambiguous case - default to MM/DD (US format)
        return new Date(year, month - 1, day);
      }
    }
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      try {
        const date = pattern.parse(match);
        if (date && !isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  
  // Fallback to JavaScript's Date constructor for other formats
  try {
    const fallbackDate = new Date(trimmed);
    return !isNaN(fallbackDate.getTime()) ? fallbackDate : null;
  } catch {
    return null;
  }
}

/**
 * Enhanced comparison function that provides detailed match information.
 */
export function compareValues(predicted: string, actual: string): ComparisonResult {
  if (!predicted || !actual) {
    return { isMatch: false, matchType: 'none', confidence: 'high' };
  }
  
  // Skip pending/error states
  if (predicted.startsWith('Pending') || predicted.startsWith('Error') || predicted.startsWith('Not Found')) {
    return { isMatch: false, matchType: 'none', confidence: 'high' };
  }
  
  // Handle "Not Present" values - they match if both are "Not Present"
  if (predicted === NOT_PRESENT_VALUE && actual === NOT_PRESENT_VALUE) {
    return { isMatch: true, matchType: 'exact', confidence: 'high' };
  }
  
  // If one is "Not Present" and the other isn't, they don't match
  if (predicted === NOT_PRESENT_VALUE || actual === NOT_PRESENT_VALUE) {
    return { isMatch: false, matchType: 'none', confidence: 'high' };
  }
  
  // Exact string match (case-sensitive)
  if (predicted === actual) {
    return { isMatch: true, matchType: 'exact', confidence: 'high' };
  }
  
  const normalizedPredicted = normalizeText(predicted);
  const normalizedActual = normalizeText(actual);
  
  if (!normalizedPredicted || !normalizedActual) {
    return { isMatch: false, matchType: 'none', confidence: 'high' };
  }
  
  // Exact match after normalization (case-insensitive, punctuation removed)
  if (normalizedPredicted === normalizedActual) {
    return { isMatch: true, matchType: 'normalized', confidence: 'high' };
  }
  
  // 🔧 NEW: Handle multi-select fields (e.g., "A, B" matches "B, A")
  // Check if values contain commas (likely multi-select from Box)
  if (predicted.includes(',') || actual.includes(',')) {
    // Split by comma, trim whitespace, normalize, and sort
    const predictedItems = predicted.split(',').map(item => normalizeText(item.trim())).filter(item => item).sort();
    const actualItems = actual.split(',').map(item => normalizeText(item.trim())).filter(item => item).sort();
    
    // Compare as sorted arrays (order-independent)
    if (predictedItems.length === actualItems.length && 
        predictedItems.every((item, index) => item === actualItems[index])) {
      return { isMatch: true, matchType: 'normalized', confidence: 'high' };
    }
  }
  
  // Check for date format differences
  if (isDateLike(predicted) && isDateLike(actual)) {
    if (compareDates(predicted, actual)) {
      return { isMatch: true, matchType: 'date_format', confidence: 'high' };
    } else {
      return { isMatch: false, matchType: 'none', confidence: 'high' };
    }
  }
  
  // Partial match - check if one contains the other (useful for addresses, names, etc.)
  if (normalizedPredicted.includes(normalizedActual) || normalizedActual.includes(normalizedPredicted)) {
    return { isMatch: true, matchType: 'partial', confidence: 'medium' };
  }
  
  return { isMatch: false, matchType: 'none', confidence: 'high' };
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
  const result = calculateFieldMetricsWithDebug(predictions, groundTruths);
  return {
    accuracy: result.accuracy,
    precision: result.precision,
    recall: result.recall,
    f1Score: result.f1Score
  };
}

/**
 * Calculates precision, recall, and F1 score with detailed debug information (async version with compare engine).
 *
 * Uses the compare engine with configured compare types for accurate field-level comparisons.
 *
 * @param predictions Array of predicted values from the model
 * @param groundTruths Array of ground truth values
 * @param compareConfig Optional compare configuration for the field
 * @returns MetricsResult and debug information
 */
export async function calculateFieldMetricsWithDebugAsync(
  predictions: string[],
  groundTruths: string[],
  compareConfig?: FieldCompareConfig
): Promise<MetricsResult & { debug: MetricsDebugInfo }> {
  if (predictions.length !== groundTruths.length) {
    throw new Error('Predictions and ground truths must have the same length');
  }

  if (predictions.length === 0) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      debug: {
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        trueNegatives: 0,
        totalValidPairs: 0,
        examples: {
          truePositives: [],
          falsePositives: [],
          falseNegatives: [],
          trueNegatives: []
        }
      }
    };
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;
  let totalValidPairs = 0;

  const examples = {
    truePositives: [] as Array<{predicted: string, actual: string}>,
    falsePositives: [] as Array<{predicted: string, actual: string}>,
    falseNegatives: [] as Array<{predicted: string, actual: string}>,
    trueNegatives: [] as Array<{predicted: string, actual: string}>
  };

  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i];
    const actual = groundTruths[i];

    // Skip if prediction is in pending/error state
    if (!predicted || predicted.startsWith('Pending') || predicted.startsWith('Error')) {
      continue;
    }

    // Handle empty/missing ground truth - treat as "Not Present"
    const normalizedActual = !actual || normalizeText(actual) === '' ? NOT_PRESENT_VALUE : actual;
    const normalizedPredicted = !predicted || normalizeText(predicted) === '' ? NOT_PRESENT_VALUE : predicted;

    totalValidPairs++;

    // Case 1: Ground truth is "Not Present"
    if (normalizedActual === NOT_PRESENT_VALUE) {
      if (normalizedPredicted === NOT_PRESENT_VALUE) {
        trueNegatives++; // Model correctly predicted "Not Present"
        examples.trueNegatives.push({predicted: normalizedPredicted, actual: normalizedActual});
      } else {
        falsePositives++; // Model incorrectly predicted something when field should be empty
        examples.falsePositives.push({predicted: normalizedPredicted, actual: normalizedActual});
      }
    }
    // Case 2: Ground truth exists (is not "Not Present")
    else {
      // Use compare engine with configured compare type
      const match = await isMatchWithCompareEngine(normalizedPredicted, normalizedActual, compareConfig);

      if (match) {
        truePositives++; // Model correctly predicted the value
        examples.truePositives.push({predicted: normalizedPredicted, actual: normalizedActual});
      } else {
        // FIXED: Wrong predictions count as BOTH FP and FN
        // FP: Model predicted something wrong (predicted value is incorrect)
        // FN: Model failed to extract the correct ground truth value
        falsePositives++; // Predicted something wrong
        falseNegatives++; // Failed to extract the correct value
        examples.falsePositives.push({predicted: normalizedPredicted, actual: normalizedActual});
        examples.falseNegatives.push({predicted: normalizedPredicted, actual: normalizedActual});
      }
    }
  }

  // Calculate metrics using same logic as sync version
  if (totalValidPairs === 0) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      debug: {
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        trueNegatives: 0,
        totalValidPairs: 0,
        examples: {
          truePositives: [],
          falsePositives: [],
          falseNegatives: [],
          trueNegatives: []
        }
      }
    };
  }

  const accuracy = (truePositives + trueNegatives) / totalValidPairs;

  let precision: number;
  let recall: number;
  let f1Score: number;

  if (truePositives === 0 && falsePositives === 0 && falseNegatives === 0 && trueNegatives > 0) {
    precision = 1.0;
    recall = 1.0;
    f1Score = 1.0;
  } else {
    precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;
    recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }

  return {
    accuracy: Math.max(0, Math.min(1, accuracy)),
    precision: Math.max(0, Math.min(1, precision)),
    recall: Math.max(0, Math.min(1, recall)),
    f1Score: Math.max(0, Math.min(1, f1Score)),
    debug: {
      truePositives,
      falsePositives,
      falseNegatives,
      trueNegatives,
      totalValidPairs,
      examples
    }
  };
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
    return { 
      accuracy: 0, 
      precision: 0, 
      recall: 0, 
      f1Score: 0,
      debug: {
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        trueNegatives: 0,
        totalValidPairs: 0,
        examples: {
          truePositives: [],
          falsePositives: [],
          falseNegatives: [],
          trueNegatives: []
        }
      }
    };
  }
  
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;
  let totalValidPairs = 0;
  
  const examples = {
    truePositives: [] as Array<{predicted: string, actual: string}>,
    falsePositives: [] as Array<{predicted: string, actual: string}>,
    falseNegatives: [] as Array<{predicted: string, actual: string}>,
    trueNegatives: [] as Array<{predicted: string, actual: string}>
  };
  
  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i];
    const actual = groundTruths[i];
    
    // Skip if prediction is in pending/error state
    if (!predicted || predicted.startsWith('Pending') || predicted.startsWith('Error')) {
      continue;
    }
    
    // Handle empty/missing ground truth - treat as "Not Present"
    const normalizedActual = !actual || normalizeText(actual) === '' ? NOT_PRESENT_VALUE : actual;
    const normalizedPredicted = !predicted || normalizeText(predicted) === '' ? NOT_PRESENT_VALUE : predicted;
    
    totalValidPairs++;
    
    // Case 1: Ground truth is "Not Present"
    if (normalizedActual === NOT_PRESENT_VALUE) {
      if (normalizedPredicted === NOT_PRESENT_VALUE) {
        trueNegatives++; // Model correctly predicted "Not Present"
        examples.trueNegatives.push({predicted: normalizedPredicted, actual: normalizedActual});
      } else {
        falsePositives++; // Model incorrectly predicted something when field should be empty
        examples.falsePositives.push({predicted: normalizedPredicted, actual: normalizedActual});
      }
    }
    // Case 2: Ground truth exists (is not "Not Present")
    else {
      if (isMatch(normalizedPredicted, normalizedActual)) {
        truePositives++; // Model correctly predicted the value
        examples.truePositives.push({predicted: normalizedPredicted, actual: normalizedActual});
      } else {
        // FIXED: Wrong predictions count as BOTH FP and FN
        // FP: Model predicted something wrong (predicted value is incorrect)
        // FN: Model failed to extract the correct ground truth value
        falsePositives++; // Predicted something wrong
        falseNegatives++; // Failed to extract the correct value
        examples.falsePositives.push({predicted: normalizedPredicted, actual: normalizedActual});
        examples.falseNegatives.push({predicted: normalizedPredicted, actual: normalizedActual});
      }
    }
  }
  
  // Handle edge case where no valid pairs exist
  if (totalValidPairs === 0) {
    return { 
      accuracy: 0, 
      precision: 0, 
      recall: 0, 
      f1Score: 0,
      debug: {
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        trueNegatives: 0,
        totalValidPairs: 0,
        examples: {
          truePositives: [],
          falsePositives: [],
          falseNegatives: [],
          trueNegatives: []
        }
      }
    };
  }
  
  // Calculate metrics using standard formulas
  const accuracy = (truePositives + trueNegatives) / totalValidPairs;
  
  // Handle special case: when everything is correctly "Not Present"
  // This should be considered perfect performance, not 0%
  let precision: number;
  let recall: number;
  let f1Score: number;
  
  if (truePositives === 0 && falsePositives === 0 && falseNegatives === 0 && trueNegatives > 0) {
    // All classifications are True Negatives - perfect "Not Present" classification
    precision = 1.0;
    recall = 1.0;
    f1Score = 1.0;
  } else {
    // Standard precision/recall calculations
    precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;
    recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }
  
  // VALIDATION: Ensure F1 formula consistency and reasonable values
  if (precision > 0 && recall > 0) {
    const expectedF1 = (2 * precision * recall) / (precision + recall);
    const f1Diff = Math.abs(f1Score - expectedF1);
    if (f1Diff > 0.001) {
      logger.warn('Field-level F1 formula inconsistency', {
        calculated: f1Score.toFixed(3),
        expected: expectedF1.toFixed(3),
        diff: f1Diff.toFixed(3),
        counts: { truePositives, falsePositives, falseNegatives, trueNegatives }
      });
    }
  }
  
  // VALIDATION: Check for impossible metrics combinations
  if (precision >= 0.999 && falsePositives > 0) {
    logger.warn('Impossible metrics: Precision=100% but FP > 0', { falsePositives });
  }
  
  if (recall >= 0.999 && falseNegatives > 0) {
    logger.warn('Impossible metrics: Recall=100% but FN > 0', { falseNegatives });
  }
  
  // VALIDATION: Log confusion matrix for debugging
  if (truePositives + falsePositives + falseNegatives + trueNegatives > 0) {
    logger.debug('Confusion matrix', {
      matrix: { truePositives, falsePositives, falseNegatives, trueNegatives },
      metrics: {
        precision: (precision * 100).toFixed(1) + '%',
        recall: (recall * 100).toFixed(1) + '%',
        f1: (f1Score * 100).toFixed(1) + '%',
        accuracy: (accuracy * 100).toFixed(1) + '%'
      }
    });
  }
  
  // VALIDATION: Precision should be < 1.0 if any field accuracy < 1.0 (unless all are "Not Present")
  if (precision >= 0.999 && falsePositives === 0 && truePositives > 0) {
    logger.debug('Precision=100% validated', {
      counts: { truePositives, falsePositives, falseNegatives, trueNegatives }
    });
  }
  
  return {
    accuracy: Math.max(0, Math.min(1, accuracy)), // Clamp between 0 and 1
    precision: Math.max(0, Math.min(1, precision)),
    recall: Math.max(0, Math.min(1, recall)),
    f1Score: Math.max(0, Math.min(1, f1Score)),
    debug: {
      truePositives,
      falsePositives,
      falseNegatives,
      trueNegatives,
      totalValidPairs,
      examples
    }
  };
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use calculateFieldMetrics instead
 */
export function calculateAccuracy(output: string, groundTruth: string): number {
  const result = calculateFieldMetrics([output], [groundTruth]);
  return result.accuracy;
}
