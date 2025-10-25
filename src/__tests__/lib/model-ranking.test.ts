import { describe, test, expect } from 'vitest';
import {
  calculateModelSummaries,
  determineFieldWinners,
  assignRanks,
  FLOATING_POINT_PRECISION,
  type ModelSummary
} from '@/lib/model-ranking-utils';
import type { AccuracyData } from '@/lib/types';

/**
 * Model Ranking Tests - Core Business Logic
 * 
 * Tests the sophisticated model ranking system that helps users choose
 * the best AI model for their extraction tasks.
 * 
 * Critical Features Tested:
 * 1. Overall ranking by accuracy with tie-breaking hierarchy
 * 2. Field-level winner determination
 * 3. Macro averaging across fields
 * 4. Field settings (includeInMetrics) filtering
 * 5. Shared victory handling
 * 6. Floating-point precision handling
 */

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function createMockFields(count: number = 3): AccuracyData['fields'] {
  return Array.from({ length: count }, (_, i) => ({
    key: `field_${i + 1}`,
    name: `Field ${i + 1}`,
    type: 'string' as const,
    prompt: `Extract field ${i + 1}`,
    promptHistory: []
  }));
}

function createMockAverages(
  fields: AccuracyData['fields'],
  models: string[],
  metricsOverride?: Record<string, Record<string, { accuracy: number; precision: number; recall: number; f1: number }>>
): AccuracyData['averages'] {
  const averages: AccuracyData['averages'] = {};
  
  fields.forEach(field => {
    averages[field.key] = {};
    models.forEach(model => {
      if (metricsOverride?.[field.key]?.[model]) {
        averages[field.key][model] = metricsOverride[field.key][model];
      } else {
        // Default to perfect scores
        averages[field.key][model] = {
          accuracy: 1.0,
          precision: 1.0,
          recall: 1.0,
          f1: 1.0
        };
      }
    });
  });
  
  return averages;
}

// ==========================================
// BASIC RANKING TESTS
// ==========================================

describe('Model Ranking - Basic Functionality', () => {
  test('should calculate model summaries correctly', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models);

    const summaries = calculateModelSummaries(models, fields, averages);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].modelName).toBe('model_a');
    expect(summaries[1].modelName).toBe('model_b');
    expect(summaries[0].fieldPerformance).toHaveLength(2);
    expect(summaries[0].overallAccuracy).toBe(1.0);
  });

  test('should rank models by overall accuracy', () => {
    const models = ['model_a', 'model_b', 'model_c'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0.95, precision: 0.95, recall: 0.95, f1: 0.95 },
        model_b: { accuracy: 0.85, precision: 0.85, recall: 0.85, f1: 0.85 },
        model_c: { accuracy: 0.75, precision: 0.75, recall: 0.75, f1: 0.75 }
      },
      field_2: {
        model_a: { accuracy: 0.95, precision: 0.95, recall: 0.95, f1: 0.95 },
        model_b: { accuracy: 0.85, precision: 0.85, recall: 0.85, f1: 0.85 },
        model_c: { accuracy: 0.75, precision: 0.75, recall: 0.75, f1: 0.75 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    assignRanks(summaries);

    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].modelName).toBe('model_a');
    expect(summaries[1].rank).toBe(2);
    expect(summaries[1].modelName).toBe('model_b');
    expect(summaries[2].rank).toBe(3);
    expect(summaries[2].modelName).toBe('model_c');
  });

  test('should calculate macro-averaged metrics correctly', () => {
    const models = ['model_a'];
    const fields = createMockFields(3);
    const averages = createMockAverages(fields, models, {
      field_1: { model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 } },
      field_2: { model_a: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 } },
      field_3: { model_a: { accuracy: 0.6, precision: 0.6, recall: 0.6, f1: 0.6 } }
    });

    const summaries = calculateModelSummaries(models, fields, averages);

    // Macro average: (1.0 + 0.8 + 0.6) / 3 = 0.8
    expect(summaries[0].overallAccuracy).toBeCloseTo(0.8, 3);
    expect(summaries[0].overallPrecision).toBeCloseTo(0.8, 3);
    expect(summaries[0].overallRecall).toBeCloseTo(0.8, 3);
    expect(summaries[0].overallF1).toBeCloseTo(0.8, 3);
  });
});

