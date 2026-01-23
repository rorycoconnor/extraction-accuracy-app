import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMetricsCalculator } from '@/hooks/use-metrics-calculator'
import type { AccuracyData, ApiExtractionResult, ExtractionError, ErrorType } from '@/lib/types'
import '@testing-library/jest-dom'

// Mock dependencies
const mockMetricsResult = {
  accuracy: 0.9,
  precision: 0.85,
  recall: 0.95,
  f1Score: 0.90,
  debug: {
    truePositives: 18,
    falsePositives: 2,
    falseNegatives: 1, 
    trueNegatives: 0,
    totalValidPairs: 20,
    examples: {
      truePositives: [],
      falsePositives: [],
      falseNegatives: [],
      trueNegatives: []
    }
  }
};

vi.mock('@/lib/metrics', () => ({
  calculateFieldMetricsWithDebug: vi.fn(() => mockMetricsResult),
  calculateFieldMetricsWithDebugAsync: vi.fn(() => Promise.resolve(mockMetricsResult)),
  calculateFieldMetrics: vi.fn(() => ({
    accuracy: 0.9,
    precision: 0.85,
    recall: 0.95,
    f1Score: 0.90
  }))
}))

vi.mock('@/lib/mock-data', () => ({
  getGroundTruthData: vi.fn(() => ({
    'file1': {
      groundTruth: {
        company_name: 'Acme Corp',
        contract_date: '2025-01-01'
      }
    },
    'file2': {
      groundTruth: {
        company_name: 'Beta Inc',
        contract_date: '2025-02-01'
      }
    }
  }))
}))

vi.mock('@/lib/utils', () => ({
  NOT_PRESENT_VALUE: 'Not Present',
  findFieldValue: vi.fn((extractedMetadata: any, fieldKey: string) => {
    return extractedMetadata?.[fieldKey] || 'Not Present'
  })
}))

vi.mock('@/lib/error-handler', () => ({
  extractConciseErrorDescription: vi.fn((error: string) => error.substring(0, 100))
}))

vi.mock('@/lib/compare-type-storage', () => ({
  getCompareConfigForField: vi.fn(() => null)
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/lib/main-page-constants', () => ({
  AVAILABLE_MODELS: ['google__gemini_2_0_flash_001', 'aws__claude_3_7_sonnet']
}))

vi.mock('@/lib/enum-validator', () => ({
  validateEnumValue: vi.fn((value: string) => value),
  validateMultiSelectValue: vi.fn((value: string) => value)
}))

