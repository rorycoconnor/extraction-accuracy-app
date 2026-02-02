import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AgentAlphaModal } from '@/components/agent-alpha/agent-alpha-modal'
import type { AgentAlphaState } from '@/lib/agent-alpha-types'
import type { AgentAlphaPendingResults } from '@/lib/agent-alpha-types'

// Mock the utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  formatModelName: (name: string) => name.replace(/[_-]/g, ' ')
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock system prompt storage
vi.mock('@/lib/system-prompt-storage', () => ({
  getAllAgentSystemPromptVersions: vi.fn(() => [
    {
      id: 'default',
      name: 'Default',
      isDefault: true,
      generateInstructions: 'Default instructions',
      improvePrompt: 'Default improve prompt'
    }
  ]),
  getActiveAgentSystemPrompt: vi.fn(() => ({
    id: 'default',
    name: 'Default',
    isDefault: true,
    generateInstructions: 'Default instructions',
    improvePrompt: 'Default improve prompt'
  })),
  setActiveAgentSystemPrompt: vi.fn(),
  createAgentSystemPromptVersion: vi.fn(),
  deleteAgentSystemPromptVersion: vi.fn(),
  updateAgentSystemPromptVersion: vi.fn()
}))

// Mock the agent-alpha-config
vi.mock('@/lib/agent-alpha-config', () => ({
  AGENT_ALPHA_CONFIG: {
    MAX_DOCS: 8,
    MAX_ITERATIONS: 5,
    TARGET_ACCURACY: 1.0,
    DEFAULT_TEST_MODEL: 'google__gemini_2_5_flash',
    FIELD_CONCURRENCY: 5,
    PROMPT_GEN_MODEL: 'aws__claude_4_5_opus'
  },
  getDefaultRuntimeConfig: () => ({
    maxDocs: 8,
    maxIterations: 5,
    testModel: 'google__gemini_2_5_flash',
    fieldConcurrency: 5
  }),
  DEFAULT_PROMPT_GENERATION_INSTRUCTIONS: 'Default instructions'
}))

