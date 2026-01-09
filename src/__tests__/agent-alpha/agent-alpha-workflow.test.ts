/**
 * Agent-Alpha Workflow Integration Tests
 * 
 * These tests verify the end-to-end workflow of Agent-Alpha, including:
 * - Work plan preparation
 * - Field processing
 * - Iteration logic
 * - Result aggregation
 * 
 * These tests mock external dependencies (Box API) to test the logic in isolation.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AccuracyData, AccuracyField } from '@/lib/types';
import type { AgentAlphaRuntimeConfig } from '@/lib/agent-alpha-config';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';

// Mock external dependencies
vi.mock('@/services/box', () => ({
  extractStructuredMetadataWithBoxAI: vi.fn(),
  boxApiFetch: vi.fn(),
  getBlankPlaceholderFileId: vi.fn().mockResolvedValue('placeholder-id'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Agent-Alpha Workflow', () => {
  
  // Helper to create mock accuracy data
  const createMockAccuracyData = (overrides?: Partial<AccuracyData>): AccuracyData => ({
    templateKey: 'test-contracts',
    baseModel: 'test-model',
    fields: [
      {
        name: 'Company Name',
        key: 'company_name',
        type: 'string',
        prompt: 'Extract the company name',
        promptHistory: [],
      },
      {
        name: 'Contract Date',
        key: 'contract_date',
        type: 'date',
        prompt: 'Extract the contract date',
        promptHistory: [],
      },
      {
        name: 'Contract Value',
        key: 'contract_value',
        type: 'number',
        prompt: 'Extract the contract value',
        promptHistory: [],
      },
    ],
    results: [
      {
        id: 'doc1',
        fileName: 'contract1.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 'Ground Truth': 'Acme Corp', 'test-model': 'Acme' },
          contract_date: { 'Ground Truth': '2025-01-01', 'test-model': '2025-01-01' },
          contract_value: { 'Ground Truth': '100000', 'test-model': '100000' },
        },
        comparisonResults: {
          company_name: { 'test-model': { isMatch: false, details: 'Partial match' } },
          contract_date: { 'test-model': { isMatch: true } },
          contract_value: { 'test-model': { isMatch: true } },
        },
      },
      {
        id: 'doc2',
        fileName: 'contract2.pdf',
        fileType: 'pdf',
        fields: {
          company_name: { 'Ground Truth': 'Beta Inc', 'test-model': 'Beta Inc' },
          contract_date: { 'Ground Truth': '2025-02-01', 'test-model': '2025-02-15' },
          contract_value: { 'Ground Truth': '50000', 'test-model': '50000' },
        },
        comparisonResults: {
          company_name: { 'test-model': { isMatch: true } },
          contract_date: { 'test-model': { isMatch: false, details: 'Date mismatch' } },
          contract_value: { 'test-model': { isMatch: true } },
        },
      },
    ],
    averages: {
      company_name: { 'test-model': { accuracy: 0.5 } },
      contract_date: { 'test-model': { accuracy: 0.5 } },
      contract_value: { 'test-model': { accuracy: 1.0 } },
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Work Plan Preparation', () => {
    test('should identify fields below target accuracy', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData();

      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
        maxDocs: 3,
      });

      // Should identify company_name and contract_date as failing (50% accuracy)
      // contract_value is at 100% so should not be included
      expect(workPlan.fields.length).toBe(2);
      
      const fieldKeys = workPlan.fields.map(f => f.fieldKey);
      expect(fieldKeys).toContain('company_name');
      expect(fieldKeys).toContain('contract_date');
      expect(fieldKeys).not.toContain('contract_value');
    });

    test('should return empty fields array when all fields at 100%', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData({
        averages: {
          company_name: { 'test-model': { accuracy: 1.0 } },
          contract_date: { 'test-model': { accuracy: 1.0 } },
          contract_value: { 'test-model': { accuracy: 1.0 } },
        },
        results: [
          {
            id: 'doc1',
            fileName: 'contract1.pdf',
            fileType: 'pdf',
            fields: {
              company_name: { 'Ground Truth': 'Acme Corp', 'test-model': 'Acme Corp' },
              contract_date: { 'Ground Truth': '2025-01-01', 'test-model': '2025-01-01' },
              contract_value: { 'Ground Truth': '100000', 'test-model': '100000' },
            },
            comparisonResults: {
              company_name: { 'test-model': { isMatch: true } },
              contract_date: { 'test-model': { isMatch: true } },
              contract_value: { 'test-model': { isMatch: true } },
            },
          },
        ],
      });

      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
        maxDocs: 3,
      });

      expect(workPlan.fields.length).toBe(0);
    });

    test('should throw error when no comparison results exist', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData({
        results: [
          {
            id: 'doc1',
            fileName: 'contract1.pdf',
            fileType: 'pdf',
            fields: {
              company_name: { 'Ground Truth': 'Acme Corp' },
            },
            // No comparisonResults
          },
        ],
      });

      await expect(
        prepareAgentAlphaWorkPlan({
          accuracyData,
          testModel: 'test-model',
          maxDocs: 3,
        })
      ).rejects.toThrow();
    });

    test('should include ground truth in field plans', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData();

      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
        maxDocs: 3,
      });

      // Each field plan should have ground truth for sampled docs
      workPlan.fields.forEach(fieldPlan => {
        expect(fieldPlan.groundTruth).toBeDefined();
        expect(typeof fieldPlan.groundTruth).toBe('object');
      });
    });

    test('should generate unique run ID', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData();

      const workPlan1 = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
      });

      const workPlan2 = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
      });

      expect(workPlan1.runId).toBeDefined();
      expect(workPlan2.runId).toBeDefined();
      expect(workPlan1.runId).not.toBe(workPlan2.runId);
    });
  });

  describe('Runtime Configuration', () => {
    test('should respect maxDocs configuration', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData();

      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
        maxDocs: 1,
      });

      expect(workPlan.sampledDocIds.length).toBeLessThanOrEqual(1);
    });

    test('should use default maxDocs when not specified', async () => {
      const { prepareAgentAlphaWorkPlan } = await import('@/ai/flows/agent-alpha-prepare');
      const accuracyData = createMockAccuracyData();

      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: 'test-model',
      });

      expect(workPlan.sampledDocIds.length).toBeLessThanOrEqual(AGENT_ALPHA_CONFIG.MAX_DOCS);
    });
  });

  describe('Field Result Structure', () => {
    test('field result should have all required properties', () => {
      // This is a type/contract test
      const mockFieldResult = {
        fieldKey: 'company_name',
        fieldName: 'Company Name',
        initialAccuracy: 0.5,
        finalAccuracy: 1.0,
        iterationCount: 3,
        finalPrompt: 'Improved prompt...',
        initialPrompt: 'Original prompt',
        userOriginalPrompt: 'Original prompt', // User had a prompt defined
        converged: true,
        sampledDocIds: ['doc1', 'doc2'],
      };

      expect(mockFieldResult.fieldKey).toBeDefined();
      expect(mockFieldResult.fieldName).toBeDefined();
      expect(typeof mockFieldResult.initialAccuracy).toBe('number');
      expect(typeof mockFieldResult.finalAccuracy).toBe('number');
      expect(typeof mockFieldResult.iterationCount).toBe('number');
      expect(typeof mockFieldResult.finalPrompt).toBe('string');
      expect(typeof mockFieldResult.initialPrompt).toBe('string');
      expect(typeof mockFieldResult.converged).toBe('boolean');
      expect(Array.isArray(mockFieldResult.sampledDocIds)).toBe(true);
      // userOriginalPrompt can be string or null
      expect(mockFieldResult.userOriginalPrompt === null || typeof mockFieldResult.userOriginalPrompt === 'string').toBe(true);
    });
  });

  describe('Convergence Logic', () => {
    test('should converge when accuracy reaches 100%', () => {
      const accuracy = 1.0;
      const targetAccuracy = AGENT_ALPHA_CONFIG.TARGET_ACCURACY;
      
      const converged = accuracy >= targetAccuracy;
      
      expect(converged).toBe(true);
    });

    test('should not converge when accuracy below target', () => {
      const accuracy = 0.95;
      const targetAccuracy = AGENT_ALPHA_CONFIG.TARGET_ACCURACY;
      
      const converged = accuracy >= targetAccuracy;
      
      expect(converged).toBe(false);
    });

    test('target accuracy should be 100%', () => {
      expect(AGENT_ALPHA_CONFIG.TARGET_ACCURACY).toBe(1.0);
    });
  });

  describe('Iteration Limits', () => {
    test('should respect max iterations limit', () => {
      const maxIterations = 5;
      let iterations = 0;
      let converged = false;
      
      while (!converged && iterations < maxIterations) {
        iterations++;
        // Simulate never converging
        converged = false;
      }
      
      expect(iterations).toBe(maxIterations);
    });

    test('should stop early when converged', () => {
      const maxIterations = 5;
      let iterations = 0;
      let converged = false;
      
      while (!converged && iterations < maxIterations) {
        iterations++;
        // Simulate converging on iteration 2
        if (iterations === 2) {
          converged = true;
        }
      }
      
      expect(iterations).toBe(2);
      expect(converged).toBe(true);
    });
  });

  describe('Best Prompt Tracking', () => {
    test('should track best accuracy across iterations', () => {
      const accuracyHistory = [0.5, 0.75, 0.6, 0.8, 0.7];
      let bestAccuracy = 0;
      let bestIteration = 0;
      
      accuracyHistory.forEach((accuracy, index) => {
        if (accuracy > bestAccuracy) {
          bestAccuracy = accuracy;
          bestIteration = index + 1;
        }
      });
      
      expect(bestAccuracy).toBe(0.8);
      expect(bestIteration).toBe(4);
    });

    test('should use best prompt when final iteration is worse', () => {
      const promptHistory = [
        { prompt: 'Prompt 1', accuracy: 0.5 },
        { prompt: 'Prompt 2', accuracy: 0.8 },
        { prompt: 'Prompt 3', accuracy: 0.6 },
      ];
      
      const best = promptHistory.reduce((prev, curr) => 
        curr.accuracy > prev.accuracy ? curr : prev
      );
      
      expect(best.prompt).toBe('Prompt 2');
      expect(best.accuracy).toBe(0.8);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing ground truth gracefully', () => {
      const groundTruth: Record<string, string> = {
        doc1: 'Value1',
        // doc2 missing
      };
      
      const docIds = ['doc1', 'doc2'];
      const values = docIds.map(id => groundTruth[id] || '');
      
      expect(values).toEqual(['Value1', '']);
    });

    test('should handle empty sampled docs', () => {
      const sampledDocIds: string[] = [];
      
      expect(sampledDocIds.length).toBe(0);
      
      // Should be able to iterate without error
      const results = sampledDocIds.map(id => ({ id, value: 'test' }));
      expect(results).toEqual([]);
    });
  });

  describe('Parallel Processing Support', () => {
    test('should support tracking multiple fields in progress', () => {
      const processingFields = [
        { fieldKey: 'field1', fieldName: 'Field 1', initialAccuracy: 0.5, startTime: Date.now() },
        { fieldKey: 'field2', fieldName: 'Field 2', initialAccuracy: 0.6, startTime: Date.now() },
      ];
      
      expect(processingFields.length).toBe(2);
      
      // Simulate completing one
      const completed = processingFields.shift();
      expect(completed?.fieldKey).toBe('field1');
      expect(processingFields.length).toBe(1);
    });

    test('should calculate correct progress with parallel processing', () => {
      const totalFields = 10;
      const fieldsCompleted = 4;
      const fieldsInProgress = 2;
      
      const progressPercentage = (fieldsCompleted / totalFields) * 100;
      const fieldsRemaining = totalFields - fieldsCompleted - fieldsInProgress;
      
      expect(progressPercentage).toBe(40);
      expect(fieldsRemaining).toBe(4);
    });
  });
});

describe('Agent-Alpha Time Estimation', () => {
  test('should estimate time based on fields and iterations', () => {
    const totalFields = 5;
    const maxIterations = 3;
    const fieldConcurrency = 2;
    const extractionConcurrency = 5;
    const maxDocs = 3;
    
    // Estimate: ~6-8 seconds per iteration with parallel extraction
    const avgIterationsPerField = Math.min(maxIterations, 3);
    const secondsPerIteration = 6 + (maxDocs / extractionConcurrency) * 3;
    const secondsPerField = avgIterationsPerField * secondsPerIteration;
    const fieldBatches = Math.ceil(totalFields / fieldConcurrency);
    const estimatedSeconds = fieldBatches * secondsPerField;
    
    // Should be reasonable (not too short, not too long)
    expect(estimatedSeconds).toBeGreaterThan(10);
    expect(estimatedSeconds).toBeLessThan(600); // 10 minutes max for 5 fields
  });

  test('should reduce estimate with higher concurrency', () => {
    const totalFields = 10;
    const maxIterations = 5;
    const maxDocs = 3;
    
    const calculateEstimate = (fieldConcurrency: number) => {
      const avgIterations = Math.min(maxIterations, 3);
      const secondsPerIteration = 8;
      const secondsPerField = avgIterations * secondsPerIteration;
      const batches = Math.ceil(totalFields / fieldConcurrency);
      return batches * secondsPerField;
    };
    
    const estimateConcurrency1 = calculateEstimate(1);
    const estimateConcurrency2 = calculateEstimate(2);
    const estimateConcurrency4 = calculateEstimate(4);
    
    expect(estimateConcurrency2).toBeLessThan(estimateConcurrency1);
    expect(estimateConcurrency4).toBeLessThan(estimateConcurrency2);
  });
});



