/**
 * Custom hook for managing model extraction operations
 * Handles parallel processing of multiple files and models with error handling
 */

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { extractMetadataBatch, type BatchExtractionJob, type BatchExtractionResult } from '@/ai/flows/batch-metadata-extraction';
import { formatModelName } from '@/lib/utils';
import { 
  createExtractionSummaryMessage,
  createExtractionError
} from '@/lib/error-handler';
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
    fieldsForExtraction: any[]
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
    
    // Prepare batch jobs for retry
    const retryBatchJobs: BatchExtractionJob[] = retryJobs.map((job, index) => {
      const actualModelName = DUAL_SYSTEM.getBaseModelName(job.modelName);
      const fieldsToUse = prepareFieldsForModel(fieldsForExtraction, job.modelName);
      
      const mappedFields = fieldsToUse.map(field => {
        let mappedType: 'string' | 'number' | 'date' | 'enum' | 'multiSelect';
        if (field.type === 'float') {
          mappedType = 'number';
        } else if (field.type === 'string' || field.type === 'date' || field.type === 'enum' || field.type === 'multiSelect') {
          mappedType = field.type;
        } else {
          mappedType = 'string';
        }
        
        return {
          ...field,
          type: mappedType
        };
      });

      return {
        jobId: `retry-${index}`,
        fileId: job.fileResult.id,
        fields: mappedFields,
        model: actualModelName,
        templateKey: undefined
      };
    });

    // Execute retry extractions with lower concurrency
    const retryBatchResults = await extractMetadataBatch(retryBatchJobs, 3);

    // Convert batch results to ApiExtractionResult format
    const retryResults: ApiExtractionResult[] = retryBatchResults.map((batchResult, index) => {
      const job = retryJobs[index];
      
      const apiResult: ApiExtractionResult = {
        fileId: job.fileResult.id,
        modelName: job.modelName,
        extractedMetadata: batchResult.data || {},
        confidenceScores: batchResult.confidenceScores,
        success: batchResult.success,
        duration: batchResult.duration,
        retryCount: 1 // Mark as retry
      };

      if (!batchResult.success && batchResult.error) {
        apiResult.error = createExtractionError(
          new Error(batchResult.error),
          {
            fileId: job.fileResult.id,
            fileName: job.fileResult.fileName,
            modelName: job.modelName
          }
        );
      }

      return apiResult;
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
      let boxFieldType = FIELD_TYPE_MAPPING[field.type as keyof typeof FIELD_TYPE_MAPPING] || field.type;
      extractionLogger.debug('Field type transformation', { fieldKey: field.key, uiType: field.type, boxType: boxFieldType });
      
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
        
        // For taxonomy fields without options, treat as string (free-text extraction)
        // Taxonomy options are stored separately in Box and may not be in the template
        if (fieldOptions.length === 0 && field.type === 'taxonomy') {
          extractionLogger.info('Taxonomy field without options - treating as string for free-text extraction', { fieldKey: field.key });
          boxFieldType = FIELD_TYPES.STRING;
        }
        // Final fallback to defaults for non-taxonomy enum/multiSelect fields
        else if (fieldOptions.length === 0) {
          fieldOptions = getDefaultEnumOptions(field.key, field.name);
          extractionLogger.warn('Using default options (no template options found)', { fieldKey: field.key, fieldType: field.type });
        }
        
        if (fieldOptions.length > 0) {
          return {
            key: field.key,
            type: boxFieldType,
            displayName: field.name,
            prompt: field.prompt,
            options: fieldOptions
          };
        }
      }
      
      return {
        key: field.key,
        type: boxFieldType,
        displayName: field.name,
        prompt: field.prompt,
      };
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

    const CONCURRENCY_LIMIT = 10; // Allow up to 10 parallel extractions
    
    // Chunk size for UI progress updates
    // With timeouts now in place (3 min per file, 5 min global), we can use larger chunks
    // for better parallelism while still being protected from hanging
    const PROGRESS_CHUNK_SIZE = 10; // Full parallelism - timeouts protect against hangs

    // Prepare all batch extraction jobs
    const batchJobs: BatchExtractionJob[] = extractionJobs.map((job, index) => {
      // Use centralized dual-system utilities
      const actualModelName = DUAL_SYSTEM.getBaseModelName(job.modelName);
      const fieldsToUse = prepareFieldsForModel(fieldsForExtraction, job.modelName);
      
      // Map BoxFieldType to BoxAIField type (convert 'float' to 'number')
      const mappedFields = fieldsToUse.map(field => {
        let mappedType: 'string' | 'number' | 'date' | 'enum' | 'multiSelect';
        if (field.type === 'float') {
          mappedType = 'number';
        } else if (field.type === 'string' || field.type === 'date' || field.type === 'enum' || field.type === 'multiSelect') {
          mappedType = field.type;
        } else {
          mappedType = 'string'; // fallback to string for unknown types
        }
        
        return {
          ...field,
          type: mappedType
        };
      });

      return {
        jobId: `extraction-${index}`,
        fileId: job.fileResult.id,
        fields: mappedFields,
        model: actualModelName,
        templateKey: undefined // Always use fields-based extraction for prompt testing
      };
    });

    extractionLogger.info('Starting batch extraction', { 
      jobCount: batchJobs.length,
      concurrencyLimit: CONCURRENCY_LIMIT 
    });

    // Split into smaller chunks for progress updates (can't pass callbacks across server boundary)
    // Smaller chunks = more frequent UI updates (but more server calls)
    const chunks: BatchExtractionJob[][] = [];
    for (let i = 0; i < batchJobs.length; i += PROGRESS_CHUNK_SIZE) {
      chunks.push(batchJobs.slice(i, i + PROGRESS_CHUNK_SIZE));
    }

    extractionLogger.info('Processing in chunks for progress updates', { 
      totalJobs: batchJobs.length,
      chunkCount: chunks.length,
      chunkSize: PROGRESS_CHUNK_SIZE,
      note: 'Smaller chunks = faster UI updates'
    });

    const allResults: BatchExtractionResult[] = [];
    const startTime = Date.now();

    // Process each chunk sequentially for progress updates
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      extractionLogger.debug(`Processing chunk ${chunkIndex + 1}/${chunks.length}`, {
        chunkSize: chunk.length
      });

      // Execute this chunk with full parallelism
      const chunkResults = await extractMetadataBatch(chunk, CONCURRENCY_LIMIT);
      allResults.push(...chunkResults);

      // Convert results and trigger progress updates after each chunk
      const startIndex = chunkIndex * PROGRESS_CHUNK_SIZE;
      chunkResults.forEach((batchResult, indexInChunk) => {
        const globalIndex = startIndex + indexInChunk;
        const job = extractionJobs[globalIndex];
        
        const apiResult: ApiExtractionResult = {
          fileId: job.fileResult.id,
          modelName: job.modelName,
          extractedMetadata: batchResult.data || {},
          confidenceScores: batchResult.confidenceScores,
          success: batchResult.success,
          duration: batchResult.duration,
          retryCount: 0
        };

        // Add error information if extraction failed
        if (!batchResult.success && batchResult.error) {
          apiResult.error = createExtractionError(
            new Error(batchResult.error),
            {
              fileId: job.fileResult.id,
              fileName: job.fileResult.fileName,
              modelName: job.modelName
            }
          );
        }

        // Call progress update callback for UI updates
        onProgressUpdate(job, apiResult);
      });

      extractionLogger.info(`Chunk ${chunkIndex + 1}/${chunks.length} complete`, {
        completed: allResults.length,
        total: batchJobs.length
      });
    }

    const totalDuration = Date.now() - startTime;

    extractionLogger.info('All batch extraction completed', {
      totalJobs: allResults.length,
      totalDuration,
      averageDuration: totalDuration / allResults.length
    });

    // Convert all results to ApiExtractionResult format for final storage
    const apiResults: ApiExtractionResult[] = allResults.map((batchResult, index) => {
      const job = extractionJobs[index];
      
      const apiResult: ApiExtractionResult = {
        fileId: job.fileResult.id,
        modelName: job.modelName,
        extractedMetadata: batchResult.data || {},
        confidenceScores: batchResult.confidenceScores,
        success: batchResult.success,
        duration: batchResult.duration,
        retryCount: 0
      };

      if (!batchResult.success && batchResult.error) {
        apiResult.error = createExtractionError(
          new Error(batchResult.error),
          {
            fileId: job.fileResult.id,
            fileName: job.fileResult.fileName,
            modelName: job.modelName
          }
        );
      }
      
      return apiResult;
    });

    setApiDebugData(apiResults);

    // Check for files where ALL fields failed and retry once
    const retryResults = await retryFailedFiles(apiResults, extractionJobs, fieldsForExtraction);
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