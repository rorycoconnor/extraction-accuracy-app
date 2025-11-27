'use client';
import { logger } from '@/lib/logger';

import React, { createContext, useReducer, useContext, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AccuracyData, AccuracyField, ApiExtractionResult, FileResult, PromptVersion } from '@/lib/types';
import {
  OPTIMIZER_STEPS,
  type OptimizerDocumentTheory,
  type OptimizerFieldSummary,
  type OptimizerState,
} from '@/lib/optimizer-types';
import type { AgentAlphaState, AgentAlphaPendingResults } from '@/lib/agent-alpha-types';
import { saveAccuracyData, getAccuracyData } from '@/lib/mock-data';

// Enhanced types for our unified store
export interface ComparisonSession {
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
  templateKey: string;
  baseModel: string;
  runs: ComparisonRun[];
}

export interface ComparisonRun {
  id: string;
  sessionId: string;
  name: string;
  timestamp: string;
  promptVersions: Record<string, string>; // fieldKey -> promptVersionId
  results: FileResult[];
  averages: Record<string, any>;
  apiResults: ApiExtractionResult[];
  isActive: boolean; // The currently active/displayed run
}

export interface UnifiedAccuracyData extends AccuracyData {
  currentSessionId?: string;
  sessions: ComparisonSession[];
  shownColumns: Record<string, boolean>;
  lastModified: string;
}

// State interface
interface AccuracyDataState {
  data: UnifiedAccuracyData | null;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  optimizer: OptimizerState;
  agentAlpha: AgentAlphaState;
  agentAlphaPendingResults: AgentAlphaPendingResults | null;
}

// Action types
type AccuracyDataAction =
  | { type: 'LOAD_DATA_START' }
  | { type: 'LOAD_DATA_SUCCESS'; payload: UnifiedAccuracyData }
  | { type: 'LOAD_DATA_ERROR'; payload: string }
  | { type: 'SET_ACCURACY_DATA'; payload: AccuracyData }
  | { type: 'UPDATE_PROMPT'; payload: { fieldKey: string; newPrompt: string } }
  | { type: 'TOGGLE_COLUMN'; payload: string }
  | { type: 'SET_SHOWN_COLUMNS'; payload: Record<string, boolean> }
  | { type: 'CREATE_SESSION'; payload: { name: string; templateKey: string; baseModel: string } }
  | { type: 'START_COMPARISON_RUN'; payload: { sessionId: string; name?: string } }
  | { type: 'COMPLETE_COMPARISON_RUN'; payload: { runId: string; results: FileResult[]; averages: Record<string, any>; apiResults: ApiExtractionResult[] } }
  | { type: 'SET_ACTIVE_RUN'; payload: string }
  | { type: 'SAVE_PROMPT_VERSION'; payload: { fieldKey: string; prompt: string; metrics?: any } }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'MARK_SAVED' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'OPTIMIZER_START'; payload: { runId: string; autoRanComparison?: boolean } }
  | { type: 'OPTIMIZER_UPDATE'; payload: Partial<OptimizerState> }
  | { type: 'OPTIMIZER_COMPLETE'; payload: { sampledDocs: OptimizerDocumentTheory[]; fieldSummaries: OptimizerFieldSummary[] } }
  | { type: 'OPTIMIZER_FAIL'; payload: { error: string } }
  | { type: 'OPTIMIZER_RESET' }
  | { type: 'AGENT_ALPHA_CONFIGURE' }
  | { type: 'AGENT_ALPHA_START'; payload: { runId: string; selectedModel: string; totalFields: number; runtimeConfig?: import('@/lib/agent-alpha-config').AgentAlphaRuntimeConfig; actualDocCount?: number } }
  | { type: 'AGENT_ALPHA_UPDATE_PROGRESS'; payload: { currentField: string | null; currentFieldName: string | null; fieldsProcessed: number; currentIteration: number; currentAccuracy: number; processedFieldInfo?: import('@/lib/agent-alpha-types').ProcessedFieldInfo } }
  | { type: 'AGENT_ALPHA_FIELD_STARTED'; payload: import('@/lib/agent-alpha-types').ProcessingFieldInfo }
  | { type: 'AGENT_ALPHA_FIELD_COMPLETED'; payload: { fieldKey: string; processedFieldInfo: import('@/lib/agent-alpha-types').ProcessedFieldInfo } }
  | { type: 'AGENT_ALPHA_COMPLETE'; payload: AgentAlphaPendingResults }
  | { type: 'AGENT_ALPHA_ERROR'; payload: { error: string } }
  | { type: 'AGENT_ALPHA_APPLY_RESULTS' }
  | { type: 'AGENT_ALPHA_DISCARD_RESULTS' }
  | { type: 'AGENT_ALPHA_RESET' };

