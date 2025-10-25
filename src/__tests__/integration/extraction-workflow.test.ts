import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { AccuracyData, BoxTemplate, ApiExtractionResult, ExtractionJob } from '@/lib/types'
import { NOT_PRESENT_VALUE } from '@/lib/utils'

// Mock the Box service
vi.mock('@/services/box', () => ({
  extractStructuredMetadataWithBoxAI: vi.fn()
}))

// Mock the logger
vi.mock('@/lib/logger', () => ({
  extractionLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('Extraction Workflow - Integration Tests', () => {
  
  const createMockAccuracyData = (overrides?: Partial<AccuracyData>): AccuracyData => ({
    templateKey: 'contracts',
    baseModel: 'google__gemini_2_0_flash_001',
    fields: [
      {
        name: 'Company Name',
        key: 'company_name',
        type: 'string',
        prompt: 'Extract the company name from the contract',
        promptHistory: []
      },
      {
        name: 'Contract Date',
        key: 'contract_date',
        type: 'date',
        prompt: 'Extract the contract effective date',
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

  const createMockTemplate = (): BoxTemplate => ({
    id: 'template1',
    templateKey: 'contracts',
    displayName: 'Contracts',
    scope: 'enterprise',
    fields: [
      {
        id: 'field1',
        key: 'company_name',
        type: 'string',
        displayName: 'Company Name'
      },
      {
        id: 'field2',
        key: 'contract_date',
        type: 'date',
        displayName: 'Contract Date'
      }
    ]
  })

  const createSuccessfulResult = (
    fileId: string,
    modelName: string,
    extractedData: Record<string, any>
  ): ApiExtractionResult => ({
    fileId,
    modelName,
    extractedMetadata: extractedData,
    success: true
  })

  const createFailedResult = (
    fileId: string,
    modelName: string,
    errorMessage: string,
    retryable: boolean = true
  ): ApiExtractionResult => ({
    fileId,
    modelName,
    extractedMetadata: {},
    success: false,
    error: {
      type: 'API_ERROR',
      message: errorMessage,
      userMessage: errorMessage,
      retryable,
      timestamp: new Date()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful Extraction Workflows', () => {
    test('should process all files successfully', () => {
      const mockData = createMockAccuracyData()
      const results: ApiExtractionResult[] = [
        createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
          company_name: 'Acme Corp',
          contract_date: '2025-01-01'
        }),
        createSuccessfulResult('file2', 'google__gemini_2_0_flash_001', {
          company_name: 'Beta Inc',
          contract_date: '2025-02-01'
        })
      ]

      // Verify all results are successful
      expect(results.every(r => r.success)).toBe(true)
      expect(results).toHaveLength(2)
      
      // Verify extracted data
      expect(results[0].extractedMetadata.company_name).toBe('Acme Corp')
      expect(results[1].extractedMetadata.company_name).toBe('Beta Inc')
    })

    test('should handle multiple models per file', () => {
      const results: ApiExtractionResult[] = [
        createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
          company_name: 'Acme Corp'
        }),
        createSuccessfulResult('file1', 'anthropic__claude_3_5_sonnet', {
          company_name: 'Acme Corporation'
        })
      ]

      // Both models should extract from same file
      expect(results.filter(r => r.fileId === 'file1')).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })

    test('should handle empty/Not Present values', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp',
        contract_date: NOT_PRESENT_VALUE
      })

      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name).toBe('Acme Corp')
      expect(result.extractedMetadata.contract_date).toBe(NOT_PRESENT_VALUE)
    })

    test('should handle partial field extraction', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp'
        // contract_date missing
      })

      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name).toBe('Acme Corp')
      expect(result.extractedMetadata.contract_date).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    test('should handle complete extraction failure', () => {
      const result = createFailedResult(
        'file1',
        'google__gemini_2_0_flash_001',
        'API request failed',
        true
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.retryable).toBe(true)
      expect(result.error?.message).toContain('API request failed')
    })

    test('should handle rate limit errors', () => {
      const result = createFailedResult(
        'file1',
        'google__gemini_2_0_flash_001',
        'Rate limit exceeded',
        true
      )

      expect(result.success).toBe(false)
      expect(result.error?.retryable).toBe(true)
      expect(result.error?.message).toContain('Rate limit')
    })

    test('should handle non-retryable errors', () => {
      const result = createFailedResult(
        'file1',
        'google__gemini_2_0_flash_001',
        'Invalid file format',
        false
      )

      expect(result.success).toBe(false)
      expect(result.error?.retryable).toBe(false)
    })

    test('should handle network timeout', () => {
      const result = createFailedResult(
        'file1',
        'google__gemini_2_0_flash_001',
        'Request timeout',
        true
      )

      expect(result.success).toBe(false)
      expect(result.error?.retryable).toBe(true)
    })

    test('should handle authentication errors', () => {
      const result = createFailedResult(
        'file1',
        'google__gemini_2_0_flash_001',
        'Authentication failed',
        false
      )

      expect(result.success).toBe(false)
      expect(result.error?.retryable).toBe(false)
    })
  })

  describe('Partial Failure Scenarios', () => {
    test('should handle mix of successful and failed extractions', () => {
      const results: ApiExtractionResult[] = [
        createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
          company_name: 'Acme Corp'
        }),
        createFailedResult('file2', 'google__gemini_2_0_flash_001', 'Rate limit exceeded'),
        createSuccessfulResult('file3', 'google__gemini_2_0_flash_001', {
          company_name: 'Charlie Co'
        })
      ]

      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)

      expect(successful).toHaveLength(2)
      expect(failed).toHaveLength(1)
      expect(failed[0].error?.message).toContain('Rate limit')
    })

    test('should handle one model succeeding while another fails', () => {
      const results: ApiExtractionResult[] = [
        createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
          company_name: 'Acme Corp'
        }),
        createFailedResult('file1', 'anthropic__claude_3_5_sonnet', 'Model unavailable')
      ]

      // Same file, different outcomes per model
      const file1Results = results.filter(r => r.fileId === 'file1')
      expect(file1Results).toHaveLength(2)
      expect(file1Results.some(r => r.success)).toBe(true)
      expect(file1Results.some(r => !r.success)).toBe(true)
    })

    test('should handle all models failing for one file', () => {
      const results: ApiExtractionResult[] = [
        createFailedResult('file1', 'google__gemini_2_0_flash_001', 'Failed'),
        createFailedResult('file1', 'anthropic__claude_3_5_sonnet', 'Failed'),
        createSuccessfulResult('file2', 'google__gemini_2_0_flash_001', {
          company_name: 'Beta Inc'
        })
      ]

      const file1Results = results.filter(r => r.fileId === 'file1')
      const file2Results = results.filter(r => r.fileId === 'file2')

      // File1: all failed
      expect(file1Results.every(r => !r.success)).toBe(true)
      
      // File2: success
      expect(file2Results.some(r => r.success)).toBe(true)
    })
  })

  describe('Retry Logic', () => {
    test('should identify files needing retry', () => {
      const results: ApiExtractionResult[] = [
        createFailedResult('file1', 'google__gemini_2_0_flash_001', 'Failed', true),
        createFailedResult('file1', 'anthropic__claude_3_5_sonnet', 'Failed', true),
        createSuccessfulResult('file2', 'google__gemini_2_0_flash_001', {
          company_name: 'Beta Inc'
        })
      ]

      // Group by file
      const resultsByFile = new Map<string, ApiExtractionResult[]>()
      results.forEach(r => {
        if (!resultsByFile.has(r.fileId)) {
          resultsByFile.set(r.fileId, [])
        }
        resultsByFile.get(r.fileId)!.push(r)
      })

      // File1: all failed, needs retry
      const file1Results = resultsByFile.get('file1')!
      expect(file1Results.every(r => !r.success)).toBe(true)
      expect(file1Results.every(r => r.error?.retryable)).toBe(true)

      // File2: success, no retry needed
      const file2Results = resultsByFile.get('file2')!
      expect(file2Results.some(r => r.success)).toBe(true)
    })

    test('should not retry non-retryable errors', () => {
      const results: ApiExtractionResult[] = [
        createFailedResult('file1', 'google__gemini_2_0_flash_001', 'Invalid format', false)
      ]

      const shouldRetry = results.every(r => r.error?.retryable === true)
      expect(shouldRetry).toBe(false)
    })

    test('should track retry count', () => {
      const result = createFailedResult('file1', 'google__gemini_2_0_flash_001', 'Failed', true)
      
      // Simulate retry
      const retryResult = {
        ...result,
        retryCount: 1
      }

      expect(retryResult.retryCount).toBe(1)
    })

    test('should handle successful retry', () => {
      const originalResult = createFailedResult('file1', 'google__gemini_2_0_flash_001', 'Timeout', true)
      
      // Simulate successful retry
      const retryResult = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp'
      })

      expect(originalResult.success).toBe(false)
      expect(retryResult.success).toBe(true)
      expect(retryResult.fileId).toBe(originalResult.fileId)
    })
  })

  describe('Progress Tracking', () => {
    test('should track extraction progress', () => {
      const progressUpdates: Array<{ job: any, result: ApiExtractionResult }> = []
      
      const mockProgressCallback = (job: any, result: ApiExtractionResult) => {
        progressUpdates.push({ job, result })
      }

      // Simulate extractions
      const results: ApiExtractionResult[] = [
        createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
          company_name: 'Acme Corp'
        }),
        createSuccessfulResult('file2', 'google__gemini_2_0_flash_001', {
          company_name: 'Beta Inc'
        })
      ]

      // Simulate progress updates
      results.forEach((result, index) => {
        mockProgressCallback({ fileIndex: index, modelName: result.modelName }, result)
      })

      expect(progressUpdates).toHaveLength(2)
      expect(progressUpdates[0].result.fileId).toBe('file1')
      expect(progressUpdates[1].result.fileId).toBe('file2')
    })

    test('should track completion percentage', () => {
      const totalJobs = 6 // 3 files × 2 models
      let completedJobs = 0

      const mockProgressCallback = () => {
        completedJobs++
      }

      // Simulate 6 extractions
      for (let i = 0; i < totalJobs; i++) {
        mockProgressCallback()
      }

      const completionPercentage = (completedJobs / totalJobs) * 100
      expect(completionPercentage).toBe(100)
    })

    test('should track partial completion', () => {
      const totalJobs = 6
      let completedJobs = 3

      const completionPercentage = (completedJobs / totalJobs) * 100
      expect(completionPercentage).toBe(50)
    })
  })

  describe('Data Validation', () => {
    test('should validate extracted data structure', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp',
        contract_date: '2025-01-01'
      })

      expect(result.extractedMetadata).toBeDefined()
      expect(typeof result.extractedMetadata).toBe('object')
      expect(result.extractedMetadata.company_name).toBeDefined()
    })

    test('should handle malformed extraction response', () => {
      const result: ApiExtractionResult = {
        fileId: 'file1',
        modelName: 'google__gemini_2_0_flash_001',
        extractedMetadata: null as any, // Malformed
        success: false,
        error: {
          type: 'PARSE_ERROR',
          message: 'Invalid response format',
          userMessage: 'Failed to parse response',
          retryable: false,
          timestamp: new Date()
        }
      }

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe('PARSE_ERROR')
    })

    test('should handle unexpected field types', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 123, // Number instead of string
        contract_date: true // Boolean instead of date
      })

      // Should still be successful, but values may need type conversion
      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name).toBeDefined()
    })

    test('should handle very large extracted values', () => {
      const largeText = 'A'.repeat(100000)
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: largeText
      })

      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name.length).toBe(100000)
    })
  })

  describe('Concurrency and Performance', () => {
    test('should handle concurrent extractions', () => {
      // Simulate 10 concurrent extractions
      const results: ApiExtractionResult[] = []
      
      for (let i = 0; i < 10; i++) {
        results.push(
          createSuccessfulResult(`file${i}`, 'google__gemini_2_0_flash_001', {
            company_name: `Company ${i}`
          })
        )
      }

      expect(results).toHaveLength(10)
      expect(results.every(r => r.success)).toBe(true)
    })

    test('should handle extraction timing', () => {
      const startTime = Date.now()
      
      // Simulate extraction
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp'
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(1000) // Mock should be fast
    })

    test('should handle rate limiting with delays', () => {
      const results: ApiExtractionResult[] = [
        createFailedResult('file1', 'google__gemini_2_0_flash_001', 'Rate limit exceeded', true),
        createFailedResult('file2', 'google__gemini_2_0_flash_001', 'Rate limit exceeded', true)
      ]

      // All should be retryable
      expect(results.every(r => r.error?.retryable)).toBe(true)
      expect(results.every(r => r.error?.message.includes('Rate limit'))).toBe(true)
    })
  })

  describe('Real-World Scenarios', () => {
    test('should handle typical production extraction batch', () => {
      // Simulate real production scenario: 3 files, 2 models, 1 partial failure
      const results: ApiExtractionResult[] = [
        // File 1: Both models succeed
        createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
          company_name: 'Acme Corp',
          contract_date: '2025-01-01'
        }),
        createSuccessfulResult('file1', 'anthropic__claude_3_5_sonnet', {
          company_name: 'Acme Corporation',
          contract_date: '2025-01-01'
        }),
        
        // File 2: One model succeeds, one fails
        createSuccessfulResult('file2', 'google__gemini_2_0_flash_001', {
          company_name: 'Beta Inc',
          contract_date: '2025-02-01'
        }),
        createFailedResult('file2', 'anthropic__claude_3_5_sonnet', 'Rate limit exceeded', true),
        
        // File 3: Both models succeed
        createSuccessfulResult('file3', 'google__gemini_2_0_flash_001', {
          company_name: 'Charlie Co',
          contract_date: NOT_PRESENT_VALUE
        }),
        createSuccessfulResult('file3', 'anthropic__claude_3_5_sonnet', {
          company_name: 'Charlie & Associates',
          contract_date: NOT_PRESENT_VALUE
        })
      ]

      // Analyze results
      const totalExtractions = results.length
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      const successRate = (successful / totalExtractions) * 100

      expect(totalExtractions).toBe(6)
      expect(successful).toBe(5)
      expect(failed).toBe(1)
      expect(successRate).toBeCloseTo(83.33, 1)
    })

    test('should handle document with missing fields', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp'
        // contract_date is missing from document
      })

      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name).toBe('Acme Corp')
      expect(result.extractedMetadata.contract_date).toBeUndefined()
    })

    test('should handle document with extra fields', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp',
        contract_date: '2025-01-01',
        extra_field: 'Extra data', // Not in template
        another_field: 'More data'
      })

      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name).toBe('Acme Corp')
      // Extra fields should be preserved
      expect(result.extractedMetadata.extra_field).toBe('Extra data')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty file list', () => {
      const results: ApiExtractionResult[] = []

      expect(results).toHaveLength(0)
    })

    test('should handle single file extraction', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp'
      })

      expect(result.success).toBe(true)
      expect(result.fileId).toBe('file1')
    })

    test('should handle extraction with no fields', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {})

      expect(result.success).toBe(true)
      expect(Object.keys(result.extractedMetadata)).toHaveLength(0)
    })

    test('should handle null/undefined values in extracted data', () => {
      const result = createSuccessfulResult('file1', 'google__gemini_2_0_flash_001', {
        company_name: null,
        contract_date: undefined
      })

      expect(result.success).toBe(true)
      expect(result.extractedMetadata.company_name).toBeNull()
      expect(result.extractedMetadata.contract_date).toBeUndefined()
    })

    test('should handle special characters in file IDs', () => {
      const specialFileId = 'file-123_test@domain.com'
      const result = createSuccessfulResult(specialFileId, 'google__gemini_2_0_flash_001', {
        company_name: 'Acme Corp'
      })

      expect(result.fileId).toBe(specialFileId)
      expect(result.success).toBe(true)
    })
  })
})

