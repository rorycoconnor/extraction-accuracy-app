import { describe, test, expect } from 'vitest';
import { calculateModelSummaries } from '@/lib/model-ranking-utils';
import type { AccuracyData } from '@/lib/types';

/**
 * Test data factory for field toggle accuracy testing
 */
function createMockAccuracyDataWithToggles(fieldSettings?: Record<string, { includeInMetrics: boolean }>): AccuracyData {
  return {
    templateKey: 'test-template',
    baseModel: 'GPT-4',
    fields: [
      {
        name: 'Contract Type',
        key: 'contract_type',
        type: 'string',
        prompt: 'Extract the contract type',
        promptHistory: []
      },
      {
        name: 'Term Years',
        key: 'term_years',
        type: 'number',
        prompt: 'Extract the term in years',
        promptHistory: []
      },
      {
        name: 'Summary',
        key: 'summary',
        type: 'string',
        prompt: 'Provide a detailed summary',
        promptHistory: []
      }
    ],
    results: [],
    averages: {
      'contract_type': {
        'GPT-4': { accuracy: 0.95, precision: 0.90, recall: 0.92, f1: 0.91 },
        'Claude': { accuracy: 0.90, precision: 0.88, recall: 0.89, f1: 0.885 }
      },
      'term_years': {
        'GPT-4': { accuracy: 0.90, precision: 0.85, recall: 0.87, f1: 0.86 },
        'Claude': { accuracy: 0.85, precision: 0.82, recall: 0.84, f1: 0.83 }
      },
      'summary': {
        'GPT-4': { accuracy: 0.05, precision: 0.02, recall: 0.03, f1: 0.024 },
        'Claude': { accuracy: 0.03, precision: 0.01, recall: 0.02, f1: 0.013 }
      }
    },
    fieldSettings
  };
}

