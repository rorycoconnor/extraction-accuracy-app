import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PromptStudioSheet from '@/components/prompt-studio/prompt-studio-sheet'
import type { AccuracyField, AccuracyData, FileResult } from '@/lib/types'

// Mock the utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  formatModelName: (name: string) => name.replace(/[_-]/g, ' '),
  findFieldValue: vi.fn((data: any, key: string) => data?.[key])
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock system prompt storage
vi.mock('@/lib/system-prompt-storage', () => ({
  getActiveSystemPrompt: vi.fn(() => ({
    id: 'default',
    name: 'Default',
    isDefault: true,
    generateInstructions: 'Default instructions',
    improvePrompt: 'Default improve prompt'
  }))
}))

// Mock AI flows
vi.mock('@/ai/flows/generate-initial-prompt', () => ({
  generateInitialPrompt: vi.fn().mockResolvedValue({
    prompt: 'Generated prompt text',
    generationMethod: 'standard'
  }),
  improvePrompt: vi.fn().mockResolvedValue({
    prompt: 'Improved prompt text',
    generationMethod: 'standard'
  })
}))

// Mock batch extraction
vi.mock('@/ai/flows/batch-metadata-extraction', () => ({
  extractMetadataBatch: vi.fn().mockResolvedValue([])
}))

// Mock metrics
vi.mock('@/lib/metrics', () => ({
  compareValues: vi.fn(() => ({
    isMatch: true,
    matchType: 'exact',
    matchClassification: 'exact',
    confidence: 'high'
  }))
}))

// Mock the prompt picker dialog
vi.mock('@/features/prompt-library/components/prompt-picker-dialog', () => ({
  PromptPickerDialog: ({ onSelectPrompt }: { onSelectPrompt: (text: string) => void }) => (
    <button onClick={() => onSelectPrompt('Library prompt')}>Library</button>
  )
}))

