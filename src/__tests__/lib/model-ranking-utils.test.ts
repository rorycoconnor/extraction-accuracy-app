import { describe, test, expect } from 'vitest'
import { 
  calculateModelSummaries,
  determineFieldWinners,
  assignRanks,
  PERFORMANCE_THRESHOLDS
} from '@/lib/model-ranking-utils'
import type { AccuracyData } from '@/lib/types'

describe('Model Ranking Utils - Accuracy-First Implementation', () => {
  
  const createMockAccuracyData = (overrides?: Partial<AccuracyData>): AccuracyData => ({
    templateKey: 'test-template',
    baseModel: 'gpt-4',
    fields: [
      { name: 'Company Name', key: 'company_name', type: 'string', prompt: 'Extract company name', promptHistory: [] },
      { name: 'Date', key: 'date', type: 'date', prompt: 'Extract date', promptHistory: [] }
    ],
    results: [
      {
        id: '1',
        fileName: 'test1.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 'GPT-4': 'Acme Corp', 'Claude': 'Acme Corporation', 'Ground Truth': 'Acme Corp' },
          date: { 'GPT-4': '2025-01-01', 'Claude': '2025-01-01', 'Ground Truth': '2025-01-01' }
        }
      }
    ],
    averages: {
      company_name: {
        'GPT-4': { accuracy: 0.9, precision: 0.85, recall: 0.88, f1: 0.86 },
        'Claude': { accuracy: 0.75, precision: 0.90, recall: 0.95, f1: 0.92 }
      },
      date: {
        'GPT-4': { accuracy: 0.8, precision: 0.82, recall: 0.78, f1: 0.80 },
        'Claude': { accuracy: 0.85, precision: 0.88, recall: 0.82, f1: 0.85 }
      }
    },
    ...overrides
  })

  describe('calculateModelSummaries - Core Ranking Logic', () => {
    test('should calculate overall metrics using macro averaging', () => {
      const mockData = createMockAccuracyData()
      const visibleModels = ['GPT-4', 'Claude']
      
      const summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      
      expect(summaries).toHaveLength(2)
      
      // GPT-4: (0.9 + 0.8) / 2 = 0.85 average accuracy
      const gpt4Summary = summaries.find(s => s.modelName === 'GPT-4')
      expect(gpt4Summary?.overallAccuracy).toBeCloseTo(0.85, 3)
      
      // Claude: (0.75 + 0.85) / 2 = 0.80 average accuracy  
      const claudeSummary = summaries.find(s => s.modelName === 'Claude')
      expect(claudeSummary?.overallAccuracy).toBeCloseTo(0.80, 3)
    })

    test('should include field-level performance details', () => {
      const mockData = createMockAccuracyData()
      const visibleModels = ['GPT-4']
      
      const summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      const gpt4Summary = summaries[0]
      
      expect(gpt4Summary.fieldPerformance).toHaveLength(2)
      expect(gpt4Summary.fieldPerformance[0].fieldName).toBe('Company Name')
      expect(gpt4Summary.fieldPerformance[0].accuracy).toBe(0.9)
      expect(gpt4Summary.fieldPerformance[0].f1).toBe(0.86)
    })

    test('should handle missing field data gracefully', () => {
      const mockData = createMockAccuracyData({
        averages: {
          company_name: {
            'GPT-4': { accuracy: 0.9, precision: 0.85, recall: 0.88, f1: 0.86 }
            // Missing Claude data
          }
        }
      })
      const visibleModels = ['GPT-4', 'Claude']
      
      const summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      
      // Should still create summaries for both models
      expect(summaries).toHaveLength(2)
      
      const claudeSummary = summaries.find(s => s.modelName === 'Claude')
      expect(claudeSummary?.overallAccuracy).toBe(0) // Missing data = 0
    })
  })

  describe('assignRanks - Accuracy-First Ranking', () => {
    test('should rank models by overall accuracy (primary criterion)', () => {
      const mockData = createMockAccuracyData({
        averages: {
          field1: {
            'Model A': { accuracy: 0.9, precision: 0.7, recall: 0.8, f1: 0.74 },
            'Model B': { accuracy: 0.8, precision: 0.9, recall: 0.9, f1: 0.90 },
            'Model C': { accuracy: 0.95, precision: 0.6, recall: 0.7, f1: 0.65 }
          }
        },
        fields: [{ name: 'Field 1', key: 'field1', type: 'string', prompt: 'test', promptHistory: [] }]
      })
      
      const visibleModels = ['Model A', 'Model B', 'Model C']
          let summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
    assignRanks(summaries)
    
    // Should be ranked by accuracy: C (0.95), A (0.9), B (0.8)
    expect(summaries[0].modelName).toBe('Model C')
    expect(summaries[0].rank).toBe(1)
    expect(summaries[1].modelName).toBe('Model A')
    expect(summaries[1].rank).toBe(2)
    expect(summaries[2].modelName).toBe('Model B')
    expect(summaries[2].rank).toBe(3)
    })

    test('should use precision for tie-breaking when accuracy is equal', () => {
      const mockData = createMockAccuracyData({
        averages: {
          field1: {
            'Model A': { accuracy: 0.8, precision: 0.7, recall: 0.8, f1: 0.9 }, // Lower precision
            'Model B': { accuracy: 0.8, precision: 0.9, recall: 0.7, f1: 0.7 }  // Higher precision
          }
        },
        fields: [{ name: 'Field 1', key: 'field1', type: 'string', prompt: 'test', promptHistory: [] }]
      })
      
      const visibleModels = ['Model A', 'Model B']
      let summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      assignRanks(summaries)
      
      // Both have same accuracy (0.8), but B has higher precision (0.9 vs 0.7)
      expect(summaries[0].modelName).toBe('Model B')
      expect(summaries[0].rank).toBe(1)
      expect(summaries[1].modelName).toBe('Model A')
      expect(summaries[1].rank).toBe(2)
    })

    test('should handle multiple tie-breaking levels', () => {
      const mockData = createMockAccuracyData({
        averages: {
          field1: {
            'Model A': { accuracy: 0.8, precision: 0.8, recall: 0.7, f1: 0.9 },
            'Model B': { accuracy: 0.8, precision: 0.7, recall: 0.8, f1: 0.9 }
          }
        },
        fields: [{ name: 'Field 1', key: 'field1', type: 'string', prompt: 'test', promptHistory: [] }]
      })
      
      const visibleModels = ['Model A', 'Model B']
      let summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      assignRanks(summaries)
      
      // Same accuracy (0.8) and F1 (0.9), should use precision: A (0.8) > B (0.7)
      expect(summaries[0].modelName).toBe('Model A')
      expect(summaries[0].rank).toBe(1)
    })
  })

  describe('determineFieldWinners - Performance Analysis', () => {
    test('should determine field winners by accuracy', () => {
      const mockData = createMockAccuracyData({
        averages: {
          field1: {
            'Model A': { accuracy: 0.9, precision: 0.7, recall: 0.8, f1: 0.74 },
            'Model B': { accuracy: 0.8, precision: 0.9, recall: 0.9, f1: 0.90 }
          },
          field2: {
            'Model A': { accuracy: 0.7, precision: 0.8, recall: 0.8, f1: 0.80 },
            'Model B': { accuracy: 0.95, precision: 0.9, recall: 0.9, f1: 0.90 }
          }
        },
        fields: [
          { name: 'Field 1', key: 'field1', type: 'string', prompt: 'test', promptHistory: [] },
          { name: 'Field 2', key: 'field2', type: 'string', prompt: 'test', promptHistory: [] }
        ]
      })
      
      const visibleModels = ['Model A', 'Model B']
      let summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      determineFieldWinners(summaries, mockData.fields)
      
      const modelA = summaries.find(s => s.modelName === 'Model A')!
      const modelB = summaries.find(s => s.modelName === 'Model B')!
      
      // Model A should win field1 (0.9 > 0.8 accuracy)
      expect(modelA.fieldPerformance[0].isWinner).toBe(true)
      expect(modelB.fieldPerformance[0].isWinner).toBe(false)
      
      // Model B should win field2 (0.95 > 0.7 accuracy)
      expect(modelA.fieldPerformance[1].isWinner).toBe(false)
      expect(modelB.fieldPerformance[1].isWinner).toBe(true)
    })

    test('should handle tied field performance', () => {
      const mockData = createMockAccuracyData({
        averages: {
          field1: {
            'Model A': { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 },
            'Model B': { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
          }
        },
        fields: [{ name: 'Field 1', key: 'field1', type: 'string', prompt: 'test', promptHistory: [] }]
      })
      
      const visibleModels = ['Model A', 'Model B']
      let summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      determineFieldWinners(summaries, mockData.fields)
      
      const modelA = summaries.find(s => s.modelName === 'Model A')!
      const modelB = summaries.find(s => s.modelName === 'Model B')!
      
      // Both should be marked as shared winners
      expect(modelA.fieldPerformance[0].isWinner).toBe(true)
      expect(modelA.fieldPerformance[0].isSharedVictory).toBe(true)
      expect(modelB.fieldPerformance[0].isWinner).toBe(true)
      expect(modelB.fieldPerformance[0].isSharedVictory).toBe(true)
    })
  })

  describe('Performance Thresholds', () => {
    test('should classify performance levels correctly', () => {
      expect(PERFORMANCE_THRESHOLDS.EXCELLENT).toBe(0.9)
      expect(PERFORMANCE_THRESHOLDS.GOOD).toBe(0.7)
      
      // Test performance classification logic would go here
      // This ensures consistency with UI color coding
    })
  })

  describe('Integration Test - Complete Workflow', () => {
    test('should process complete ranking workflow correctly', () => {
      const mockData = createMockAccuracyData({
        averages: {
          company_name: {
            'GPT-4': { accuracy: 0.9, precision: 0.85, recall: 0.88, f1: 0.86 },
            'Claude': { accuracy: 0.85, precision: 0.90, recall: 0.82, f1: 0.86 },
            'Gemini': { accuracy: 0.95, precision: 0.92, recall: 0.98, f1: 0.95 }
          },
          date: {
            'GPT-4': { accuracy: 0.8, precision: 0.82, recall: 0.78, f1: 0.80 },
            'Claude': { accuracy: 0.85, precision: 0.88, recall: 0.82, f1: 0.85 },
            'Gemini': { accuracy: 0.75, precision: 0.72, recall: 0.78, f1: 0.75 }
          }
        }
      })
      
      const visibleModels = ['GPT-4', 'Claude', 'Gemini']
      let summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages)
      determineFieldWinners(summaries, mockData.fields)
      assignRanks(summaries)
      
      // Verify overall accuracy calculations
      // GPT-4: (0.9 + 0.8) / 2 = 0.85
      // Claude: (0.85 + 0.85) / 2 = 0.85
      // Gemini: (0.95 + 0.75) / 2 = 0.85
      
      // All tied on accuracy, should use precision for tie-breaking
      // GPT-4 Precision: (0.85 + 0.82) / 2 = 0.835
      // Claude Precision: (0.90 + 0.88) / 2 = 0.89
      // Gemini Precision: (0.92 + 0.72) / 2 = 0.82
      
      expect(summaries[0].modelName).toBe('Claude') // Highest precision
      expect(summaries[1].modelName).toBe('GPT-4') // Second highest precision
      expect(summaries[2].modelName).toBe('Gemini') // Lowest precision
      
      // Verify field winners
      const claudeSummary = summaries.find(s => s.modelName === 'Claude')!
      const geminiSummary = summaries.find(s => s.modelName === 'Gemini')!
      
      // Gemini should win company_name (0.95 accuracy)
      expect(geminiSummary.fieldPerformance.find(f => f.fieldKey === 'company_name')?.isWinner).toBe(true)
      // Claude should win date (0.85 accuracy)
      expect(claudeSummary.fieldPerformance.find(f => f.fieldKey === 'date')?.isWinner).toBe(true)
    })
  })
}) 