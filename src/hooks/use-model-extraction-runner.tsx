/**
 * Custom hook for managing model extraction operations
 * Handles parallel processing of multiple files and models with error handling
 */

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { extractMetadata } from '@/ai/flows/metadata-extraction';
import { formatModelName } from '@/lib/utils';
import { 
  executeExtractionWithRetry, 
  createExtractionSummaryMessage 
} from '@/lib/error-handler';
import { processWithConcurrency } from '@/lib/concurrency';
import type { 
  AccuracyData, 
  BoxTemplate, 
  FileResult, 
  ApiExtractionResult 
} from '@/lib/types';
import { FIELD_TYPE_MAPPING } from '@/features/prompt-library/types';
import { extractionLogger } from '@/lib/logger';
import { DUAL_SYSTEM, prepareFieldsForModel, getFieldPreparationInfo } from '@/lib/dual-system-utils';

interface ExtractionJob {
  fileResult: FileResult;
  modelName: string;
}

interface UseModelExtractionRunnerReturn {
  // State
  apiDebugData: ApiExtractionResult[] | null;
  apiRequestDebugData: any;
  
  // Actions
  runExtractions: (
    accuracyData: AccuracyData,
    selectedTemplate: BoxTemplate | null,
    shownColumns: Record<string, boolean>,
    onProgressUpdate: (job: ExtractionJob, result: ApiExtractionResult) => void
  ) => Promise<ApiExtractionResult[]>;
}

// Field Types
const FIELD_TYPES = {
  DATE: 'date',
  ENUM: 'enum',
  MULTISELECT: 'multiSelect',
  STRING: 'string',
  FILE: 'file'
} as const;

// Import centralized constants
import { AVAILABLE_MODELS, UI_LABELS } from '@/lib/main-page-constants';

/**
 * Generate default enum options for common contract fields
 */
function getDefaultEnumOptions(fieldKey: string, fieldName: string): { key: string }[] {
  const lowerKey = fieldKey.toLowerCase();
  const lowerName = fieldName.toLowerCase();
  
  if (lowerKey.includes('contract_type') || lowerName.includes('contract type')) {
    return [
      { key: 'Service Agreement' },
      { key: 'Master Service Agreement' },
      { key: 'Non-Disclosure Agreement' },
      { key: 'Purchase Agreement' },
      { key: 'License Agreement' },
      { key: 'Employment Agreement' },
      { key: 'Consulting Agreement' },
      { key: 'Vendor Agreement' },
      { key: 'Partnership Agreement' },
      { key: UI_LABELS.OTHER_OPTION }
    ];
  }
  
  if (lowerKey.includes('term') || lowerName.includes('term')) {
    return [
      { key: '1 Year' },
      { key: '2 Years' },
      { key: '3 Years' },
      { key: '5 Years' },
      { key: 'Indefinite' },
      { key: 'Until Terminated' },
      { key: 'Project-Based' },
      { key: UI_LABELS.OTHER_OPTION }
    ];
  }
  
  if (lowerKey.includes('renewal') || lowerName.includes('renewal')) {
    return [
      { key: 'Automatic' },
      { key: 'Manual' },
      { key: 'Upon Agreement' },
      { key: 'No Renewal' },
      { key: UI_LABELS.OTHER_OPTION }
    ];
  }
  
  if (lowerKey.includes('termination') || lowerName.includes('termination')) {
    return [
      { key: 'Yes' },
      { key: 'No' },
      { key: 'With Cause Only' },
      { key: 'With Notice' },
      { key: UI_LABELS.OTHER_OPTION }
    ];
  }
  
  return [
    { key: 'Yes' },
    { key: 'No' },
    { key: 'Not Specified' },
    { key: UI_LABELS.OTHER_OPTION }
  ];
}

