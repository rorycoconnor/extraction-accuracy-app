/**
 * Semantic Matcher Management Utilities
 * 
 * Provides easy-to-use functions for managing the semantic matching feature.
 * Use these functions in your admin panel or settings page.
 */

import { 
  addAcronymExpansion, 
  removeAcronymExpansion, 
  getAllExpansions,
  setSemanticMatchingEnabled,
  setSemanticDebugMode,
  getSemanticMatchingStats,
  isSemanticMatchingEnabled,
  DEFAULT_SEMANTIC_CONFIG,
  type SemanticMatchConfig
} from './semantic-matcher';
import { logger } from './logger';

// ==========================================
// EASY MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Add multiple acronym expansions at once
 * Usage: addMultipleExpansions([
 *   { acronym: 'API', expansions: ['Application Programming Interface'] },
 *   { acronym: 'CEO', expansions: ['Chief Executive Officer'] }
 * ])
 */
export function addMultipleExpansions(
  expansions: Array<{ acronym: string; expansions: string[] }>
): void {
  expansions.forEach(({ acronym, expansions: expList }) => {
    addAcronymExpansion(acronym, expList);
  });
  
  logger.info('Added acronym expansions', { count: expansions.length });
}

/**
 * Add a single acronym expansion with validation
 */
export function addExpansion(acronym: string, expansions: string | string[]): boolean {
  try {
    const expArray = Array.isArray(expansions) ? expansions : [expansions];
    
    // Basic validation
    if (!acronym || !expArray.length) {
      logger.error('Invalid acronym or expansions provided', new Error('Validation failed'));
      return false;
    }
    
    if (acronym.length > 10) {
      logger.error('Acronym too long (max 10 characters)', new Error('Validation failed'));
      return false;
    }
    
    addAcronymExpansion(acronym, expArray);
    logger.info('Added expansion', { acronym, expansions: expArray.join(', ') });
    return true;
  } catch (error) {
    logger.error('Failed to add expansion', error as Error);
    return false;
  }
}

/**
 * Remove a specific acronym expansion
 */
export function removeExpansion(acronym: string): boolean {
  try {
    const allExpansions = getAllExpansions();
    const upperAcronym = acronym.toUpperCase();
    
    if (!allExpansions[upperAcronym]) {
      logger.warn('Acronym not found', { acronym: upperAcronym });
      return false;
    }
    
    removeAcronymExpansion(acronym);
    logger.info('Removed expansion', { acronym: upperAcronym });
    return true;
  } catch (error) {
    logger.error('Failed to remove expansion', error as Error);
    return false;
  }
}

/**
 * List all current expansions in a readable format
 */
export function listAllExpansions(): void {
  const expansions = getAllExpansions();
  const stats = getSemanticMatchingStats();
  
  logger.info('=== SEMANTIC MATCHING STATUS ===');
  logger.info(`Status: ${stats.enabled ? 'Enabled' : 'Disabled'}`);
  logger.info('Total Acronyms', { count: stats.totalAcronyms });
  logger.info('Total Expansions', { count: stats.totalExpansions });
  logger.info('Current Expansions:');
  
  Object.entries(expansions).forEach(([acronym, expList]) => {
    logger.info(`  ${acronym}: ${expList.join(' | ')}`);
  });
}

/**
 * Enable semantic matching with optional debug mode
 */
export function enableSemanticMatching(debug: boolean = false): void {
  setSemanticMatchingEnabled(true);
  if (debug) {
    setSemanticDebugMode(true);
  }
  logger.info(`Semantic matching enabled${debug ? ' (debug mode on)' : ''}`);
}

/**
 * Disable semantic matching
 */
export function disableSemanticMatching(): void {
  setSemanticMatchingEnabled(false);
  setSemanticDebugMode(false);
  logger.info('Semantic matching disabled');
}

/**
 * Toggle semantic matching on/off
 */
export function toggleSemanticMatching(): boolean {
  const currentState = isSemanticMatchingEnabled();
  setSemanticMatchingEnabled(!currentState);
  logger.info(`Semantic matching ${!currentState ? 'enabled' : 'disabled'}`);
  return !currentState;
}

/**
 * Reset to default expansions (removes all custom additions)
 */
export function resetToDefaults(): void {
  // This would require reloading the module, so for now just log a warning
  logger.warn('To reset to defaults, restart the application');
  logger.info('Tip: Remove individual expansions using removeExpansion() instead');
}

/**
 * Get a status report of the semantic matching system
 */
export function getStatusReport(): {
  enabled: boolean;
  stats: ReturnType<typeof getSemanticMatchingStats>;
  config: SemanticMatchConfig;
  recentAdditions: string[];
} {
  return {
    enabled: isSemanticMatchingEnabled(),
    stats: getSemanticMatchingStats(),
    config: { ...DEFAULT_SEMANTIC_CONFIG },
    recentAdditions: [] // Could be enhanced to track recent additions
  };
}

