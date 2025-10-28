/**
 * Semantic Matching Module
 * 
 * Provides semantic/fuzzy matching capabilities for document context finding.
 * This module is designed to be easily removable if needed.
 * 
 * Features:
 * - Acronym expansion (NDA ↔ Non Disclosure Agreement)
 * - Bidirectional matching
 * - Easy dictionary management
 * - Enable/disable controls
 */

import { logger } from '@/lib/logger';

// ==========================================
// CONFIGURATION
// ==========================================

/**
 * Global configuration for semantic matching
 */
export interface SemanticMatchConfig {
  enabled: boolean;
  confidence: 'high' | 'medium' | 'low';
  caseSensitive: boolean;
  debug: boolean;
}

export const DEFAULT_SEMANTIC_CONFIG: SemanticMatchConfig = {
  enabled: true,
  confidence: 'medium',
  caseSensitive: false,
  debug: false
};

// ==========================================
// SEMANTIC DICTIONARIES
// ==========================================

/**
 * High-confidence acronym expansions
 * Only add mappings that are almost always correct
 */
export const ACRONYM_EXPANSIONS: Record<string, string[]> = {
  // Contract types (from actual enum options)
  'NDA': ['Non Disclosure Agreement', 'Non-Disclosure Agreement', 'Nondisclosure Agreement'],
  'DPA': ['Data Processing Agreement', 'Data Protection Agreement'],
  'MSA': ['Master Service Agreement', 'Master Services Agreement'],
  'SOW': ['Statement of Work', 'Statement of Works'],
  'SLA': ['Service Level Agreement', 'Service-Level Agreement'],
  
  // Business entities (very common)
  'LLC': ['Limited Liability Company', 'L.L.C.', 'L L C'],
  'Corp': ['Corporation', 'Corp.'],
  'Inc': ['Incorporated', 'Inc.'],
  'Ltd': ['Limited', 'Ltd.', 'Limited Company'],
  
  // Insurance terms (from insurance template)
  'GL': ['General Liability'],
  'WC': ['Workers Compensation', 'Workers Comp', 'Workers\' Compensation'],
  'E&O': ['Errors and Omissions', 'Errors & Omissions'],
  'D&O': ['Directors and Officers', 'Directors & Officers'],
  
  // Executive titles
  'CEO': ['Chief Executive Officer', 'C.E.O.'],
  'CFO': ['Chief Financial Officer', 'C.F.O.'],
  'CTO': ['Chief Technology Officer', 'C.T.O.'],
  'COO': ['Chief Operating Officer', 'C.O.O.'],
  'VP': ['Vice President', 'V.P.', 'Vice-President'],
  'SVP': ['Senior Vice President', 'S.V.P.', 'Senior Vice-President'],
  'EVP': ['Executive Vice President', 'E.V.P.', 'Executive Vice-President'],
  
  // Technology terms
  'AI': ['Artificial Intelligence', 'A.I.'],
  'API': ['Application Programming Interface', 'A.P.I.'],
  'SaaS': ['Software as a Service', 'S.a.a.S.'],
  'PaaS': ['Platform as a Service', 'P.a.a.S.'],
  'IaaS': ['Infrastructure as a Service', 'I.a.a.S.'],
  
  // Business terms
  'B2B': ['Business to Business', 'B-to-B', 'Business-to-Business'],
  'B2C': ['Business to Consumer', 'B-to-C', 'Business-to-Consumer'],
  'R&D': ['Research and Development', 'R & D', 'Research & Development'],
  'IP': ['Intellectual Property', 'I.P.'],
};

/**
 * Reverse lookup dictionary (expansion → acronym)
 * Auto-generated from ACRONYM_EXPANSIONS
 */
export const REVERSE_EXPANSIONS: Record<string, string> = {};

// Auto-populate reverse expansions
Object.entries(ACRONYM_EXPANSIONS).forEach(([acronym, expansions]) => {
  expansions.forEach(expansion => {
    const key = expansion.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    REVERSE_EXPANSIONS[key] = acronym;
  });
});

// ==========================================
// NUMBER FORMATTING UTILITIES
// ==========================================

/**
 * Check if a string represents a number (integer or decimal)
 */
