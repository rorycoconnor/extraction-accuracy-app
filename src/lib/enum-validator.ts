/**
 * Enum/MultiSelect Field Validator
 * 
 * Validates and normalizes extracted values for dropdown/taxonomy fields
 * against the predefined options from the Box metadata template.
 */

import { logger } from './logger';
import { NOT_PRESENT_VALUE } from './utils';

export interface EnumOption {
  key: string;
}

/**
 * Normalize a string for comparison (lowercase, remove special chars, trim)
 */
function normalizeForComparison(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Check if two strings are similar enough to be considered a match
 * Uses normalized comparison and substring matching
 */
function isSimilar(extracted: string, option: string): boolean {
  const normalizedExtracted = normalizeForComparison(extracted);
  const normalizedOption = normalizeForComparison(option);
  
  // Exact match after normalization
  if (normalizedExtracted === normalizedOption) {
    return true;
  }
  
  // Check if one contains the other (for cases like "USA" vs "United States of America")
  if (normalizedExtracted.includes(normalizedOption) || normalizedOption.includes(normalizedExtracted)) {
    return true;
  }
  
  // Check for common abbreviations and variations
  // Map from abbreviation to full names
  const abbreviationMap: Record<string, string[]> = {
    'usa': ['united states', 'united states of america'],
    'us': ['united states', 'united states of america'],
    'uk': ['united kingdom', 'great britain', 'britain'],
    'uae': ['united arab emirates'],
    'jpn': ['japan'],
    'jp': ['japan'],
    'chn': ['china'],
    'cn': ['china'],
    'deu': ['germany'],
    'de': ['germany'],
    'fra': ['france'],
    'fr': ['france'],
    'gbr': ['united kingdom', 'great britain'],
    'can': ['canada'],
    'ca': ['canada'],
    'aus': ['australia'],
    'au': ['australia'],
    'nzl': ['new zealand'],
    'nz': ['new zealand'],
    'ind': ['india'],
    'in': ['india'],
  };
  
  // Check if extracted value matches any known abbreviation
  // Only match if the FULL NAME is in the list (not just contains)
  for (const [abbrev, fullNames] of Object.entries(abbreviationMap)) {
    if (normalizedExtracted === abbrev) {
      // Extracted is abbreviation, check if option is one of the full names
      if (fullNames.some(name => normalizedOption === name || normalizedOption.includes(name))) {
        return true;
      }
    }
    if (normalizedOption === abbrev) {
      // Option is abbreviation, check if extracted is one of the full names
      if (fullNames.some(name => normalizedExtracted === name || normalizedExtracted.includes(name))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Find the best matching option for an extracted value
 * Returns the exact option key if a match is found, or null if no match
 */
export function findMatchingOption(
  extractedValue: string,
  options: EnumOption[],
  fieldKey: string
): string | null {
  if (!extractedValue || !options || options.length === 0) {
    return null;
  }
  
  // Try exact match first (case-sensitive)
  const exactMatch = options.find(opt => opt.key === extractedValue);
  if (exactMatch) {
    logger.debug('Enum exact match found', { fieldKey, extractedValue, matchedOption: exactMatch.key });
    return exactMatch.key;
  }
  
  // Try case-insensitive exact match
  const caseInsensitiveMatch = options.find(opt => 
    opt.key.toLowerCase() === extractedValue.toLowerCase()
  );
  if (caseInsensitiveMatch) {
    logger.debug('Enum case-insensitive match found', { fieldKey, extractedValue, matchedOption: caseInsensitiveMatch.key });
    return caseInsensitiveMatch.key;
  }
  
  // Try fuzzy matching (normalized comparison and substring matching)
  const fuzzyMatch = options.find(opt => isSimilar(extractedValue, opt.key));
  if (fuzzyMatch) {
    logger.info('Enum fuzzy match found', { fieldKey, extractedValue, matchedOption: fuzzyMatch.key });
    return fuzzyMatch.key;
  }
  
  // No match found
  logger.warn('No matching enum option found', { 
    fieldKey, 
    extractedValue, 
    availableOptions: options.map(o => o.key).join(', ')
  });
  return null;
}

/**
 * Validate and normalize a single enum field value
 * Returns the matched option key or NOT_PRESENT_VALUE if no match
 */
export function validateEnumValue(
  extractedValue: string | null | undefined,
  options: EnumOption[],
  fieldKey: string
): string {
  // Handle empty/null values
  if (!extractedValue || extractedValue === '' || extractedValue === NOT_PRESENT_VALUE) {
    return NOT_PRESENT_VALUE;
  }
  
  // Find matching option
  const matchedOption = findMatchingOption(extractedValue, options, fieldKey);
  
  if (matchedOption) {
    return matchedOption;
  }
  
  // No match found - log warning and return Not Present
  logger.warn('Extracted enum value does not match any option', {
    fieldKey,
    extractedValue,
    availableOptions: options.map(o => o.key)
  });
  
  return NOT_PRESENT_VALUE;
}

/**
 * Validate and normalize a multiSelect field value
 * Input can be a string (comma/pipe separated) or array
 * Returns pipe-separated string of matched option keys
 */
export function validateMultiSelectValue(
  extractedValue: string | string[] | null | undefined,
  options: EnumOption[],
  fieldKey: string
): string {
  // Handle empty/null values
  if (!extractedValue || extractedValue === '' || extractedValue === NOT_PRESENT_VALUE) {
    return NOT_PRESENT_VALUE;
  }
  
  // Parse into array of values
  let values: string[];
  if (Array.isArray(extractedValue)) {
    values = extractedValue;
  } else if (typeof extractedValue === 'string') {
    // Split by pipe or comma
    const separator = extractedValue.includes('|') ? '|' : ',';
    values = extractedValue.split(separator).map(v => v.trim()).filter(v => v);
  } else {
    logger.warn('Invalid multiSelect value type', { fieldKey, extractedValue, type: typeof extractedValue });
    return NOT_PRESENT_VALUE;
  }
  
  // Find matching options for each value
  const matchedOptions: string[] = [];
  const unmatchedValues: string[] = [];
  
  for (const value of values) {
    const matchedOption = findMatchingOption(value, options, fieldKey);
    if (matchedOption) {
      matchedOptions.push(matchedOption);
    } else {
      unmatchedValues.push(value);
    }
  }
  
  // Log unmatched values
  if (unmatchedValues.length > 0) {
    logger.warn('Some multiSelect values did not match any option', {
      fieldKey,
      unmatchedValues,
      matchedOptions,
      availableOptions: options.map(o => o.key)
    });
  }
  
  // Return matched options as pipe-separated string
  if (matchedOptions.length > 0) {
    return matchedOptions.join(' | ');
  }
  
  return NOT_PRESENT_VALUE;
}

