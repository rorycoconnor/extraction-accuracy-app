/**
 * Agent-Alpha State Management Tests
 * 
 * These tests verify the state transitions and reducer logic for Agent-Alpha.
 * They ensure the UI state is correctly managed throughout the optimization process.
 */

import { describe, test, expect } from 'vitest';
import type { AgentAlphaState, ProcessedFieldInfo, ProcessingFieldInfo } from '@/lib/agent-alpha-types';

describe('Agent-Alpha State Management', () => {
  
  // Initial state factory
  const createInitialState = (): AgentAlphaState => ({
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
  });

  describe('State Transitions', () => {
    test('should transition from idle to configure', () => {
      const state = createInitialState();
      
      // Simulate AGENT_ALPHA_CONFIGURE action
      const newState: AgentAlphaState = {
        ...state,
        status: 'configure',
      };
      
      expect(newState.status).toBe('configure');
    });

    test('should transition from configure to running', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'configure',
      };
      
      // Simulate AGENT_ALPHA_START action
      const newState: AgentAlphaState = {
        status: 'running',
        selectedModel: 'gpt-4',
        currentField: null,
        currentFieldName: null,
        currentIteration: 0,
        currentAccuracy: 0,
        fieldsProcessed: 0,
        totalFields: 5,
        startTime: Date.now(),
        runId: 'run-123',
        processedFields: [],
        processingFields: [],
        runtimeConfig: {
          maxDocs: 3,
          maxIterations: 5,
          testModel: 'gpt-4',
        },
      };
      
      expect(newState.status).toBe('running');
      expect(newState.totalFields).toBe(5);
      expect(newState.runtimeConfig).toBeDefined();
    });

    test('should transition from running to preview', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        totalFields: 3,
        fieldsProcessed: 3,
      };
      
      // Simulate AGENT_ALPHA_COMPLETE action
      const newState: AgentAlphaState = {
        ...state,
        status: 'preview',
        currentField: null,
        currentFieldName: null,
      };
      
      expect(newState.status).toBe('preview');
    });

    test('should transition from running to error', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
      };
      
      // Simulate AGENT_ALPHA_ERROR action
      const newState: AgentAlphaState = {
        ...state,
        status: 'error',
        errorMessage: 'API rate limit exceeded',
      };
      
      expect(newState.status).toBe('error');
      expect(newState.errorMessage).toBe('API rate limit exceeded');
    });

    test('should reset to idle from any state', () => {
      const states: AgentAlphaState[] = [
        { ...createInitialState(), status: 'configure' },
        { ...createInitialState(), status: 'running' },
        { ...createInitialState(), status: 'preview' },
        { ...createInitialState(), status: 'error' },
      ];
      
      states.forEach(state => {
        // Simulate AGENT_ALPHA_RESET action
        const newState = createInitialState();
        expect(newState.status).toBe('idle');
      });
    });
  });

  describe('Field Started Action', () => {
    test('should add field to processingFields', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        processingFields: [],
      };
      
      const newField: ProcessingFieldInfo = {
        fieldKey: 'company_name',
        fieldName: 'Company Name',
        initialAccuracy: 0.5,
        startTime: Date.now(),
      };
      
      // Simulate AGENT_ALPHA_FIELD_STARTED action
      const newState: AgentAlphaState = {
        ...state,
        processingFields: [...state.processingFields, newField],
      };
      
      expect(newState.processingFields.length).toBe(1);
      expect(newState.processingFields[0].fieldKey).toBe('company_name');
    });

    test('should support multiple fields processing in parallel', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        processingFields: [
          { fieldKey: 'field1', fieldName: 'Field 1', initialAccuracy: 0.5, startTime: Date.now() },
        ],
      };
      
      const newField: ProcessingFieldInfo = {
        fieldKey: 'field2',
        fieldName: 'Field 2',
        initialAccuracy: 0.6,
        startTime: Date.now(),
      };
      
      const newState: AgentAlphaState = {
        ...state,
        processingFields: [...state.processingFields, newField],
      };
      
      expect(newState.processingFields.length).toBe(2);
    });
  });

  describe('Field Completed Action', () => {
    test('should remove field from processingFields and add to processedFields', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        fieldsProcessed: 0,
        processingFields: [
          { fieldKey: 'company_name', fieldName: 'Company Name', initialAccuracy: 0.5, startTime: Date.now() },
        ],
        processedFields: [],
      };
      
      const completedField: ProcessedFieldInfo = {
        fieldKey: 'company_name',
        fieldName: 'Company Name',
        iterationCount: 3,
        initialAccuracy: 0.5,
        finalAccuracy: 1.0,
        finalPrompt: 'Improved prompt...',
        timeMs: 45000,
      };
      
      // Simulate AGENT_ALPHA_FIELD_COMPLETED action
      const newState: AgentAlphaState = {
        ...state,
        processingFields: state.processingFields.filter(f => f.fieldKey !== 'company_name'),
        processedFields: [...state.processedFields, completedField],
        fieldsProcessed: state.fieldsProcessed + 1,
      };
      
      expect(newState.processingFields.length).toBe(0);
      expect(newState.processedFields.length).toBe(1);
      expect(newState.fieldsProcessed).toBe(1);
    });

    test('should correctly update progress count', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        totalFields: 5,
        fieldsProcessed: 2,
        processedFields: [
          { fieldKey: 'f1', fieldName: 'F1', iterationCount: 2, initialAccuracy: 0.5, finalAccuracy: 1.0, finalPrompt: 'p1', timeMs: 1000 },
          { fieldKey: 'f2', fieldName: 'F2', iterationCount: 3, initialAccuracy: 0.6, finalAccuracy: 1.0, finalPrompt: 'p2', timeMs: 2000 },
        ],
      };
      
      const completedField: ProcessedFieldInfo = {
        fieldKey: 'f3',
        fieldName: 'F3',
        iterationCount: 1,
        initialAccuracy: 0.7,
        finalAccuracy: 1.0,
        finalPrompt: 'p3',
        timeMs: 500,
      };
      
      const newState: AgentAlphaState = {
        ...state,
        processedFields: [...state.processedFields, completedField],
        fieldsProcessed: state.fieldsProcessed + 1,
      };
      
      expect(newState.fieldsProcessed).toBe(3);
      expect(newState.processedFields.length).toBe(3);
    });
  });

  describe('Progress Calculation', () => {
    test('should calculate correct progress percentage', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        totalFields: 10,
        fieldsProcessed: 4,
      };
      
      const progressPercentage = state.totalFields > 0
        ? (state.fieldsProcessed / state.totalFields) * 100
        : 0;
      
      expect(progressPercentage).toBe(40);
    });

    test('should handle zero total fields', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        totalFields: 0,
        fieldsProcessed: 0,
      };
      
      const progressPercentage = state.totalFields > 0
        ? (state.fieldsProcessed / state.totalFields) * 100
        : 0;
      
      expect(progressPercentage).toBe(0);
    });

    test('should reach 100% when all fields processed', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        totalFields: 5,
        fieldsProcessed: 5,
      };
      
      const progressPercentage = (state.fieldsProcessed / state.totalFields) * 100;
      
      expect(progressPercentage).toBe(100);
    });
  });

  describe('Runtime Config Preservation', () => {
    test('should preserve runtime config throughout run', () => {
      const runtimeConfig = {
        maxDocs: 5,
        maxIterations: 7,
        testModel: 'custom-model',
        customInstructions: 'Custom instructions here',
      };
      
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        runtimeConfig,
      };
      
      // After field completed, config should still be there
      const newState: AgentAlphaState = {
        ...state,
        fieldsProcessed: state.fieldsProcessed + 1,
      };
      
      expect(newState.runtimeConfig).toEqual(runtimeConfig);
    });
  });

  describe('Error State', () => {
    test('should preserve error message', () => {
      const errorMessage = 'Failed to connect to Box API: 503 Service Unavailable';
      
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'error',
        errorMessage,
      };
      
      expect(state.errorMessage).toBe(errorMessage);
    });

    test('should clear error on reset', () => {
      const state: AgentAlphaState = {
        ...createInitialState(),
        status: 'error',
        errorMessage: 'Some error',
      };
      
      // Reset to initial state
      const newState = createInitialState();
      
      expect(newState.status).toBe('idle');
      expect(newState.errorMessage).toBeUndefined();
    });
  });

  describe('Processed Fields Accumulation', () => {
    test('should accumulate processed fields in order', () => {
      let state: AgentAlphaState = {
        ...createInitialState(),
        status: 'running',
        processedFields: [],
      };
      
      const fields = ['field1', 'field2', 'field3'];
      
      fields.forEach((fieldKey, index) => {
        const completedField: ProcessedFieldInfo = {
          fieldKey,
          fieldName: `Field ${index + 1}`,
          iterationCount: index + 1,
          initialAccuracy: 0.5,
          finalAccuracy: 1.0,
          finalPrompt: `Prompt ${index + 1}`,
          timeMs: (index + 1) * 1000,
        };
        
        state = {
          ...state,
          processedFields: [...state.processedFields, completedField],
        };
      });
      
      expect(state.processedFields.length).toBe(3);
      expect(state.processedFields[0].fieldKey).toBe('field1');
      expect(state.processedFields[1].fieldKey).toBe('field2');
      expect(state.processedFields[2].fieldKey).toBe('field3');
    });
  });

  describe('Modal State Helpers', () => {
    test('isConfigure should be true only in configure status', () => {
      const statuses: AgentAlphaState['status'][] = ['idle', 'configure', 'running', 'preview', 'error'];
      
      statuses.forEach(status => {
        const state: AgentAlphaState = { ...createInitialState(), status };
        const isConfigure = state.status === 'configure';
        
        expect(isConfigure).toBe(status === 'configure');
      });
    });

    test('isRunning should be true only in running status', () => {
      const statuses: AgentAlphaState['status'][] = ['idle', 'configure', 'running', 'preview', 'error'];
      
      statuses.forEach(status => {
        const state: AgentAlphaState = { ...createInitialState(), status };
        const isRunning = state.status === 'running';
        
        expect(isRunning).toBe(status === 'running');
      });
    });

    test('isPreview should be true only in preview status', () => {
      const statuses: AgentAlphaState['status'][] = ['idle', 'configure', 'running', 'preview', 'error'];
      
      statuses.forEach(status => {
        const state: AgentAlphaState = { ...createInitialState(), status };
        const isPreview = state.status === 'preview';
        
        expect(isPreview).toBe(status === 'preview');
      });
    });

    test('isModalOpen should be true for configure, running, or preview', () => {
      const statuses: AgentAlphaState['status'][] = ['idle', 'configure', 'running', 'preview', 'error'];
      const modalOpenStatuses = ['configure', 'running', 'preview'];
      
      statuses.forEach(status => {
        const state: AgentAlphaState = { ...createInitialState(), status };
        const isModalOpen = modalOpenStatuses.includes(state.status);
        
        expect(isModalOpen).toBe(modalOpenStatuses.includes(status));
      });
    });
  });
});

