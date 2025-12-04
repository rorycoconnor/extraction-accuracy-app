'use client';

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore, useCurrentSession } from '@/store/AccuracyDataStore';
import { useModelExtractionRunner } from '@/hooks/use-model-extraction-runner';
import { useGroundTruth } from '@/hooks/use-ground-truth';
import { useExtractionProgress } from '@/hooks/use-extraction-progress';
import { calculateFieldMetricsWithDebug, calculateFieldMetricsWithDebugAsync } from '@/lib/metrics';
import { getCompareConfigForField } from '@/lib/compare-type-storage';
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
  AccuracyField,
  BoxTemplate, 
  FileResult, 
  ModelAverages,
  ApiExtractionResult,
} from '@/lib/types';
import { useDataHandlers } from '@/hooks/use-data-handlers';
import { logger } from '@/lib/logger';
import { validateEnumValue, validateMultiSelectValue } from '@/lib/enum-validator';

// Import centralized constants

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

const getActiveModelsForRun = (shownColumns: Record<string, boolean>) =>
  Object.entries(shownColumns)
    .filter(([modelName, isShown]) => modelName !== UI_LABELS.GROUND_TRUTH && isShown)
    .map(([modelName]) => modelName);

interface UseEnhancedComparisonRunnerReturn {
  handleRunComparison: () => Promise<void>;
  isExtracting: boolean;
  progress: { processed: number; total: number };
  isJudging: boolean;
}

