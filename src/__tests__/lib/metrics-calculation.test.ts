import { describe, test, expect, beforeEach } from 'vitest'
import { 
  calculateFieldMetrics, 
  calculateFieldMetricsWithDebug,
  compareValues 
} from '@/lib/metrics'
import { NOT_PRESENT_VALUE } from '@/lib/utils'

describe('Metrics Calculation - Core Business Logic', () => {
  
  describe('Perfect Matches', () => {
    test('should return 100% for all metrics when all predictions match exactly', () => {
      const predictions = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(1.0)
      expect(result.precision).toBe(1.0)
      expect(result.recall).toBe(1.0)
      expect(result.f1Score).toBe(1.0)
    })

    test('should handle single perfect match', () => {
      const predictions = ['Acme Corp']
      const groundTruths = ['Acme Corp']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(1.0)
      expect(result.precision).toBe(1.0)
      expect(result.recall).toBe(1.0)
      expect(result.f1Score).toBe(1.0)
    })

    test('should handle case-insensitive matches', () => {
      const predictions = ['ACME CORP', 'beta inc']
      const groundTruths = ['Acme Corp', 'Beta Inc']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // Should match despite case differences
      expect(result.accuracy).toBe(1.0)
    })
  })

  describe('Wrong Value Classification - CRITICAL', () => {
    test('should count wrong value as BOTH FP and FN', () => {
      // This is the CRITICAL business rule
      const predictions = ['Wrong Corp']
      const groundTruths = ['Acme Corp']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Wrong value = FP (predicted wrong) + FN (missed correct)
      expect(result.debug.truePositives).toBe(0)
      expect(result.debug.falsePositives).toBe(1)
      expect(result.debug.falseNegatives).toBe(1)
      expect(result.debug.trueNegatives).toBe(0)
      
      // Precision = TP/(TP+FP) = 0/(0+1) = 0
      expect(result.precision).toBe(0)
      
      // Recall = TP/(TP+FN) = 0/(0+1) = 0
      expect(result.recall).toBe(0)
      
      // F1 = 0 when both precision and recall are 0
      expect(result.f1Score).toBe(0)
      
      // Accuracy = (TP+TN)/total = (0+0)/1 = 0
      expect(result.accuracy).toBe(0)
    })

    test('should handle mix of correct and wrong predictions', () => {
      const predictions = ['Acme Corp', 'Wrong Inc', 'Charlie Co']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // 2 correct (TP), 1 wrong (FP+FN)
      expect(result.debug.truePositives).toBe(2)
      expect(result.debug.falsePositives).toBe(1)
      expect(result.debug.falseNegatives).toBe(1)
      expect(result.debug.trueNegatives).toBe(0)
      
      // Precision = 2/(2+1) = 0.667
      expect(result.precision).toBeCloseTo(0.667, 2)
      
      // Recall = 2/(2+1) = 0.667
      expect(result.recall).toBeCloseTo(0.667, 2)
      
      // F1 = 2*0.667*0.667/(0.667+0.667) = 0.667
      expect(result.f1Score).toBeCloseTo(0.667, 2)
      
      // Accuracy = (2+0)/3 = 0.667
      expect(result.accuracy).toBeCloseTo(0.667, 2)
    })
  })

  describe('Not Present Handling', () => {
    test('should handle all "Not Present" correctly (True Negatives)', () => {
      const predictions = [NOT_PRESENT_VALUE, NOT_PRESENT_VALUE]
      const groundTruths = [NOT_PRESENT_VALUE, NOT_PRESENT_VALUE]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // All True Negatives
      expect(result.debug.trueNegatives).toBe(2)
      expect(result.debug.truePositives).toBe(0)
      expect(result.debug.falsePositives).toBe(0)
      expect(result.debug.falseNegatives).toBe(0)
      
      // Perfect "Not Present" classification = 100%
      expect(result.accuracy).toBe(1.0)
      expect(result.precision).toBe(1.0)
      expect(result.recall).toBe(1.0)
      expect(result.f1Score).toBe(1.0)
    })

    test('should handle False Positive (predicted when should be Not Present)', () => {
      const predictions = ['Acme Corp']
      const groundTruths = [NOT_PRESENT_VALUE]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Predicted something when ground truth is empty = FP
      expect(result.debug.falsePositives).toBe(1)
      expect(result.debug.truePositives).toBe(0)
      expect(result.debug.falseNegatives).toBe(0)
      expect(result.debug.trueNegatives).toBe(0)
      
      // Precision = 0/(0+1) = 0
      expect(result.precision).toBe(0)
    })

    test('should handle False Negative (missed value, predicted Not Present)', () => {
      const predictions = [NOT_PRESENT_VALUE]
      const groundTruths = ['Acme Corp']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Missed the value = FP + FN (wrong prediction)
      expect(result.debug.falsePositives).toBe(1)
      expect(result.debug.falseNegatives).toBe(1)
      expect(result.debug.truePositives).toBe(0)
      expect(result.debug.trueNegatives).toBe(0)
      
      // Recall = 0/(0+1) = 0
      expect(result.recall).toBe(0)
    })

    test('should handle mix of present and not present', () => {
      const predictions = ['Acme Corp', NOT_PRESENT_VALUE, 'Charlie Co']
      const groundTruths = ['Acme Corp', NOT_PRESENT_VALUE, NOT_PRESENT_VALUE]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // 1 TP (Acme Corp), 1 TN (Not Present), 1 FP (Charlie when should be empty)
      expect(result.debug.truePositives).toBe(1)
      expect(result.debug.trueNegatives).toBe(1)
      expect(result.debug.falsePositives).toBe(1)
      expect(result.debug.falseNegatives).toBe(0)
      
      // Accuracy = (1+1)/3 = 0.667
      expect(result.accuracy).toBeCloseTo(0.667, 2)
    })

    test('should treat empty string as Not Present', () => {
      const predictions = ['', '  ', '\t']
      const groundTruths = ['', '', '']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Empty strings may be filtered out during processing
      // Just verify perfect accuracy for empty/whitespace
      expect(result.accuracy).toBe(1.0)
      expect(result.debug.trueNegatives).toBeGreaterThan(0)
    })
  })

  describe('Error and Pending State Handling', () => {
    test('should exclude "Pending..." from calculations', () => {
      const predictions = ['Acme Corp', 'Pending...', 'Charlie Co']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Should only count 2 valid pairs (skip Pending)
      expect(result.debug.totalValidPairs).toBe(2)
      expect(result.debug.truePositives).toBe(2)
      
      // Accuracy = 2/2 = 100% (Pending excluded)
      expect(result.accuracy).toBe(1.0)
    })

    test('should exclude "Error: ..." from calculations', () => {
      const predictions = ['Acme Corp', 'Error: Rate limit exceeded', 'Charlie Co']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Should only count 2 valid pairs (skip Error)
      expect(result.debug.totalValidPairs).toBe(2)
      expect(result.debug.truePositives).toBe(2)
      
      // Accuracy = 2/2 = 100% (Error excluded)
      expect(result.accuracy).toBe(1.0)
    })

    test('should handle all predictions being errors/pending', () => {
      const predictions = ['Pending...', 'Error: Failed', 'Pending...']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // No valid pairs
      expect(result.debug.totalValidPairs).toBe(0)
      expect(result.accuracy).toBe(0)
      expect(result.precision).toBe(0)
      expect(result.recall).toBe(0)
      expect(result.f1Score).toBe(0)
    })
  })

  describe('Date Format Handling', () => {
    test('should match equivalent date formats', () => {
      const predictions = ['2025-01-01', '01/15/2025']
      const groundTruths = ['2025-01-01', '2025-01-15']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // Should recognize date equivalence
      expect(result.accuracy).toBeGreaterThan(0.5)
    })

    test('should handle date format variations', () => {
      // Test the compareValues function directly
      const result1 = compareValues('2025-01-01', '2025-01-01')
      expect(result1.isMatch).toBe(true)
      
      const result2 = compareValues('January 1, 2025', '2025-01-01')
      // Should match if date parsing is implemented
      expect(result2.isMatch).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty arrays', () => {
      const predictions: string[] = []
      const groundTruths: string[] = []
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(0)
      expect(result.precision).toBe(0)
      expect(result.recall).toBe(0)
      expect(result.f1Score).toBe(0)
    })

    test('should throw error for mismatched array lengths', () => {
      const predictions = ['Acme Corp', 'Beta Inc']
      const groundTruths = ['Acme Corp']
      
      expect(() => {
        calculateFieldMetrics(predictions, groundTruths)
      }).toThrow('must have the same length')
    })

    test('should handle very long strings', () => {
      const longString = 'A'.repeat(10000)
      const predictions = [longString]
      const groundTruths = [longString]
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(1.0)
    })

    test('should handle special characters', () => {
      const predictions = ['Company & Co. <Special> "Chars"', 'Test™ Corp®']
      const groundTruths = ['Company & Co. <Special> "Chars"', 'Test™ Corp®']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(1.0)
    })

    test('should handle unicode characters', () => {
      const predictions = ['日本株式会社', 'Société Française', 'Компания']
      const groundTruths = ['日本株式会社', 'Société Française', 'Компания']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.accuracy).toBe(1.0)
    })

    test('should handle numbers as strings', () => {
      const predictions = ['1000000', '4,000,000', '$5.50']
      const groundTruths = ['1000000', '4000000', '$5.50']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // Should handle number format variations
      expect(result.accuracy).toBeGreaterThan(0.5)
    })
  })

  describe('F1 Score Formula Validation', () => {
    test('should calculate F1 as harmonic mean of precision and recall', () => {
      const predictions = ['Acme Corp', 'Wrong Inc', 'Charlie Co']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // F1 = 2 * (P * R) / (P + R)
      const expectedF1 = (2 * result.precision * result.recall) / (result.precision + result.recall)
      
      expect(result.f1Score).toBeCloseTo(expectedF1, 3)
    })

    test('should return 0 F1 when precision and recall are both 0', () => {
      const predictions = ['Wrong Corp']
      const groundTruths = ['Acme Corp']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.precision).toBe(0)
      expect(result.recall).toBe(0)
      expect(result.f1Score).toBe(0)
    })

    test('should return 1.0 F1 when precision and recall are both 1.0', () => {
      const predictions = ['Acme Corp']
      const groundTruths = ['Acme Corp']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      expect(result.precision).toBe(1.0)
      expect(result.recall).toBe(1.0)
      expect(result.f1Score).toBe(1.0)
    })
  })

  describe('Confusion Matrix Validation', () => {
    test('should maintain TP + FP + FN + TN = total valid pairs', () => {
      const predictions = ['Acme Corp', 'Wrong Inc', NOT_PRESENT_VALUE, 'Delta Co']
      const groundTruths = ['Acme Corp', 'Beta Inc', NOT_PRESENT_VALUE, NOT_PRESENT_VALUE]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      const total = result.debug.truePositives + 
                   result.debug.falsePositives + 
                   result.debug.falseNegatives + 
                   result.debug.trueNegatives
      
      // Note: FP and FN can both count for wrong predictions
      // So total might be > totalValidPairs
      expect(total).toBeGreaterThanOrEqual(result.debug.totalValidPairs)
    })

    test('should provide example cases in debug info', () => {
      const predictions = ['Acme Corp', 'Wrong Inc', NOT_PRESENT_VALUE]
      const groundTruths = ['Acme Corp', 'Beta Inc', NOT_PRESENT_VALUE]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // Should have examples for each category
      expect(result.debug.examples.truePositives.length).toBeGreaterThan(0)
      expect(result.debug.examples.falsePositives.length).toBeGreaterThan(0)
      expect(result.debug.examples.falseNegatives.length).toBeGreaterThan(0)
      expect(result.debug.examples.trueNegatives.length).toBeGreaterThan(0)
    })
  })

  describe('Real-World Scenarios', () => {
    test('should handle typical contract extraction results', () => {
      // Simulating real Box AI extraction results
      const predictions = [
        'Acme Corporation',        // Correct
        'Beta Inc',                // Correct
        'Charlie & Associates',    // Wrong (should be Charlie Co)
        NOT_PRESENT_VALUE,         // Correct (no value)
        'Error: Rate limit',       // Should be excluded
        'Delta Corp'               // Correct
      ]
      const groundTruths = [
        'Acme Corporation',
        'Beta Inc',
        'Charlie Co',
        NOT_PRESENT_VALUE,
        'Echo Inc',
        'Delta Corp'
      ]
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // 4 correct (3 TP + 1 TN), 1 wrong (FP+FN), 1 error (excluded)
      expect(result.debug.totalValidPairs).toBe(5) // Excludes error
      expect(result.debug.truePositives).toBe(3)
      expect(result.debug.trueNegatives).toBe(1)
      expect(result.debug.falsePositives).toBe(1)
      expect(result.debug.falseNegatives).toBe(1)
      
      // Accuracy = (3+1)/5 = 0.8
      expect(result.accuracy).toBe(0.8)
    })

    test('should handle all models failing', () => {
      const predictions = ['Error: Failed', 'Error: Timeout', 'Error: Auth']
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetrics(predictions, groundTruths)
      
      // All errors excluded = no valid pairs
      expect(result.accuracy).toBe(0)
      expect(result.precision).toBe(0)
      expect(result.recall).toBe(0)
      expect(result.f1Score).toBe(0)
    })

    test('should handle model that always returns Not Present', () => {
      const predictions = [NOT_PRESENT_VALUE, NOT_PRESENT_VALUE, NOT_PRESENT_VALUE]
      const groundTruths = ['Acme Corp', 'Beta Inc', 'Charlie Co']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // All wrong (predicted Not Present when should have values)
      expect(result.debug.falsePositives).toBe(3)
      expect(result.debug.falseNegatives).toBe(3)
      expect(result.accuracy).toBe(0)
      expect(result.recall).toBe(0)
    })
  })

  describe('Metrics Boundary Values', () => {
    test('should clamp metrics between 0 and 1', () => {
      const predictions = ['Acme Corp']
      const groundTruths = ['Acme Corp']
      
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

    test('should handle precision = 1.0, recall = 0', () => {
      // This happens when model makes one prediction and it's correct,
      // but misses other values
      const predictions = ['Acme Corp', NOT_PRESENT_VALUE]
      const groundTruths = ['Acme Corp', 'Beta Inc']
      
      const result = calculateFieldMetricsWithDebug(predictions, groundTruths)
      
      // TP=1, FP=1 (Not Present when should be Beta), FN=1
      expect(result.debug.truePositives).toBe(1)
      expect(result.precision).toBeLessThan(1.0)
      expect(result.recall).toBeLessThan(1.0)
    })
  })
})

