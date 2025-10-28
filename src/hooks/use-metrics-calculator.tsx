/**
 * Custom hook for calculating accuracy metrics
 * Handles calculation of precision, recall, F1-score, and accuracy for each field and model
 */

import { useCallback } from 'react';
import { NOT_PRESENT_VALUE, findFieldValue } from '@/lib/utils';
import { calculateFieldMetricsWithDebug } from '@/lib/metrics';
import { getGroundTruthData } from '@/lib/mock-data';
import type { AccuracyData, ApiExtractionResult } from '@/lib/types';
import { extractConciseErrorDescription } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

interface UseMetricsCalculatorReturn {
  // Actions
  calculateAndUpdateMetrics: (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ) => AccuracyData;
}

// Import centralized constants
import { AVAILABLE_MODELS } from '@/lib/main-page-constants';

// UI Labels
const UI_LABELS = {
  GROUND_TRUTH: 'Ground Truth',
  PENDING_STATUS: 'Pending...',
  UNKNOWN_ERROR: 'Unknown error'
} as const;

export const useMetricsCalculator = (): UseMetricsCalculatorReturn => {
  const calculateAndUpdateMetrics = (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ): AccuracyData => {
    const refreshedGroundTruth = getGroundTruthData();
    const newData = JSON.parse(JSON.stringify(accuracyData));
    
    // Update results with API data and refreshed ground truth
    newData.results.forEach((fileResult: any) => {
      const fileApiResults = apiResults.filter(r => r.fileId === fileResult.id);
      
      fileResult.fields = Object.keys(fileResult.fields).reduce((acc: any, fieldKey) => {
        const fieldData: any = {};
        
        // Update ground truth from refreshed data
        const refreshedGroundTruthValue = refreshedGroundTruth[fileResult.id]?.groundTruth?.[fieldKey] || '';
        fieldData[UI_LABELS.GROUND_TRUTH] = refreshedGroundTruthValue;
        
        // Update model results from API
        AVAILABLE_MODELS.forEach(modelName => {
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
            fieldData[modelName] = UI_LABELS.PENDING_STATUS;
          }
        });
        
        acc[fieldKey] = fieldData;
        return acc;
      }, {});
    });
    
    // Calculate metrics for each field and model
    logger.debug('Calculating metrics for all fields');
    newData.fields.forEach((field: any) => {
      const fieldKey = field.key;
      logger.debug('Processing field for metrics', { fieldKey });
      
      AVAILABLE_MODELS.forEach(modelName => {
        const predictions = newData.results.map((fileResult: any) => 
          fileResult.fields[fieldKey]?.[modelName] || ''
        );
        const groundTruths = newData.results.map((fileResult: any) => 
          fileResult.fields[fieldKey]?.[UI_LABELS.GROUND_TRUTH] || ''
        );
        
        const result = calculateFieldMetricsWithDebug(predictions, groundTruths);
        
        logger.debug('Metrics calculated', {
          modelName,
          fieldKey,
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
        })
        
        // Store the calculated metrics in averages (to match hook structure)
        if (!newData.averages) {
          newData.averages = {};
        }
        if (!newData.averages[fieldKey]) {
          newData.averages[fieldKey] = {};
        }
        newData.averages[fieldKey][modelName] = {
          accuracy: result.accuracy,
          precision: result.precision,
          recall: result.recall,
          f1: result.f1Score
        };
      });
    });
    
    return newData;
  };

  return {
    calculateAndUpdateMetrics,
  };
}; 