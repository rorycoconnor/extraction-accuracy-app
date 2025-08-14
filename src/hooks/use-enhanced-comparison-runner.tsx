'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore, useCurrentSession } from '@/store/AccuracyDataStore';
import { useModelExtractionRunner } from '@/hooks/use-model-extraction-runner';
import { useGroundTruth } from '@/hooks/use-ground-truth';
import { useExtractionProgress } from '@/hooks/use-extraction-progress';
import { calculateFieldMetricsWithDebug } from '@/lib/metrics';
import { formatModelName, NOT_PRESENT_VALUE, findFieldValue } from '@/lib/utils';
import { 
  createExtractionSummaryMessage, 
  getErrorToastMessage,
  getExtractionSummary,
  extractConciseErrorDescription
} from '@/lib/error-handler';
import { getGroundTruthData, saveAccuracyData } from '@/lib/mock-data';
import { v4 as uuidv4 } from 'uuid';
import type { 
  AccuracyData, 
  BoxTemplate, 
  FileResult, 
  ModelAverages,
  ApiExtractionResult,
} from '@/lib/types';
import { useDataHandlers } from '@/hooks/use-data-handlers';

// Constants
const AVAILABLE_MODELS = [
  // Google Gemini Models
  'google__gemini_2_0_flash_001',
  'google__gemini_2_0_flash_001_no_prompt',
  'google__gemini_2_5_pro',
  'google__gemini_2_5_pro_no_prompt',

  // Enhanced Extract Agent
  'enhanced_extract_agent',
  'enhanced_extract_agent_no_prompt',

  // AWS Claude Models
  'aws__claude_3_7_sonnet',
  'aws__claude_3_7_sonnet_no_prompt',
  'aws__claude_4_sonnet',
  'aws__claude_4_sonnet_no_prompt',

  // Azure OpenAI Models (GPT)
  'azure__openai__gpt_4_1',
  'azure__openai__gpt_4_1_no_prompt',
  'azure__openai__gpt_4_1_mini',
  'azure__openai__gpt_4_1_mini_no_prompt',

  // OpenAI Models (Customer-enabled)
  'openai__o3',
  'openai__o3_no_prompt',
];

const UI_LABELS = {
  GROUND_TRUTH: 'Ground Truth',
  PENDING_STATUS: 'Pending...',
  UNKNOWN_ERROR: 'Unknown error',
  SUCCESS_VARIANT: 'success',
  DEFAULT_VARIANT: 'default',
} as const;

const TOAST_MESSAGES = {
  NO_DATA_TO_PROCESS: {
    title: 'No Data to Process',
    description: 'Please select documents and configure your template first.',
    variant: 'destructive' as const,
  },
  COMPARISON_STARTED: {
    title: 'Comparison Started',
    description: 'Running AI extraction across selected models...',
    variant: 'default' as const,
  },
} as const;

interface UseEnhancedComparisonRunnerReturn {
  handleRunComparison: () => Promise<void>;
  isExtracting: boolean;
  progress: { processed: number; total: number };
}