// ==========================================
// TIE-BREAKING TESTS
// ==========================================

describe('Model Ranking - Tie-Breaking Logic', () => {
  test('should use precision as first tie-breaker when accuracy is equal', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0.9, precision: 0.95, recall: 0.85, f1: 0.9 },
        model_b: { accuracy: 0.9, precision: 0.85, recall: 0.95, f1: 0.9 }
      },
      field_2: {
        model_a: { accuracy: 0.9, precision: 0.95, recall: 0.85, f1: 0.9 },
        model_b: { accuracy: 0.9, precision: 0.85, recall: 0.95, f1: 0.9 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    assignRanks(summaries);

    // Model A should rank higher due to better precision
    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].modelName).toBe('model_a');
    expect(summaries[1].rank).toBe(2);
    expect(summaries[1].modelName).toBe('model_b');
  });

  test('should use recall as second tie-breaker when accuracy and precision are equal', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0.9, precision: 0.9, recall: 0.95, f1: 0.9 },
        model_b: { accuracy: 0.9, precision: 0.9, recall: 0.85, f1: 0.9 }
      },
      field_2: {
        model_a: { accuracy: 0.9, precision: 0.9, recall: 0.95, f1: 0.9 },
        model_b: { accuracy: 0.9, precision: 0.9, recall: 0.85, f1: 0.9 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    assignRanks(summaries);

    // Model A should rank higher due to better recall
    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].modelName).toBe('model_a');
    expect(summaries[1].rank).toBe(2);
    expect(summaries[1].modelName).toBe('model_b');
  });

  test('should use field wins as third tie-breaker', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(3);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 }, // Model A wins
        model_b: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
      },
      field_2: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 }, // Model A wins
        model_b: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
      },
      field_3: {
        model_a: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 },
        model_b: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 } // Model B wins
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Both have same overall metrics, but Model A won 2 fields vs Model B's 1
    expect(summaries[0].modelName).toBe('model_a');
    expect(summaries[0].fieldsWon).toBe(2);
    expect(summaries[1].modelName).toBe('model_b');
    expect(summaries[1].fieldsWon).toBe(1);
  });

  test('should use alphabetical order as final tie-breaker', () => {
    const models = ['zebra_model', 'alpha_model'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models); // All perfect scores

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Should be sorted alphabetically
    expect(summaries[0].modelName).toBe('alpha_model');
    expect(summaries[1].modelName).toBe('zebra_model');
    expect(summaries[0].rank).toBe(1); // Tied, so both rank 1
    expect(summaries[1].rank).toBe(1);
  });

  test('should handle exact ties with same rank', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models); // All perfect scores

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Both should have rank 1 (tied)
    expect(summaries[0].rank).toBe(1);
    expect(summaries[1].rank).toBe(1);
  });
});

// ==========================================
// FIELD WINNER TESTS
// ==========================================