// Initial state
const initialOptimizerState: OptimizerState = {
  status: 'idle',
  stepIndex: 0,
  sampledDocs: [],
  fieldSummaries: [],
  runId: undefined,
};

const initialAgentAlphaState: AgentAlphaState = {
  status: 'idle',
  selectedModel: null,
  currentField: null,
  currentFieldName: null,
  currentIteration: 0,
  currentAccuracy: 0,
  fieldsProcessed: 0,
  totalFields: 0,
  runId: undefined,
  errorMessage: undefined,
  processedFields: [],
  processingFields: [],
  runtimeConfig: undefined,
};

const initialState: AccuracyDataState = {
  data: null,
  isLoading: false,
  error: null,
  hasUnsavedChanges: false,
  optimizer: initialOptimizerState,
  agentAlpha: initialAgentAlphaState,
  agentAlphaPendingResults: null,
};

// Helper function to create initial unified data structure
function createInitialUnifiedData(): UnifiedAccuracyData {
  const timestamp = new Date().toISOString();
  const defaultSessionId = uuidv4();
  
  // Create a default session so comparison runs have somewhere to save
  const defaultSession: ComparisonSession = {
    id: defaultSessionId,
    name: 'Default Session',
    createdAt: timestamp,
    lastModified: timestamp,
    templateKey: '',
    baseModel: '',
    runs: []
  };
  
  return {
    templateKey: '',
    baseModel: '',
    fields: [],
    results: [],
    averages: {},
    sessions: [defaultSession],
    currentSessionId: defaultSessionId,
    shownColumns: { 'Ground Truth': true },
    lastModified: timestamp,
  };
}

// Helper function to migrate legacy AccuracyData to UnifiedAccuracyData
function migrateToUnifiedData(legacyData: AccuracyData): UnifiedAccuracyData {
  const timestamp = new Date().toISOString();
  const sessionId = uuidv4();
  
  // Create initial session with existing data
  const initialSession: ComparisonSession = {
    id: sessionId,
    name: 'Legacy Data Session',
    createdAt: timestamp,
    lastModified: timestamp,
    templateKey: legacyData.templateKey,
    baseModel: legacyData.baseModel,
    runs: []
  };

  // If there are results, create an initial run
  if (legacyData.results.length > 0) {
    const initialRun: ComparisonRun = {
      id: uuidv4(),
      sessionId: sessionId,
      name: 'Initial Results',
      timestamp: timestamp,
      promptVersions: {},
      results: legacyData.results,
      averages: legacyData.averages,
      apiResults: [],
      isActive: true
    };
    
    initialSession.runs = [initialRun];
  }

  // 🔧 FIX: Preserve existing shownColumns if the data already has them
  // This prevents resetting selected models when saving prompts
  const preservedShownColumns = (legacyData as any).shownColumns || { 'Ground Truth': true };

  return {
    ...legacyData,
    currentSessionId: sessionId,
    sessions: [initialSession],
    shownColumns: preservedShownColumns,
    lastModified: timestamp,
  };
}

