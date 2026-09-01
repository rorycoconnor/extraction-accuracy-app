import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentAlphaRunner } from '@/hooks/use-agent-alpha-runner'
import type { AccuracyData } from '@/lib/types'
import type { AgentAlphaState } from '@/lib/agent-alpha-types'

// Mock the store
const mockDispatch = vi.fn()
const mockState = {
  agentAlpha: {
    status: 'idle' as const,
    fieldsProcessed: 0,
    totalFields: 0,
    processingFields: [],
    processedFields: [],
    runtimeConfig: undefined,
    errorMessage: undefined,
    actualDocCount: undefined,
  },
  agentAlphaPendingResults: null,
  data: null as AccuracyData | null,
}

vi.mock('@/store/AccuracyDataStore', () => ({
  useAccuracyDataStore: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}))

// Mock toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock AI flows
vi.mock('@/ai/flows/agent-alpha-prepare', () => ({
  prepareAgentAlphaWorkPlan: vi.fn().mockResolvedValue({
    fields: [],
    sampledDocIds: [],
    trainDocIds: [],
    holdoutDocIds: [],
    templateKey: 'test-template',
  }),
}))

vi.mock('@/ai/flows/agent-alpha-process-field', () => ({
  processAgentAlphaField: vi.fn(),
}))

// Mock storage
vi.mock('@/lib/prompt-storage', () => ({
  saveFieldPrompt: vi.fn(),
}))

vi.mock('@/lib/compare-type-storage', () => ({
  getCompareConfigForField: vi.fn(),
}))

vi.mock('@/lib/mock-data', () => ({
  getConfiguredTemplates: vi.fn(() => []),
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}))

// Mock agent-alpha-config
vi.mock('@/lib/agent-alpha-config', () => ({
  getDefaultRuntimeConfig: () => ({
    maxDocs: 8,
    maxIterations: 5,
    testModel: 'google__gemini_2_5_flash',
    fieldConcurrency: 5,
  }),
  AGENT_ALPHA_CONFIG: {
    MAX_DOCS: 8,
    MAX_ITERATIONS: 5,
    TARGET_ACCURACY: 1.0,
    DEFAULT_TEST_MODEL: 'google__gemini_2_5_flash',
    FIELD_CONCURRENCY: 5,
    EXTRACTION_CONCURRENCY: 5,
    STAGGER_DELAY_MS: 500,
  },
}))

