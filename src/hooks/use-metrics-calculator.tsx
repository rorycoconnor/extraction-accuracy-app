/**
 * Custom hook for calculating accuracy metrics
 * Handles calculation of precision, recall, F1-score, and accuracy for each field and model
 */

import { useCallback } from 'react';
import { NOT_PRESENT_VALUE, findFieldValue } from '@/lib/utils';
import { calculateFieldMetricsWithDebug, calculateFieldMetricsWithDebugAsync } from '@/lib/metrics';
import { getGroundTruthData } from '@/lib/mock-data';
import { getCompareConfigForField } from '@/lib/compare-type-storage';
import type { AccuracyData, ApiExtractionResult } from '@/lib/types';
import { validateEnumValue, validateMultiSelectValue } from '@/lib/enum-validator';
import { extractConciseErrorDescription } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

interface UseMetricsCalculatorReturn {
  // Actions
  calculateAndUpdateMetrics: (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ) => Promise<AccuracyData>;
}

// Import centralized constants
import { AVAILABLE_MODELS } from '@/lib/main-page-constants';

// UI Labels
const UI_LABELS = {
  GROUND_TRUTH: 'Ground Truth',
  PENDING_STATUS: 'Pending...',
  UNKNOWN_ERROR: 'Unknown error'
} as const;

const getActiveModelsForRun = (shownColumns: Record<string, boolean>) =>
  Object.entries(shownColumns)
    .filter(([modelName, isShown]) => modelName !== UI_LABELS.GROUND_TRUTH && isShown)
    .map(([modelName]) => modelName);