// Reducer function
function accuracyDataReducer(state: AccuracyDataState, action: AccuracyDataAction): AccuracyDataState {
  switch (action.type) {
    case 'LOAD_DATA_START':
      return { ...state, isLoading: true, error: null };

    case 'LOAD_DATA_SUCCESS':
      return { 
        ...state, 
        data: action.payload, 
        isLoading: false, 
        error: null,
        hasUnsavedChanges: false 
      };

    case 'LOAD_DATA_ERROR':
      return { ...state, isLoading: false, error: action.payload };

    case 'SET_ACCURACY_DATA': {
      // 🔧 FIX: Only migrate if we don't already have unified data
      // This prevents creating duplicate sessions when updating prompts
      const isAlreadyUnified = state.data && 'sessions' in state.data;
      
      if (isAlreadyUnified) {
        // If already unified, just update the core data while preserving structure
        const updatedData = {
          ...state.data!,
          ...action.payload,
          lastModified: new Date().toISOString()
        };
        
        // 🔧 SAFETY CHECK: Ensure there's always a currentSessionId and at least one session
        if (!updatedData.currentSessionId || updatedData.sessions.length === 0) {
          const timestamp = new Date().toISOString();
          const defaultSessionId = uuidv4();
          const defaultSession: ComparisonSession = {
            id: defaultSessionId,
            name: 'Default Session',
            createdAt: timestamp,
            lastModified: timestamp,
            templateKey: updatedData.templateKey || '',
            baseModel: updatedData.baseModel || '',
            runs: []
          };
          updatedData.sessions = [defaultSession];
          updatedData.currentSessionId = defaultSessionId;
        }
        
        return {
          ...state,
          data: updatedData,
          hasUnsavedChanges: true
        };
      } else {
        // First time migration
        const migratedData = migrateToUnifiedData(action.payload);
        return {
          ...state,
          data: migratedData,
          hasUnsavedChanges: true
        };
      }
    }

    case 'UPDATE_PROMPT': {
      if (!state.data) return state;
      
      const { fieldKey, newPrompt } = action.payload;
      const timestamp = new Date().toISOString();
      
      // Update the field's active prompt
      const updatedFields = state.data.fields.map(field =>
        field.key === fieldKey 
          ? { ...field, prompt: newPrompt }
          : field
      );

      // Create a new prompt version
      const promptVersionId = uuidv4();
      const updatedFieldsWithHistory = updatedFields.map(field => {
        if (field.key === fieldKey) {
          const newVersion: PromptVersion = {
            id: promptVersionId,
            prompt: newPrompt,
            savedAt: timestamp,
            isFavorite: false,
          };
          
          return {
            ...field,
            promptHistory: [...field.promptHistory, newVersion]
          };
        }
        return field;
      });

      return {
        ...state,
        data: {
          ...state.data,
          fields: updatedFieldsWithHistory,
          lastModified: timestamp
        },
        hasUnsavedChanges: true
      };
    }

    case 'TOGGLE_COLUMN': {
      if (!state.data) return state;
      
      return {
        ...state,
        data: {
          ...state.data,
          shownColumns: {
            ...state.data.shownColumns,
            [action.payload]: !state.data.shownColumns[action.payload]
          },
          lastModified: new Date().toISOString()
        },
        hasUnsavedChanges: true
      };
    }

    case 'SET_SHOWN_COLUMNS': {
      if (!state.data) return state;
      
      return {
        ...state,
        data: {
          ...state.data,
          shownColumns: action.payload,
          lastModified: new Date().toISOString()
        },
        hasUnsavedChanges: true
      };
    }

    case 'CREATE_SESSION': {
      if (!state.data) return state;
      
      const { name, templateKey, baseModel } = action.payload;
      const timestamp = new Date().toISOString();
      const sessionId = uuidv4();
      
      const newSession: ComparisonSession = {
        id: sessionId,
        name,
        createdAt: timestamp,
        lastModified: timestamp,
        templateKey,
        baseModel,
        runs: []
      };

      return {
        ...state,
        data: {
          ...state.data,
          currentSessionId: sessionId,
          sessions: [...state.data.sessions, newSession],
          lastModified: timestamp
        },
        hasUnsavedChanges: true
      };
    }

    case 'START_COMPARISON_RUN': {
      if (!state.data) return state;
      
      const { sessionId, name } = action.payload;
      const timestamp = new Date().toISOString();
      const runId = uuidv4();
      
      // Mark all other runs in the session as inactive
      const updatedSessions = state.data.sessions.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            runs: session.runs.map(run => ({ ...run, isActive: false })),
            lastModified: timestamp
          };
        }
        return session;
      });

      return {
        ...state,
        data: {
          ...state.data,
          sessions: updatedSessions,
          lastModified: timestamp
        },
        hasUnsavedChanges: true
      };
    }

    case 'COMPLETE_COMPARISON_RUN': {
      if (!state.data || !state.data.currentSessionId) return state;
      
      const { runId, results, averages, apiResults } = action.payload;
      const timestamp = new Date().toISOString();
      const currentData = state.data;
      
      // Update the current session with the new run
      const currentSession = currentData.sessions.find(s => s.id === currentData.currentSessionId);
      if (!currentSession) {
        logger.error('No matching session found for comparison run', {
          currentSessionId: currentData.currentSessionId,
          availableSessionCount: currentData.sessions.length
        });
        return state;
      }

      const newRun: ComparisonRun = {
        id: runId,
        sessionId: currentSession.id,
        name: `Run ${currentSession.runs.length + 1}`,
        timestamp,
        promptVersions: {}, // Will be populated with current prompt versions
        results,
        averages,
        apiResults,
        isActive: true
      };

      const updatedSessions = currentData.sessions.map(session => {
        if (session.id === currentSession.id) {
          return {
            ...session,
            runs: [
              ...session.runs.map(run => ({ ...run, isActive: false })),
              newRun
            ],
            lastModified: timestamp
          };
        }
        return session;
      });

      // Update the main data structure with the latest results
      return {
        ...state,
        data: {
          ...currentData,
          results,
          averages,
          sessions: updatedSessions,
          lastModified: timestamp
        },
        hasUnsavedChanges: true
      };
    }

    case 'CLEAR_RESULTS': {
      if (!state.data) return state;
      
      const timestamp = new Date().toISOString();
      
      // Optimized: Single pass to preserve fields and update sessions
      return {
        ...state,
        data: {
          ...state.data,
          fields: state.data.fields, // Fields are already immutable, no need to copy
          results: [], // Clear extraction results
          averages: {}, // Reset averages
          sessions: state.data.sessions.map(session => ({
            ...session,
            runs: session.runs.map(run => ({
              ...run,
              results: [],
              averages: {},
              apiResults: [],
              lastModified: timestamp
            }))
          })),
          lastModified: timestamp
        },
        hasUnsavedChanges: true
      };
    }

    case 'MARK_SAVED':
      return { ...state, hasUnsavedChanges: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'OPTIMIZER_START':
      return {
        ...state,
        optimizer: {
          status: 'precheck',
          stepIndex: 0,
          sampledDocs: [],
          fieldSummaries: [],
          startedAt: Date.now(),
          completedAt: undefined,
          autoRanComparison: action.payload.autoRanComparison ?? false,
          lastToast: undefined,
          errorMessage: undefined,
          runId: action.payload.runId,
        },
      };

    case 'OPTIMIZER_UPDATE':
      return {
        ...state,
        optimizer: {
          ...state.optimizer,
          ...action.payload,
        },
      };

    case 'OPTIMIZER_COMPLETE':
      return {
        ...state,
        optimizer: {
          ...state.optimizer,
          status: 'review',
          stepIndex: OPTIMIZER_STEPS.length - 1,
          sampledDocs: action.payload.sampledDocs,
          fieldSummaries: action.payload.fieldSummaries,
          completedAt: Date.now(),
          lastToast: action.payload.fieldSummaries.some(summary => summary.error)
            ? 'error'
            : 'success',
        },
      };

    case 'OPTIMIZER_FAIL':
      return {
        ...state,
        optimizer: {
          ...state.optimizer,
          status: 'error',
          errorMessage: action.payload.error,
          completedAt: Date.now(),
          lastToast: 'error',
        },
      };

    case 'OPTIMIZER_RESET':
      return {
        ...state,
        optimizer: initialOptimizerState,
      };

    case 'AGENT_ALPHA_CONFIGURE': {
      return {
        ...state,
        agentAlpha: {
          ...initialAgentAlphaState,
          status: 'configure',
        },
      };
    }

    case 'AGENT_ALPHA_START': {
      return {
        ...state,
        agentAlpha: {
          status: 'running',
          selectedModel: action.payload.selectedModel,
          currentField: null,
          currentFieldName: null,
          currentIteration: 0,
          currentAccuracy: 0,
          fieldsProcessed: 0,
          totalFields: action.payload.totalFields,
          startTime: Date.now(),
          runId: action.payload.runId,
          errorMessage: undefined,
          processedFields: [],
          processingFields: [],
          runtimeConfig: action.payload.runtimeConfig,
          actualDocCount: action.payload.actualDocCount,
        },
        agentAlphaPendingResults: null,
      };
    }

    case 'AGENT_ALPHA_FIELD_STARTED': {
      return {
        ...state,
        agentAlpha: {
          ...state.agentAlpha,
          processingFields: [...state.agentAlpha.processingFields, action.payload],
        },
      };
    }

    case 'AGENT_ALPHA_FIELD_COMPLETED': {
      const { fieldKey, processedFieldInfo } = action.payload;
      return {
        ...state,
        agentAlpha: {
          ...state.agentAlpha,
          processingFields: state.agentAlpha.processingFields.filter(f => f.fieldKey !== fieldKey),
          processedFields: [...state.agentAlpha.processedFields, processedFieldInfo],
          fieldsProcessed: state.agentAlpha.fieldsProcessed + 1,
        },
      };
    }

    case 'AGENT_ALPHA_UPDATE_PROGRESS': {
      const { processedFieldInfo, ...progressData } = action.payload;
      return {
        ...state,
        agentAlpha: {
          ...state.agentAlpha,
          ...progressData,
          status: 'running',
          processedFields: processedFieldInfo 
            ? [...state.agentAlpha.processedFields, processedFieldInfo]
            : state.agentAlpha.processedFields,
        },
      };
    }

    case 'AGENT_ALPHA_COMPLETE': {
      return {
        ...state,
        agentAlpha: {
          ...state.agentAlpha,
          status: 'preview',
          currentField: null,
          currentFieldName: null,
        },
        agentAlphaPendingResults: action.payload,
      };
    }

    case 'AGENT_ALPHA_ERROR': {
      return {
        ...state,
        agentAlpha: {
          ...state.agentAlpha,
          status: 'error',
          errorMessage: action.payload.error,
        },
      };
    }

    case 'AGENT_ALPHA_APPLY_RESULTS': {
      return {
        ...state,
        agentAlpha: initialAgentAlphaState,
        agentAlphaPendingResults: null,
      };
    }

    case 'AGENT_ALPHA_DISCARD_RESULTS': {
      return {
        ...state,
        agentAlpha: initialAgentAlphaState,
        agentAlphaPendingResults: null,
      };
    }

    case 'AGENT_ALPHA_RESET': {
      return {
        ...state,
        agentAlpha: initialAgentAlphaState,
        agentAlphaPendingResults: null,
      };
    }

    default:
      return state;
  }
}