describe('Model Ranking - Field Winner Determination', () => {
  test('should determine sole field winner correctly', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 },
        model_b: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);

    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldPerformance[0].isSharedVictory).toBeFalsy();
    expect(summaries[0].fieldsWon).toBe(1);
    expect(summaries[1].fieldPerformance[0].isWinner).toBe(false);
    expect(summaries[1].fieldsWon).toBe(0);
  });

  test('should handle shared victories correctly', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 },
        model_b: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);

    // Both should be winners with shared victory
    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldPerformance[0].isSharedVictory).toBe(true);
    expect(summaries[0].fieldsWon).toBe(0.5); // 1/2 win
    expect(summaries[1].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[1].fieldPerformance[0].isSharedVictory).toBe(true);
    expect(summaries[1].fieldsWon).toBe(0.5); // 1/2 win
  });

  test('should apply field-level tie-breaking with precision', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0.9, precision: 0.95, recall: 0.85, f1: 0.9 },
        model_b: { accuracy: 0.9, precision: 0.85, recall: 0.95, f1: 0.9 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);

    // Model A should win due to better precision
    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldsWon).toBe(1);
    expect(summaries[1].fieldPerformance[0].isWinner).toBe(false);
    expect(summaries[1].fieldsWon).toBe(0);
  });

  test('should apply field-level tie-breaking with recall', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0.9, precision: 0.9, recall: 0.95, f1: 0.9 },
        model_b: { accuracy: 0.9, precision: 0.9, recall: 0.85, f1: 0.9 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);

    // Model A should win due to better recall
    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldsWon).toBe(1);
    expect(summaries[1].fieldPerformance[0].isWinner).toBe(false);
    expect(summaries[1].fieldsWon).toBe(0);
  });

  test('should handle three-way shared victory', () => {
    const models = ['model_a', 'model_b', 'model_c'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models); // All perfect

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);

    // All three should share the victory
    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldPerformance[0].isSharedVictory).toBe(true);
    expect(summaries[0].fieldsWon).toBeCloseTo(1/3, 3);
    expect(summaries[1].fieldsWon).toBeCloseTo(1/3, 3);
    expect(summaries[2].fieldsWon).toBeCloseTo(1/3, 3);
  });
});

// ==========================================
// FIELD SETTINGS TESTS
// ==========================================

describe('Model Ranking - Field Settings (includeInMetrics)', () => {
  test('should exclude disabled fields from overall metrics', () => {
    const models = ['model_a'];
    const fields = createMockFields(3);
    const averages = createMockAverages(fields, models, {
      field_1: { model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 } },
      field_2: { model_a: { accuracy: 0.5, precision: 0.5, recall: 0.5, f1: 0.5 } }, // Disabled
      field_3: { model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 } }
    });
    const fieldSettings = {
      field_1: { includeInMetrics: true },
      field_2: { includeInMetrics: false }, // Disabled
      field_3: { includeInMetrics: true }
    };

    const summaries = calculateModelSummaries(models, fields, averages, fieldSettings);

    // Should average only field_1 and field_3: (1.0 + 1.0) / 2 = 1.0
    expect(summaries[0].overallAccuracy).toBe(1.0);
    expect(summaries[0].totalFields).toBe(2); // Only 2 enabled fields
  });

  test('should not determine winners for disabled fields', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 },
        model_b: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
      },
      field_2: {
        model_a: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 },
        model_b: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 }
      }
    });
    const fieldSettings = {
      field_1: { includeInMetrics: true },
      field_2: { includeInMetrics: false } // Disabled
    };

    const summaries = calculateModelSummaries(models, fields, averages, fieldSettings);
    determineFieldWinners(summaries, fields, fieldSettings);

    // Model A should win field_1, but field_2 should have no winner
    expect(summaries[0].fieldsWon).toBe(1); // Only field_1
    expect(summaries[1].fieldsWon).toBe(0);
    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldPerformance[1].isWinner).toBe(false); // Disabled field
    expect(summaries[1].fieldPerformance[1].isWinner).toBe(false); // Disabled field
  });

  test('should mark disabled fields in field performance', () => {
    const models = ['model_a'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models);
    const fieldSettings = {
      field_1: { includeInMetrics: true },
      field_2: { includeInMetrics: false }
    };

    const summaries = calculateModelSummaries(models, fields, averages, fieldSettings);

    expect(summaries[0].fieldPerformance[0].isIncludedInMetrics).toBe(true);
    expect(summaries[0].fieldPerformance[1].isIncludedInMetrics).toBe(false);
  });
});

// ==========================================
// EDGE CASES & ROBUSTNESS
// ==========================================