function isNumericString(str: string): boolean {
  const cleaned = str.replace(/[,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned);
}

/**
 * Normalize a number string by removing formatting
 */
function normalizeNumber(str: string): string {
  // Remove commas, spaces, and other common number formatting
  return str.replace(/[,\s]/g, '');
}

/**
 * Generate common number format variations
 */
function generateNumberVariations(numberStr: string): string[] {
  const normalized = normalizeNumber(numberStr);
  
  // Skip if not a valid number
  if (!isNumericString(numberStr)) {
    return [];
  }
  
  const variations: string[] = [normalized];
  
  // Convert to number for formatting
  const num = parseFloat(normalized);
  
  // Add comma-separated format for integers
  if (Number.isInteger(num) && num >= 1000) {
    variations.push(num.toLocaleString('en-US'));
  }
  
  // Add space-separated format (common in some regions)
  if (Number.isInteger(num) && num >= 1000) {
    const spaceFormatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    variations.push(spaceFormatted);
  }
  
  // Add period-separated format (European style)
  if (Number.isInteger(num) && num >= 1000) {
    const periodFormatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    variations.push(periodFormatted);
  }
  
  return variations;
}

/**
 * Find number format matches in text
 */
function findNumberMatch(pattern: string, text: string): SemanticMatch | null {
  if (!isNumericString(pattern)) {
    return null;
  }
  
  const variations = generateNumberVariations(pattern);
  
  for (const variation of variations) {
    const index = text.indexOf(variation);
    if (index !== -1) {
      return {
        start: index,
        end: index + variation.length,
        matchedText: variation,
        matchType: 'number-format' as any,
        originalPattern: pattern,
        foundPattern: variation
      };
    }
  }
  
  // Also try finding variations of numbers in the text that match our pattern
  const normalizedPattern = normalizeNumber(pattern);
  
  // Find all numbers in text and check if any match when normalized
  const numberRegex = /\d{1,3}(?:[,.\s]\d{3})*(?:\.\d+)?/g;
  let match;
  
  while ((match = numberRegex.exec(text)) !== null) {
    const foundNumber = match[0];
    const normalizedFound = normalizeNumber(foundNumber);
    
    if (normalizedFound === normalizedPattern) {
      return {
        start: match.index,
        end: match.index + foundNumber.length,
        matchedText: foundNumber,
        matchType: 'number-format' as any,
        originalPattern: pattern,
        foundPattern: foundNumber
      };
    }
  }
  
  return null;
}

// ==========================================
// DICTIONARY MANAGEMENT
// ==========================================

/**
 * Add a new acronym expansion to the dictionary
 */
export function addAcronymExpansion(acronym: string, expansions: string[]): void {
  const upperAcronym = acronym.toUpperCase();
  
  if (ACRONYM_EXPANSIONS[upperAcronym]) {
    // Merge with existing expansions
    ACRONYM_EXPANSIONS[upperAcronym] = [
      ...ACRONYM_EXPANSIONS[upperAcronym],
      ...expansions.filter(exp => !ACRONYM_EXPANSIONS[upperAcronym].includes(exp))
    ];
  } else {
    // Add new acronym
    ACRONYM_EXPANSIONS[upperAcronym] = expansions;
  }
  
  // Update reverse expansions
  expansions.forEach(expansion => {
    const key = expansion.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    REVERSE_EXPANSIONS[key] = upperAcronym;
  });
  
  if (DEFAULT_SEMANTIC_CONFIG.debug) {
    logger.debug('[Semantic Matcher] Added expansion', { 
      acronym: upperAcronym, 
      expansions: expansions.join(', ') 
    });
  }
}

/**
 * Remove an acronym expansion from the dictionary
 */
export function removeAcronymExpansion(acronym: string): void {
  const upperAcronym = acronym.toUpperCase();
  
  if (ACRONYM_EXPANSIONS[upperAcronym]) {
    // Remove from reverse expansions
    ACRONYM_EXPANSIONS[upperAcronym].forEach(expansion => {
      const key = expansion.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      delete REVERSE_EXPANSIONS[key];
    });
    
    // Remove from main dictionary
    delete ACRONYM_EXPANSIONS[upperAcronym];
    
    if (DEFAULT_SEMANTIC_CONFIG.debug) {
      logger.debug('[Semantic Matcher] Removed expansion', { acronym: upperAcronym });
    }
  }
}

/**
 * Get all current acronym expansions
 */
export function getAllExpansions(): Record<string, string[]> {
  return { ...ACRONYM_EXPANSIONS };
}

// ==========================================
// SEMANTIC MATCHING LOGIC
// ==========================================

export interface SemanticMatch {
  start: number;
  end: number;
  matchedText: string;
  matchType: 'acronym-to-expansion' | 'expansion-to-acronym' | 'number-format';
  originalPattern: string;
  foundPattern: string;
}

/**
 * Find semantic matches using the configured dictionaries
 */
export function findSemanticMatch(
  pattern: string, 
  text: string, 
  config: SemanticMatchConfig = DEFAULT_SEMANTIC_CONFIG
): SemanticMatch | null {
  
  if (!config.enabled) {
    return null;
  }
  
  const cleanPattern = pattern.trim();
  const searchText = config.caseSensitive ? text : text.toLowerCase();
  const searchPattern = config.caseSensitive ? cleanPattern : cleanPattern.toLowerCase();
  
  if (config.debug) {
    logger.debug('[Semantic Matcher] Searching for pattern', { pattern: cleanPattern });
  }
  
  // 1. Check if pattern is an acronym we can expand
  const upperPattern = cleanPattern.toUpperCase();
  if (ACRONYM_EXPANSIONS[upperPattern]) {
    for (const expansion of ACRONYM_EXPANSIONS[upperPattern]) {
      const searchExpansion = config.caseSensitive ? expansion : expansion.toLowerCase();
      const index = searchText.indexOf(searchExpansion);
      
      if (index !== -1) {
        const actualMatch = text.substring(index, index + expansion.length);
        
        if (config.debug) {
          logger.debug('[Semantic Matcher] Found acronym expansion', { 
            acronym: upperPattern, 
            expansion: actualMatch 
          });
        }
        
        return {
          start: index,
          end: index + expansion.length,
          matchedText: actualMatch,
          matchType: 'acronym-to-expansion',
          originalPattern: cleanPattern,
          foundPattern: actualMatch
        };
      }
    }
  }
  
  // 2. Check if pattern is an expansion we can match to acronym
  const normalizedPattern = searchPattern.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (REVERSE_EXPANSIONS[normalizedPattern]) {
    const acronym = REVERSE_EXPANSIONS[normalizedPattern];
    
    // Try different variations of the acronym
    const acronymVariations = [acronym, acronym.toLowerCase()];
    
    for (const variation of acronymVariations) {
      const index = searchText.indexOf(variation);
      if (index !== -1) {
        const actualMatch = text.substring(index, index + variation.length);
        
        if (config.debug) {
          logger.debug('[Semantic Matcher] Found expansion to acronym', { 
            expansion: cleanPattern, 
            acronym: actualMatch 
          });
        }
        
        return {
          start: index,
          end: index + variation.length,
          matchedText: actualMatch,
          matchType: 'expansion-to-acronym',
          originalPattern: cleanPattern,
          foundPattern: actualMatch
        };
      }
    }
  }
  
  // 3. Check if pattern is a number format match
  const numberMatch = findNumberMatch(cleanPattern, text);
  if (numberMatch) {
    if (config.debug) {
      logger.debug('[Semantic Matcher] Found number format match', { 
        pattern: cleanPattern, 
        match: numberMatch.matchedText 
      });
    }
    return numberMatch;
  }
  
  if (config.debug) {
    logger.debug('[Semantic Matcher] No semantic match found', { pattern: cleanPattern });
  }
  
  return null;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if semantic matching is enabled
 */
export function isSemanticMatchingEnabled(): boolean {
  return DEFAULT_SEMANTIC_CONFIG.enabled;
}

/**
 * Enable or disable semantic matching
 */
export function setSemanticMatchingEnabled(enabled: boolean): void {
  DEFAULT_SEMANTIC_CONFIG.enabled = enabled;
  
  if (DEFAULT_SEMANTIC_CONFIG.debug) {
    logger.info('[Semantic Matcher] Semantic matching status changed', { enabled });
  }
}

/**
 * Set debug mode for semantic matching
 */
export function setSemanticDebugMode(debug: boolean): void {
  DEFAULT_SEMANTIC_CONFIG.debug = debug;
  logger.info('[Semantic Matcher] Debug mode changed', { debug });
}

/**
 * Get current semantic matching statistics
 */
export function getSemanticMatchingStats(): {
  totalAcronyms: number;
  totalExpansions: number;
  enabled: boolean;
} {
  const totalExpansions = Object.values(ACRONYM_EXPANSIONS).reduce(
    (total, expansions) => total + expansions.length, 
    0
  );
  
  return {
    totalAcronyms: Object.keys(ACRONYM_EXPANSIONS).length,
    totalExpansions,
    enabled: DEFAULT_SEMANTIC_CONFIG.enabled
  };
} 