export const useModelExtractionRunner = (): UseModelExtractionRunnerReturn => {
  const [apiDebugData, setApiDebugData] = useState<ApiExtractionResult[] | null>(null);
  const [apiRequestDebugData, setApiRequestDebugData] = useState<any>(null);
  const { toast } = useToast();

  /**
   * Retry extractions for files where ALL fields failed
   */
  const retryFailedFiles = async (
    originalResults: ApiExtractionResult[],
    originalJobs: ExtractionJob[],
    extractionProcessor: (job: ExtractionJob) => Promise<ApiExtractionResult>
  ): Promise<ApiExtractionResult[]> => {
    // Group results by file and model to analyze failures
    const resultsByFile = new Map<string, Map<string, ApiExtractionResult>>();
    
    originalResults.forEach(result => {
      if (!resultsByFile.has(result.fileId)) {
        resultsByFile.set(result.fileId, new Map());
      }
      resultsByFile.get(result.fileId)!.set(result.modelName, result);
    });

    // Find files where ALL models failed
    const filesToRetry = new Set<string>();
    
    resultsByFile.forEach((modelResults, fileId) => {
      const allFailed = Array.from(modelResults.values()).every(result => !result.success);
      if (allFailed && modelResults.size > 0) {
        filesToRetry.add(fileId);
        extractionLogger.info('File scheduled for retry (all extractions failed)', { fileId });
      }
    });

    if (filesToRetry.size === 0) {
      extractionLogger.info('No files need retry - at least one model succeeded per file');
      return [];
    }

    extractionLogger.info('Retrying files where all extractions failed', { count: filesToRetry.size });

    // Create retry jobs only for the failed files
    const retryJobs = originalJobs.filter(job => filesToRetry.has(job.fileResult.id));
    
    // Execute retry extractions
    const retryResults = await processWithConcurrency(retryJobs, 3, async (job) => {
      extractionLogger.debug('Retrying extraction', { model: job.modelName, fileId: job.fileResult.id });
      const result = await extractionProcessor(job);
      
      // Mark this as a retry attempt
      return {
        ...result,
        retryCount: (result.retryCount || 0) + 1,
      };
    });

    const successfulRetries = retryResults.filter(result => result.success);
    const stillFailedRetries = retryResults.filter(result => !result.success);

    if (successfulRetries.length > 0) {
      extractionLogger.info('Retry complete', { successCount: successfulRetries.length });
    }
    if (stillFailedRetries.length > 0) {
      extractionLogger.warn('Some extractions still failed after retry', { failedCount: stillFailedRetries.length });
    }

    return retryResults;
  };

  const runExtractions = async (
    accuracyData: AccuracyData,
    selectedTemplate: BoxTemplate | null,
    shownColumns: Record<string, boolean>,
    onProgressUpdate: (job: ExtractionJob, result: ApiExtractionResult) => void
  ): Promise<ApiExtractionResult[]> => {
    
    // Keep template key for validation purposes, but don't use it for extraction
    const templateKeyForValidation = selectedTemplate?.templateKey || accuracyData.templateKey;
    
    extractionLogger.debug('Template detection for validation', {
      selectedTemplate: selectedTemplate?.templateKey,
      accuracyDataTemplate: accuracyData.templateKey,
      templateKeyForValidation: templateKeyForValidation
    });
    
    // IMPORTANT: Always use fields-based extraction to enable prompt testing
    // We'll validate against template constraints separately
    const fieldsForExtraction = accuracyData.fields.map(field => {
      extractionLogger.debug(`Prompt debug for field`, { fieldKey: field.key });
      extractionLogger.debug('Current prompt', { fieldKey: field.key, prompt: field.prompt?.substring(0, 100) });
      
      // Transform UI field type to Box AI field type
      const boxFieldType = FIELD_TYPE_MAPPING[field.type as keyof typeof FIELD_TYPE_MAPPING] || field.type;
      extractionLogger.debug('Field type transformation', { fieldKey: field.key, uiType: field.type, boxType: boxFieldType });
      
      const baseField = {
        key: field.key,
        type: boxFieldType,
        displayName: field.name,
        prompt: field.prompt,
      };
      
      // Handle enum and multiSelect fields with options (check against transformed Box type)
      if (boxFieldType === FIELD_TYPES.ENUM || boxFieldType === FIELD_TYPES.MULTISELECT) {
        let fieldOptions: { key: string }[] = [];
        
        // 🔧 FIXED: Use persisted field options first (most reliable)
        if (field.options && field.options.length > 0) {
          fieldOptions = field.options.map(opt => ({ key: opt.key }));
          extractionLogger.debug('Using persisted options', { fieldKey: field.key, fieldType: field.type, optionCount: fieldOptions.length });
        } 
        // Fallback to selectedTemplate if field options not available
        else if (selectedTemplate) {
          const templateField = selectedTemplate.fields.find(tf => tf.key === field.key);
          if (templateField?.options && templateField.options.length > 0) {
            fieldOptions = templateField.options.map(opt => ({ key: opt.key }));
            extractionLogger.debug('Using template options', { fieldKey: field.key, fieldType: field.type, optionCount: fieldOptions.length });
          }
        }
        
        // Final fallback to defaults
        if (fieldOptions.length === 0) {
          fieldOptions = getDefaultEnumOptions(field.key, field.name);
          extractionLogger.warn('Using default options (no template options found)', { fieldKey: field.key, fieldType: field.type });
        }
        
        if (fieldOptions.length > 0) {
          return {
            ...baseField,
            options: fieldOptions
          };
        }
      }
      
      return baseField;
    });

    // 🛡️ GUARDRAIL: Validate all enum and multiSelect fields have options before proceeding
    const enumFieldsWithoutOptions = fieldsForExtraction.filter(field => {
      if (field.type === FIELD_TYPES.ENUM || field.type === FIELD_TYPES.MULTISELECT) {
        // Type guard: check if field has options property
        const fieldWithOptions = field as typeof field & { options?: { key: string }[] };
        return !fieldWithOptions.options || fieldWithOptions.options.length === 0;
      }
      return false;
    });
    
    if (enumFieldsWithoutOptions.length > 0) {
      const fieldNames = enumFieldsWithoutOptions.map(f => f.displayName).join(', ');
      toast({
        variant: "destructive",
        title: "Cannot Run Extraction",
        description: `Enum fields missing options: ${fieldNames}. Please check your template configuration.`,
      });
      extractionLogger.error('Blocking extraction: enum fields without options', new Error(JSON.stringify(enumFieldsWithoutOptions)));
      return [];
    }

    // Create extraction jobs for each file and model combination
    const selectedModels = Object.entries(shownColumns)
      .filter(([, isShown]) => isShown)
      .map(([modelName]) => modelName)
      .filter(modelName => modelName !== UI_LABELS.GROUND_TRUTH);
      
    const extractionJobs: ExtractionJob[] = accuracyData.results.flatMap(fileResult =>
      selectedModels.map(modelName => ({ fileResult, modelName }))
    );
    
    extractionLogger.info('Extraction jobs created', { jobCount: extractionJobs.length });

    // Setup debug data for the first extraction job
    if (extractionJobs.length > 0) {
      const firstJob = extractionJobs[0];
      
      // Use centralized dual-system utilities
      const prepInfo = getFieldPreparationInfo(firstJob.modelName, fieldsForExtraction.length);
      const actualModelName = DUAL_SYSTEM.getBaseModelName(firstJob.modelName);
      const fieldsToShow = prepareFieldsForModel(fieldsForExtraction, firstJob.modelName);
      
      extractionLogger.debug('Debug setup for extraction', prepInfo);
      
      // Log a sample field to verify prompt handling
      if (fieldsToShow.length > 0) {
        const sampleField = fieldsToShow[0];
        extractionLogger.debug('Sample field for model', { 
          modelName: firstJob.modelName, 
          key: sampleField.key,
          hasPrompt: 'prompt' in sampleField,
          promptPreview: 'prompt' in sampleField && sampleField.prompt 
            ? sampleField.prompt.substring(0, 50) + '...' 
            : 'NONE'
        });
      }
      
      const requestBody: any = {
        items: [{ id: firstJob.fileResult.id, type: 'file' }],
        fields: fieldsToShow, // Always use fields for prompt testing
      };
      
      if (actualModelName !== 'box_ai_default') {
        requestBody.model = actualModelName; // Use clean model name in debug
      }
      
      extractionLogger.debug('Using fields-based extraction for prompt testing');
      extractionLogger.debug('Template available for validation', { hasTemplate: !!templateKeyForValidation });
      
      setApiRequestDebugData(requestBody);
    } else {
      setApiRequestDebugData(null);
    }

    const CONCURRENCY_LIMIT = 5;

    // Execute extractions in controlled batches
    const extractionProcessor = async (job: ExtractionJob) => {
      // Use centralized dual-system utilities
      const prepInfo = getFieldPreparationInfo(job.modelName, fieldsForExtraction.length);
      const actualModelName = DUAL_SYSTEM.getBaseModelName(job.modelName);
      const fieldsToUse = prepareFieldsForModel(fieldsForExtraction, job.modelName);
      
      extractionLogger.debug('Processing extraction', {
        ...prepInfo,
        fileId: job.fileResult.id,
        fileName: job.fileResult.fileName
      });
      
      const result = await executeExtractionWithRetry(
        async () => {
          const response = await extractMetadata({
            fileId: job.fileResult.id,
            fields: fieldsToUse,
            model: actualModelName,
          });
          
          extractionLogger.debug('Box AI response received', { 
            modelName: actualModelName,
            fileId: job.fileResult.id,
            fileName: job.fileResult.fileName,
            extractedFieldCount: response?.data ? Object.keys(response.data).length : 0
          });
          
          return response;
        },
        {
          fileId: job.fileResult.id,
          fileName: job.fileResult.fileName,
          modelName: job.modelName,
        }
      );
      
      // Call progress update callback
      onProgressUpdate(job, result);
      
      return result;
    };

    // Wait for all extractions to complete
    const apiResults = await processWithConcurrency(extractionJobs, CONCURRENCY_LIMIT, extractionProcessor);
    setApiDebugData(apiResults);

    // Check for files where ALL fields failed and retry once
    const retryResults = await retryFailedFiles(apiResults, extractionJobs, extractionProcessor);
    const finalResults = [...apiResults, ...retryResults];
    
    // Update debug data with final results including retries
    setApiDebugData(finalResults);

    // Show extraction summary
    const summaryMessage = createExtractionSummaryMessage(finalResults);
    toast({
      title: summaryMessage.title,
      description: summaryMessage.description,
      variant: summaryMessage.variant === 'success' ? 'default' : summaryMessage.variant,
    });

    return finalResults;
  };

  return {
    // State
    apiDebugData,
    apiRequestDebugData,
    
    // Actions
    runExtractions,
  };
}; 