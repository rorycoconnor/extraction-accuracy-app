/**
 * Compare Engine - Executes comparisons based on configured compare types
 * Implements all comparison strategies defined in the PRD
 */

import type { FieldCompareConfig, ComparisonResult, CompareType, MatchClassification } from './compare-types';
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

  // Special handling for boolean fields: "Not Present" is semantically equivalent to "No"
  // If a document doesn't have a "termination for convenience" clause, the answer is "No"
  if (compareConfig.compareType === 'boolean') {
    const normalizedExtracted = extractedValue === NOT_PRESENT_VALUE ? 'No' : extractedValue;
    const normalizedGroundTruth = groundTruthValue === NOT_PRESENT_VALUE ? 'No' : groundTruthValue;
    return compareBoolean(normalizedExtracted, normalizedGroundTruth);
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

      // Note: 'boolean' is handled above before the switch statement
      // to support "Not Present" = "No" semantic equivalence

      case 'list-unordered':
        return compareListUnordered(extractedValue, groundTruthValue, compareConfig);

      case 'list-ordered':
        return compareListOrdered(extractedValue, groundTruthValue, compareConfig);

      default:
        logger.error('Unknown compare type in preview', { compareType: compareConfig.compareType });
        return {
          isMatch: false,
          matchType: compareConfig.compareType as CompareType,
          confidence: 'low',
          error: `Unknown compare type: ${compareConfig.compareType}`,
        };
    }
  } catch (error) {
    logger.error('Comparison failed in preview', {
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

  // Special handling for boolean fields: "Not Present" is semantically equivalent to "No"
  // If a document doesn't have a "termination for convenience" clause, the answer is "No"
  if (compareConfig.compareType === 'boolean') {
    const normalizedExtracted = extractedValue === NOT_PRESENT_VALUE ? 'No' : extractedValue;
    const normalizedGroundTruth = groundTruthValue === NOT_PRESENT_VALUE ? 'No' : groundTruthValue;
    return compareBoolean(normalizedExtracted, normalizedGroundTruth);
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

      // Note: 'boolean' is handled above before the switch statement
      // to support "Not Present" = "No" semantic equivalence

      case 'list-unordered':
        return compareListUnordered(extractedValue, groundTruthValue, compareConfig);

      case 'list-ordered':
        return compareListOrdered(extractedValue, groundTruthValue, compareConfig);

      default:
        logger.error('Unknown compare type in async compare', { compareType: compareConfig.compareType });
        return {
          isMatch: false,
          matchType: compareConfig.compareType as CompareType,
          confidence: 'low',
          error: `Unknown compare type: ${compareConfig.compareType}`,
        };
    }
  } catch (error) {
    logger.error('Comparison failed in async compare', {
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
    matchClassification: isMatch ? 'exact' : 'none',
  };
}

/**
 * Near Exact Match - Normalized comparison ignoring whitespace and punctuation
 * Enhanced with partial matching and multi-value handling
 */
function compareNearExactString(extracted: string, groundTruth: string): ComparisonResult {
  const normalizedExtracted = normalizeText(extracted);
  const normalizedGroundTruth = normalizeText(groundTruth);

  // Exact normalized match
  if (normalizedExtracted === normalizedGroundTruth) {
    return {
      isMatch: true,
      matchType: 'near-exact-string',
      confidence: 'high',
      matchClassification: 'normalized',
    };
  }

  // Multi-value check: if extracted has multiple values (comma or pipe separated), check if any match ground truth
  const extractedSeparator = extracted.includes('|') ? '|' : ',';
  const groundTruthSeparator = groundTruth.includes('|') ? '|' : ',';
  
  if (extracted.includes(extractedSeparator)) {
    const extractedItems = extracted.split(extractedSeparator).map(s => normalizeText(s.trim())).filter(s => s);
    if (extractedItems.some(item => item === normalizedGroundTruth)) {
      return {
        isMatch: true,
        matchType: 'near-exact-string',
        confidence: 'high',
        matchClassification: 'partial',
        details: 'Ground truth found in multi-value extracted field',
      };
    }
    // Also check if ground truth contains any of the extracted items (or vice versa)
    if (extractedItems.some(item => 
      normalizedGroundTruth.includes(item) || 
      item.includes(normalizedGroundTruth) ||
      // Check core names (without suffixes like "plc", "inc")
      (extractCoreNames(item) && extractCoreNames(item) === extractCoreNames(groundTruth))
    )) {
      return {
        isMatch: true,
        matchType: 'near-exact-string',
        confidence: 'medium',
        matchClassification: 'partial',
        details: 'Partial match found in multi-value extracted field',
      };
    }
  }

  // Also check if ground truth has multiple values
  if (groundTruth.includes(groundTruthSeparator)) {
    const groundTruthItems = groundTruth.split(groundTruthSeparator).map(s => normalizeText(s.trim())).filter(s => s);
    if (groundTruthItems.some(item => item === normalizedExtracted)) {
      return {
        isMatch: true,
        matchType: 'near-exact-string',
        confidence: 'high',
        matchClassification: 'partial',
        details: 'Extracted value found in multi-value ground truth',
      };
    }
    // Check for partial matches in ground truth items
    if (groundTruthItems.some(item => 
      item.includes(normalizedExtracted) || 
      normalizedExtracted.includes(item) ||
      (extractCoreNames(item) && extractCoreNames(item) === extractCoreNames(extracted))
    )) {
      return {
        isMatch: true,
        matchType: 'near-exact-string',
        confidence: 'medium',
        matchClassification: 'partial',
        details: 'Partial match found in multi-value ground truth',
      };
    }
  }

  // Partial match: one contains the other (useful for addresses, names, etc.)
  const minLength = 3; // Avoid matching very short substrings
  if (normalizedExtracted.length >= minLength && normalizedGroundTruth.length >= minLength) {
    if (normalizedExtracted.includes(normalizedGroundTruth)) {
      return {
        isMatch: true,
        matchType: 'near-exact-string',
        confidence: 'medium',
        matchClassification: 'partial',
        details: 'Ground truth is contained in extracted value',
      };
    }
    if (normalizedGroundTruth.includes(normalizedExtracted)) {
      return {
        isMatch: true,
        matchType: 'near-exact-string',
        confidence: 'medium',
        matchClassification: 'partial',
        details: 'Extracted value is contained in ground truth',
      };
    }
  }

  return {
    isMatch: false,
    matchType: 'near-exact-string',
    confidence: 'high',
    matchClassification: 'none',
  };
}

/**
 * Normalize text for near-exact comparison
 * - Convert to lowercase
 * - Remove redundant parenthetical numbers (e.g., "sixty (60)" → "sixty")
 * - Convert written numbers to digits (e.g., "sixty" → "60")
 * - Normalize duration/period values to days (e.g., "2 years" → "730 days")
 * - Remove all punctuation except numbers
 * - Normalize whitespace (multiple spaces → single space, trim)
 */
function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Word-to-number mappings
  const wordToNumber: Record<string, string> = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
    'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
    'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
    'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
    'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
  };

  let normalized = text.toLowerCase();

  // Remove redundant parenthetical numbers that match written words
  // e.g., "sixty (60)" → "sixty", "thirty (30)" → "thirty"
  Object.entries(wordToNumber).forEach(([word, digit]) => {
    const parenPattern = new RegExp('\\b' + word + '\\s*\\(' + digit + '\\)', 'gi');
    normalized = normalized.replace(parenPattern, word);
  });

  // Convert written numbers to digits
  Object.entries(wordToNumber).forEach(([word, digit]) => {
    const regex = new RegExp('\\b' + word + '\\b', 'gi');
    normalized = normalized.replace(regex, digit);
  });

  // Normalize durations to a common format (days)
  normalized = normalizeDuration(normalized);

  return normalized
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Normalize duration expressions to months for comparison
 * Using months as the common unit since it's the most common unit in contracts
 * e.g., "2 years" → "24 months", "24 months" → "24 months", "365 days" → "12 months"
 */
function normalizeDuration(text: string): string {
  // Duration patterns: number + unit → convert to months
  const durationPatterns = [
    // Years to months (12 months per year)
    { pattern: /(\d+)\s*years?/gi, toMonths: (num: number) => num * 12 },
    // Weeks to approximate months (4.33 weeks per month)
    { pattern: /(\d+)\s*weeks?/gi, toMonths: (num: number) => Math.round(num / 4.33) },
  ];

  let result = text;

  for (const { pattern, toMonths } of durationPatterns) {
    result = result.replace(pattern, (match, num) => {
      const months = toMonths(parseInt(num, 10));
      return `${months} months`;
    });
  }

  // Also normalize "days" to months if the number is large enough
  result = result.replace(/(\d+)\s*days?/gi, (match, num) => {
    const days = parseInt(num, 10);
    // Only convert to months if 28+ days (approximately a month)
    if (days >= 28) {
      const months = Math.round(days / 30);
      if (months > 0) {
        return `${months} months`;
      }
    }
    return `${days} days`;
  });

  return result;
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
      matchClassification: result.isMatch ? 'normalized' : 'none',
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
      matchClassification: 'none',
      details: 'Failed to parse as number',
    };
  }

  const isMatch = extractedNum === groundTruthNum;

  // Check if formats were different (e.g., "12000000" vs "12 million")
  const formatsDifferent = isMatch && extracted.trim() !== groundTruth.trim();

  return {
    isMatch,
    matchType: 'exact-number',
    confidence: 'high',
    matchClassification: isMatch ? (formatsDifferent ? 'different-format' : 'exact') : 'none',
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
      matchClassification: 'none',
      details: 'Failed to parse as date',
    };
  }

  // Compare using ISO date strings (ignoring time)
  const iso1 = extractedDate.toISOString().split('T')[0];
  const iso2 = groundTruthDate.toISOString().split('T')[0];

  const isMatch = iso1 === iso2;
  
  // Check if the original formats were different
  const formatsDifferent = isMatch && extracted.trim().toLowerCase() !== groundTruth.trim().toLowerCase();

  return {
    isMatch,
    matchType: 'date-exact',
    confidence: 'high',
    matchClassification: isMatch ? (formatsDifferent ? 'different-format' : 'exact') : 'none',
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
      matchClassification: 'none',
      details: 'Failed to parse as boolean',
    };
  }

  const isMatch = extractedBool === groundTruthBool;
  
  // Check if formats were different (e.g., "Yes" vs "true")
  const formatsDifferent = isMatch && extracted.trim().toLowerCase() !== groundTruth.trim().toLowerCase();

  return {
    isMatch,
    matchType: 'boolean',
    confidence: 'high',
    matchClassification: isMatch ? (formatsDifferent ? 'different-format' : 'exact') : 'none',
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
 * Enhanced with auto-detect separator and partial matching
 */
function compareListUnordered(
  extracted: string,
  groundTruth: string,
  compareConfig: FieldCompareConfig
): ComparisonResult {
  // Auto-detect separator if not specified
  const separator = compareConfig.parameters?.separator || detectSeparator(extracted, groundTruth);

  const extractedItems = parseList(extracted, separator);
  const groundTruthItems = parseList(groundTruth, separator);

  // Sort both lists for order-independent comparison
  const sortedExtracted = [...extractedItems].sort();
  const sortedGroundTruth = [...groundTruthItems].sort();

  // Exact match (all items match, order independent)
  const exactMatch =
    sortedExtracted.length === sortedGroundTruth.length &&
    sortedExtracted.every((item, index) => item === sortedGroundTruth[index]);

  if (exactMatch) {
    // Check if original order was different
    const orderDifferent = extractedItems.some((item, index) => item !== groundTruthItems[index]);
    return {
      isMatch: true,
      matchType: 'list-unordered',
      confidence: 'high',
      matchClassification: orderDifferent ? 'different-format' : 'normalized',
      details: orderDifferent ? 'Same items in different order' : undefined,
    };
  }

  // More flexible partial matching for lists
  // Check how many items match (exact or contain each other)
  let matchedGroundTruthItems = 0;
  let matchedExtractedItems = 0;
  
  for (const gtItem of groundTruthItems) {
    const hasMatch = sortedExtracted.some(extItem => 
      extItem === gtItem || 
      extItem.includes(gtItem) || 
      gtItem.includes(extItem) ||
      // Also check if core names match (ignoring titles/suffixes)
      extractCoreNames(extItem) === extractCoreNames(gtItem)
    );
    if (hasMatch) matchedGroundTruthItems++;
  }
  
  for (const extItem of extractedItems) {
    const hasMatch = sortedGroundTruth.some(gtItem => 
      gtItem === extItem || 
      gtItem.includes(extItem) || 
      extItem.includes(gtItem) ||
      extractCoreNames(gtItem) === extractCoreNames(extItem)
    );
    if (hasMatch) matchedExtractedItems++;
  }
  
  // If most ground truth items are found (≥50%), consider it a partial match
  const gtMatchPercentage = groundTruthItems.length > 0 ? matchedGroundTruthItems / groundTruthItems.length : 0;
  const extMatchPercentage = extractedItems.length > 0 ? matchedExtractedItems / extractedItems.length : 0;
  
  if (gtMatchPercentage >= 0.5 || extMatchPercentage >= 0.5) {
    // If all match, it's normalized; otherwise partial
    const allMatch = gtMatchPercentage === 1.0 && extMatchPercentage === 1.0;
    return {
      isMatch: true,
      matchType: 'list-unordered',
      confidence: allMatch ? 'high' : 'medium',
      matchClassification: allMatch ? 'normalized' : 'partial',
      details: allMatch 
        ? 'All items match with possible variations' 
        : `${matchedGroundTruthItems}/${groundTruthItems.length} ground truth items found`,
    };
  }

  return {
    isMatch: false,
    matchType: 'list-unordered',
    confidence: 'high',
    matchClassification: 'none',
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
  // Auto-detect separator if not specified
  const separator = compareConfig.parameters?.separator || detectSeparator(extracted, groundTruth);

  const extractedItems = parseList(extracted, separator);
  const groundTruthItems = parseList(groundTruth, separator);

  const exactMatch =
    extractedItems.length === groundTruthItems.length &&
    extractedItems.every((item, index) => item === groundTruthItems[index]);

  if (exactMatch) {
    return {
      isMatch: true,
      matchType: 'list-ordered',
      confidence: 'high',
      matchClassification: 'normalized',
    };
  }

  // Check for same items but different order
  const sortedExtracted = [...extractedItems].sort();
  const sortedGroundTruth = [...groundTruthItems].sort();
  const sameItemsDifferentOrder =
    sortedExtracted.length === sortedGroundTruth.length &&
    sortedExtracted.every((item, index) => item === sortedGroundTruth[index]);

  if (sameItemsDifferentOrder) {
    return {
      isMatch: false,  // Order matters for list-ordered
      matchType: 'list-ordered',
      confidence: 'high',
      matchClassification: 'different-format',
      details: 'Same items but in different order',
    };
  }

  return {
    isMatch: false,
    matchType: 'list-ordered',
    confidence: 'high',
    matchClassification: 'none',
  };
}

/**
 * Extract core names from a string containing names with titles/roles
 * e.g., "Jeffrey D. Fox (Managing Director)" → "jeffrey d fox"
 * e.g., "Otkritie Investments Cyprus Limited | QIWI plc" → "otkritie investments cyprus limited qiwi plc"
 */
function extractCoreNames(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text.toLowerCase();
  
  // Remove common title suffixes
  const suffixes = [
    'inc', 'llc', 'ltd', 'limited', 'plc', 'corp', 'corporation', 
    'gmbh', 'sa', 'bv', 'ag', 'na'
  ];
  
  // Remove parenthetical content (titles, roles)
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  
  // Remove common titles/prefixes
  cleaned = cleaned.replace(/\b(mr|mrs|ms|dr|prof|sir|dame|lord|lady)\b\.?/gi, '');
  
  // Normalize
  cleaned = normalizeText(cleaned);
  
  return cleaned;
}

/**
 * Auto-detect the separator used in list values
 * Prefers pipe | over comma , as it's more explicit
 */
function detectSeparator(extracted: string, groundTruth: string): string {
  // Check for pipe separator (commonly used for entity lists)
  if (extracted.includes('|') || groundTruth.includes('|')) {
    return '|';
  }
  // Default to comma
  return ',';
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
