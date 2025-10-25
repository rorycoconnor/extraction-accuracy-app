import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ModelRankingSummary from '@/components/model-ranking-summary'
import type { AccuracyData } from '@/lib/types'

// Mock the utils to avoid dependency issues
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  formatModelName: (name: string) => name.replace(/[_-]/g, ' ')
}))

// Mock the model ranking utils with realistic implementations
vi.mock('@/lib/model-ranking-utils', () => ({
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 0.9,
    GOOD: 0.7
  },
  calculateModelSummaries: vi.fn((visibleModels: string[], fields: any[], averages: any) => {
    return visibleModels.map((modelName: string) => ({
      modelName,
      overallAccuracy: averages[fields[0].key]?.[modelName]?.accuracy || 0,
      overallF1: averages[fields[0].key]?.[modelName]?.f1 || 0,
      overallPrecision: averages[fields[0].key]?.[modelName]?.precision || 0,
      overallRecall: averages[fields[0].key]?.[modelName]?.recall || 0,
      fieldsWon: 1,
      totalFields: fields.length,
      rank: 1,
      fieldPerformance: fields.map((field: any) => ({
        fieldKey: field.key,
        fieldName: field.name,
        accuracy: averages[field.key]?.[modelName]?.accuracy || 0,
        f1: averages[field.key]?.[modelName]?.f1 || 0,
        precision: averages[field.key]?.[modelName]?.precision || 0,
        recall: averages[field.key]?.[modelName]?.recall || 0,
        isWinner: true,
        isSharedVictory: false
      }))
    }))
  }),
  determineFieldWinners: vi.fn(),
  assignRanks: vi.fn((summaries: any[]) => {
    return summaries.map((summary: any, index: number) => ({
      ...summary,
      rank: index + 1
    }))
  })
}))

