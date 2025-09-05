import { describe, test, expect } from 'vitest'
import { 
  calculateFieldMetrics, 
  calculateFieldMetricsWithDebug,
  compareValues,
  compareDates,
  isDateLike,
  calculateAccuracy,
  type MetricsResult,
  type ComparisonResult
} from '@/lib/metrics'
import { NOT_PRESENT_VALUE } from '@/lib/utils'

describe('Metrics Calculation - Baseline for Accuracy-First Implementation', () => {
  
  describe('calculateFieldMetrics - Core Function', () => {
    test('should calculate perfect accuracy (100%)', () => {
      const predictions = ['Acme Corp', 'John Doe', 'Not Present']
      const groundTruths = ['Acme Corp', 'John Doe', 'Not Present']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(1.0)
      expect(result.precision).toBe(1.0)
      expect(result.recall).toBe(1.0)
      expect(result.f1Score).toBe(1.0)
    })

    test('should calculate 50% accuracy with mixed results', () => {
      const predictions = ['Acme Corp', 'Wrong Name', 'Not Present', 'Value']
      const groundTruths = ['Acme Corp', 'John Doe', 'Not Present', 'Not Present']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // 2 correct out of 4 = 50% accuracy
      expect(result.accuracy).toBe(0.5)
      expect(result.precision).toBeCloseTo(0.333, 3) // 1 TP / (1 TP + 2 FP) - actual behavior
      expect(result.recall).toBeCloseTo(0.5, 3)      // 1 TP / (1 TP + 1 FN)
      expect(result.f1Score).toBeCloseTo(0.4, 3)     // 2 * (0.333 * 0.5) / (0.333 + 0.5)
    })

    test('should handle all "Not Present" correctly (perfect negative classification)', () => {
      const predictions = ['Not Present', 'Not Present', 'Not Present']
      const groundTruths = ['Not Present', 'Not Present', 'Not Present']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // All True Negatives should be perfect performance
      expect(result.accuracy).toBe(1.0)
      expect(result.precision).toBe(1.0)
      expect(result.recall).toBe(1.0)
      expect(result.f1Score).toBe(1.0)
    })

    test('should handle zero accuracy (all wrong)', () => {
      const predictions = ['Wrong1', 'Wrong2', 'Wrong3']
      const groundTruths = ['Right1', 'Right2', 'Right3']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(0.0)
      expect(result.precision).toBe(0.0)
      expect(result.recall).toBe(0.0)
      expect(result.f1Score).toBe(0.0)
    })

    test('should throw error for mismatched array lengths', () => {
      const predictions = ['A', 'B']
      const groundTruths = ['A', 'B', 'C']
      
      expect(() => {
        calculateFieldMetrics(predictions, groundTruths)
      }).toThrow('Predictions and ground truths must have the same length')
    })

    test('should handle empty arrays', () => {
      const predictions: string[] = []
      const groundTruths: string[] = []
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(0.0)
      expect(result.precision).toBe(0.0)
      expect(result.recall).toBe(0.0)
      expect(result.f1Score).toBe(0.0)
    })
  })

  describe('compareValues - Text Comparison Logic', () => {
    test('should detect exact matches', () => {
      const result = compareValues('Acme Corporation', 'Acme Corporation')
      
      expect(result.isMatch).toBe(true)
      expect(result.matchType).toBe('exact')
      expect(result.confidence).toBe('high')
    })

    test('should detect normalized matches (case/whitespace differences)', () => {
      const result = compareValues('  ACME CORP  ', 'acme corp')
      
      expect(result.isMatch).toBe(true)
      expect(result.matchType).toBe('normalized')
      expect(result.confidence).toBe('high')
    })

    test('should detect partial matches', () => {
      const result = compareValues('Acme Corporation Inc', 'Acme Corp')
      
      expect(result.isMatch).toBe(true)
      expect(result.matchType).toBe('partial')
      expect(result.confidence).toBe('medium')
    })

    test('should handle "Not Present" values', () => {
      const result1 = compareValues('Not Present', 'Not Present')
      const result2 = compareValues('Some Value', 'Not Present')
      const result3 = compareValues('Not Present', 'Some Value')
      
      expect(result1.isMatch).toBe(true)
      expect(result1.matchType).toBe('exact')
      
      expect(result2.isMatch).toBe(false)
      expect(result2.matchType).toBe('none')
      
      expect(result3.isMatch).toBe(false)
      expect(result3.matchType).toBe('none')
    })

    test('should reject non-matches', () => {
      const result = compareValues('Completely Different', 'Another Company')
      
      expect(result.isMatch).toBe(false)
      expect(result.matchType).toBe('none')
      expect(result.confidence).toBe('high')
    })
  })

  describe('Date Comparison Functions', () => {
    test('isDateLike should detect various date formats', () => {
      expect(isDateLike('2025-05-07')).toBe(true)
      expect(isDateLike('05/07/2025')).toBe(true)
      expect(isDateLike('May 7, 2025')).toBe(true)
      expect(isDateLike('7 May 2025')).toBe(true)
      expect(isDateLike('May 2025')).toBe(true)
      
      expect(isDateLike('Not a date')).toBe(false)
      expect(isDateLike('12345')).toBe(false)
      expect(isDateLike('')).toBe(false)
    })

    test('compareDates should match equivalent dates', () => {
      expect(compareDates('2025-05-07', '05/07/2025')).toBe(true)
      expect(compareDates('May 7, 2025', '2025-05-07')).toBe(true)
      
      expect(compareDates('2025-05-07', '2025-05-08')).toBe(false)
      expect(compareDates('invalid', '2025-05-07')).toBe(false)
    })

    test('compareValues should use date comparison for date-like strings', () => {
      const result = compareValues('2025-05-07', 'May 7, 2025')
      
      expect(result.isMatch).toBe(true)
      expect(result.matchType).toBe('date_format')
      expect(result.confidence).toBe('high')
    })
  })

  describe('Real-World Scenarios - Golden Standard Cases', () => {
    test('Company name extraction scenario', () => {
      const predictions = [
        'Acme Corporation',      // Exact match
        'BETA CORP',            // Case difference  
        'Gamma Inc.',           // Punctuation difference
        'Not Present',          // Correct negative
        'Wrong Company',        // False positive
        'Not Present'           // False negative (should be Delta LLC)
      ]
      const groundTruths = [
        'Acme Corporation',
        'Beta Corp',
        'Gamma Inc',
        'Not Present',
        'Not Present',
        'Delta LLC'
      ]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Verify core accuracy calculation
      expect(result.accuracy).toBeCloseTo(0.667, 3) // 4/6
      expect(result.debug.totalValidPairs).toBe(6)
    })

    test('Date extraction scenario', () => {
      const predictions = [
        '2025-05-07',           // ISO format
        'May 7, 2025',          // Written format
        '05/07/2025',           // US format
        'Not Present',          // Correct negative
        'Invalid Date',         // False positive
        'Not Present'           // False negative
      ]
      const groundTruths = [
        '05/07/2025',           // Should match despite format difference
        '2025-05-07',           // Should match despite format difference
        'May 7, 2025',          // Should match despite format difference
        'Not Present',
        'Not Present',
        '2025-12-25'
      ]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // All first 3 should match due to date format handling
      expect(result.accuracy).toBeCloseTo(0.667, 3) // 4/6
    })

    test('Mixed field types scenario (comprehensive baseline)', () => {
      const predictions = [
        'Acme Corp',            // Company name - exact
        'JOHN DOE',             // Person name - case diff
        '2025-05-07',           // Date - format diff
        'Not Present',          // Correct negative
        '$1,000.00',            // Amount - punctuation
        'Wrong Value',          // False positive
        'Not Present',          // False negative
        'Partial Match Inc'     // Partial company match
      ]
      const groundTruths = [
        'Acme Corp',
        'John Doe',
        'May 7, 2025',
        'Not Present',
        '1000.00',
        'Not Present',
        'Should Be Here',
        'Partial Match Corporation'
      ]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // This comprehensive test establishes the baseline behavior
      expect(result.accuracy).toBeCloseTo(0.625, 3)  // Actual: 5/8 correct
      expect(result.precision).toBeGreaterThan(0.4)
      expect(result.recall).toBeGreaterThan(0.4)
      expect(result.f1Score).toBeGreaterThan(0.4)
      
      // Verify confusion matrix makes sense
      expect(result.debug.totalValidPairs).toBe(8)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle null/undefined values gracefully', () => {
      const predictions = ['Valid', '', 'Not Present']
      const groundTruths = ['Valid', 'Not Present', 'Not Present']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // Should not throw and should handle empty strings
      expect(result.accuracy).toBeGreaterThanOrEqual(0)
      expect(result.accuracy).toBeLessThanOrEqual(1)
    })

    test('should clamp metrics between 0 and 1', () => {
      const predictions = ['Test']
      const groundTruths = ['Test']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBeGreaterThanOrEqual(0)
      expect(result.accuracy).toBeLessThanOrEqual(1)
      expect(result.precision).toBeGreaterThanOrEqual(0)
      expect(result.precision).toBeLessThanOrEqual(1)
      expect(result.recall).toBeGreaterThanOrEqual(0)
      expect(result.recall).toBeLessThanOrEqual(1)
      expect(result.f1Score).toBeGreaterThanOrEqual(0)
      expect(result.f1Score).toBeLessThanOrEqual(1)
    })

    test('should maintain F1 formula consistency', () => {
      const predictions = ['A', 'B', 'C', 'Not Present']
      const groundTruths = ['A', 'X', 'Not Present', 'Not Present']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // Verify F1 = 2 * (precision * recall) / (precision + recall)
      if (result.precision > 0 && result.recall > 0) {
        const expectedF1 = (2 * result.precision * result.recall) / (result.precision + result.recall)
        expect(result.f1Score).toBeCloseTo(expectedF1, 3)
      }
    })
  })
}) 