export const useMetricsCalculator = (): UseMetricsCalculatorReturn => {
  const calculateAndUpdateMetrics = async (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ): Promise<AccuracyData> => {
    const refreshedGroundTruth = getGroundTruthData();
    const newData = JSON.parse(JSON.stringify(accuracyData));
    const shownColumns = (accuracyData as AccuracyData & { shownColumns?: Record<string, boolean> }).shownColumns ?? {};
    const activeModels = getActiveModelsForRun(shownColumns);
    const modelsToProcess = activeModels.length > 0 ? activeModels : AVAILABLE_MODELS;
    
    // Update results with API data and refreshed ground truth
    newData.results.forEach((fileResult: any) => {
      const fileApiResults = apiResults.filter(r => r.fileId === fileResult.id);

      // Initialize comparisonResults if not present
      if (!fileResult.comparisonResults) {
        fileResult.comparisonResults = {};
      }

      fileResult.fields = Object.keys(fileResult.fields).reduce((acc: any, fieldKey) => {
        const existingFieldData = fileResult.fields[fieldKey] || {};
        const fieldData: any = { ...existingFieldData };

        // Initialize comparison results for this field
        if (!fileResult.comparisonResults[fieldKey]) {
          fileResult.comparisonResults[fieldKey] = {};
        }

        // Update ground truth from refreshed data
        const refreshedGroundTruthValue = refreshedGroundTruth[fileResult.id]?.groundTruth?.[fieldKey] || '';
        fieldData[UI_LABELS.GROUND_TRUTH] = refreshedGroundTruthValue;
        
        // Update model results from API
        modelsToProcess.forEach(modelName => {
          const modelResult = fileApiResults.find(r => r.modelName === modelName);
          if (modelResult) {
            if (modelResult.success) {
              // 🔧 Enhanced field value extraction with debugging
              const extractedValue = findFieldValue(modelResult.extractedMetadata as Record<string, any>, fieldKey);
              
              // Debug logging for troubleshooting
              if (extractedValue === undefined) {
                logger.debug('Field not found in extraction response', {
                  fieldKey,
                  modelName,
                  fileId: fileResult.id,
                  availableKeys: Object.keys(modelResult.extractedMetadata as Record<string, any>)
                });
              }
              
              if (extractedValue !== undefined && extractedValue !== null && extractedValue !== '') {
                let formattedValue = String(extractedValue).trim();
                
                // Validate enum/multiSelect fields against options
                const field = newData.fields.find(f => f.key === fieldKey);
                if (field) {
                  const fieldType = field.type;
                  const fieldOptions = field.options;
                  
                  if (fieldType === 'enum' && fieldOptions && fieldOptions.length > 0) {
                    // Validate single-select enum field
                    formattedValue = validateEnumValue(formattedValue, fieldOptions, fieldKey);
                  } else if (fieldType === 'multiSelect' && fieldOptions && fieldOptions.length > 0) {
                    // Validate multi-select field
                    formattedValue = validateMultiSelectValue(formattedValue, fieldOptions, fieldKey);
                  }
                }
                
                fieldData[modelName] = formattedValue;
              } else {
                fieldData[modelName] = NOT_PRESENT_VALUE;
              }
            } else {
              const errorMessage = modelResult.error?.userMessage || modelResult.error?.message || UI_LABELS.UNKNOWN_ERROR;
              const conciseError = extractConciseErrorDescription(errorMessage);
              fieldData[modelName] = `Error: ${conciseError}`;
            }
          } else {
            fieldData[modelName] = UI_LABELS.PENDING_STATUS;
          }
        });
        
        acc[fieldKey] = fieldData;
        return acc;
      }, {});
    });
    
    // Calculate metrics for each field and model (async)
    logger.debug('Calculating metrics for all fields');

    // Get template key for compare type lookup from accuracyData
    const templateKey = accuracyData.templateKey;

    // Process all fields sequentially (to handle async compare operations)
    for (const field of newData.fields) {
      const fieldKey = field.key;
      logger.debug('Processing field for metrics', { fieldKey });

      // Get compare config for this field
      const compareConfig = templateKey
        ? getCompareConfigForField(templateKey, fieldKey)
        : null;

      // Start console group for LLM judge comparisons
      if (compareConfig?.compareType === 'llm-judge') {
        console.group(`🤖 LLM Judge Comparisons: ${field.displayName || fieldKey}`);
      }

      if (!newData.averages) {
        newData.averages = {};
      }
      if (!newData.averages[fieldKey]) {
        newData.averages[fieldKey] = accuracyData.averages?.[fieldKey]
          ? { ...accuracyData.averages[fieldKey] }
          : {};
      }

      // Process only models that are active (fallback to all if none selected)
      for (const modelName of modelsToProcess) {
        const predictions = newData.results.map((fileResult: any) =>
          fileResult.fields[fieldKey]?.[modelName] || ''
        );
        const groundTruths = newData.results.map((fileResult: any) =>
          fileResult.fields[fieldKey]?.[UI_LABELS.GROUND_TRUTH] || ''
        );

        // Get file IDs for LLM judge comparisons
        const fileIds = newData.results.map((fileResult: any) => fileResult.id);

        // Use async version with compare config and file IDs
        const result = await calculateFieldMetricsWithDebugAsync(
          predictions,
          groundTruths,
          compareConfig || undefined,
          fileIds
        );

        logger.debug('Metrics calculated', {
          modelName,
          fieldKey,
          compareType: compareConfig?.compareType || 'legacy',
          f1: (result.f1Score * 100).toFixed(1) + '%',
          accuracy: (result.accuracy * 100).toFixed(1) + '%',
          precision: (result.precision * 100).toFixed(1) + '%',
          recall: (result.recall * 100).toFixed(1) + '%',
          counts: {
            truePositives: result.debug.truePositives,
            falsePositives: result.debug.falsePositives,
            falseNegatives: result.debug.falseNegatives,
            trueNegatives: result.debug.trueNegatives
          },
          examples: {
            truePositivesCount: result.debug.examples.truePositives.length,
            falsePositivesCount: result.debug.examples.falsePositives.length,
            falseNegativesCount: result.debug.examples.falseNegatives.length,
            trueNegativesCount: result.debug.examples.trueNegatives.length
          }
        });

        // Store the calculated metrics in averages (to match hook structure)
        newData.averages[fieldKey][modelName] = {
          accuracy: result.accuracy,
          precision: result.precision,
          recall: result.recall,
          f1: result.f1Score
        };

        // Store per-cell comparison results
        if (result.debug.comparisonResults && result.debug.comparisonResults.length > 0) {
          newData.results.forEach((fileResult: any, fileIndex: number) => {
            const comparisonResults = result.debug.comparisonResults;
            if (!comparisonResults) return;

            const comparisonResult = comparisonResults[fileIndex];
            if (comparisonResult) {
              // Ensure comparison results structure exists
              if (!fileResult.comparisonResults) {
                fileResult.comparisonResults = {};
              }
              if (!fileResult.comparisonResults[fieldKey]) {
                fileResult.comparisonResults[fieldKey] = {};
              }
              // Store the comparison result for this model
              fileResult.comparisonResults[fieldKey][modelName] = {
                isMatch: comparisonResult.isMatch,
                matchType: comparisonResult.matchType,
                confidence: comparisonResult.confidence,
                details: 'details' in comparisonResult ? comparisonResult.details : undefined,
                error: 'error' in comparisonResult ? comparisonResult.error : undefined
              };
            }
          });
        }
      }

      // Close console group for LLM judge comparisons
      if (compareConfig?.compareType === 'llm-judge') {
        console.groupEnd();
      }
    }

    return newData;
  };

  return {
    calculateAndUpdateMetrics,
  };
}; 