describe('Model Ranking - Edge Cases', () => {
  test('should handle single model', () => {
    const models = ['only_model'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models);

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].fieldsWon).toBe(2); // Wins all fields
  });

  test('should handle single field', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 },
        model_b: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].fieldsWon).toBe(1);
    expect(summaries[1].rank).toBe(2);
  });

  test('should handle all zero metrics', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
        model_b: { accuracy: 0, precision: 0, recall: 0, f1: 0 }
      },
      field_2: {
        model_a: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
        model_b: { accuracy: 0, precision: 0, recall: 0, f1: 0 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Should handle gracefully without errors
    expect(summaries[0].overallAccuracy).toBe(0);
    expect(summaries[1].overallAccuracy).toBe(0);
    expect(summaries[0].rank).toBe(1); // Tied
    expect(summaries[1].rank).toBe(1);
  });

  test('should handle floating-point precision correctly', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(1);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 0.9, precision: 0.9, recall: 0.9, f1: 0.9 },
        model_b: { accuracy: 0.9 + FLOATING_POINT_PRECISION / 2, precision: 0.9, recall: 0.9, f1: 0.9 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);

    // Should be considered tied due to floating-point precision tolerance
    expect(summaries[0].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[1].fieldPerformance[0].isWinner).toBe(true);
    expect(summaries[0].fieldPerformance[0].isSharedVictory).toBe(true);
  });

  test('should handle all fields disabled', () => {
    const models = ['model_a'];
    const fields = createMockFields(2);
    const averages = createMockAverages(fields, models);
    const fieldSettings = {
      field_1: { includeInMetrics: false },
      field_2: { includeInMetrics: false }
    };

    const summaries = calculateModelSummaries(models, fields, averages, fieldSettings);

    // Should have zero metrics when no fields are enabled
    expect(summaries[0].overallAccuracy).toBe(0);
    expect(summaries[0].totalFields).toBe(0);
  });

  test('should handle mixed performance across fields', () => {
    const models = ['model_a', 'model_b'];
    const fields = createMockFields(5);
    const averages = createMockAverages(fields, models, {
      field_1: {
        model_a: { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 },
        model_b: { accuracy: 0.5, precision: 0.5, recall: 0.5, f1: 0.5 }
      },
      field_2: {
        model_a: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 },
        model_b: { accuracy: 0.9, precision: 0.9, recall: 0.9, f1: 0.9 }
      },
      field_3: {
        model_a: { accuracy: 0.6, precision: 0.6, recall: 0.6, f1: 0.6 },
        model_b: { accuracy: 0.7, precision: 0.7, recall: 0.7, f1: 0.7 }
      },
      field_4: {
        model_a: { accuracy: 0.95, precision: 0.95, recall: 0.95, f1: 0.95 },
        model_b: { accuracy: 0.85, precision: 0.85, recall: 0.85, f1: 0.85 }
      },
      field_5: {
        model_a: { accuracy: 0.7, precision: 0.7, recall: 0.7, f1: 0.7 },
        model_b: { accuracy: 0.8, precision: 0.8, recall: 0.8, f1: 0.8 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Model A wins fields 1 and 4, Model B wins fields 2, 3, and 5
    expect(summaries[0].fieldsWon).toBe(2);
    expect(summaries[1].fieldsWon).toBe(3);
    
    // Calculate expected overall accuracy
    const modelAOverall = (1.0 + 0.8 + 0.6 + 0.95 + 0.7) / 5;
    const modelBOverall = (0.5 + 0.9 + 0.7 + 0.85 + 0.8) / 5;
    
    expect(summaries[0].overallAccuracy).toBeCloseTo(modelAOverall, 3);
    expect(summaries[1].overallAccuracy).toBeCloseTo(modelBOverall, 3);
  });
});

// ==========================================
// REAL-WORLD SCENARIOS
// ==========================================

describe('Model Ranking - Real-World Scenarios', () => {
  test('should rank Google Gemini vs Anthropic Claude vs OpenAI GPT', () => {
    const models = [
      'google__gemini_2_0_flash_001',
      'anthropic__claude_3_5_sonnet',
      'openai__gpt_4o'
    ];
    const fields = [
      { key: 'company_name', name: 'Company Name', type: 'string' as const, prompt: '', promptHistory: [] },
      { key: 'contract_date', name: 'Contract Date', type: 'date' as const, prompt: '', promptHistory: [] },
      { key: 'contract_value', name: 'Contract Value', type: 'float' as const, prompt: '', promptHistory: [] },
      { key: 'effective_date', name: 'Effective Date', type: 'date' as const, prompt: '', promptHistory: [] }
    ];
    const averages = createMockAverages(fields, models, {
      company_name: {
        google__gemini_2_0_flash_001: { accuracy: 0.95, precision: 0.95, recall: 0.95, f1: 0.95 },
        anthropic__claude_3_5_sonnet: { accuracy: 0.98, precision: 0.98, recall: 0.98, f1: 0.98 },
        openai__gpt_4o: { accuracy: 0.92, precision: 0.92, recall: 0.92, f1: 0.92 }
      },
      contract_date: {
        google__gemini_2_0_flash_001: { accuracy: 0.88, precision: 0.88, recall: 0.88, f1: 0.88 },
        anthropic__claude_3_5_sonnet: { accuracy: 0.90, precision: 0.90, recall: 0.90, f1: 0.90 },
        openai__gpt_4o: { accuracy: 0.85, precision: 0.85, recall: 0.85, f1: 0.85 }
      },
      contract_value: {
        google__gemini_2_0_flash_001: { accuracy: 0.92, precision: 0.92, recall: 0.92, f1: 0.92 },
        anthropic__claude_3_5_sonnet: { accuracy: 0.89, precision: 0.89, recall: 0.89, f1: 0.89 },
        openai__gpt_4o: { accuracy: 0.94, precision: 0.94, recall: 0.94, f1: 0.94 }
      },
      effective_date: {
        google__gemini_2_0_flash_001: { accuracy: 0.87, precision: 0.87, recall: 0.87, f1: 0.87 },
        anthropic__claude_3_5_sonnet: { accuracy: 0.91, precision: 0.91, recall: 0.91, f1: 0.91 },
        openai__gpt_4o: { accuracy: 0.86, precision: 0.86, recall: 0.86, f1: 0.86 }
      }
    });

    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Claude should rank #1 (wins 3 fields, highest overall)
    expect(summaries[0].modelName).toBe('anthropic__claude_3_5_sonnet');
    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].fieldsWon).toBe(3);
    
    // Gemini should rank #2
    expect(summaries[1].modelName).toBe('google__gemini_2_0_flash_001');
    expect(summaries[1].rank).toBe(2);
    
    // GPT-4o should rank #3
    expect(summaries[2].modelName).toBe('openai__gpt_4o');
    expect(summaries[2].rank).toBe(3);
    expect(summaries[2].fieldsWon).toBe(1); // Wins contract_value
  });

  test('should handle scenario where fast model beats accurate model', () => {
    const models = ['fast_model', 'accurate_model'];
    const fields = createMockFields(10);
    
    // Fast model: consistently good (90%) across all fields
    // Accurate model: excellent on some (100%), poor on others (70%)
    const metricsOverride: Record<string, Record<string, any>> = {};
    fields.forEach((field, i) => {
      metricsOverride[field.key] = {
        fast_model: { accuracy: 0.9, precision: 0.9, recall: 0.9, f1: 0.9 },
        accurate_model: i < 5
          ? { accuracy: 1.0, precision: 1.0, recall: 1.0, f1: 1.0 }
          : { accuracy: 0.7, precision: 0.7, recall: 0.7, f1: 0.7 }
      };
    });
    
    const averages = createMockAverages(fields, models, metricsOverride);
    const summaries = calculateModelSummaries(models, fields, averages);
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);

    // Fast model: 0.9 overall
    // Accurate model: (5 * 1.0 + 5 * 0.7) / 10 = 0.85 overall
    expect(summaries[0].modelName).toBe('fast_model');
    expect(summaries[0].rank).toBe(1);
    expect(summaries[0].overallAccuracy).toBeCloseTo(0.9, 3);
    expect(summaries[1].overallAccuracy).toBeCloseTo(0.85, 3);
  });
});

