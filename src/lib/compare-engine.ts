/**
 * Compare Engine - Executes comparisons based on configured compare types
 * Implements all comparison strategies defined in the PRD
 */

import type { FieldCompareConfig, ComparisonResult, CompareType } from './compare-types';
import { logger } from './logger';
import { NOT_PRESENT_VALUE } from './utils';

/**
 * Lightweight comparison used only for UI previews (non-async compare types)
 * Falls back to near-exact for LLM-judge so renders never await network calls
 */
export function compareValuesPreview(
  extractedValue: string,
  groundTruthValue: string,
  compareConfig: FieldCompareConfig
): ComparisonResult {
  // Handle empty/missing values
  if (!extractedValue && !groundTruthValue) {
    return {
      isMatch: true,
      matchType: compareConfig.compareType,
      confidence: 'high',
    };
  }

  // Handle "Not Present" values
  if (extractedValue === NOT_PRESENT_VALUE && groundTruthValue === NOT_PRESENT_VALUE) {
    return {
      isMatch: true,
      matchType: compareConfig.compareType,
      confidence: 'high',
    };
  }

  if (extractedValue === NOT_PRESENT_VALUE || groundTruthValue === NOT_PRESENT_VALUE) {
    return {
      isMatch: false,
      matchType: compareConfig.compareType,
      confidence: 'high',
    };
  }

  // Skip pending/error states
  if (
    extractedValue.startsWith('Pending') ||
    extractedValue.startsWith('Error') ||
    extractedValue.startsWith('Not Found')
  ) {
    return {
      isMatch: false,
      matchType: compareConfig.compareType,
      confidence: 'high',
      details: 'Skipped pending/error state',
    };
  }

  try {
    // Route to appropriate comparison function (sync only)
    switch (compareConfig.compareType) {
      case 'exact-string':
        return compareExactString(extractedValue, groundTruthValue);

      case 'near-exact-string':
        return compareNearExactString(extractedValue, groundTruthValue);

      case 'llm-judge':
        // For UI rendering, fall back to near-exact for LLM comparisons
        // (the actual metrics use the async LLM comparison)
        const fallback = compareNearExactString(extractedValue, groundTruthValue);
        return {
          ...fallback,
          matchType: 'llm-judge',
          details: 'UI preview (actual metrics use LLM)',
        };

      case 'exact-number':
        return compareExactNumber(extractedValue, groundTruthValue);

      case 'date-exact':
        return compareDateExact(extractedValue, groundTruthValue);

      case 'boolean':
        return compareBoolean(extractedValue, groundTruthValue);

      case 'list-unordered':
        return compareListUnordered(extractedValue, groundTruthValue, compareConfig);

      case 'list-ordered':
        return compareListOrdered(extractedValue, groundTruthValue, compareConfig);

      default:
        logger.error('Unknown compare type', { compareType: compareConfig.compareType });
        return {
          isMatch: false,
          matchType: compareConfig.compareType,
          confidence: 'low',
          error: `Unknown compare type: ${compareConfig.compareType}`,
        };
    }
  } catch (error) {
    logger.error('Comparison failed', {
      compareType: compareConfig.compareType,
      error: error as Error,
    });

    return {
      isMatch: false,
      matchType: compareConfig.compareType,
      confidence: 'low',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main comparison function that routes to specific comparison strategies
 */
export async function compareValues(
  extractedValue: string,
  groundTruthValue: string,
  compareConfig: FieldCompareConfig
): Promise<ComparisonResult> {
  // Handle empty/missing values
  if (!extractedValue && !groundTruthValue) {
    return {
      isMatch: true,
      matchType: compareConfig.compareType,
      confidence: 'high',
    };
  }

  // Handle "Not Present" values
  if (extractedValue === NOT_PRESENT_VALUE && groundTruthValue === NOT_PRESENT_VALUE) {
    return {
      isMatch: true,
      matchType: compareConfig.compareType,
      confidence: 'high',
    };
  }

  if (extractedValue === NOT_PRESENT_VALUE || groundTruthValue === NOT_PRESENT_VALUE) {
    return {
      isMatch: false,
      matchType: compareConfig.compareType,
      confidence: 'high',
    };
  }

  // Skip pending/error states
  if (
    extractedValue.startsWith('Pending') ||
    extractedValue.startsWith('Error') ||
    extractedValue.startsWith('Not Found')
  ) {
    return {
      isMatch: false,
      matchType: compareConfig.compareType,
      confidence: 'high',
      details: 'Skipped pending/error state',
    };
  }

  try {
    // Route to appropriate comparison function
    switch (compareConfig.compareType) {
      case 'exact-string':
        return compareExactString(extractedValue, groundTruthValue);

      case 'near-exact-string':
        return compareNearExactString(extractedValue, groundTruthValue);

      case 'llm-judge':
        return await compareLLMJudge(extractedValue, groundTruthValue, compareConfig);

      case 'exact-number':
        return compareExactNumber(extractedValue, groundTruthValue);

      case 'date-exact':
        return compareDateExact(extractedValue, groundTruthValue);

      case 'boolean':
        return compareBoolean(extractedValue, groundTruthValue);

      case 'list-unordered':
        return compareListUnordered(extractedValue, groundTruthValue, compareConfig);

      case 'list-ordered':
        return compareListOrdered(extractedValue, groundTruthValue, compareConfig);

      default:
        logger.error('Unknown compare type', { compareType: compareConfig.compareType });
        return {
          isMatch: false,
          matchType: compareConfig.compareType,
          confidence: 'low',
          error: `Unknown compare type: ${compareConfig.compareType}`,
        };
    }
  } catch (error) {
    logger.error('Comparison failed', {
      compareType: compareConfig.compareType,
      error: error as Error,
    });

    return {
      isMatch: false,
      matchType: compareConfig.compareType,
      confidence: 'low',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Exact String Match - Character-for-character comparison (case-sensitive)
 */
function compareExactString(extracted: string, groundTruth: string): ComparisonResult {
  const isMatch = extracted === groundTruth;

  return {
    isMatch,
    matchType: 'exact-string',
    confidence: 'high',
  };
}

/**
 * Near Exact Match - Normalized comparison ignoring whitespace and punctuation
 */
function compareNearExactString(extracted: string, groundTruth: string): ComparisonResult {
  const normalizedExtracted = normalizeText(extracted);
  const normalizedGroundTruth = normalizeText(groundTruth);

  const isMatch = normalizedExtracted === normalizedGroundTruth;

  return {
    isMatch,
    matchType: 'near-exact-string',
    confidence: 'high',
  };
}

/**
 * Normalize text for near-exact comparison
 * - Convert to lowercase
 * - Remove all punctuation
 * - Normalize whitespace (multiple spaces → single space, trim)
 */
function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * LLM as Judge - Semantic comparison using Box AI
 */
async function compareLLMJudge(
  extracted: string,
  groundTruth: string,
  compareConfig: FieldCompareConfig
): Promise<ComparisonResult> {
  const comparisonPrompt =
    compareConfig.parameters?.comparisonPrompt ||
    'Determine if these two values are semantically equivalent. Focus on meaning rather than exact phrasing.';

  try {
    // Dynamic import to avoid issues with server actions in client code
    const { evaluateWithLLM } = await import('@/ai/flows/llm-comparison');

    const result = await evaluateWithLLM({
      groundTruthValue: groundTruth,
      extractedValue: extracted,
      comparisonPrompt,
      fileId: compareConfig.parameters?.fileId,
    });

    if (result.error) {
      logger.error('LLM comparison returned error', { error: result.error });
      console.error('🤖 LLM Judge - Error:', {
        extracted,
        groundTruth,
        error: result.error,
        prompt: comparisonPrompt
      });

      // Fallback to near-exact match on error
      const fallbackResult = compareNearExactString(extracted, groundTruth);
      return {
        ...fallbackResult,
        matchType: 'llm-judge',
        details: `LLM error (fallback used): ${result.error}`,
        error: result.error,
      };
    }

    // Console log the LLM judge decision for debugging
    console.log('🤖 LLM Judge Decision:', {
      extracted,
      groundTruth,
      isMatch: result.isMatch,
      reasoning: result.reason,
      prompt: comparisonPrompt,
      fieldKey: compareConfig.fieldKey
    });

    return {
      isMatch: result.isMatch,
      matchType: 'llm-judge',
      confidence: 'medium', // LLM results have medium confidence due to non-determinism
      details: result.reason,
    };
  } catch (error) {
    logger.error('Failed to call LLM comparison', { error: error as Error });
    console.error('🤖 LLM Judge - Exception:', {
      extracted,
      groundTruth,
      error: error instanceof Error ? error.message : 'Unknown error',
      prompt: comparisonPrompt,
      fallback: 'Using near-exact match'
    });

    // Fallback to near-exact match on error
    const fallbackResult = compareNearExactString(extracted, groundTruth);
    return {
      ...fallbackResult,
      matchType: 'llm-judge',
      details: 'LLM comparison failed, used near-exact fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Exact Numeric Match - Exact numeric equality after parsing
 */
function compareExactNumber(extracted: string, groundTruth: string): ComparisonResult {
  const extractedNum = parseNumber(extracted);
  const groundTruthNum = parseNumber(groundTruth);

  if (extractedNum === null || groundTruthNum === null) {
    return {
      isMatch: false,
      matchType: 'exact-number',
      confidence: 'high',
      details: 'Failed to parse as number',
    };
  }

  const isMatch = extractedNum === groundTruthNum;

  return {
    isMatch,
    matchType: 'exact-number',
    confidence: 'high',
  };
}

/**
 * Parse number from string, handling currency symbols and commas
 */
function parseNumber(text: string): number | null {
  if (!text || typeof text !== 'string') return null;

  // Remove currency symbols, commas, and whitespace
  const cleaned = text
    .replace(/[$€£¥,\s]/g, '')
    .trim();

  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

/**
 * Date Exact Match - Date equality with flexible format parsing
 */
function compareDateExact(extracted: string, groundTruth: string): ComparisonResult {
  const extractedDate = parseFlexibleDate(extracted);
  const groundTruthDate = parseFlexibleDate(groundTruth);

  if (!extractedDate || !groundTruthDate) {
    return {
      isMatch: false,
      matchType: 'date-exact',
      confidence: 'high',
      details: 'Failed to parse as date',
    };
  }

  // Compare using ISO date strings (ignoring time)
  const iso1 = extractedDate.toISOString().split('T')[0];
  const iso2 = groundTruthDate.toISOString().split('T')[0];

  const isMatch = iso1 === iso2;

  return {
    isMatch,
    matchType: 'date-exact',
    confidence: 'high',
  };
}

/**
 * Enhanced date parser that handles multiple formats
 * Reuses the logic from metrics.ts
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
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
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

  // Fallback to JavaScript's Date constructor
  try {
    const fallbackDate = new Date(trimmed);
    return !isNaN(fallbackDate.getTime()) ? fallbackDate : null;
  } catch {
    return null;
  }
}

/**
 * Boolean Match - Boolean/Yes-No comparison with flexible parsing
 */
function compareBoolean(extracted: string, groundTruth: string): ComparisonResult {
  const extractedBool = parseBoolean(extracted);
  const groundTruthBool = parseBoolean(groundTruth);

  if (extractedBool === null || groundTruthBool === null) {
    return {
      isMatch: false,
      matchType: 'boolean',
      confidence: 'high',
      details: 'Failed to parse as boolean',
    };
  }

  const isMatch = extractedBool === groundTruthBool;

  return {
    isMatch,
    matchType: 'boolean',
    confidence: 'high',
  };
}

/**
 * Parse boolean from string
 */
function parseBoolean(text: string): boolean | null {
  if (!text || typeof text !== 'string') return null;

  const normalized = text.toLowerCase().trim();

  // True values
  if (['true', 'yes', 'y', '1', '✓', 'checked'].includes(normalized)) {
    return true;
  }

  // False values
  if (['false', 'no', 'n', '0', 'unchecked'].includes(normalized)) {
    return false;
  }

  return null;
}

/**
 * List Match (Order Insensitive) - Compare lists/arrays ignoring order
 */
function compareListUnordered(
  extracted: string,
  groundTruth: string,
  compareConfig: FieldCompareConfig
): ComparisonResult {
  const separator = compareConfig.parameters?.separator || ',';

  const extractedItems = parseList(extracted, separator);
  const groundTruthItems = parseList(groundTruth, separator);

  // Sort both lists for order-independent comparison
  const sortedExtracted = [...extractedItems].sort();
  const sortedGroundTruth = [...groundTruthItems].sort();

  const isMatch =
    sortedExtracted.length === sortedGroundTruth.length &&
    sortedExtracted.every((item, index) => item === sortedGroundTruth[index]);

  return {
    isMatch,
    matchType: 'list-unordered',
    confidence: 'high',
  };
}

/**
 * List Match (Order Sensitive) - Compare lists/arrays with order preservation
 */
function compareListOrdered(
  extracted: string,
  groundTruth: string,
  compareConfig: FieldCompareConfig
): ComparisonResult {
  const separator = compareConfig.parameters?.separator || ',';

  const extractedItems = parseList(extracted, separator);
  const groundTruthItems = parseList(groundTruth, separator);

  const isMatch =
    extractedItems.length === groundTruthItems.length &&
    extractedItems.every((item, index) => item === groundTruthItems[index]);

  return {
    isMatch,
    matchType: 'list-ordered',
    confidence: 'high',
  };
}

/**
 * Parse list from string with given separator
 */
function parseList(text: string, separator: string): string[] {
  if (!text || typeof text !== 'string') return [];

  return text
    .split(separator)
    .map(item => normalizeText(item))
    .filter(item => item.length > 0);
}