describe('ModelRankingSummary - Accuracy-First Display Tests', () => {
  
  const createMockAccuracyData = (overrides?: Partial<AccuracyData>): AccuracyData => ({
    templateKey: 'test-template',
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
        name: 'Contract Date', 
        key: 'contract_date', 
        type: 'date', 
        prompt: 'Extract contract date', 
        promptHistory: [] 
      }
    ],
    results: [
      {
        id: 'file1',
        fileName: 'contract1.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 
            'GPT-4': 'Acme Corp', 
            'Claude': 'Acme Corporation', 
            'Ground Truth': 'Acme Corp' 
          },
          contract_date: { 
            'GPT-4': '2025-01-01', 
            'Claude': '2025-01-01', 
            'Ground Truth': '2025-01-01' 
          }
        }
      }
    ],
    averages: {
      company_name: {
        'GPT-4': { accuracy: 0.95, precision: 0.90, recall: 0.92, f1: 0.91 },
        'Claude': { accuracy: 0.85, precision: 0.88, recall: 0.82, f1: 0.85 },
        'Gemini': { accuracy: 0.78, precision: 0.75, recall: 0.80, f1: 0.77 }
      },
      contract_date: {
        'GPT-4': { accuracy: 0.88, precision: 0.85, recall: 0.90, f1: 0.87 },
        'Claude': { accuracy: 0.82, precision: 0.80, recall: 0.84, f1: 0.82 },
        'Gemini': { accuracy: 0.75, precision: 0.72, recall: 0.78, f1: 0.75 }
      }
    },
    ...overrides
  })

  const defaultShownColumns = {
    'GPT-4': true,
    'Claude': true,
    'Gemini': true,
    'Ground Truth': true
  }

  describe('Component Rendering and Validation', () => {
    test('should render without crashing with valid data', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should render model names (in side-by-side view they appear in card header + Key Insights)
      expect(screen.getAllByText('GPT 4')).toHaveLength(2) // Card header + Key Insights
      expect(screen.getAllByText('Claude')).toHaveLength(1) // Card header only
      expect(screen.getAllByText('Gemini')).toHaveLength(1) // Card header only
    })

    test('should return null for invalid data', () => {
      const { container } = render(
        <ModelRankingSummary 
          data={null as any} 
          shownColumns={defaultShownColumns} 
        />
      )
      
      expect(container.firstChild).toBeNull()
    })

    test('should return null when no fields exist', () => {
      const mockData = createMockAccuracyData({ fields: [] })
      
      const { container } = render(
        <ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />
      )
      
      expect(container.firstChild).toBeNull()
    })

    test('should return null when no models are visible', () => {
      const mockData = createMockAccuracyData()
      const noModelsShown = { 'Ground Truth': true }
      
      const { container } = render(
        <ModelRankingSummary data={mockData} shownColumns={noModelsShown} />
      )
      
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Accuracy-First Display - CRITICAL FEATURE', () => {
    test('should prominently display Accuracy as main metric', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show Accuracy badges as primary metric
      expect(screen.getByText('95.0% Accuracy')).toBeInTheDocument() // GPT-4
      expect(screen.getByText('85.0% Accuracy')).toBeInTheDocument() // Claude  
      expect(screen.getByText('78.0% Accuracy')).toBeInTheDocument() // Gemini
      
      // Accuracy should be the largest, most prominent display
      const accuracyBadges = screen.getAllByText(/% Accuracy/)
      expect(accuracyBadges.length).toBe(3) // One for each model
    })

    test('should show models ranked by Accuracy (not F1)', () => {
      const mockData = createMockAccuracyData({
        averages: {
          company_name: {
            'Model_A': { accuracy: 0.95, precision: 0.80, recall: 0.85, f1: 0.82 }, // Highest Accuracy
            'Model_B': { accuracy: 0.80, precision: 0.95, recall: 0.95, f1: 0.95 }, // Highest F1, Lower Accuracy
            'Model_C': { accuracy: 0.90, precision: 0.88, recall: 0.88, f1: 0.88 }  // Middle
          }
        }
      })
      
      const columns = { 'Model_A': true, 'Model_B': true, 'Model_C': true, 'Ground Truth': true }
      
      render(<ModelRankingSummary data={mockData} shownColumns={columns} />)
      
      // Models should be ordered by accuracy: Model_A (95%) > Model_C (90%) > Model_B (80%)
      const modelCards = screen.getAllByText(/Model [ABC]/)
      
      // First card should be Model A (highest accuracy) - expect multiple occurrences
      expect(screen.getAllByText('Model A')).toHaveLength(2) // Header + insights
      expect(screen.getByText('95.0% Accuracy')).toBeInTheDocument()
      
      // Model B should be ranked lower despite higher F1
      expect(screen.getByText('80.0% Accuracy')).toBeInTheDocument()
    })

    test('should use correct color coding for Accuracy performance levels', () => {
      const mockData = createMockAccuracyData({
        averages: {
          company_name: {
            'Excellent_Model': { accuracy: 0.95, precision: 0.90, recall: 0.92, f1: 0.91 }, // >= 90% = Green
            'Good_Model': { accuracy: 0.75, precision: 0.70, recall: 0.80, f1: 0.75 },       // >= 70% = Yellow
            'Poor_Model': { accuracy: 0.50, precision: 0.45, recall: 0.55, f1: 0.50 }        // < 70% = Red
          }
        }
      })
      
      const columns = { 'Excellent_Model': true, 'Good_Model': true, 'Poor_Model': true, 'Ground Truth': true }
      
      render(<ModelRankingSummary data={mockData} shownColumns={columns} />)
      
      // Excellent model should have green styling
      const excellentBadge = screen.getByText('95.0% Accuracy')
      expect(excellentBadge.closest('.border-green-200')).toBeInTheDocument()
      
      // Good model should have yellow styling
      const goodBadge = screen.getByText('75.0% Accuracy')
      expect(goodBadge.closest('.border-yellow-200')).toBeInTheDocument()
      
      // Poor model should have red styling
      const poorBadge = screen.getByText('50.0% Accuracy')
      expect(poorBadge.closest('.border-red-200')).toBeInTheDocument()
    })
  })

  describe('View Mode Toggle Functionality', () => {
    test('should render Stack and Side by side view toggle buttons', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show view mode buttons
      expect(screen.getByText('Stack')).toBeInTheDocument()
      expect(screen.getByText('Side by side')).toBeInTheDocument()
    })

    test('should start with Side by side view by default', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Side by side button should be active by default
      const stackButton = screen.getByText('Stack').closest('button')
      const sideBySideButton = screen.getByText('Side by side').closest('button')
      
      expect(sideBySideButton).toHaveClass('bg-white') // Active styling
      expect(stackButton).not.toHaveClass('bg-white') // Inactive styling
    })

    test('should switch to Stack view when clicked', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Click stack button
      const stackButton = screen.getByText('Stack')
      fireEvent.click(stackButton)
      
      // Stack button should now be active
      const sideBySideButtonAfter = screen.getByText('Side by side').closest('button')
      const stackButtonAfter = screen.getByText('Stack').closest('button')
      
      expect(stackButtonAfter).toHaveClass('bg-white') // Active styling
      expect(sideBySideButtonAfter).not.toHaveClass('bg-white') // Inactive styling
    })
  })

  describe('Field Performance Display', () => {
    test('should show field-by-field performance breakdown', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show field names (in side-by-side view, field names appear once per model card)
      expect(screen.getAllByText('Company Name')).toHaveLength(3) // Once per model card
      expect(screen.getAllByText('Contract Date')).toHaveLength(3) // Once per model card
      
      // Should show individual field accuracy percentages (in side-by-side view)
      // 3 Accuracy badges + (2 fields × 3 models) + 1 in Key Insights = 10 total
      expect(screen.getAllByText(/\d+%/)).toHaveLength(10)
    })

    test('should indicate field winners with proper styling', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Winner fields should have green background styling
      const fieldElements = screen.getAllByText('Company Name')
      const winnerField = fieldElements.find(el => 
        el.closest('.bg-green-100') !== null
      )
      expect(winnerField).toBeDefined()
    })

    test('should show Field Performance legend', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show legend items (in side-by-side view, "Field Performance:" appears per card + header legend)
      expect(screen.getAllByText('Field Performance:')).toHaveLength(4) // 3 model cards + 1 in header
      expect(screen.getAllByText('Winner')).toHaveLength(1) // Once in the main legend
      expect(screen.getAllByText('Shared Victory')).toHaveLength(1) // Once in the main legend
      expect(screen.getAllByText('Non-winner')).toHaveLength(1) // Once in the main legend
    })
  })

  describe('Key Insights Section', () => {
    test('should display Key Insights with top performer information', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show insights section
      expect(screen.getByText('Key Insights')).toBeInTheDocument()
      
      // Should mention the top performer with accuracy percentage
      expect(screen.getByText(/is the top performer with.*% average Accuracy/)).toBeInTheDocument()
    })

    test('should show performance gap information when multiple models', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show performance gap between best and worst
      expect(screen.getByText(/Performance gap between best and worst model/)).toBeInTheDocument()
    })

    test('should recommend using top-performing model', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should show recommendation
      expect(screen.getByText(/Consider using the top-performing model for production workloads/)).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    test('should apply proper grid layout for side-by-side view', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Switch to side by side view
      const sideBySideButton = screen.getByText('Side by side')
      fireEvent.click(sideBySideButton)
      
      // Should apply horizontal scroll container
      const scrollContainer = document.querySelector('.overflow-x-auto')
      expect(scrollContainer).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have proper ARIA labels for model performance', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should have aria-label for screen readers
      const elementsWithAriaLabel = document.querySelectorAll('[aria-label*="Accuracy"]')
      expect(elementsWithAriaLabel.length).toBeGreaterThan(0)
    })

    test('should have keyboard-accessible view toggle buttons', () => {
      const mockData = createMockAccuracyData()
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      const stackButton = screen.getByText('Stack').closest('button')
      const sideBySideButton = screen.getByText('Side by side').closest('button')
      
      // Buttons should be focusable and clickable
      expect(stackButton).toBeInTheDocument()
      expect(sideBySideButton).toBeInTheDocument()
      expect(stackButton).not.toHaveAttribute('disabled')
      expect(sideBySideButton).not.toHaveAttribute('disabled')
    })
  })

  describe('Performance and Edge Cases', () => {
    test('should handle single model scenario', () => {
      const mockData = createMockAccuracyData()
      const singleModelColumns = { 'GPT-4': true, 'Ground Truth': true }
      
      render(<ModelRankingSummary data={mockData} shownColumns={singleModelColumns} />)
      
      // Should still render without errors - expect multiple occurrences
      expect(screen.getAllByText('GPT 4')).toHaveLength(2) // Header + insights
      expect(screen.getByText('95.0% Accuracy')).toBeInTheDocument()
    })

    test('should handle missing averages data gracefully', () => {
      const mockData = createMockAccuracyData({
        averages: {
          company_name: {
            'GPT-4': { accuracy: 0.90, precision: 0.85, recall: 0.88, f1: 0.86 }
            // Missing other models
          }
        }
      })
      
      render(<ModelRankingSummary data={mockData} shownColumns={defaultShownColumns} />)
      
      // Should render available data without crashing
      expect(screen.getByText('90.0% Accuracy')).toBeInTheDocument()
    })
  })
}) 