describe('Field Toggle Accuracy Calculations', () => {

  test('should include all fields when no fieldSettings provided (default behavior)', () => {
    const mockData = createMockAccuracyDataWithToggles();
    const visibleModels = ['GPT-4', 'Claude'];
    
    const summaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages);
    
    expect(summaries).toHaveLength(2);
    
    // All fields should be included by default
    summaries.forEach(summary => {
      summary.fieldPerformance.forEach(field => {
        expect(field.isIncludedInMetrics).toBe(true);
      });
    });
    
    // GPT-4: (0.95 + 0.90 + 0.05) / 3 = 0.633
    const gpt4Summary = summaries.find(s => s.modelName === 'GPT-4');
    expect(gpt4Summary?.overallAccuracy).toBeCloseTo(0.633, 3);
    
    // Claude: (0.90 + 0.85 + 0.03) / 3 = 0.593
    const claudeSummary = summaries.find(s => s.modelName === 'Claude');
    expect(claudeSummary?.overallAccuracy).toBeCloseTo(0.593, 3);
  });

  test('should exclude disabled fields from metrics calculation', () => {
    const mockData = createMockAccuracyDataWithToggles({
      'summary': { includeInMetrics: false } // Disable the poor-performing summary field
    });
    const visibleModels = ['GPT-4', 'Claude'];
    
    const summaries = calculateModelSummaries(
      visibleModels, 
      mockData.fields, 
      mockData.averages, 
      mockData.fieldSettings
    );
    
    expect(summaries).toHaveLength(2);
    
    // Check field inclusion status
    summaries.forEach(summary => {
      const summaryField = summary.fieldPerformance.find(f => f.fieldKey === 'summary');
      const contractField = summary.fieldPerformance.find(f => f.fieldKey === 'contract_type');
      const termField = summary.fieldPerformance.find(f => f.fieldKey === 'term_years');
      
      expect(summaryField?.isIncludedInMetrics).toBe(false);
      expect(contractField?.isIncludedInMetrics).toBe(true);
      expect(termField?.isIncludedInMetrics).toBe(true);
    });
    
    // GPT-4: Only contract_type (0.95) and term_years (0.90) = (0.95 + 0.90) / 2 = 0.925
    const gpt4Summary = summaries.find(s => s.modelName === 'GPT-4');
    expect(gpt4Summary?.overallAccuracy).toBeCloseTo(0.925, 3);
    
    // Claude: Only contract_type (0.90) and term_years (0.85) = (0.90 + 0.85) / 2 = 0.875
    const claudeSummary = summaries.find(s => s.modelName === 'Claude');
    expect(claudeSummary?.overallAccuracy).toBeCloseTo(0.875, 3);
  });

  test('should handle multiple disabled fields correctly', () => {
    const mockData = createMockAccuracyDataWithToggles({
      'summary': { includeInMetrics: false },
      'term_years': { includeInMetrics: false }
    });
    const visibleModels = ['GPT-4'];
    
    const summaries = calculateModelSummaries(
      visibleModels, 
      mockData.fields, 
      mockData.averages, 
      mockData.fieldSettings
    );
    
    const gpt4Summary = summaries[0];
    
    // Only contract_type should be included
    const enabledFields = gpt4Summary.fieldPerformance.filter(f => f.isIncludedInMetrics);
    expect(enabledFields).toHaveLength(1);
    expect(enabledFields[0].fieldKey).toBe('contract_type');
    
    // Overall accuracy should be just the contract_type accuracy
    expect(gpt4Summary.overallAccuracy).toBeCloseTo(0.95, 3);
  });

  test('should handle case where all fields are disabled', () => {
    const mockData = createMockAccuracyDataWithToggles({
      'contract_type': { includeInMetrics: false },
      'term_years': { includeInMetrics: false },
      'summary': { includeInMetrics: false }
    });
    const visibleModels = ['GPT-4'];
    
    const summaries = calculateModelSummaries(
      visibleModels, 
      mockData.fields, 
      mockData.averages, 
      mockData.fieldSettings
    );
    
    const gpt4Summary = summaries[0];
    
    // All fields should be marked as not included
    gpt4Summary.fieldPerformance.forEach(field => {
      expect(field.isIncludedInMetrics).toBe(false);
    });
    
    // Overall metrics should be 0 when no fields are enabled
    expect(gpt4Summary.overallAccuracy).toBe(0);
    expect(gpt4Summary.overallF1).toBe(0);
    expect(gpt4Summary.overallPrecision).toBe(0);
    expect(gpt4Summary.overallRecall).toBe(0);
  });

  test('should demonstrate accuracy improvement when disabling poor-performing fields', () => {
    const mockData = createMockAccuracyDataWithToggles();
    const visibleModels = ['GPT-4'];
    
    // Test with all fields enabled
    const allFieldsSummaries = calculateModelSummaries(visibleModels, mockData.fields, mockData.averages);
    const allFieldsAccuracy = allFieldsSummaries[0].overallAccuracy;
    
    // Test with summary field disabled (it has 0.05 accuracy, dragging down the overall score)
    mockData.fieldSettings = { 'summary': { includeInMetrics: false } };
    const filteredSummaries = calculateModelSummaries(
      visibleModels, 
      mockData.fields, 
      mockData.averages, 
      mockData.fieldSettings
    );
    const filteredAccuracy = filteredSummaries[0].overallAccuracy;
    
    // Accuracy should improve when removing the poor-performing summary field
    expect(filteredAccuracy).toBeGreaterThan(allFieldsAccuracy);
    
    console.log('🎯 Accuracy Improvement Test:');
    console.log(`   All fields: ${(allFieldsAccuracy * 100).toFixed(1)}%`);
    console.log(`   Summary disabled: ${(filteredAccuracy * 100).toFixed(1)}%`);
    console.log(`   Improvement: +${((filteredAccuracy - allFieldsAccuracy) * 100).toFixed(1)}%`);
  });

});
