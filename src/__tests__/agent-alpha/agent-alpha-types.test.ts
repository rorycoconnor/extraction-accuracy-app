/**
 * Agent-Alpha Types Tests
 * 
 * These tests verify the type contracts and state structures for Agent-Alpha.
 * They serve as documentation and validation for any implementation.
 */

import { describe, test, expect } from 'vitest';
import type {
  AgentAlphaStatus,
  ProcessedFieldInfo,
  ProcessingFieldInfo,
  AgentAlphaState,
  AgentAlphaFieldResult,
  AgentAlphaPendingResults,
  AgentAlphaIterationResult,
} from '@/lib/agent-alpha-types';

describe('Agent-Alpha Types Contract', () => {
  
  describe('AgentAlphaStatus', () => {
    test('should support all valid status values', () => {
      const validStatuses: AgentAlphaStatus[] = [
        'idle',
        'configure',
        'running',
        'preview',
        'error',
      ];
      
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('ProcessedFieldInfo', () => {
    test('should have all required properties', () => {
      const processedField: ProcessedFieldInfo = {
        fieldName: 'Company Name',
        fieldKey: 'company_name',
        iterationCount: 3,
        initialAccuracy: 0.5,
        finalAccuracy: 1.0,
        finalPrompt: 'Extract the company name...',
        timeMs: 45000,
      };
      
      expect(processedField.fieldName).toBe('Company Name');
      expect(processedField.fieldKey).toBe('company_name');
      expect(processedField.iterationCount).toBe(3);
      expect(processedField.initialAccuracy).toBe(0.5);
      expect(processedField.finalAccuracy).toBe(1.0);
      expect(processedField.finalPrompt).toBe('Extract the company name...');
      expect(processedField.timeMs).toBe(45000);
    });

    test('accuracy values should be between 0 and 1', () => {
      const field: ProcessedFieldInfo = {
        fieldName: 'Test',
        fieldKey: 'test',
        iterationCount: 1,
        initialAccuracy: 0.75,
        finalAccuracy: 0.95,
        finalPrompt: 'prompt',
        timeMs: 1000,
      };
      
      expect(field.initialAccuracy).toBeGreaterThanOrEqual(0);
      expect(field.initialAccuracy).toBeLessThanOrEqual(1);
      expect(field.finalAccuracy).toBeGreaterThanOrEqual(0);
      expect(field.finalAccuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('ProcessingFieldInfo', () => {
    test('should have all required properties for tracking in-progress fields', () => {
      const processingField: ProcessingFieldInfo = {
        fieldKey: 'contract_date',
        fieldName: 'Contract Date',
        initialAccuracy: 0.6,
        startTime: Date.now(),
      };
      
      expect(processingField.fieldKey).toBe('contract_date');
      expect(processingField.fieldName).toBe('Contract Date');
      expect(processingField.initialAccuracy).toBe(0.6);
      expect(typeof processingField.startTime).toBe('number');
      expect(processingField.startTime).toBeGreaterThan(0);
    });
  });

  describe('AgentAlphaState', () => {
    test('should have all required properties for state management', () => {
      const state: AgentAlphaState = {
        status: 'idle',
        selectedModel: null,
        currentField: null,
        currentFieldName: null,
        currentIteration: 0,
        currentAccuracy: 0,
        fieldsProcessed: 0,
        totalFields: 0,
        processedFields: [],
        processingFields: [],
      };
      
      expect(state.status).toBe('idle');
      expect(state.selectedModel).toBeNull();
      expect(state.currentField).toBeNull();
      expect(state.currentFieldName).toBeNull();
      expect(state.currentIteration).toBe(0);
      expect(state.currentAccuracy).toBe(0);
      expect(state.fieldsProcessed).toBe(0);
      expect(state.totalFields).toBe(0);
      expect(Array.isArray(state.processedFields)).toBe(true);
      expect(Array.isArray(state.processingFields)).toBe(true);
    });

    test('should support running state with active fields', () => {
      const runningState: AgentAlphaState = {
        status: 'running',
        selectedModel: 'gpt-4',
        currentField: 'company_name',
        currentFieldName: 'Company Name',
        currentIteration: 2,
        currentAccuracy: 0.75,
        fieldsProcessed: 1,
        totalFields: 5,
        startTime: Date.now(),
        runId: 'run-123',
        processedFields: [
          {
            fieldName: 'Contract Date',
            fieldKey: 'contract_date',
            iterationCount: 3,
            initialAccuracy: 0.5,
            finalAccuracy: 1.0,
            finalPrompt: 'Extract date...',
            timeMs: 30000,
          },
        ],
        processingFields: [
          {
            fieldKey: 'company_name',
            fieldName: 'Company Name',
            initialAccuracy: 0.6,
            startTime: Date.now(),
          },
        ],
        runtimeConfig: {
          maxDocs: 3,
          maxIterations: 5,
          testModel: 'gpt-4',
        },
      };
      
      expect(runningState.status).toBe('running');
      expect(runningState.selectedModel).toBe('gpt-4');
      expect(runningState.processedFields.length).toBe(1);
      expect(runningState.processingFields.length).toBe(1);
    });

    test('should support error state', () => {
      const errorState: AgentAlphaState = {
        status: 'error',
        selectedModel: 'gpt-4',
        currentField: null,
        currentFieldName: null,
        currentIteration: 0,
        currentAccuracy: 0,
        fieldsProcessed: 2,
        totalFields: 5,
        errorMessage: 'API rate limit exceeded',
        processedFields: [],
        processingFields: [],
      };
      
      expect(errorState.status).toBe('error');
      expect(errorState.errorMessage).toBe('API rate limit exceeded');
    });
  });

  describe('AgentAlphaFieldResult', () => {
    test('should contain all required result data', () => {
      const result: AgentAlphaFieldResult = {
        fieldKey: 'company_name',
        fieldName: 'Company Name',
        initialAccuracy: 0.5,
        finalAccuracy: 1.0,
        iterationCount: 3,
        finalPrompt: 'Look for company name in header...',
        initialPrompt: 'Extract company name',
        converged: true,
        sampledDocIds: ['doc1', 'doc2', 'doc3'],
        improved: true,
      };
      
      expect(result.fieldKey).toBe('company_name');
      expect(result.fieldName).toBe('Company Name');
      expect(result.initialAccuracy).toBe(0.5);
      expect(result.finalAccuracy).toBe(1.0);
      expect(result.iterationCount).toBe(3);
      expect(result.converged).toBe(true);
      expect(result.sampledDocIds.length).toBe(3);
    });

    test('should support non-converged results', () => {
      const result: AgentAlphaFieldResult = {
        fieldKey: 'difficult_field',
        fieldName: 'Difficult Field',
        initialAccuracy: 0.2,
        finalAccuracy: 0.6,
        iterationCount: 5,
        finalPrompt: 'Best attempt prompt...',
        initialPrompt: 'Extract field',
        converged: false,
        sampledDocIds: ['doc1', 'doc2'],
        improved: true,
      };
      
      expect(result.converged).toBe(false);
      expect(result.finalAccuracy).toBeLessThan(1.0);
    });
  });

  describe('AgentAlphaPendingResults', () => {
    test('should contain complete run results for preview', () => {
      const pendingResults: AgentAlphaPendingResults = {
        runId: 'run-abc-123',
        results: [
          {
            fieldKey: 'field1',
            fieldName: 'Field 1',
            initialAccuracy: 0.5,
            finalAccuracy: 1.0,
            iterationCount: 2,
            finalPrompt: 'prompt1',
            initialPrompt: 'initial1',
            converged: true,
            sampledDocIds: ['doc1'],
            improved: true,
          },
        ],
        timestamp: '2025-01-01T00:00:00.000Z',
        testModel: 'gpt-4',
        sampledDocIds: ['doc1', 'doc2'],
        sampledDocNames: {
          'doc1': 'contract1.pdf',
          'doc2': 'contract2.pdf',
        },
        startTime: 1704067200000,
        endTime: 1704067260000,
        estimatedTimeMs: 120000,
        actualTimeMs: 60000,
      };
      
      expect(pendingResults.runId).toBe('run-abc-123');
      expect(pendingResults.results.length).toBe(1);
      expect(pendingResults.testModel).toBe('gpt-4');
      expect(pendingResults.sampledDocNames?.['doc1']).toBe('contract1.pdf');
      expect(pendingResults.actualTimeMs).toBe(60000);
    });
  });

  describe('AgentAlphaIterationResult', () => {
    test('should contain iteration outcome data', () => {
      const iterationResult: AgentAlphaIterationResult = {
        newPrompt: 'Improved extraction prompt...',
        accuracy: 0.75,
        converged: false,
        failureExamples: [
          {
            docId: 'doc1',
            predicted: 'Wrong Value',
            expected: 'Correct Value',
          },
        ],
      };
      
      expect(iterationResult.newPrompt).toBe('Improved extraction prompt...');
      expect(iterationResult.accuracy).toBe(0.75);
      expect(iterationResult.converged).toBe(false);
      expect(iterationResult.failureExamples?.length).toBe(1);
    });

    test('should support converged result without failure examples', () => {
      const convergedResult: AgentAlphaIterationResult = {
        newPrompt: 'Perfect prompt',
        accuracy: 1.0,
        converged: true,
      };
      
      expect(convergedResult.converged).toBe(true);
      expect(convergedResult.accuracy).toBe(1.0);
      expect(convergedResult.failureExamples).toBeUndefined();
    });
  });
});