describe('AgentAlphaModal Component Tests', () => {
  const defaultProps = {
    isOpen: true,
    onApply: vi.fn(),
    onCancel: vi.fn(),
    onStartWithConfig: vi.fn(),
    availableModels: ['google__gemini_2_5_flash', 'openai__gpt_4o'],
    defaultModel: 'google__gemini_2_5_flash'
  }

  const createAgentAlphaState = (overrides?: Partial<AgentAlphaState>): AgentAlphaState => ({
    status: 'configure',
    fieldsProcessed: 0,
    totalFields: 0,
    processingFields: [],
    processedFields: [],
    runtimeConfig: undefined,
    errorMessage: undefined,
    actualDocCount: undefined,
    ...overrides
  })

  const createPendingResults = (overrides?: Partial<AgentAlphaPendingResults>): AgentAlphaPendingResults => ({
    results: [
      {
        fieldKey: 'field1',
        fieldName: 'Test Field',
        initialAccuracy: 0.5,
        finalAccuracy: 1.0,
        finalPrompt: 'Optimized prompt',
        iterationCount: 2,
        improved: true,
        converged: true,
        sampledDocIds: ['doc1', 'doc2'],
        hasGroundTruth: true
      }
    ],
    sampledDocIds: ['doc1', 'doc2'],
    sampledDocNames: { 'doc1': 'Document 1', 'doc2': 'Document 2' },
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal State Rendering', () => {
    test('should render configure view when status is configure', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      // Should show configuration elements
      expect(screen.getByText('Configure & Start Agent')).toBeInTheDocument()
      expect(screen.getByText('Model to Test With')).toBeInTheDocument()
    })

    test('should render running view when status is running', () => {
      const state = createAgentAlphaState({ 
        status: 'running',
        totalFields: 5,
        fieldsProcessed: 2,
        processingFields: [{
          fieldKey: 'field1',
          fieldName: 'Processing Field',
          initialAccuracy: 0.5,
          startTime: Date.now()
        }]
      })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      // Should show progress elements
      expect(screen.getByText('Agent Prompt Optimization')).toBeInTheDocument()
      expect(screen.getByText(/Optimizing Prompts/)).toBeInTheDocument()
    })

    test('should render preview view when status is preview', () => {
      const state = createAgentAlphaState({ status: 'preview' })
      const results = createPendingResults()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={results}
        />
      )
      
      // Should show results preview
      expect(screen.getByText('Agent Prompt Optimization Results')).toBeInTheDocument()
    })

    test('should render error view when status is error', () => {
      const state = createAgentAlphaState({ 
        status: 'error',
        errorMessage: 'Something went wrong'
      })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      // Should show error message
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    test('should not render when isOpen is false', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      const { container } = render(
        <AgentAlphaModal 
          {...defaultProps}
          isOpen={false}
          agentAlphaState={state}
          results={null}
        />
      )
      
      // Modal should not be visible
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
    })
  })

  describe('Configure View Interactions', () => {
    test('should show available models in dropdown', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      // Check for model selection label
      expect(screen.getByText('Model to Test With')).toBeInTheDocument()
    })

    test('should show configuration inputs', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      // Should show document count input
      expect(screen.getByText('Test Documents')).toBeInTheDocument()
      // Should show max attempts input
      expect(screen.getByText('Max Attempts')).toBeInTheDocument()
      // Should show concurrent fields input
      expect(screen.getByText('Concurrent Fields')).toBeInTheDocument()
    })

    test('should show estimated time', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      expect(screen.getByText('Estimated time per field:')).toBeInTheDocument()
    })

    test('should call onStartWithConfig when start button is clicked', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      const onStartWithConfig = vi.fn()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
          onStartWithConfig={onStartWithConfig}
        />
      )
      
      const startButton = screen.getByText('Start Agent')
      fireEvent.click(startButton)
      
      expect(onStartWithConfig).toHaveBeenCalled()
    })
  })

  describe('Preview View Actions', () => {
    test('should call onApply when Apply button is clicked', () => {
      const state = createAgentAlphaState({ status: 'preview' })
      const results = createPendingResults()
      const onApply = vi.fn()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={results}
          onApply={onApply}
        />
      )
      
      const applyButton = screen.getByText('Apply All Prompts')
      fireEvent.click(applyButton)
      
      expect(onApply).toHaveBeenCalled()
    })

    test('should show confirmation dialog when Cancel button is clicked with results', () => {
      const state = createAgentAlphaState({ status: 'preview' })
      const results = createPendingResults()
      const onCancel = vi.fn()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={results}
          onCancel={onCancel}
        />
      )
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      // Should show confirmation dialog, not immediately call onCancel
      expect(screen.getByText('Unsaved Optimized Prompts')).toBeInTheDocument()
      expect(onCancel).not.toHaveBeenCalled()
    })

    test('should call onCancel when Discard Changes is clicked in confirmation dialog', () => {
      const state = createAgentAlphaState({ status: 'preview' })
      const results = createPendingResults()
      const onCancel = vi.fn()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={results}
          onCancel={onCancel}
        />
      )
      
      // First click Cancel to open the confirmation dialog
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      // Then click Discard Changes
      const discardButton = screen.getByText('Discard Changes')
      fireEvent.click(discardButton)
      
      expect(onCancel).toHaveBeenCalled()
    })

    test('should call onApply when Apply All Prompts is clicked in confirmation dialog', () => {
      const state = createAgentAlphaState({ status: 'preview' })
      const results = createPendingResults()
      const onApply = vi.fn()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={results}
          onApply={onApply}
        />
      )
      
      // First click Cancel to open the confirmation dialog
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      // Then click Apply All Prompts in the dialog
      const applyButtons = screen.getAllByText('Apply All Prompts')
      // The second one is in the confirmation dialog
      fireEvent.click(applyButtons[1])
      
      expect(onApply).toHaveBeenCalled()
    })
  })

  describe('Error View Actions', () => {
    test('should call onCancel when Close button is clicked in error view', () => {
      const state = createAgentAlphaState({ 
        status: 'error',
        errorMessage: 'Test error'
      })
      const onCancel = vi.fn()
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
          onCancel={onCancel}
        />
      )
      
      // Get all buttons with "Close" and find the visible one (not the sr-only X button)
      const closeButtons = screen.getAllByRole('button', { name: 'Close' })
      // Find the button that has actual visible "Close" text (not just sr-only)
      const closeButton = closeButtons.find(btn => btn.textContent === 'Close')
      expect(closeButton).toBeTruthy()
      fireEvent.click(closeButton!)
      
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('Running View Display', () => {
    test('should show progress percentage', () => {
      const state = createAgentAlphaState({ 
        status: 'running',
        totalFields: 10,
        fieldsProcessed: 3,
        processingFields: []
      })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      expect(screen.getByText('3 / 10 Fields Complete')).toBeInTheDocument()
    })

    test('should show processing fields', () => {
      const state = createAgentAlphaState({ 
        status: 'running',
        totalFields: 5,
        fieldsProcessed: 1,
        processingFields: [{
          fieldKey: 'field1',
          fieldName: 'Contract Date',
          initialAccuracy: 0.5,
          startTime: Date.now()
        }]
      })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      expect(screen.getByText('Contract Date')).toBeInTheDocument()
      expect(screen.getByText('Optimizing...')).toBeInTheDocument()
    })

    test('should show processed fields', () => {
      const state = createAgentAlphaState({ 
        status: 'running',
        totalFields: 5,
        fieldsProcessed: 2,
        processingFields: [],
        processedFields: [{
          fieldKey: 'field1',
          fieldName: 'Completed Field',
          initialAccuracy: 0.5,
          finalAccuracy: 1.0,
          finalPrompt: 'New prompt',
          iterationCount: 2,
          timeMs: 5000
        }]
      })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      expect(screen.getByText('Completed Field')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have proper dialog role', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    test('should have focusable buttons', () => {
      const state = createAgentAlphaState({ status: 'configure' })
      
      render(
        <AgentAlphaModal 
          {...defaultProps}
          agentAlphaState={state}
          results={null}
        />
      )
      
      const startButton = screen.getByText('Start Agent')
      expect(startButton).not.toHaveAttribute('disabled')
    })
  })
})