// Context
const AccuracyDataContext = createContext<{
  state: AccuracyDataState;
  dispatch: React.Dispatch<AccuracyDataAction>;
} | undefined>(undefined);

// Provider component
export const AccuracyDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(accuracyDataReducer, initialState);

  // Load data on mount (client-side only)
  useEffect(() => {
    // Extra SSR guard - only run on client
    if (typeof window === 'undefined') {
      logger.debug('AccuracyDataProvider: Still on server, skipping load');
      return;
    }

    const loadData = async () => {
      dispatch({ type: 'LOAD_DATA_START' });
      
      try {
        const savedData = getAccuracyData();
        
        if (savedData) {
          // Check if it's already unified data or needs migration
          const unifiedData = 'sessions' in savedData 
            ? savedData as UnifiedAccuracyData
            : migrateToUnifiedData(savedData);
            
          dispatch({ type: 'LOAD_DATA_SUCCESS', payload: unifiedData });
        } else {
          // No saved data, create initial structure
          const initialData = createInitialUnifiedData();
          dispatch({ type: 'LOAD_DATA_SUCCESS', payload: initialData });
        }
      } catch (error) {
        dispatch({ 
          type: 'LOAD_DATA_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to load data' 
        });
      }
    };

    loadData();
  }, []);

  // Auto-save when data changes (debounced)
  useEffect(() => {
    if (state.data && state.hasUnsavedChanges) {
      const saveData = async () => {
        try {
          await saveAccuracyData(state.data);
          dispatch({ type: 'MARK_SAVED' });
        } catch (error) {
          logger.error('Failed to auto-save data', error instanceof Error ? error : { error });
        }
      };

      // Debounce saves to avoid excessive writes during rapid updates
      const timeoutId = setTimeout(saveData, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [state.data, state.hasUnsavedChanges]);

  const contextValue = useMemo(() => ({
    state,
    dispatch
  }), [state]);

  return (
    <AccuracyDataContext.Provider value={contextValue}>
      {children}
    </AccuracyDataContext.Provider>
  );
};

// Hook to use the store
export const useAccuracyDataStore = () => {
  const context = useContext(AccuracyDataContext);
  if (context === undefined) {
    throw new Error('useAccuracyDataStore must be used within an AccuracyDataProvider');
  }
  return context;
};

// Derived state selectors
export const useCurrentSession = () => {
  const { state } = useAccuracyDataStore();
  
  return useMemo(() => {
    if (!state.data?.currentSessionId) return null;
    const data = state.data;
    return data.sessions.find(s => s.id === data.currentSessionId) || null;
  }, [state.data]);
};

export const useActiveRun = () => {
  const currentSession = useCurrentSession();
  
  return useMemo(() => {
    if (!currentSession) return null;
    return currentSession.runs.find(run => run.isActive) || null;
  }, [currentSession]);
};

export const useAccuracyDataCompat = () => {
  const { state, dispatch } = useAccuracyDataStore();
  
  // Compatibility layer that mimics the old useAccuracyData hook interface
  return useMemo(() => {
    if (!state.data) return null;
    
    const data = state.data;
    return {
      accuracyData: data,
      shownColumns: data.shownColumns,
      setAccuracyData: (data: AccuracyData) => dispatch({ type: 'SET_ACCURACY_DATA', payload: data }),
      toggleColumn: (column: string) => dispatch({ type: 'TOGGLE_COLUMN', payload: column }),
      setShownColumns: (columns: Record<string, boolean>) => dispatch({ type: 'SET_SHOWN_COLUMNS', payload: columns }),
      updatePrompt: (fieldKey: string, newPrompt: string) => dispatch({ type: 'UPDATE_PROMPT', payload: { fieldKey, newPrompt } }),
      createSession: (name: string, templateKey: string, baseModel: string) => dispatch({ type: 'CREATE_SESSION', payload: { name, templateKey, baseModel } }),
      startComparisonRun: (sessionId: string, name?: string) => dispatch({ type: 'START_COMPARISON_RUN', payload: { sessionId, name } }),
      completeComparisonRun: (runId: string, results: FileResult[], averages: Record<string, any>, apiResults: ApiExtractionResult[]) => 
        dispatch({ type: 'COMPLETE_COMPARISON_RUN', payload: { runId, results, averages, apiResults } }),
      clearResults: () => dispatch({ type: 'CLEAR_RESULTS' }),
    };
  }, [state.data, dispatch]);
};

export const useOptimizerState = () => {
  const { state } = useAccuracyDataStore();
  return state.optimizer;
};