export const useEnhancedComparisonRunner = (
  selectedTemplate: BoxTemplate | null
): UseEnhancedComparisonRunnerReturn => {
  const { toast } = useToast();
  const { state, dispatch } = useAccuracyDataStore();
  const currentSession = useCurrentSession();
  const { runExtractions } = useModelExtractionRunner();
  const { refreshGroundTruth } = useGroundTruth();
  const { updatePromptVersionMetrics } = useDataHandlers({
    accuracyData: state.data,
    setAccuracyData: (data) => dispatch({ type: 'SET_ACCURACY_DATA', payload: data }),
    selectedCellForEdit: null,
    setSelectedCellForEdit: () => {},
    setIsInlineEditorOpen: () => {},
    setSelectedFieldForPromptStudio: () => {},
  });
  
  const {
    isExtracting,
    progress,
    detailedProgress,
    runIdRef,
    startExtraction,
    stopExtraction,
    updateProgress,
    updateDetailedProgress,
    resetProgress,
    isCurrentRun,
  } = useExtractionProgress();

  const handleRunComparison = useCallback(async () => {
    if (!state.data) {
      toast({
        title: TOAST_MESSAGES.NO_DATA_TO_PROCESS.title,
        description: TOAST_MESSAGES.NO_DATA_TO_PROCESS.description,
        variant: TOAST_MESSAGES.NO_DATA_TO_PROCESS.variant,
      });
      return;
    }

    const accuracyData = state.data;
    const shownColumns = accuracyData.shownColumns;

    // Start a new comparison run
    const runId = uuidv4();
    const currentRunId = ++runIdRef.current;

    // Create or ensure we have a session
    let sessionId = currentSession?.id;
    if (!sessionId) {
      sessionId = uuidv4();
      dispatch({
        type: 'CREATE_SESSION',
        payload: {
          name: `Session ${Date.now()}`,
          templateKey: accuracyData.templateKey,
          baseModel: accuracyData.baseModel
        }
      });
    }

    // Initialize progress tracking
    const extractionJobCount = accuracyData.results.length * AVAILABLE_MODELS.filter(model => shownColumns[model]).length;
    startExtraction(extractionJobCount);
    
    updateDetailedProgress({
      currentFile: '',
      currentFileName: '',
      currentModel: '',
      currentOperation: 'Starting extraction...',
      successful: 0,
      failed: 0,
      filesCompleted: [],
      modelsCompleted: [],
      startTime: new Date(),
      estimatedTimeRemaining: 0,
      lastUpdateTime: new Date()
    });

    // Mark the start of this comparison run
    dispatch({
      type: 'START_COMPARISON_RUN',
      payload: { sessionId, name: `Run ${Date.now()}` }
    });

    try {
      console.log('🚀 Starting enhanced extraction with versioning...');
      
      // Run extractions using the existing hook
      const apiResults = await runExtractions(
        accuracyData,
        selectedTemplate,
        shownColumns,
        (job, result) => {
          console.log(`📊 Progress update: ${job.modelName} for ${job.fileResult.fileName}`);
          
          updateProgress();
          
          updateDetailedProgress({
            currentFile: job.fileResult.id,
            currentFileName: job.fileResult.fileName,
            currentModel: job.modelName,
            currentOperation: `${result.success ? 'Completed' : 'Failed'} ${formatModelName(job.modelName)} extraction for ${job.fileResult.fileName}`,
            successful: result.success ? detailedProgress.successful + 1 : detailedProgress.successful,
            failed: result.success ? detailedProgress.failed : detailedProgress.failed + 1,
            filesCompleted: detailedProgress.filesCompleted.includes(job.fileResult.id) 
              ? detailedProgress.filesCompleted 
              : [...detailedProgress.filesCompleted, job.fileResult.id],
            modelsCompleted: [...detailedProgress.modelsCompleted, `${job.fileResult.id}-${job.modelName}`],
            lastUpdateTime: new Date()
          });
        }
      );

      console.log('✅ Extraction completed, processing results with versioning...');

      updateDetailedProgress({
        currentOperation: 'Calculating metrics...',
        lastUpdateTime: new Date()
      });
      
      // ❌ DISABLED: Auto-populate ground truth from premium model if available
      // This is now only done when user clicks "Copy to Ground Truth" button
      // if (selectedTemplate) {
      //   await autoPopulateGroundTruth(accuracyData, apiResults);
      // }
      
      // Process results with atomic updates to prevent overwrites
      await processExtractionResults(accuracyData, apiResults, runId, sessionId);
      
      stopExtraction();
      
      updateDetailedProgress({
        currentOperation: 'Completed',
        lastUpdateTime: new Date()
      });
      
      // Show detailed extraction summary
      const summaryMessage = createExtractionSummaryMessage(apiResults);
      toast({
        title: summaryMessage.title,
        description: summaryMessage.description,
        variant: summaryMessage.variant === UI_LABELS.SUCCESS_VARIANT ? UI_LABELS.DEFAULT_VARIANT : summaryMessage.variant,
      });
      
    } catch (error) {
      console.error('Enhanced extraction failed:', error);
      stopExtraction();
      
      updateDetailedProgress({
        currentOperation: 'Error',
        lastUpdateTime: new Date()
      });
      
      toast({
        title: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred during extraction',
        variant: 'destructive'
      });
    }
  }, [
    state.data,
    currentSession,
    selectedTemplate,
    dispatch,
    toast,
    runExtractions,
    refreshGroundTruth,
    isExtracting,
    startExtraction,
    stopExtraction,
    updateProgress,
    updateDetailedProgress,
    runIdRef,
    detailedProgress
  ]);

  // Helper function to process extraction results atomically
  const processExtractionResults = async (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[],
    runId: string,
    sessionId: string
  ) => {
    // Get fresh ground truth data to ensure we have the latest
    const refreshedGroundTruth = getGroundTruthData();
    
    // Create a deep copy to avoid mutations
    const processedResults: FileResult[] = JSON.parse(JSON.stringify(accuracyData.results));
    
    // Process each file result atomically
    processedResults.forEach((fileResult) => {
      const fileApiResults = apiResults.filter(r => r.fileId === fileResult.id);
      
      // Update fields for this file
      fileResult.fields = Object.keys(fileResult.fields).reduce((acc: any, fieldKey) => {
        const fieldData: any = {};
        
        // Always use the latest ground truth data - this prevents overwrites
        const refreshedGroundTruthValue = refreshedGroundTruth[fileResult.id]?.groundTruth?.[fieldKey] || '';
        fieldData[UI_LABELS.GROUND_TRUTH] = refreshedGroundTruthValue;
        
        // Update model results from API, preserving existing data for models not in this run
        AVAILABLE_MODELS.forEach(modelName => {
          const modelResult = fileApiResults.find(r => r.modelName === modelName);
          if (modelResult) {
            // This model was run in this comparison - update with new results
            if (modelResult.success) {
              // 🔧 Enhanced field value extraction with debugging
              const extractedValue = findFieldValue(modelResult.extractedMetadata as Record<string, any>, fieldKey);
              
              // Debug logging for troubleshooting
              if (extractedValue === undefined) {
                console.log(`🔍 Field "${fieldKey}" not found for ${modelName} in file ${fileResult.id}`);
                console.log(`📊 Available keys in response:`, Object.keys(modelResult.extractedMetadata as Record<string, any>));
                console.log(`📋 Full extracted metadata:`, modelResult.extractedMetadata);
              }
              
              if (extractedValue !== undefined && extractedValue !== null && extractedValue !== '') {
                fieldData[modelName] = String(extractedValue).trim();
              } else {
                fieldData[modelName] = NOT_PRESENT_VALUE;
              }
            } else {
              const errorMessage = modelResult.error?.userMessage || modelResult.error?.message || UI_LABELS.UNKNOWN_ERROR;
              const conciseError = extractConciseErrorDescription(errorMessage);
              fieldData[modelName] = `Error: ${conciseError}`;
            }
          } else {
            // This model was not run - preserve existing data
            const existingValue = fileResult.fields[fieldKey]?.[modelName];
            fieldData[modelName] = existingValue || UI_LABELS.PENDING_STATUS;
          }
        });
        
        acc[fieldKey] = fieldData;
        return acc;
      }, {});
    });
    
    // Calculate fresh metrics for all fields and models
    const newAverages: Record<string, ModelAverages> = {};
    
    accuracyData.fields.forEach((field) => {
      const fieldKey = field.key;
      const modelAvgs: ModelAverages = {};
      
      AVAILABLE_MODELS.forEach(modelName => {
        const predictions = processedResults.map((fileResult) => 
          fileResult.fields[fieldKey]?.[modelName] || ''
        );
        const groundTruths = processedResults.map((fileResult) => 
          fileResult.fields[fieldKey]?.[UI_LABELS.GROUND_TRUTH] || ''
        );
        
        const result = calculateFieldMetricsWithDebug(predictions, groundTruths);
        
        modelAvgs[modelName] = {
          accuracy: result.accuracy,
          precision: result.precision,
          recall: result.recall,
          f1: result.f1Score
        };
      });
      
      newAverages[fieldKey] = modelAvgs;
    });
    
    // 🆕 NEW: Update prompt version metrics for any recently saved prompts
    const updatedAccuracyDataWithMetrics = updatePromptVersionMetrics({
      ...accuracyData,
      results: processedResults,
      averages: newAverages
    });
    
    // Atomically update the store with the complete new state including metrics
    dispatch({
      type: 'COMPLETE_COMPARISON_RUN',
      payload: {
        runId,
        results: processedResults,
        averages: newAverages,
        apiResults
      }
    });
    
    // Update the main data with the metrics-enhanced version
    dispatch({
      type: 'SET_ACCURACY_DATA',
      payload: updatedAccuracyDataWithMetrics
    });
    
    console.log('✅ Results processed and stored with versioning');
  };

  return {
    handleRunComparison,
    isExtracting,
    progress,
  };
}; 