describe('PromptStudioSheet Component Tests', () => {
  const createField = (overrides?: Partial<AccuracyField>): AccuracyField => ({
    name: 'Contract Date',
    key: 'contract_date',
    type: 'date',
    prompt: 'Extract the contract date',
    promptHistory: [],
    ...overrides
  })

  const createAccuracyData = (overrides?: Partial<AccuracyData>): AccuracyData => ({
    templateKey: 'test-template',
    baseModel: 'gpt-4',
    fields: [createField()],
    results: [
      {
        id: 'file1',
        fileName: 'test-contract.pdf',
        fileType: 'pdf',
        fields: {
          contract_date: {
            'GPT-4': '2025-01-15',
            'Ground Truth': '2025-01-15'
          }
        }
      }
    ],
    averages: {},
    ...overrides
  })

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    field: createField(),
    templateName: 'Test Template',
    onUpdatePrompt: vi.fn(),
    onUsePromptVersion: vi.fn(),
    onToggleFavorite: vi.fn(),
    onDeletePromptVersion: vi.fn(),
    selectedFileIds: ['file1'],
    accuracyData: createAccuracyData(),
    shownColumns: { 'GPT-4': true, 'Ground Truth': true }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    test('should render when isOpen is true and field is provided', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText(/Prompt Studio - Contract Date/)).toBeInTheDocument()
    })

    test('should not render when isOpen is false', () => {
      const { container } = render(
        <PromptStudioSheet {...defaultProps} isOpen={false} />
      )
      
      // Sheet should be closed
      expect(container.querySelector('[data-state="open"]')).not.toBeInTheDocument()
    })

    test('should return null when no field is provided', () => {
      const { container } = render(
        <PromptStudioSheet {...defaultProps} field={undefined as any} />
      )
      
      expect(container.firstChild).toBeNull()
    })

    test('should show field name in title', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText(/Contract Date/)).toBeInTheDocument()
    })
  })

  describe('Active Prompt Card', () => {
    test('should display the current prompt text', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText('Active Prompt')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Extract the contract date')).toBeInTheDocument()
    })

    test('should allow editing prompt text', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      const textarea = screen.getByDisplayValue('Extract the contract date')
      fireEvent.change(textarea, { target: { value: 'New prompt text' } })
      
      expect(screen.getByDisplayValue('New prompt text')).toBeInTheDocument()
    })

    test('should show Save button when prompt is modified', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      const textarea = screen.getByDisplayValue('Extract the contract date')
      fireEvent.change(textarea, { target: { value: 'Modified prompt' } })
      
      const saveButton = screen.getByText('Save as New Version')
      expect(saveButton).not.toBeDisabled()
    })

    test('should call onUpdatePrompt when save is clicked', () => {
      const onUpdatePrompt = vi.fn()
      render(<PromptStudioSheet {...defaultProps} onUpdatePrompt={onUpdatePrompt} />)
      
      const textarea = screen.getByDisplayValue('Extract the contract date')
      fireEvent.change(textarea, { target: { value: 'Modified prompt' } })
      
      const saveButton = screen.getByText('Save as New Version')
      fireEvent.click(saveButton)
      
      expect(onUpdatePrompt).toHaveBeenCalledWith('contract_date', 'Modified prompt', undefined)
    })
  })

  describe('Prompt Generation', () => {
    test('should show Generate Prompt button when prompt is empty', () => {
      const field = createField({ prompt: '' })
      render(<PromptStudioSheet {...defaultProps} field={field} />)
      
      expect(screen.getByText('Generate Prompt')).toBeInTheDocument()
    })

    test('should show improvement instructions field when prompt exists', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText('What do you need this prompt to do better?')).toBeInTheDocument()
    })

    test('should show Improve Prompt button when instructions are entered', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      const instructionsInput = screen.getByPlaceholderText('Describe what you want to improve about this prompt...')
      fireEvent.change(instructionsInput, { target: { value: 'Make it more specific' } })
      
      expect(screen.getByText('Improve Prompt')).toBeInTheDocument()
    })
  })

  describe('Version History', () => {
    test('should display version history when available', () => {
      const field = createField({
        promptHistory: [
          {
            id: 'v1',
            prompt: 'Version 1 prompt',
            savedAt: '2025-01-15T10:00:00Z',
            isFavorite: false
          }
        ]
      })
      
      render(<PromptStudioSheet {...defaultProps} field={field} />)
      
      expect(screen.getByText('Prompt Versions')).toBeInTheDocument()
    })

    test('should show empty state when no history exists', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText('No version history available yet.')).toBeInTheDocument()
    })
  })

  describe('Test Functionality', () => {
    test('should show Test button when prompt text exists', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    test('should not show Test button when prompt is empty', () => {
      const field = createField({ prompt: '' })
      render(<PromptStudioSheet {...defaultProps} field={field} />)
      
      expect(screen.queryByText('Test')).not.toBeInTheDocument()
    })
  })

  describe('System Prompt Panel', () => {
    test('should show system prompt button', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText(/System Prompt:/)).toBeInTheDocument()
    })

    test('should show active system prompt name', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText('Default')).toBeInTheDocument()
    })
  })

  describe('Library Integration', () => {
    test('should show Library button', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByText('Library')).toBeInTheDocument()
    })

    test('should update prompt when selecting from library', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      const libraryButton = screen.getByText('Library')
      fireEvent.click(libraryButton)
      
      // After clicking library, the prompt should be updated
      expect(screen.getByDisplayValue('Library prompt')).toBeInTheDocument()
    })
  })

  describe('No Files Warning', () => {
    test('should show warning when no files are selected', () => {
      render(<PromptStudioSheet {...defaultProps} selectedFileIds={[]} />)
      
      expect(screen.getByText(/No context files/)).toBeInTheDocument()
    })

    test('should not show warning when files are selected', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.queryByText(/No context files/)).not.toBeInTheDocument()
    })
  })

  describe('Copy to Clipboard', () => {
    test('should have copy button on active prompt', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      // The copy button is an icon button with Copy icon
      const copyButtons = screen.getAllByRole('button')
      const copyButton = copyButtons.find(btn => 
        btn.querySelector('svg.lucide-copy') !== null
      )
      
      expect(copyButton).toBeDefined()
    })
  })

  describe('Delete Confirmation Dialog', () => {
    test('should show delete confirmation when delete is initiated', async () => {
      const field = createField({
        promptHistory: [
          {
            id: 'v1',
            prompt: 'Version 1 prompt',
            savedAt: '2025-01-15T10:00:00Z',
            isFavorite: false
          }
        ]
      })
      
      render(<PromptStudioSheet {...defaultProps} field={field} />)
      
      // Look for delete button in version history
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find(btn => 
        btn.querySelector('svg.lucide-trash-2') !== null
      )
      
      if (deleteButton) {
        fireEvent.click(deleteButton)
        
        await waitFor(() => {
          expect(screen.getByText('Delete Version')).toBeInTheDocument()
        })
      }
    })
  })

  describe('Accessibility', () => {
    test('should have proper labels for inputs', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      expect(screen.getByLabelText('What do you need this prompt to do better?')).toBeInTheDocument()
    })

    test('should have focusable buttons', () => {
      render(<PromptStudioSheet {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('disabled')
      })
    })
  })
})
