import { describe, test, expect } from 'vitest'
import { formatDateValue, getGenerationMethodBadge } from '@/components/prompt-studio/utils'

describe('Prompt Studio Utilities', () => {
  describe('formatDateValue', () => {
    test('should remove timestamp from ISO 8601 date with Z suffix', () => {
      const result = formatDateValue('2025-04-04T00:00:00Z')
      expect(result).toBe('2025-04-04')
    })

    test('should remove timestamp from ISO 8601 date without Z suffix', () => {
      const result = formatDateValue('2025-04-04T00:00:00')
      expect(result).toBe('2025-04-04')
    })

    test('should handle ISO dates with different times', () => {
      expect(formatDateValue('2026-03-26T12:30:45Z')).toBe('2026-03-26')
      expect(formatDateValue('2024-12-31T23:59:59')).toBe('2024-12-31')
    })

    test('should return original value for non-ISO date strings', () => {
      expect(formatDateValue('March 15, 2025')).toBe('March 15, 2025')
      expect(formatDateValue('15/03/2025')).toBe('15/03/2025')
      expect(formatDateValue('2025-04-04')).toBe('2025-04-04') // Already formatted
    })

    test('should return original value for non-date strings', () => {
      expect(formatDateValue('Hello World')).toBe('Hello World')
      expect(formatDateValue('Acme Corporation')).toBe('Acme Corporation')
    })

    test('should handle empty string', () => {
      expect(formatDateValue('')).toBe('')
    })

    test('should handle null/undefined gracefully', () => {
      expect(formatDateValue(null as any)).toBe(null)
      expect(formatDateValue(undefined as any)).toBe(undefined)
    })

    test('should handle non-string input gracefully', () => {
      expect(formatDateValue(123 as any)).toBe(123)
      expect(formatDateValue({ date: '2025-01-01' } as any)).toEqual({ date: '2025-01-01' })
    })
  })

  describe('getGenerationMethodBadge', () => {
    test('should return null for undefined method', () => {
      const result = getGenerationMethodBadge(undefined)
      expect(result).toBeNull()
    })

    test('should return badge element for standard method', () => {
      const result = getGenerationMethodBadge('standard')
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('type', 'span')
      expect(result).toHaveProperty('props.children', 'Gen w/Standard')
      expect(result).toHaveProperty('props.className')
      expect((result as any).props.className).toContain('bg-blue-100')
    })

    test('should return badge element for dspy method', () => {
      const result = getGenerationMethodBadge('dspy')
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('props.children', 'Gen w/DSPy Style')
      expect((result as any).props.className).toContain('bg-purple-100')
    })

    test('should return badge element for agent method', () => {
      const result = getGenerationMethodBadge('agent')
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('props.children', 'Gen w/Agent')
      expect((result as any).props.className).toContain('bg-orange-100')
    })

    test('should include dark mode classes', () => {
      const standardResult = getGenerationMethodBadge('standard')
      expect((standardResult as any).props.className).toContain('dark:bg-blue-900/30')
      
      const dspyResult = getGenerationMethodBadge('dspy')
      expect((dspyResult as any).props.className).toContain('dark:bg-purple-900/30')
      
      const agentResult = getGenerationMethodBadge('agent')
      expect((agentResult as any).props.className).toContain('dark:bg-orange-900/30')
    })

    test('should include proper text color classes', () => {
      const standardResult = getGenerationMethodBadge('standard')
      expect((standardResult as any).props.className).toContain('text-blue-700')
      
      const dspyResult = getGenerationMethodBadge('dspy')
      expect((dspyResult as any).props.className).toContain('text-purple-700')
      
      const agentResult = getGenerationMethodBadge('agent')
      expect((agentResult as any).props.className).toContain('text-orange-700')
    })

    test('should include pill styling classes', () => {
      const result = getGenerationMethodBadge('standard')
      expect((result as any).props.className).toContain('text-xs')
      expect((result as any).props.className).toContain('px-2')
      expect((result as any).props.className).toContain('py-1')
      expect((result as any).props.className).toContain('rounded-full')
    })
  })
})
