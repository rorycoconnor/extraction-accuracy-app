import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ExtractionTable from '@/components/extraction-table'
import type { AccuracyData } from '@/lib/types'

// Mock usePathname hook
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/')
}))

// Mock the utils to avoid dependency issues
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  formatModelName: (name: string) => name,
  NOT_PRESENT_VALUE: 'Not Present'
}))

// Mock the model ranking utils
vi.mock('@/lib/model-ranking-utils', () => ({
  calculateModelSummaries: vi.fn(() => []),
  assignRanks: vi.fn(() => [])
}))

// Mock the metrics comparison
vi.mock('@/lib/metrics', () => ({
  compareValues: vi.fn(() => ({ isMatch: true, matchType: 'exact', confidence: 'high' }))
}))

// Mock the UI components to render simple divs with text content
vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  TableFooter: ({ children, ...props }: any) => <tfoot {...props}>{children}</tfoot>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}))

describe('ExtractionTable - Accuracy-First Display Tests', () => {
  
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
      },
      {
        id: 'file2',
        fileName: 'contract2.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 
            'GPT-4': 'Beta Inc', 
            'Claude': 'Beta Inc', 
            'Ground Truth': 'Beta Inc' 
          },
          contract_date: { 
            'GPT-4': '2025-02-01', 
            'Claude': '2025-02-15', 
            'Ground Truth': '2025-02-01' 
          }
        }
      }
    ],
    averages: {
      company_name: {
        'GPT-4': { accuracy: 0.9, precision: 0.85, recall: 0.88, f1: 0.86 },
        'Claude': { accuracy: 0.8, precision: 0.90, recall: 0.82, f1: 0.86 }
      },
      contract_date: {
        'GPT-4': { accuracy: 0.85, precision: 0.82, recall: 0.88, f1: 0.85 },
        'Claude': { accuracy: 0.75, precision: 0.72, recall: 0.78, f1: 0.75 }
      }
    },
    ...overrides
  })

  const defaultProps = {
    shownColumns: { 'GPT-4': true, 'Claude': true, 'Ground Truth': true },
    showMetrics: true,
    onOpenPromptStudio: vi.fn(),
    onOpenInlineEditor: vi.fn(),
    onRunSingleField: vi.fn(),
    onRunSingleFieldForFile: vi.fn(),
    recentlyChangedPrompts: new Set<string>(),
    isExtracting: false,
    extractingFields: new Set<string>()
  }

  describe('Basic Rendering', () => {
    test('should render table without crashing', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should render table structure
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    test('should display field names in header', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should show field names (use queryByText instead of getByText for debugging)
      const companyNameElement = screen.queryByText(/Company Name/)
      const contractDateElement = screen.queryByText(/Contract Date/)
      
      if (!companyNameElement || !contractDateElement) {
        // Debug: show what's actually rendered
        console.log('Rendered HTML:', document.body.innerHTML)
      }
      
      expect(companyNameElement).toBeInTheDocument()
      expect(contractDateElement).toBeInTheDocument()
    })

    test('should display model columns when shown', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should show model headers (use more flexible text matching)
      expect(screen.getByText(/GPT.?4/)).toBeInTheDocument()
      expect(screen.getByText(/Claude/)).toBeInTheDocument()
      expect(screen.getByText(/Ground Truth/)).toBeInTheDocument()
    })

    test('should display file data in rows', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should show file names
      expect(screen.getByText('contract1.pdf')).toBeInTheDocument()
      expect(screen.getByText('contract2.pdf')).toBeInTheDocument()
      
      // Should show extracted values
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    })
  })

  describe('Accuracy Metrics Display - CRITICAL FEATURE', () => {
    test('should show "Field Averages" row when showMetrics=true', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          showMetrics={true}
        />
      )
      
      // Should display the metrics row
      expect(screen.getByText('Field Averages')).toBeInTheDocument()
    })

    test('should display Accuracy badges (not F1) in metrics footer', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          showMetrics={true}
        />
      )
      
      // Should show Accuracy percentages (use flexible regex matching)
      expect(screen.getByText(/90\.0% Accuracy/)).toBeInTheDocument()
      expect(screen.getByText(/80\.0% Accuracy/)).toBeInTheDocument()
      
      // Should show contract_date accuracies (GPT-4: 85%, Claude: 75%)  
      expect(screen.getByText(/85\.0% Accuracy/)).toBeInTheDocument()
      expect(screen.getByText(/75\.0% Accuracy/)).toBeInTheDocument()
      
      // Should NOT show F1 scores in the footer
      expect(screen.queryByText(/F1/)).not.toBeInTheDocument()
    })

    test('should use correct color coding for Accuracy badges', () => {
      const mockData = createMockAccuracyData({
        averages: {
          company_name: {
            'GPT-4': { accuracy: 0.95, precision: 0.90, recall: 0.88, f1: 0.89 }, // High accuracy = green
            'Claude': { accuracy: 0.60, precision: 0.65, recall: 0.70, f1: 0.67 }  // Low accuracy = red
          }
        }
      })
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          showMetrics={true}
        />
      )
      
      const highAccuracyBadge = screen.getByText('95.0% Accuracy')
      const lowAccuracyBadge = screen.getByText('60.0% Accuracy')
      
      // High accuracy should have green styling
      expect(highAccuracyBadge.closest('.border-green-200')).toBeInTheDocument()
      
      // Low accuracy should have red styling  
      expect(lowAccuracyBadge.closest('.border-red-200')).toBeInTheDocument()
    })

    test('should hide metrics row when showMetrics=false', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          showMetrics={false}
        />
      )
      
      // Should not display the metrics row
      expect(screen.queryByText('Field Averages')).not.toBeInTheDocument()
      expect(screen.queryByText(/Accuracy/)).not.toBeInTheDocument()
    })
  })

  describe('Column Visibility Controls', () => {
    test('should hide columns when shownColumns=false', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          shownColumns={{ 'GPT-4': true, 'Claude': false, 'Ground Truth': true }}
        />
      )
      
      // Should show GPT-4 and Ground Truth
      expect(screen.getByText('GPT-4')).toBeInTheDocument()
      expect(screen.getByText('Ground Truth')).toBeInTheDocument()
      
      // Should hide Claude column
      expect(screen.queryByText('Claude')).not.toBeInTheDocument()
    })

    test('should hide Accuracy metrics for hidden columns', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          shownColumns={{ 'GPT-4': true, 'Claude': false, 'Ground Truth': true }}
          showMetrics={true}
        />
      )
      
      // Should show GPT-4 accuracy
      expect(screen.getByText('90.0% Accuracy')).toBeInTheDocument()
      
      // Should not show Claude accuracy (column hidden)
      expect(screen.queryByText('80.0% Accuracy')).not.toBeInTheDocument()
    })
  })

  describe('Interactive Features', () => {
    test('should call onOpenPromptStudio when prompt studio is triggered', () => {
      const mockData = createMockAccuracyData()
      const onOpenPromptStudio = vi.fn()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          onOpenPromptStudio={onOpenPromptStudio}
        />
      )
      
      // Find and click a prompt studio trigger (this depends on your implementation)
      // This test may need adjustment based on how prompt studio is triggered in your UI
    })

    test('should call onRunSingleField when single field extraction is triggered', () => {
      const mockData = createMockAccuracyData()
      const onRunSingleField = vi.fn()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          onRunSingleField={onRunSingleField}
        />
      )
      
      // This test depends on your UI implementation for single field runs
    })
  })

  describe('Loading and Error States', () => {
    test('should show pending state for extracting fields', () => {
      const mockData = createMockAccuracyData({
        results: [
          {
            id: 'file1',
            fileName: 'contract1.pdf',
            fileType: 'pdf',
            fields: {
              company_name: { 
                'GPT-4': 'Pending...', // Show pending state
                'Claude': 'Acme Corporation', 
                'Ground Truth': 'Acme Corp' 
              }
            }
          }
        ]
      })
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          isExtracting={true}
          extractingFields={new Set(['company_name'])}
        />
      )
      
      // Should show pending state
      expect(screen.getByText('Pending...')).toBeInTheDocument()
    })

    test('should handle empty data gracefully', () => {
      const mockData = createMockAccuracyData({
        fields: [],
        results: [],
        averages: {}
      })
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should still render table structure without errors
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    test('should apply homepage-specific styling when on root path', () => {
      const mockData = createMockAccuracyData()
      
      // Mock is already set to return '/' for usePathname
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should apply homepage-specific wrapper classes
      const wrapper = screen.getByRole('table').closest('.flex.flex-col.h-full.w-full')
      expect(wrapper).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have proper table structure for screen readers', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
        />
      )
      
      // Should have proper table structure
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader')).toHaveLength(7) // File Name + 2 fields × 3 models each
      expect(screen.getAllByRole('row')).toHaveLength(4) // Header + 2 data rows + metrics row
    })

    test('should have readable Accuracy badge text for screen readers', () => {
      const mockData = createMockAccuracyData()
      
      render(
        <ExtractionTable
          data={mockData}
          {...defaultProps}
          showMetrics={true}
        />
      )
      
      // Accuracy badges should be readable
      const accuracyBadges = screen.getAllByText(/Accuracy/)
      expect(accuracyBadges.length).toBeGreaterThan(0)
      
      // Each badge should contain the percentage and "Accuracy" text
      accuracyBadges.forEach(badge => {
        expect(badge.textContent).toMatch(/\d+\.\d+% Accuracy/)
      })
    })
  })
}) 