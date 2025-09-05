import { describe, test, expect, beforeEach } from 'vitest'
import { calculateFieldMetrics } from '@/lib/metrics'
import { calculateModelSummaries, assignRanks, determineFieldWinners } from '@/lib/model-ranking-utils'
import type { AccuracyData } from '@/lib/types'

describe('Accuracy-First Metrics Workflow Integration', () => {
  
  const createTestData = (): AccuracyData => ({
    templateKey: 'invoice-template',
    baseModel: 'gpt-4',
    fields: [
      {
        name: 'Company Name',
        key: 'company_name',
        type: 'string',
        prompt: 'Extract company name',
        promptHistory: []
      },
      {
        name: 'Invoice Amount',
        key: 'invoice_amount',
        type: 'number',
        prompt: 'Extract total amount',
        promptHistory: []
      }
    ],
    results: [],
    averages: {
      company_name: {
        'GPT-4': { accuracy: 0.95, precision: 0.92, recall: 0.90, f1: 0.91 },
        'Claude': { accuracy: 0.88, precision: 0.85, recall: 0.90, f1: 0.87 },
        'Gemini': { accuracy: 0.82, precision: 0.80, recall: 0.85, f1: 0.82 }
      },
      invoice_amount: {
        'GPT-4': { accuracy: 0.90, precision: 0.88, recall: 0.92, f1: 0.90 },
        'Claude': { accuracy: 0.85, precision: 0.82, recall: 0.88, f1: 0.85 },
        'Gemini': { accuracy: 0.78, precision: 0.75, recall: 0.82, f1: 0.78 }
      }
    }
  })

  describe('End-to-End Accuracy-First Model Ranking', () => {
    test('should rank models by Overall Accuracy (primary criterion)', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      
      // Step 1: Calculate model summaries
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      
      // Step 2: Determine field winners
      determineFieldWinners(summaries, testData.fields)
      
      // Step 3: Assign ranks (Accuracy-first)
      assignRanks(summaries)
      
      // Verify Accuracy-first ranking
      // Expected overall accuracies: GPT-4 (0.925), Claude (0.865), Gemini (0.80)
      expect(summaries[0].modelName).toBe('GPT-4') // Highest accuracy
      expect(summaries[0].rank).toBe(1)
      expect(summaries[1].modelName).toBe('Claude') // Second highest
      expect(summaries[1].rank).toBe(2)  
      expect(summaries[2].modelName).toBe('Gemini') // Lowest accuracy
      expect(summaries[2].rank).toBe(3)
      
      // Verify accuracy values are correctly prioritized
      expect(summaries[0].overallAccuracy).toBeGreaterThan(summaries[1].overallAccuracy)
      expect(summaries[1].overallAccuracy).toBeGreaterThan(summaries[2].overallAccuracy)
    })

    test('should use F1 for tie-breaking when Accuracy is equal', () => {
      const testData = createTestData()
      
      // Modify data to create accuracy tie but different F1 scores
      testData.averages = {
        company_name: {
          'Model_A': { accuracy: 0.85, precision: 0.80, recall: 0.90, f1: 0.92 }, // Same accuracy, higher F1
          'Model_B': { accuracy: 0.85, precision: 0.88, recall: 0.82, f1: 0.85 }  // Same accuracy, lower F1
        }
      }
      
      const visibleModels = ['Model_A', 'Model_B']
      const summaries = calculateModelSummaries(visibleModels, testData.fields.slice(0, 1), testData.averages)
      
      assignRanks(summaries)
      
      // Should tie-break using F1: Model_A (higher F1) should rank first
      expect(summaries[0].modelName).toBe('Model_A')
      expect(summaries[0].rank).toBe(1)
      expect(summaries[1].modelName).toBe('Model_B')
      expect(summaries[1].rank).toBe(2)
      
      // Verify both have same accuracy but Model_A has higher F1
      expect(summaries[0].overallAccuracy).toBe(summaries[1].overallAccuracy)
      expect(summaries[0].overallF1).toBeGreaterThan(summaries[1].overallF1)
    })

    test('should identify field winners based on accuracy', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      determineFieldWinners(summaries, testData.fields)
      
      // GPT-4 should win both fields (highest accuracy in both)
      const gptSummary = summaries.find(s => s.modelName === 'GPT-4')!
      
      expect(gptSummary.fieldPerformance).toHaveLength(2)
      
      // Should win company_name field (0.95 accuracy)
      const companyField = gptSummary.fieldPerformance.find(f => f.fieldKey === 'company_name')
      expect(companyField?.isWinner).toBe(true)
      expect(companyField?.accuracy).toBe(0.95)
      
      // Should win invoice_amount field (0.90 accuracy) 
      const amountField = gptSummary.fieldPerformance.find(f => f.fieldKey === 'invoice_amount')
      expect(amountField?.isWinner).toBe(true)
      expect(amountField?.accuracy).toBe(0.90)
      
      // GPT-4 should have 2 fields won out of 2 total
      expect(gptSummary.fieldsWon).toBe(2)
      expect(gptSummary.totalFields).toBe(2)
    })

    test('should calculate macro-averaged overall metrics correctly', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      
      const gptSummary = summaries.find(s => s.modelName === 'GPT-4')!
      const claudeSummary = summaries.find(s => s.modelName === 'Claude')!
      
      // GPT-4 overall accuracy should be (0.95 + 0.90) / 2 = 0.925
      expect(gptSummary.overallAccuracy).toBe(0.925)
      
      // Claude overall accuracy should be (0.88 + 0.85) / 2 = 0.865
      expect(claudeSummary.overallAccuracy).toBe(0.865)
      
      // GPT-4 overall F1 should be (0.91 + 0.90) / 2 = 0.905
      expect(gptSummary.overallF1).toBe(0.905)
      
      // Claude overall F1 should be (0.87 + 0.85) / 2 = 0.86
      expect(claudeSummary.overallF1).toBe(0.86)
    })
  })

  describe('Performance Threshold Classification', () => {
    test('should classify performance levels correctly', () => {
      const testData = createTestData()
      
      // Test with different performance levels
      testData.averages = {
        company_name: {
          'Excellent_Model': { accuracy: 0.95, precision: 0.92, recall: 0.94, f1: 0.93 }, // >= 90% = Excellent
          'Good_Model': { accuracy: 0.75, precision: 0.72, recall: 0.78, f1: 0.75 },       // >= 70% = Good
          'Poor_Model': { accuracy: 0.45, precision: 0.40, recall: 0.50, f1: 0.44 }        // < 70% = Needs Improvement
        }
      }
      
      const visibleModels = ['Excellent_Model', 'Good_Model', 'Poor_Model']
      const summaries = calculateModelSummaries(visibleModels, testData.fields.slice(0, 1), testData.averages)
      
      const excellentSummary = summaries.find(s => s.modelName === 'Excellent_Model')!
      const goodSummary = summaries.find(s => s.modelName === 'Good_Model')!
      const poorSummary = summaries.find(s => s.modelName === 'Poor_Model')!
      
      // Verify performance levels through accuracy
      expect(excellentSummary.overallAccuracy).toBeGreaterThanOrEqual(0.9) // Excellent
      expect(goodSummary.overallAccuracy).toBeGreaterThanOrEqual(0.7) // Good
      expect(goodSummary.overallAccuracy).toBeLessThan(0.9)
      expect(poorSummary.overallAccuracy).toBeLessThan(0.7) // Needs Improvement
    })
  })

  describe('Edge Cases and Data Validation', () => {
    test('should handle single model scenario', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4']
      
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      determineFieldWinners(summaries, testData.fields)
      assignRanks(summaries)
      
      expect(summaries).toHaveLength(1)
      expect(summaries[0].modelName).toBe('GPT-4')
      expect(summaries[0].rank).toBe(1)
      expect(summaries[0].fieldsWon).toBe(2) // Should win all fields by default
    })

    test('should handle missing averages gracefully', () => {
      const testData = createTestData()
      testData.averages = {
        company_name: {
          'GPT-4': { accuracy: 0.90, precision: 0.85, recall: 0.88, f1: 0.86 }
          // Missing Claude and Gemini
        }
      }
      
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      
      // Should create summaries for all models, with 0 metrics for missing data
      expect(summaries).toHaveLength(3)
      
      const gptSummary = summaries.find(s => s.modelName === 'GPT-4')!
      const claudeSummary = summaries.find(s => s.modelName === 'Claude')!
      
      expect(gptSummary.overallAccuracy).toBeGreaterThan(0)
      expect(claudeSummary.overallAccuracy).toBe(0) // Missing data = 0
    })

    test('should maintain ranking consistency', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      
      // Run ranking multiple times
      const rankings = Array.from({ length: 5 }, () => {
        const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
        assignRanks(summaries)
        return summaries.map(s => ({ model: s.modelName, rank: s.rank }))
      })
      
      // All rankings should be identical (deterministic)
      rankings.forEach(ranking => {
        expect(ranking).toEqual(rankings[0])
      })
      
      // Verify expected ranking
      const expectedRanking = rankings[0]
      expect(expectedRanking.find(r => r.model === 'GPT-4')?.rank).toBe(1)
      expect(expectedRanking.find(r => r.model === 'Claude')?.rank).toBe(2)
      expect(expectedRanking.find(r => r.model === 'Gemini')?.rank).toBe(3)
    })
  })

  describe('Metrics Calculation Validation', () => {
    test('should validate metrics are within expected bounds', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      
      summaries.forEach(summary => {
        // All metrics should be between 0 and 1
        expect(summary.overallAccuracy).toBeGreaterThanOrEqual(0)
        expect(summary.overallAccuracy).toBeLessThanOrEqual(1)
        expect(summary.overallF1).toBeGreaterThanOrEqual(0)
        expect(summary.overallF1).toBeLessThanOrEqual(1)
        expect(summary.overallPrecision).toBeGreaterThanOrEqual(0)
        expect(summary.overallPrecision).toBeLessThanOrEqual(1)
        expect(summary.overallRecall).toBeGreaterThanOrEqual(0)
        expect(summary.overallRecall).toBeLessThanOrEqual(1)
        
        // Field-level metrics should also be bounded
        summary.fieldPerformance.forEach(field => {
          expect(field.accuracy).toBeGreaterThanOrEqual(0)
          expect(field.accuracy).toBeLessThanOrEqual(1)
          expect(field.f1).toBeGreaterThanOrEqual(0)
          expect(field.f1).toBeLessThanOrEqual(1)
        })
        
        // fieldsWon should not exceed totalFields
        expect(summary.fieldsWon).toBeLessThanOrEqual(summary.totalFields)
        expect(summary.fieldsWon).toBeGreaterThanOrEqual(0)
      })
    })

    test('should maintain mathematical relationships', () => {
      const testData = createTestData()
      const visibleModels = ['GPT-4']
      
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      const summary = summaries[0]
      
      // Overall metrics should be averages of field metrics
      const expectedAccuracy = summary.fieldPerformance.reduce((sum, field) => sum + field.accuracy, 0) / summary.fieldPerformance.length
      const expectedF1 = summary.fieldPerformance.reduce((sum, field) => sum + field.f1, 0) / summary.fieldPerformance.length
      
      expect(summary.overallAccuracy).toBeCloseTo(expectedAccuracy, 10)
      expect(summary.overallF1).toBeCloseTo(expectedF1, 10)
    })
  })

  describe('System Integration Points', () => {
    test('should integrate with existing metrics calculation', () => {
      // Test that our ranking system works with the actual metrics library
      const groundTruth = ['Company A', 'Company B']
      const extracted = ['Company A', 'Company B'] // Perfect match
      
      const metrics = calculateFieldMetrics(groundTruth, extracted)
      
      // Should return proper metrics structure
      expect(metrics).toHaveProperty('accuracy')
      expect(metrics).toHaveProperty('precision')
      expect(metrics).toHaveProperty('recall')
      expect(metrics).toHaveProperty('f1')
      
      // Perfect match should yield perfect scores
      expect(metrics.accuracy).toBe(1.0)
    })

    test('should work with realistic data volumes', () => {
      const testData = createTestData()
      
      // Add multiple fields to simulate realistic template
      testData.fields = Array.from({ length: 10 }, (_, i) => ({
        name: `Field ${i + 1}`,
        key: `field_${i + 1}`,
        type: 'string',
        prompt: `Extract field ${i + 1}`,
        promptHistory: []
      }))
      
      // Create averages for all fields
      testData.fields.forEach(field => {
        testData.averages[field.key] = {
          'GPT-4': { accuracy: 0.90 + Math.random() * 0.1, precision: 0.85, recall: 0.88, f1: 0.86 },
          'Claude': { accuracy: 0.80 + Math.random() * 0.1, precision: 0.82, recall: 0.85, f1: 0.83 },
          'Gemini': { accuracy: 0.70 + Math.random() * 0.1, precision: 0.75, recall: 0.78, f1: 0.76 }
        }
      })
      
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      const startTime = performance.now()
      
      const summaries = calculateModelSummaries(visibleModels, testData.fields, testData.averages)
      determineFieldWinners(summaries, testData.fields)
      assignRanks(summaries)
      
      const endTime = performance.now()
      const processingTime = endTime - startTime
      
      // Should process efficiently
      expect(processingTime).toBeLessThan(100) // Under 100ms for 10 fields x 3 models
      expect(summaries).toHaveLength(3)
      expect(summaries[0].fieldPerformance).toHaveLength(10)
    })
  })
}) 