describe('useMetricsCalculator Hook - Core Business Logic', () => {
  
  const createMockAccuracyData = (overrides?: Partial<AccuracyData>): AccuracyData => ({
    templateKey: 'test-template',
    baseModel: 'google__gemini_2_0_flash_001',
    fields: [
      {
        name: 'Company Name',
        key: 'company_name',
        type: 'string',
        prompt: 'Extract the company name',
        promptHistory: []
      },
      {
        name: 'Contract Date', 
        key: 'contract_date',
        type: 'date',
        prompt: 'Extract the contract date',
        promptHistory: []
      }
    ],
    results: [
      {
        id: 'file1',
        fileName: 'contract1.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 'Ground Truth': 'Acme Corp' },
          contract_date: { 'Ground Truth': '2025-01-01' }
        }
      },
      {
        id: 'file2', 
        fileName: 'contract2.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 'Ground Truth': 'Beta Inc' },
          contract_date: { 'Ground Truth': '2025-02-01' }
        }
      }
    ],
    averages: {},
    ...overrides
  })

  const createMockExtractionError = (message: string): ExtractionError => ({
    type: 'API_ERROR' as ErrorType,
    message,
    userMessage: message,
    retryable: true,
    timestamp: new Date()
  })

  const createMockApiResults = (): ApiExtractionResult[] => [
    {
      fileId: 'file1',
      modelName: 'google__gemini_2_0_flash_001',
      extractedMetadata: {
        company_name: 'Acme Corp',
        contract_date: '2025-01-01'
      },
      success: true
    },
    {
      fileId: 'file2',
      modelName: 'google__gemini_2_0_flash_001',
      extractedMetadata: {
        company_name: 'Beta Inc',
        contract_date: '2025-02-01'
      },
      success: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Hook Initialization', () => {
    test('should initialize successfully', () => {
      const { result } = renderHook(() => useMetricsCalculator())
      
      expect(result.current).toBeDefined()
      expect(result.current.calculateAndUpdateMetrics).toBeInstanceOf(Function)
    })
  })

  describe('calculateAndUpdateMetrics - Core Function', () => {
    test('should calculate metrics for successful API results', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const mockApiResults = createMockApiResults()

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, mockApiResults)

      // Should return updated accuracy data
      expect(updatedData).toBeDefined()
      expect(updatedData.results).toHaveLength(2)
      expect(updatedData.averages).toBeDefined()

      // Should have calculated averages for each field
      expect(updatedData.averages.company_name).toBeDefined()
      expect(updatedData.averages.contract_date).toBeDefined()
      
      // Should include model results in field data
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toBe('Acme Corp')
      expect(updatedData.results[1].fields.company_name['google__gemini_2_0_flash_001']).toBe('Beta Inc')
    })

    test('should handle mixed success/failure API results', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const mixedApiResults: ApiExtractionResult[] = [
        ...createMockApiResults().slice(0, 1), // One success
        {
          fileId: 'file2',
          modelName: 'google__gemini_2_0_flash_001', 
          extractedMetadata: {},
          success: false,
          error: createMockExtractionError('Rate limit exceeded')
        }
      ]

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, mixedApiResults)

      // Should handle successful extraction for file1
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toBe('Acme Corp')
      
      // Should handle failed extraction for file2 with error message
      expect(updatedData.results[1].fields.company_name['google__gemini_2_0_flash_001']).toContain('Error:')
    })

    test('should handle completely failed API results', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const failedApiResults: ApiExtractionResult[] = [
        {
          fileId: 'file1',
          modelName: 'google__gemini_2_0_flash_001',
          extractedMetadata: {},
          success: false,
          error: createMockExtractionError('Authentication failed')
        }
      ]

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, failedApiResults)

      // Should handle failed extractions gracefully
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toContain('Error:')
      
      // Should still create averages structure (though with error data)
      expect(updatedData.averages).toBeDefined()
    })

    test('should preserve existing field data when adding new model results', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData({
        results: [
          {
            id: 'file1',
            fileName: 'contract1.pdf', 
            fileType: 'pdf',
            fields: {
              company_name: { 
                'Ground Truth': 'Acme Corp',
                'claude-3-sonnet': 'Acme Corporation' // Existing model result
              }
            }
          }
        ]
      })
      const mockApiResults: ApiExtractionResult[] = [
        {
          fileId: 'file1',
          modelName: 'google__gemini_2_0_flash_001', // New model
          extractedMetadata: { company_name: 'Acme Corp' },
          success: true
        }
      ]

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, mockApiResults)

      // Should add new model data from API
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toBe('Acme Corp')
      
      // Should preserve ground truth
      expect(updatedData.results[0].fields.company_name['Ground Truth']).toBe('Acme Corp')
      
      // Note: Non-API models get reset to "Pending..." status - this is correct behavior
      // The hook processes all available models, so existing model data without API results becomes "Pending..."
      expect(updatedData.results[0].fields.company_name['aws__claude_3_7_sonnet']).toBe('Pending...')
    })

    test('should handle empty API results gracefully', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const emptyApiResults: ApiExtractionResult[] = []

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, emptyApiResults)

      // Should preserve ground truth data
      expect(updatedData.results[0].fields.company_name['Ground Truth']).toBe('Acme Corp')
      expect(updatedData.results[1].fields.company_name['Ground Truth']).toBe('Beta Inc')
      
      // Should set all available models to "Pending..." when no API results provided
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toBe('Pending...')
      expect(updatedData.results[0].fields.contract_date['google__gemini_2_0_flash_001']).toBe('Pending...')
      
      // Should create averages structure with metrics for "Pending..." values
      expect(updatedData.averages).toBeDefined()
      expect(updatedData.averages.company_name).toBeDefined()
      expect(updatedData.averages.contract_date).toBeDefined()
    })

    test('should handle files not found in accuracy data', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const apiResultsWithUnknownFile: ApiExtractionResult[] = [
        {
          fileId: 'unknown-file', // File not in accuracy data
          modelName: 'google__gemini_2_0_flash_001',
          extractedMetadata: { company_name: 'Unknown Corp' },
          success: true
        }
      ]

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, apiResultsWithUnknownFile)

      // Should handle gracefully without crashing
      expect(updatedData).toBeDefined()
      expect(updatedData.results).toHaveLength(2) // Original files unchanged
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed API results', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const malformedApiResults = [
        {
          // Missing required fields
          fileId: 'file1',
          success: true,
          extractedMetadata: {}
        }
      ] as any

      // Should not throw, even with async
      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, malformedApiResults)
      expect(updatedData).toBeDefined()
    })

    test('should handle missing ground truth data', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData({
        results: [
          {
            id: 'file1',
            fileName: 'contract1.pdf',
            fileType: 'pdf',
            fields: {
              company_name: {} // No ground truth
            }
          }
        ]
      })
      const mockApiResults = createMockApiResults()

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, mockApiResults)

      // Should handle missing ground truth gracefully
      expect(updatedData).toBeDefined()
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toBe('Acme Corp')
    })

    test('should handle fields missing from API results', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const incompleteApiResults: ApiExtractionResult[] = [
        {
          fileId: 'file1',
          modelName: 'google__gemini_2_0_flash_001',
          extractedMetadata: {
            company_name: 'Acme Corp'
            // Missing contract_date field
          },
          success: true
        }
      ]

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, incompleteApiResults)

      // Should have extracted company_name
      expect(updatedData.results[0].fields.company_name['google__gemini_2_0_flash_001']).toBe('Acme Corp')
      
      // Should handle missing contract_date field with 'Not Present' value
      expect(updatedData.results[0].fields.contract_date['google__gemini_2_0_flash_001']).toBe('Not Present')
    })
  })

  describe('Performance and Data Integrity', () => {
    test('should maintain data immutability', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      const mockAccuracyData = createMockAccuracyData()
      const originalData = JSON.parse(JSON.stringify(mockAccuracyData)) // Deep copy
      const mockApiResults = createMockApiResults()

      const updatedData = await result.current.calculateAndUpdateMetrics(mockAccuracyData, mockApiResults)

      // Original data should be unchanged
      expect(mockAccuracyData).toEqual(originalData)
      
      // Updated data should be different
      expect(updatedData).not.toBe(mockAccuracyData)
      expect(updatedData.results).not.toBe(mockAccuracyData.results)
    })

    test('should handle large datasets efficiently', async () => {
      const { result } = renderHook(() => useMetricsCalculator())
      
      // Create large dataset
      const largeAccuracyData = createMockAccuracyData({
        results: Array.from({ length: 100 }, (_, i) => ({
          id: `file${i}`,
          fileName: `contract${i}.pdf`,
          fileType: 'pdf',
          fields: {
            company_name: { 'Ground Truth': `Company ${i}` },
            contract_date: { 'Ground Truth': `2025-${String(i % 12 + 1).padStart(2, '0')}-01` }
          }
        }))
      })

      const largeApiResults: ApiExtractionResult[] = Array.from({ length: 100 }, (_, i) => ({
        fileId: `file${i}`,
        modelName: 'google__gemini_2_0_flash_001',
        extractedMetadata: {
          company_name: `Company ${i}`,
          contract_date: `2025-${String(i % 12 + 1).padStart(2, '0')}-01`
        },
        success: true
      }))

      const startTime = performance.now()
      const updatedData = await result.current.calculateAndUpdateMetrics(largeAccuracyData, largeApiResults)
      const endTime = performance.now()

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(2000) // 2 seconds for async
      
      // Should process all results
      expect(updatedData.results).toHaveLength(100)
      expect(updatedData.averages.company_name).toBeDefined()
      expect(updatedData.averages.contract_date).toBeDefined()
    })
  })
}) 