describe('useAgentAlphaRunner Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset state to defaults
    mockState.agentAlpha = {
      status: 'idle',
      fieldsProcessed: 0,
      totalFields: 0,
      processingFields: [],
      processedFields: [],
      runtimeConfig: undefined,
      errorMessage: undefined,
      actualDocCount: undefined,
    }
    mockState.agentAlphaPendingResults = null
    mockState.data = null
  })

  describe('Hook Initialization', () => {
    test('should return all required functions and state', () => {
      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.openConfigureModal).toBeInstanceOf(Function)
      expect(result.current.runAgentAlphaWithConfig).toBeInstanceOf(Function)
      expect(result.current.applyResults).toBeInstanceOf(Function)
      expect(result.current.discardResults).toBeInstanceOf(Function)
      expect(result.current.resetState).toBeInstanceOf(Function)
      expect(result.current.agentAlphaState).toBeDefined()
      expect(result.current.pendingResults).toBeDefined()
    })

    test('should return correct computed state flags when idle', () => {
      mockState.agentAlpha.status = 'idle'
      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.isConfigure).toBe(false)
      expect(result.current.isRunning).toBe(false)
      expect(result.current.isPreview).toBe(false)
      expect(result.current.isModalOpen).toBe(false)
    })

    test('should return correct computed state flags when configure', () => {
      mockState.agentAlpha.status = 'configure'
      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.isConfigure).toBe(true)
      expect(result.current.isRunning).toBe(false)
      expect(result.current.isPreview).toBe(false)
      expect(result.current.isModalOpen).toBe(true)
    })

    test('should return correct computed state flags when running', () => {
      mockState.agentAlpha.status = 'running'
      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.isConfigure).toBe(false)
      expect(result.current.isRunning).toBe(true)
      expect(result.current.isPreview).toBe(false)
      expect(result.current.isModalOpen).toBe(true)
    })

    test('should return correct computed state flags when preview', () => {
      mockState.agentAlpha.status = 'preview'
      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.isConfigure).toBe(false)
      expect(result.current.isRunning).toBe(false)
      expect(result.current.isPreview).toBe(true)
      expect(result.current.isModalOpen).toBe(true)
    })
  })

  describe('openConfigureModal', () => {
    test('should show toast when no accuracy data', () => {
      mockState.data = null
      const { result } = renderHook(() => useAgentAlphaRunner())

      act(() => {
        result.current.openConfigureModal()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'No accuracy data',
        description: 'Load comparison results before running Agent-Alpha.',
        variant: 'destructive',
      })
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test('should show toast when no comparison results exist', () => {
      mockState.data = {
        templateKey: 'test',
        baseModel: 'gpt-4',
        fields: [],
        results: [
          {
            id: 'file1',
            fileName: 'test.pdf',
            fileType: 'pdf',
            fields: {},
            comparisonResults: {}, // Empty comparison results
          },
        ],
        averages: {},
      }
      const { result } = renderHook(() => useAgentAlphaRunner())

      act(() => {
        result.current.openConfigureModal()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Run Comparison First',
        description: 'Please run a comparison before using Agent-Alpha. It needs comparison results to identify failing fields.',
        variant: 'destructive',
      })
    })

    test('should dispatch AGENT_ALPHA_CONFIGURE when all conditions met', () => {
      mockState.data = {
        templateKey: 'test',
        baseModel: 'gpt-4',
        fields: [],
        results: [
          {
            id: 'file1',
            fileName: 'test.pdf',
            fileType: 'pdf',
            fields: {},
            comparisonResults: {
              field1: {
                'GPT-4': { isMatch: true, matchType: 'exact', confidence: 'high' },
              },
            },
          },
        ],
        averages: {},
      }
      const { result } = renderHook(() => useAgentAlphaRunner())

      act(() => {
        result.current.openConfigureModal()
      })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'AGENT_ALPHA_CONFIGURE' })
    })

    test('should not open when already running', () => {
      mockState.agentAlpha.status = 'running'
      mockState.data = {
        templateKey: 'test',
        baseModel: 'gpt-4',
        fields: [],
        results: [],
        averages: {},
      }
      const { result } = renderHook(() => useAgentAlphaRunner())

      act(() => {
        result.current.openConfigureModal()
      })

      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('discardResults', () => {
    test('should dispatch AGENT_ALPHA_DISCARD_RESULTS', () => {
      const { result } = renderHook(() => useAgentAlphaRunner())

      act(() => {
        result.current.discardResults()
      })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'AGENT_ALPHA_DISCARD_RESULTS' })
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Prompts Discarded',
        description: 'Agent-Alpha changes have been discarded.',
      })
    })
  })

  describe('resetState', () => {
    test('should dispatch AGENT_ALPHA_RESET', () => {
      const { result } = renderHook(() => useAgentAlphaRunner())

      act(() => {
        result.current.resetState()
      })

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'AGENT_ALPHA_RESET' })
    })
  })

  describe('applyResults', () => {
    test('should not apply when no pending results', async () => {
      mockState.agentAlphaPendingResults = null
      const { result } = renderHook(() => useAgentAlphaRunner())

      await act(async () => {
        await result.current.applyResults()
      })

      expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'AGENT_ALPHA_APPLY_RESULTS' })
    })

    test('should not apply when no accuracy data', async () => {
      mockState.agentAlphaPendingResults = {
        results: [],
        sampledDocIds: [],
        sampledDocNames: {},
      }
      mockState.data = null
      const { result } = renderHook(() => useAgentAlphaRunner())

      await act(async () => {
        await result.current.applyResults()
      })

      expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'AGENT_ALPHA_APPLY_RESULTS' })
    })
  })

  describe('runAgentAlphaWithConfig', () => {
    test('should show toast when no accuracy data', async () => {
      mockState.data = null
      const { result } = renderHook(() => useAgentAlphaRunner())

      await act(async () => {
        await result.current.runAgentAlphaWithConfig({
          maxDocs: 8,
          maxIterations: 5,
          testModel: 'google__gemini_2_5_flash',
          fieldConcurrency: 5,
        })
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'No accuracy data',
        description: 'Load comparison results before running Agent-Alpha.',
        variant: 'destructive',
      })
    })
  })

  describe('Partial field failures', () => {
    const buildFieldPlan = (key: string, name: string) => ({
      fieldKey: key,
      field: { key, name, type: 'string', prompt: `Prompt for ${name}`, options: undefined },
      initialAccuracy: 0.5,
      groundTruth: {},
    })

    const runWithFields = async (fieldPlans: unknown[]) => {
      mockState.data = {
        templateKey: 'test-template',
        baseModel: 'google__gemini_2_5_flash',
        fields: [],
        results: [],
        averages: {},
      } as unknown as AccuracyData

      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare')
      vi.mocked(prepareAgentAlphaWorkPlan).mockResolvedValue({
        fields: fieldPlans,
        sampledDocIds: ['doc1'],
        trainDocIds: ['doc1'],
        holdoutDocIds: [],
        templateKey: 'test-template',
      } as never)

      const { result } = renderHook(() => useAgentAlphaRunner())
      await act(async () => {
        await result.current.runAgentAlphaWithConfig({
          maxDocs: 8,
          maxIterations: 5,
          testModel: 'google__gemini_2_5_flash',
          fieldConcurrency: 5,
        })
      })
    }

    const succeedExcept = async (failingFieldName: string | null) => {
      const { processAgentAlphaField } = await import('@/ai/flows/agent-alpha-process-field')
      vi.mocked(processAgentAlphaField).mockImplementation((async (args: { fieldKey: string; fieldName: string }) => {
        if (args.fieldName === failingFieldName) {
          throw new Error('Box API returned 429')
        }
        return {
          fieldKey: args.fieldKey,
          fieldName: args.fieldName,
          initialAccuracy: 0.5,
          finalAccuracy: 0.9,
          finalPrompt: 'improved prompt',
          iterationCount: 1,
          improved: true,
          converged: false,
          sampledDocIds: ['doc1'],
          hasGroundTruth: true,
        }
      }) as never)
    }

    const findToast = (predicate: (arg: { title: string }) => boolean) =>
      mockToast.mock.calls.map(call => call[0]).find(predicate)

    test('surfaces the failed field in the toast rather than reporting plain success', async () => {
      await succeedExcept('Broken Field')
      await runWithFields([
        buildFieldPlan('good', 'Good Field'),
        buildFieldPlan('broken', 'Broken Field'),
      ])

      const failureToast = findToast(arg => arg.title.includes('Failed Field'))

      expect(failureToast).toBeDefined()
      expect(failureToast).toMatchObject({
        title: 'Agent-Alpha Finished With 1 Failed Field(s)',
        variant: 'destructive',
      })
      expect(failureToast!.description).toContain('Broken Field')
      expect(failureToast!.description).toContain('1 of 2')

      // The old behaviour was a plain success toast; make sure it is gone.
      expect(findToast(arg => arg.title === 'Agent-Alpha Complete')).toBeUndefined()
    })

    test('includes failed fields and their error in the completion payload', async () => {
      await succeedExcept('Broken Field')
      await runWithFields([
        buildFieldPlan('good', 'Good Field'),
        buildFieldPlan('broken', 'Broken Field'),
      ])

      const completeDispatch = mockDispatch.mock.calls
        .map(call => call[0])
        .find(action => action.type === 'AGENT_ALPHA_COMPLETE')

      expect(completeDispatch).toBeDefined()
      expect(completeDispatch.payload.results).toHaveLength(1)
      expect(completeDispatch.payload.failedFields).toEqual([
        { fieldKey: 'broken', fieldName: 'Broken Field', error: 'Box API returned 429' },
      ])
    })

    test('still reports clean success when every field succeeds', async () => {
      await succeedExcept(null)
      await runWithFields([
        buildFieldPlan('good', 'Good Field'),
        buildFieldPlan('also-good', 'Also Good Field'),
      ])

      expect(findToast(arg => arg.title === 'Agent-Alpha Complete')).toMatchObject({
        variant: 'default',
      })
      expect(findToast(arg => arg.title.includes('Failed Field'))).toBeUndefined()

      const completeDispatch = mockDispatch.mock.calls
        .map(call => call[0])
        .find(action => action.type === 'AGENT_ALPHA_COMPLETE')

      expect(completeDispatch.payload.results).toHaveLength(2)
      expect(completeDispatch.payload.failedFields).toEqual([])
    })
  })

  describe('State Exposure', () => {
    test('should expose agentAlphaState from store', () => {
      mockState.agentAlpha = {
        status: 'running',
        fieldsProcessed: 3,
        totalFields: 5,
        processingFields: [],
        processedFields: [],
        runtimeConfig: undefined,
        errorMessage: undefined,
        actualDocCount: undefined,
      }

      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.agentAlphaState.status).toBe('running')
      expect(result.current.agentAlphaState.fieldsProcessed).toBe(3)
      expect(result.current.agentAlphaState.totalFields).toBe(5)
    })

    test('should expose pendingResults from store', () => {
      mockState.agentAlphaPendingResults = {
        results: [
          {
            fieldKey: 'field1',
            fieldName: 'Test Field',
            initialAccuracy: 0.5,
            finalAccuracy: 1.0,
            finalPrompt: 'New prompt',
            iterationCount: 2,
            improved: true,
            converged: true,
            sampledDocIds: ['doc1'],
            hasGroundTruth: true,
          },
        ],
        sampledDocIds: ['doc1'],
        sampledDocNames: { doc1: 'Document 1' },
      }

      const { result } = renderHook(() => useAgentAlphaRunner())

      expect(result.current.pendingResults).not.toBeNull()
      expect(result.current.pendingResults?.results).toHaveLength(1)
      expect(result.current.pendingResults?.results[0].fieldKey).toBe('field1')
    })
  })
})
