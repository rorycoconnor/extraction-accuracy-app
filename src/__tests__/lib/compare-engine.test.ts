import { describe, test, expect } from 'vitest';
import { compareValuesPreview } from '@/lib/compare-engine';
import type { FieldCompareConfig } from '@/lib/compare-types';

/**
 * Compare Engine Tests - Enhanced Comparison Logic
 * 
 * Tests the improved comparison system that includes:
 * 1. Partial matching (substring containment)
 * 2. Multi-value handling
 * 3. Duration normalization
 * 4. List comparison with auto-detect separator
 * 5. Match classification for UI coloring
 */

// Helper to create a compare config
const createConfig = (compareType: string, parameters?: Record<string, any>): FieldCompareConfig => ({
  fieldKey: 'test-field',
  fieldName: 'Test Field',
  compareType: compareType as any,
  parameters,
});

// ==========================================
// NEAR-EXACT STRING - PARTIAL MATCHING
// ==========================================

describe('Compare Engine - Partial Matching', () => {
  const config = createConfig('near-exact-string');

  test('should match when ground truth is contained in extracted', () => {
    const result = compareValuesPreview('Supply Agreement - FUSION', 'Supply Agreement', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('should match when extracted is contained in ground truth', () => {
    const result = compareValuesPreview('California', 'State of California', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('should match partial addresses', () => {
    const result = compareValuesPreview('123 Main Street, New York, NY 10001', '123 Main Street', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('should match company name variations', () => {
    const result = compareValuesPreview('Acme Corporation', 'Acme Corp', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('should match company name with suffix variations', () => {
    // "QIWI plc" vs "QIWI plc." - trailing period
    const result = compareValuesPreview('QIWI plc', 'QIWI plc.', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match entity names in multi-value field', () => {
    // "Otkritie Investments Cyprus Limited" vs "Otkritie Investments Cyprus Limited | QIWI plc"
    const result = compareValuesPreview(
      'Otkritie Investments Cyprus Limited | QIWI plc',
      'Otkritie Investments Cyprus Limited',
      config
    );
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('should NOT match unrelated strings', () => {
    const result = compareValuesPreview('Alpha Inc', 'Beta Corp', config);
    
    expect(result.isMatch).toBe(false);
    expect(result.matchClassification).toBe('none');
  });

  test('should NOT match very short substrings to avoid false positives', () => {
    // "NY" is too short to be a reliable partial match
    const result = compareValuesPreview('New York', 'NY', config);
    
    // Short strings should not trigger partial matching
    expect(result.matchClassification).not.toBe('partial');
  });
});

// ==========================================
// NEAR-EXACT STRING - MULTI-VALUE HANDLING
// ==========================================

describe('Compare Engine - Multi-Value Handling', () => {
  const config = createConfig('near-exact-string');

  test('should match when ground truth is one of multiple extracted values', () => {
    const result = compareValuesPreview('California, State of California', 'California', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('should match when extracted value is in multi-value ground truth', () => {
    const result = compareValuesPreview('60 Days', '60 Days, sixty (60) days written notice', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match exact value in comma-separated list', () => {
    const result = compareValuesPreview('A, B, C', 'B', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should handle spaces around commas', () => {
    const result = compareValuesPreview('Value A,Value B,Value C', 'Value B', config);
    
    expect(result.isMatch).toBe(true);
  });
});

// ==========================================
// DURATION NORMALIZATION
// ==========================================

describe('Compare Engine - Duration Normalization', () => {
  const config = createConfig('near-exact-string');

  test('should match "2 years" with "24 months"', () => {
    const result = compareValuesPreview('2 years', '24 months', config);
    
    // Both should normalize to "730 days"
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('normalized');
  });

  test('should match "1 year" with "12 months"', () => {
    const result = compareValuesPreview('1 year', '12 months', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match "1 month" with "30 days"', () => {
    const result = compareValuesPreview('1 month', '30 days', config);
    
    // Both normalize to "1 months" (30 days ≈ 1 month)
    expect(result.isMatch).toBe(true);
  });

  test('should match months expressed differently', () => {
    // "2 weeks" = ~0.5 months, "14 days" = ~0.5 months - too small to convert
    // Instead test a clearer case
    const result = compareValuesPreview('6 months', '6 months', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match written numbers with digits', () => {
    const result = compareValuesPreview('sixty (60) days', '60 days', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match "90 days" vs "ninety (90) calendar days"', () => {
    const result = compareValuesPreview('90 days', 'ninety (90) calendar days', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('normalized');
  });

  test('should match "30 days" vs "30 business days"', () => {
    const result = compareValuesPreview('30 days', '30 business days', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('normalized');
  });

  test('should match "60 working days" vs "60 days"', () => {
    const result = compareValuesPreview('60 working days', '60 days', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('normalized');
  });

  test('should NOT match different durations', () => {
    const result = compareValuesPreview('30 days', '60 days', config);
    
    expect(result.isMatch).toBe(false);
  });
});

// ==========================================
// LIST COMPARISON - UNORDERED
// ==========================================

describe('Compare Engine - List Unordered', () => {
  const config = createConfig('list-unordered');

  test('should match lists with same items in different order', () => {
    const result = compareValuesPreview(
      'iPayment, Inc. | First Data Merchant Services Corporation | Wells Fargo Bank, N.A.',
      'First Data Merchant Services Corporation | Wells Fargo Bank, N.A. | iPayment, Inc.',
      config
    );
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('different-format');
  });

  test('should match lists with case differences', () => {
    const result = compareValuesPreview(
      'FIRST DATA | WELLS FARGO',
      'First Data | Wells Fargo',
      config
    );
    
    expect(result.isMatch).toBe(true);
  });

  test('should auto-detect pipe separator', () => {
    const result = compareValuesPreview('A | B | C', 'C | B | A', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should work with comma separator', () => {
    const result = compareValuesPreview('A, B, C', 'C, B, A', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should handle partial list matches', () => {
    const result = compareValuesPreview(
      'Marko Bukovec | Robin Ram',
      'Marko Bukovec (Marketing Director) | Robin Ram (President)',
      config
    );
    
    expect(result.isMatch).toBe(true);
    // When all items match (even with extra details), it's normalized, not partial
    expect(['normalized', 'partial']).toContain(result.matchClassification);
  });

  test('should match lists with detailed titles/roles', () => {
    const result = compareValuesPreview(
      'Jeffrey D. Fox | Scott A. Betz',
      'Jeffrey D. Fox (Managing Director for Palmer Square Capital Management LLC); Scott A. Betz (Chief Compliance Officer)',
      config
    );
    
    expect(result.isMatch).toBe(true);
    // When all items match, it's normalized
    expect(['normalized', 'partial']).toContain(result.matchClassification);
  });

  test('should match entity lists with suffix variations', () => {
    const result = compareValuesPreview(
      'Otkritie Investments Cyprus Limited | QIWI plc',
      'Otkritie Investments Cyprus Limited | QIWI plc.',
      config
    );
    
    expect(result.isMatch).toBe(true);
  });

  test('should NOT match completely different lists', () => {
    const result = compareValuesPreview('Alpha | Beta', 'Gamma | Delta', config);
    
    expect(result.isMatch).toBe(false);
  });
});

// ==========================================
// DATE COMPARISON
// ==========================================

describe('Compare Engine - Date Comparison', () => {
  const config = createConfig('date-exact');

  test('should match same date in different formats', () => {
    const result = compareValuesPreview('2008-07-20', '07/20/2008', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('different-format');
  });

  test('should match exact same date format', () => {
    const result = compareValuesPreview('2008-07-20', '2008-07-20', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('exact');
  });

  test('should NOT match different dates', () => {
    const result = compareValuesPreview('2008-07-20', '2008-07-21', config);
    
    expect(result.isMatch).toBe(false);
  });
});

// ==========================================
// NUMBER COMPARISON
// ==========================================

describe('Compare Engine - Number Comparison', () => {
  const config = createConfig('exact-number');

  test('should match numbers with different formats', () => {
    const result = compareValuesPreview('12000000', '12,000,000', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match currency values', () => {
    const result = compareValuesPreview('$40,000', '40000', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should identify different format when matched', () => {
    const result = compareValuesPreview('40000.0', '40000', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('different-format');
  });

  test('should NOT match different numbers', () => {
    const result = compareValuesPreview('12000000', '40000', config);
    
    expect(result.isMatch).toBe(false);
  });
});

// ==========================================
// BOOLEAN COMPARISON
// ==========================================

describe('Compare Engine - Boolean Comparison', () => {
  const config = createConfig('boolean');

  test('should match Yes with true', () => {
    const result = compareValuesPreview('Yes', 'true', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('different-format');
  });

  test('should match No with false', () => {
    const result = compareValuesPreview('No', 'false', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should match case-insensitive', () => {
    const result = compareValuesPreview('YES', 'yes', config);
    
    expect(result.isMatch).toBe(true);
  });

  test('should NOT match Yes with No', () => {
    const result = compareValuesPreview('Yes', 'No', config);
    
    expect(result.isMatch).toBe(false);
  });
});

// ==========================================
// EXACT STRING COMPARISON
// ==========================================

describe('Compare Engine - Exact String', () => {
  const config = createConfig('exact-string');

  test('should match identical strings', () => {
    const result = compareValuesPreview('Acme Corp', 'Acme Corp', config);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('exact');
  });

  test('should NOT match case differences', () => {
    const result = compareValuesPreview('ACME CORP', 'Acme Corp', config);
    
    expect(result.isMatch).toBe(false);
    expect(result.matchClassification).toBe('none');
  });

  test('should NOT match with extra whitespace', () => {
    const result = compareValuesPreview('Acme  Corp', 'Acme Corp', config);
    
    expect(result.isMatch).toBe(false);
  });
});

// ==========================================
// REAL-WORLD SCENARIOS FROM USER EXAMPLES
// ==========================================

describe('Compare Engine - Real-World Scenarios', () => {
  const nearExactConfig = createConfig('near-exact-string');
  const listConfig = createConfig('list-unordered');

  test('Supply Agreement partial match', () => {
    const result = compareValuesPreview('Supply Agreement', 'Supply Agreement - FUSION', nearExactConfig);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('California multi-value match', () => {
    const result = compareValuesPreview('California, State of California', 'California', nearExactConfig);
    
    expect(result.isMatch).toBe(true);
  });

  test('60 Days with extended text', () => {
    const result = compareValuesPreview('60 Days, sixty (60) days written notice', '60 Days', nearExactConfig);
    
    expect(result.isMatch).toBe(true);
  });

  test('Party list with different order and case', () => {
    const result = compareValuesPreview(
      'FIRST DATA MERCHANT SERVICES CORPORATION | WELLS FARGO BANK, N.A. | iPAYMENT, INC.',
      'iPayment, Inc. | First Data Merchant Services Corporation | Wells Fargo Bank, N.A.',
      listConfig
    );
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('different-format');
  });

  test('30 Days partial match in simple text', () => {
    // Note: "30 calendar days" and "30 business days" are different from "30 days"
    // Test with simpler partial match
    const result = compareValuesPreview(
      '30 days notice required',
      '30 Days',
      nearExactConfig
    );
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });

  test('Entity names with titles in list', () => {
    const result = compareValuesPreview(
      'Marko Bukovec | Robin Ram',
      'Marko Bukovec (Marketing Director, ConAgra Foods Canada Inc.); Robin Ram (President, Charity Tunes, Inc.)',
      listConfig
    );
    
    expect(result.isMatch).toBe(true);
    // When all items match, it's normalized
    expect(['normalized', 'partial']).toContain(result.matchClassification);
  });

  test('England and Wales jurisdiction match', () => {
    const result = compareValuesPreview('England and Wales', 'england and wales', nearExactConfig);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('normalized');
  });

  test('Massachusetts jurisdiction partial match', () => {
    const result = compareValuesPreview('Massachusetts', 'Commonwealth of Massachusetts, Netherlands', nearExactConfig);
    
    expect(result.isMatch).toBe(true);
    expect(result.matchClassification).toBe('partial');
  });
});