export const useEnhancedComparisonRunner = (
  selectedTemplate: BoxTemplate | null
): UseEnhancedComparisonRunnerReturn => {
  const [isJudging, setIsJudging] = useState(false);
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
  
  // Use a ref to track the latest data during extraction for real-time updates
  const currentDataRef = useRef<AccuracyData | null>(null);

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
    const activeModelsForRun = getActiveModelsForRun(shownColumns);

    if (activeModelsForRun.length === 0) {
      toast({
        title: TOAST_MESSAGES.NO_DATA_TO_PROCESS.title,
        description: 'Please enable at least one model column before running a comparison.',
        variant: TOAST_MESSAGES.NO_DATA_TO_PROCESS.variant,
      });
      return;
    }
    
    // Initialize ref with current data
    currentDataRef.current = accuracyData;
    setIsJudging(false);

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
    const extractionJobCount = accuracyData.results.length * activeModelsForRun.length;
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
      logger.info('Starting enhanced extraction with versioning');
      
      // Run extractions using the existing hook
      const apiResults = await runExtractions(
        accuracyData,
        selectedTemplate,
        shownColumns,
        (job, result) => {
          logger.debug('Progress update', { 
            modelName: job.modelName, 
            fileName: job.fileResult.fileName,
            success: result.success
          });
          
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
          
          // 🎨 Real-time update: Process this single result and dispatch to trigger UI updates
          if (currentDataRef.current) {
            const updatedData = processSingleResult(currentDataRef.current, job, result);
            currentDataRef.current = updatedData; // Update ref for next iteration

            // ✅ Dispatch to store to trigger real-time UI updates
            dispatch({
              type: 'SET_ACCURACY_DATA',
              payload: updatedData
            });
          }
        }
      );

      logger.info('Extraction completed, processing results with versioning');

      updateDetailedProgress({
        currentOperation: 'Calculating metrics...',
        lastUpdateTime: new Date()
      });
      setIsJudging(true);
      
      // ❌ DISABLED: Auto-populate ground truth from premium model if available
      // This is now only done when user clicks "Copy to Ground Truth" button
      // if (selectedTemplate) {
      //   await autoPopulateGroundTruth(accuracyData, apiResults);
      // }
      
      // Process results with atomic updates to prevent overwrites
      await processExtractionResults(accuracyData, apiResults, runId, sessionId, activeModelsForRun);
      setIsJudging(false);

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
      logger.error('Enhanced extraction failed', error instanceof Error ? error : { error });
      setIsJudging(false);
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

  /**
   * Formats multi-select field values by adding spaces after commas
   */
  const formatMultiSelectValue = (value: string): string => {
    if (!value || typeof value !== 'string') return value;
    
    // Check if it's a comma-separated list without proper spacing
    if (value.includes(',') && !value.includes(', ')) {
      // Split by comma, trim each value, and rejoin with proper spacing
      return value.split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0) // Remove any empty items
        .join(', ');
    }
    
    return value;
  };

  /**
   * Checks if a field is a multi-select type based on various indicators
   */
  const isMultiSelectField = (field: AccuracyField, fieldKey: string): boolean => {
    // Check various field type indicators
    const fieldType = field.type;
    
    // Direct multiSelect type check (from Box API types)
    if (fieldType === 'multiSelect') return true;
    
    // UI field types that map to multiSelect
    if (fieldType === 'dropdown_multi' || fieldType === 'taxonomy') return true;
    
    // Fallback: Check if field name suggests multi-select
    const fieldName = (field.name || fieldKey).toLowerCase();
    if (fieldName.includes('multi') || fieldName.includes('dropdown') || fieldName.includes('select')) return true;
    
    return false;
  };

  // Helper function to process a single extraction result in real-time
  const processSingleResult = (
    currentData: AccuracyData,
    job: { fileResult: FileResult; modelName: string },
    result: ApiExtractionResult
  ): AccuracyData => {
    // Create a deep copy to avoid mutations
    const updatedData = JSON.parse(JSON.stringify(currentData)) as AccuracyData;
    
    // Find the file result to update
    const fileResult = updatedData.results.find(r => r.id === job.fileResult.id);
    if (!fileResult) return updatedData;
    
    // Get fresh ground truth data
    const refreshedGroundTruth = getGroundTruthData();
    
    // Update each field for this file/model combination
    Object.keys(fileResult.fields).forEach(fieldKey => {
      // Initialize field data if it doesn't exist
      if (!fileResult.fields[fieldKey]) {
        fileResult.fields[fieldKey] = {};
      }
      
      // Ensure ground truth is preserved
      const refreshedGroundTruthValue = refreshedGroundTruth[fileResult.id]?.groundTruth?.[fieldKey] || 
                                        fileResult.fields[fieldKey][UI_LABELS.GROUND_TRUTH] || '';
      fileResult.fields[fieldKey][UI_LABELS.GROUND_TRUTH] = refreshedGroundTruthValue;
      
      // Update ONLY this specific model's result (preserve all other models)
      if (result.success) {
        const extractedValue = findFieldValue(result.extractedMetadata as Record<string, any>, fieldKey);
        
        if (extractedValue !== undefined && extractedValue !== null && extractedValue !== '') {
          let formattedValue = String(extractedValue).trim();
          
          // Check if this is a multi-select field and format accordingly
          const field = updatedData.fields.find(f => f.key === fieldKey);
          
          // Validate enum/multiSelect fields against options
          if (field) {
            const fieldType = field.type;
            const fieldOptions = field.options;
            
            if (fieldType === 'enum' && fieldOptions && fieldOptions.length > 0) {
              // Validate single-select enum field
              formattedValue = validateEnumValue(formattedValue, fieldOptions, fieldKey);
              logger.debug('Validated enum field', { fieldKey, original: extractedValue, validated: formattedValue });
            } else if ((fieldType === 'multiSelect' || isMultiSelectField(field, fieldKey)) && fieldOptions && fieldOptions.length > 0) {
              // Validate multi-select field
              formattedValue = validateMultiSelectValue(formattedValue, fieldOptions, fieldKey);
              logger.debug('Validated multiSelect field', { fieldKey, original: extractedValue, validated: formattedValue });
            } else if (isMultiSelectField(field, fieldKey)) {
              // Format multi-select without validation (no options available)
              formattedValue = formatMultiSelectValue(formattedValue);
            }
          }
          
          fileResult.fields[fieldKey][job.modelName] = formattedValue;
        } else {
          fileResult.fields[fieldKey][job.modelName] = NOT_PRESENT_VALUE;
        }
      } else {
        const errorMessage = result.error?.userMessage || result.error?.message || UI_LABELS.UNKNOWN_ERROR;
        const conciseError = extractConciseErrorDescription(errorMessage);
        fileResult.fields[fieldKey][job.modelName] = `Error: ${conciseError}`;
      }
    });
    
    return updatedData;
  };

  // Helper function to process extraction results atomically
  const processExtractionResults = async (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[],
    runId: string,
    sessionId: string,
    activeModelsForRun: string[]
  ) => {
    // Get fresh ground truth data to ensure we have the latest
    const refreshedGroundTruth = getGroundTruthData();
    
    // Create a deep copy to avoid mutations
    const processedResults: FileResult[] = JSON.parse(JSON.stringify(accuracyData.results));
    
    const activeModelSet = new Set(activeModelsForRun);

    // Process each file result atomically
    processedResults.forEach((fileResult) => {
      const fileApiResults = apiResults.filter(r => r.fileId === fileResult.id);
      const previousFields = fileResult.fields;
      
      // Update fields for this file
      fileResult.fields = Object.keys(previousFields).reduce((acc: any, fieldKey) => {
        const existingFieldData = previousFields[fieldKey] || {};
        const fieldData: any = { ...existingFieldData };
        
        // Always use the latest ground truth data - this prevents overwrites
        const refreshedGroundTruthValue = refreshedGroundTruth[fileResult.id]?.groundTruth?.[fieldKey] || '';
        fieldData[UI_LABELS.GROUND_TRUTH] = refreshedGroundTruthValue;
        
        // Update only the models that actually participated in this run
        fileApiResults.forEach(modelResult => {
          if (!activeModelSet.has(modelResult.modelName)) {
            return;
          }

          if (modelResult.success) {
            const extractedValue = findFieldValue(modelResult.extractedMetadata as Record<string, any>, fieldKey);
            
            // Store extraction confidence score if available
            if (modelResult.confidenceScores) {
              const confidenceScore = findFieldValue(modelResult.confidenceScores as Record<string, any>, fieldKey);
              if (confidenceScore !== undefined && typeof confidenceScore === 'number') {
                // Initialize comparisonResults structure if needed
                if (!fileResult.comparisonResults) {
                  fileResult.comparisonResults = {};
                }
                if (!fileResult.comparisonResults[fieldKey]) {
                  fileResult.comparisonResults[fieldKey] = {};
                }
                if (!fileResult.comparisonResults[fieldKey][modelResult.modelName]) {
                  fileResult.comparisonResults[fieldKey][modelResult.modelName] = {
                    isMatch: false,
                    matchType: 'pending',
                    confidence: 'medium'
                  };
                }
                fileResult.comparisonResults[fieldKey][modelResult.modelName].extractionConfidence = confidenceScore;
              }
            }
            
            if (extractedValue === undefined) {
              logger.debug('Field not found in extraction response', {
                fieldKey,
                modelName: modelResult.modelName,
                fileId: fileResult.id,
                availableKeys: Object.keys(modelResult.extractedMetadata as Record<string, any>)
              });
            }
            
            if (extractedValue !== undefined && extractedValue !== null && extractedValue !== '') {
              let formattedValue = String(extractedValue).trim();
              
              const field = accuracyData.fields.find(f => f.key === fieldKey);
              if (field && isMultiSelectField(field, fieldKey)) {
                formattedValue = formatMultiSelectValue(formattedValue);
                logger.debug('Formatted multi-select value', {
                  fieldKey,
                  original: extractedValue,
                  formatted: formattedValue
                });
              }
              
              fieldData[modelResult.modelName] = formattedValue;
            } else {
              fieldData[modelResult.modelName] = NOT_PRESENT_VALUE;
            }
          } else {
            const errorMessage = modelResult.error?.userMessage || modelResult.error?.message || UI_LABELS.UNKNOWN_ERROR;
            const conciseError = extractConciseErrorDescription(errorMessage);
            fieldData[modelResult.modelName] = `Error: ${conciseError}`;
          }
        });
        
        acc[fieldKey] = fieldData;
        return acc;
      }, {});
    });
    
    // Calculate fresh metrics for all fields and models (async with compare types)
    const newAverages: Record<string, ModelAverages> = {};

    // Get template key for compare type lookup from accuracyData
    const templateKey = accuracyData.templateKey;

    // Process fields sequentially to handle async compare operations
    for (const field of accuracyData.fields) {
      const fieldKey = field.key;
      const previousModelAverages = accuracyData.averages?.[fieldKey] || {};
      const modelAvgs: ModelAverages = { ...previousModelAverages };
      const fileIds = processedResults.map((fileResult) => fileResult.id);

      // Get compare config for this field
      let compareConfig = templateKey
        ? getCompareConfigForField(templateKey, fieldKey)
        : null;

      // IMPORTANT: Override LLM-judge to prevent it from being used in Run Comparison
      // LLM-judge should only be used in the Optimizer flow (DSPy Alpha)
      if (compareConfig && compareConfig.compareType === 'llm-judge') {
        logger.debug('Overriding llm-judge with near-exact-string for Run Comparison', { fieldKey });
        compareConfig = {
          ...compareConfig,
          compareType: 'near-exact-string'
        };
      }

      // Process only the models that were active for this run
      for (const modelName of activeModelsForRun) {
        const predictions = processedResults.map((fileResult) =>
          fileResult.fields[fieldKey]?.[modelName] || ''
        );
        const groundTruths = processedResults.map((fileResult) =>
          fileResult.fields[fieldKey]?.[UI_LABELS.GROUND_TRUTH] || ''
        );

        // Use async version with compare config
        const result = await calculateFieldMetricsWithDebugAsync(
          predictions,
          groundTruths,
          compareConfig || undefined,
          fileIds
        );

        modelAvgs[modelName] = {
          accuracy: result.accuracy,
          precision: result.precision,
          recall: result.recall,
          f1: result.f1Score
        };

        // Persist per-cell comparison metadata so the UI can show LLM judge reasoning
        if (result.debug.comparisonResults && result.debug.comparisonResults.length > 0) {
          processedResults.forEach((fileResult, fileIndex) => {
            const comparisonResult = result.debug.comparisonResults?.[fileIndex];
            if (!comparisonResult) {
              return;
            }

            if (!fileResult.comparisonResults) {
              fileResult.comparisonResults = {};
            }
            if (!fileResult.comparisonResults[fieldKey]) {
              fileResult.comparisonResults[fieldKey] = {};
            }

            // Preserve existing extractionConfidence if it was set during extraction
            const existingExtractionConfidence = fileResult.comparisonResults[fieldKey][modelName]?.extractionConfidence;

            fileResult.comparisonResults[fieldKey][modelName] = {
              isMatch: comparisonResult.isMatch,
              matchType: comparisonResult.matchType || (compareConfig?.compareType ?? 'near-exact-string'),
              confidence: comparisonResult.confidence || 'medium',
              details: 'details' in comparisonResult ? comparisonResult.details : undefined,
              error: 'error' in comparisonResult ? comparisonResult.error : undefined,
              extractionConfidence: existingExtractionConfidence,
            };
          });
        }
      }

      newAverages[fieldKey] = modelAvgs;
    }
    
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
    
    logger.info('Results processed and stored with versioning');
  };

  return {
    handleRunComparison,
    isExtracting,
    progress,
    isJudging,
  };
}; 
