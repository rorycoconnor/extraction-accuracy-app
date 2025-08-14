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

interface UseMetricsCalculatorReturn {
  // Actions
  calculateAndUpdateMetrics: (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ) => AccuracyData;
}

// Models supported by the Box AI extract_structured endpoint
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
            fieldData[modelName] = UI_LABELS.PENDING_STATUS;
          }
        });
        
        acc[fieldKey] = fieldData;
        return acc;
      }, {});
    });
    
    // Calculate metrics for each field and model
    console.log('\n=== CALCULATING METRICS ===');
    newData.fields.forEach((field: any) => {
      const fieldKey = field.key;
      console.log(`\n🔍 Processing field: ${fieldKey}`);
      
      AVAILABLE_MODELS.forEach(modelName => {
        const predictions = newData.results.map((fileResult: any) => 
          fileResult.fields[fieldKey]?.[modelName] || ''
        );
        const groundTruths = newData.results.map((fileResult: any) => 
          fileResult.fields[fieldKey]?.[UI_LABELS.GROUND_TRUTH] || ''
        );
        
        const result = calculateFieldMetricsWithDebug(predictions, groundTruths);
        
        console.log(`\n📊 ${modelName} - ${fieldKey}:`);
        console.log(`  Predictions: [${predictions.map((p: string) => `"${p}"`).join(', ')}]`);
        console.log(`  Ground Truth: [${groundTruths.map((g: string) => `"${g}"`).join(', ')}]`);
        console.log(`  📈 Metrics: F1=${(result.f1Score * 100).toFixed(1)}%, Acc=${(result.accuracy * 100).toFixed(1)}%, Prec=${(result.precision * 100).toFixed(1)}%, Rec=${(result.recall * 100).toFixed(1)}%`);
        console.log(`  🔢 Counts: TP=${result.debug.truePositives}, FP=${result.debug.falsePositives}, FN=${result.debug.falseNegatives}, TN=${result.debug.trueNegatives}`);
        
        if (result.debug.examples.truePositives.length > 0) {
          console.log(`  ✅ True Positives: ${result.debug.examples.truePositives.map(ex => `"${ex.predicted}" = "${ex.actual}"`).join(', ')}`);
        }
        if (result.debug.examples.falsePositives.length > 0) {
          console.log(`  ❌ False Positives: ${result.debug.examples.falsePositives.map(ex => `"${ex.predicted}" ≠ "${ex.actual}"`).join(', ')}`);
        }
        if (result.debug.examples.falseNegatives.length > 0) {
          console.log(`  ❌ False Negatives: ${result.debug.examples.falseNegatives.map(ex => `"${ex.predicted}" ≠ "${ex.actual}"`).join(', ')}`);
        }
        if (result.debug.examples.trueNegatives.length > 0) {
          console.log(`  ✅ True Negatives: ${result.debug.examples.trueNegatives.map(ex => `"${ex.predicted}" = "${ex.actual}"`).join(', ')}`);
        }
        
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