/**
 * Export current configuration for backup/sharing
 */
export function exportConfiguration(): string {
  const expansions = getAllExpansions();
  const config = { ...DEFAULT_SEMANTIC_CONFIG };
  
  const exportData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    config,
    expansions
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Validate a potential acronym expansion before adding
 */
export function validateExpansion(
  acronym: string, 
  expansions: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!acronym || acronym.trim().length === 0) {
    errors.push('Acronym cannot be empty');
  }
  
  if (acronym.length > 10) {
    errors.push('Acronym too long (max 10 characters)');
  }
  
  if (!/^[A-Z0-9&-]+$/i.test(acronym)) {
    errors.push('Acronym should only contain letters, numbers, &, and -');
  }
  
  if (!expansions || expansions.length === 0) {
    errors.push('At least one expansion must be provided');
  }
  
  expansions.forEach((exp, index) => {
    if (!exp || exp.trim().length === 0) {
      errors.push(`Expansion ${index + 1} cannot be empty`);
    }
    
    if (exp.length > 100) {
      errors.push(`Expansion ${index + 1} too long (max 100 characters)`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ==========================================
// QUICK SETUP PRESETS
// ==========================================

/**
 * Quick setup for contract/legal documents
 */
export function setupForContracts(): void {
  const contractExpansions = [
    { acronym: 'SOW', expansions: ['Statement of Work', 'Statement of Works'] },
    { acronym: 'MSA', expansions: ['Master Service Agreement', 'Master Services Agreement'] },
    { acronym: 'SLA', expansions: ['Service Level Agreement', 'Service-Level Agreement'] },
    { acronym: 'IP', expansions: ['Intellectual Property', 'I.P.'] }
  ];
  
  addMultipleExpansions(contractExpansions);
  logger.info('Contract/Legal preset applied');
}

/**
 * Quick setup for insurance documents
 */
export function setupForInsurance(): void {
  const insuranceExpansions = [
    { acronym: 'GL', expansions: ['General Liability'] },
    { acronym: 'WC', expansions: ['Workers Compensation', 'Workers Comp'] },
    { acronym: 'E&O', expansions: ['Errors and Omissions', 'Errors & Omissions'] },
    { acronym: 'D&O', expansions: ['Directors and Officers', 'Directors & Officers'] }
  ];
  
  addMultipleExpansions(insuranceExpansions);
  logger.info('Insurance preset applied');
}

/**
 * Quick setup for HR/employment documents
 */
export function setupForHR(): void {
  const hrExpansions = [
    { acronym: 'PTO', expansions: ['Paid Time Off'] },
    { acronym: 'FMLA', expansions: ['Family Medical Leave Act'] },
    { acronym: 'HR', expansions: ['Human Resources'] },
    { acronym: 'VP', expansions: ['Vice President', 'V.P.'] }
  ];
  
  addMultipleExpansions(hrExpansions);
  logger.info('HR/Employment preset applied');
} 

/**
 * Quick test function for number formatting feature
 */
export function testNumberFormatting(): void {
  logger.info('=== TESTING NUMBER FORMATTING FEATURE ===');
  
  const { findSemanticMatch } = require('./semantic-matcher');
  
  const numberTests = [
    { pattern: '4000000', text: 'Total amount: 4,000,000 USD', expected: '4,000,000' },
    { pattern: '4,000,000', text: 'Contract value is 4000000 dollars', expected: '4000000' },
    { pattern: '1500', text: 'Monthly fee: 1,500', expected: '1,500' },
    { pattern: '12.50', text: 'Cost per unit: 12.50', expected: '12.50' }
  ];
  
  let passed = 0;
  
  numberTests.forEach((test, index) => {
    logger.debug(`Test ${index + 1}: "${test.pattern}" in "${test.text}"`);
    
    const result = findSemanticMatch(test.pattern, test.text);
    
    if (result && result.matchedText === test.expected) {
      logger.debug(`PASS - Found: "${result.matchedText}"`);
      passed++;
    } else {
      logger.warn(`FAIL - Expected: "${test.expected}", Got: ${result ? result.matchedText : 'null'}`);
    }
    // Empty log line removed
  });
  
  logger.info(`Number formatting tests: ${passed}/${numberTests.length} passed`);
  
  if (passed === numberTests.length) {
    logger.info('Number formatting is working correctly!');
    logger.info('Try your own: Ground truth "4000000" should now match "4,000,000" in documents');
  } else {
    logger.warn('Some number formatting tests failed');
  }
} 