/**
 * Error Handler Utilities
 * 
 * Provides comprehensive error handling for the Box AI extraction process.
 * Includes error classification, user-friendly messages, and retry logic.
 */

import { 
  ErrorType, 
  ExtractionError, 
  ApiExtractionResult, 
  DEFAULT_RETRY_CONFIG, 
  ERROR_MESSAGES,
  RetryConfig 
} from './types';
import { logger } from '@/lib/logger';

// ===== ERROR CLASSIFICATION =====

/**
 * Classify an error based on its properties and context
 * 
 * @param error - The original error object
 * @param context - Additional context about where the error occurred
 * @returns Classified error type
 */
export function classifyError(error: any, context?: {
  fileId?: string;
  fileName?: string;
  modelName?: string;
  fieldKey?: string;
}): ErrorType {
  // Network-related errors
  if (error.name === 'NetworkError' || error.message?.includes('network')) {
    return ErrorType.NETWORK_ERROR;
  }
  
  // Timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return ErrorType.TIMEOUT_ERROR;
  }
  
  // HTTP status code based classification
  if (error.status || error.statusCode) {
    const statusCode = error.status || error.statusCode;
    
    if (statusCode === 401) {
      return ErrorType.AUTHENTICATION_ERROR;
    }
    
    if (statusCode === 403) {
      return ErrorType.PERMISSION_ERROR;
    }
    
    if (statusCode === 404) {
      return ErrorType.FILE_NOT_FOUND;
    }
    
    if (statusCode === 429) {
      return ErrorType.RATE_LIMIT_ERROR;
    }
    
    if (statusCode >= 400 && statusCode < 500) {
      return ErrorType.VALIDATION_ERROR;
    }
    
    if (statusCode >= 500) {
      return ErrorType.API_ERROR;
    }
  }
  
  // API-specific error messages
  if (error.message?.includes('invalid template') || error.message?.includes('template')) {
    return ErrorType.INVALID_TEMPLATE;
  }
  
  if (error.message?.includes('processing') || error.message?.includes('extraction')) {
    return ErrorType.PROCESSING_ERROR;
  }
  
  // Default to API error if it seems to be from a service call
  if (error.message?.includes('API') || error.message?.includes('service')) {
    return ErrorType.API_ERROR;
  }
  
  // Unknown error type
  return ErrorType.UNKNOWN_ERROR;
}

/**
 * Create a structured ExtractionError from a raw error
 * 
 * @param error - The original error
 * @param context - Additional context
 * @returns Structured ExtractionError
 */
export function createExtractionError(
  error: any,
  context?: {
    fileId?: string;
    fileName?: string;
    modelName?: string;
    fieldKey?: string;
  }
): ExtractionError {
  const errorType = classifyError(error, context);
  const errorInfo = ERROR_MESSAGES[errorType];
  
  return {
    type: errorType,
    message: error.message || error.toString(),
    userMessage: errorInfo.description,
    retryable: DEFAULT_RETRY_CONFIG.retryableErrors.includes(errorType),
    fileId: context?.fileId,
    fileName: context?.fileName,
    modelName: context?.modelName,
    fieldKey: context?.fieldKey,
    originalError: error,
    statusCode: error.status || error.statusCode,
    timestamp: new Date()
  };
}

// ===== RETRY LOGIC =====

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param config - Retry configuration
 * @returns Promise that resolves with the result or rejects with the final error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      // If this is the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw error;
      }
      
      // Check if this error type is retryable
      const errorType = classifyError(error);
      if (!config.retryableErrors.includes(errorType)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = config.retryDelay * Math.pow(2, attempt);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Execute an extraction with retry logic and proper error handling
 * 
 * @param extractionFn - The extraction function to execute
 * @param context - Context for error reporting
 * @param config - Retry configuration
 * @returns Promise that resolves with ApiExtractionResult
 */
export async function executeExtractionWithRetry(
  extractionFn: () => Promise<any>,
  context: {
    fileId: string;
    fileName: string;
    modelName: string;
    fieldKey?: string;
  },
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ApiExtractionResult> {
  const startTime = Date.now();
  let retryCount = 0;
  
  try {
    const result = await retryWithBackoff(async () => {
      if (retryCount > 0) {
        logger.info('Retrying extraction', {
          fileName: context.fileName,
          modelName: context.modelName,
          attempt: retryCount + 1
        });
      }
      
      const extractionResult = await extractionFn();
      retryCount++;
      
      return extractionResult;
    }, config);
    
    const duration = Date.now() - startTime;
    
    return {
      fileId: context.fileId,
      modelName: context.modelName,
      extractedMetadata: result.data || result,
      success: true,
      retryCount: retryCount - 1, // Subtract 1 because we increment on success too
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const extractionError = createExtractionError(error, context);
    
    // Enhanced error logging with more details
    logger.error('Extraction failed', {
      fileName: context.fileName,
      modelName: context.modelName,
      errorType: extractionError.type,
      errorMessage: extractionError.message,
      userMessage: extractionError.userMessage,
      retryable: extractionError.retryable,
      statusCode: extractionError.statusCode,
      fullError: extractionError
    });
    
    return {
      fileId: context.fileId,
      modelName: context.modelName,
      extractedMetadata: {},
      success: false,
      error: extractionError,
      retryCount: config.maxRetries,
      duration
    };
  }
}

// ===== USER FEEDBACK UTILITIES =====

/**
 * Get user-friendly error message for toast notifications
 * 
 * @param error - The extraction error
 * @returns Toast-friendly error message
 */
export function getErrorToastMessage(error: ExtractionError): {
  title: string;
  description: string;
  action?: string;
} {
  const errorInfo = ERROR_MESSAGES[error.type];
  
  let description = errorInfo.description;
  
  // Add context if available
  if (error.fileName && error.modelName) {
    description += ` (File: ${error.fileName}, Model: ${error.modelName})`;
  } else if (error.fileName) {
    description += ` (File: ${error.fileName})`;
  } else if (error.modelName) {
    description += ` (Model: ${error.modelName})`;
  }
  
  return {
    title: errorInfo.title,
    description,
    action: errorInfo.action
  };
}

/**
 * Get a summary of extraction results for user feedback
 * 
 * @param results - Array of extraction results
 * @returns Summary information
 */
export function getExtractionSummary(results: ApiExtractionResult[]): {
  total: number;
  successful: number;
  failed: number;
  retried: number;
  averageDuration: number;
  errorsByType: Record<ErrorType, number>;
} {
  const summary = {
    total: results.length,
    successful: 0,
    failed: 0,
    retried: 0,
    averageDuration: 0,
    errorsByType: {} as Record<ErrorType, number>
  };
  
  let totalDuration = 0;
  
  results.forEach(result => {
    if (result.success) {
      summary.successful++;
    } else {
      summary.failed++;
      
      if (result.error) {
        summary.errorsByType[result.error.type] = (summary.errorsByType[result.error.type] || 0) + 1;
      }
    }
    
    if (result.retryCount && result.retryCount > 0) {
      summary.retried++;
    }
    
    if (result.duration) {
      totalDuration += result.duration;
    }
  });
  
  summary.averageDuration = results.length > 0 ? totalDuration / results.length : 0;
  
  return summary;
}

/**
 * Create a user-friendly summary message for extraction results
 * 
 * @param results - Array of extraction results
 * @returns User-friendly summary message
 */
export function createExtractionSummaryMessage(results: ApiExtractionResult[]): {
  title: string;
  description: string;
  variant: 'default' | 'destructive' | 'success';
} {
  const summary = getExtractionSummary(results);
  
  if (summary.failed === 0) {
    return {
      title: 'Extraction Complete',
      description: `Successfully processed ${summary.successful} extraction${summary.successful === 1 ? '' : 's'} in ${(summary.averageDuration / 1000).toFixed(1)}s average.`,
      variant: 'success'
    };
  } else if (summary.successful === 0) {
    return {
      title: 'Extraction Failed',
      description: `All ${summary.failed} extraction${summary.failed === 1 ? '' : 's'} failed. Please check your settings and try again.`,
      variant: 'destructive'
    };
  } else {
    return {
      title: 'Extraction Partially Complete',
      description: `${summary.successful} successful, ${summary.failed} failed. ${summary.retried > 0 ? `${summary.retried} required retries.` : ''}`,
      variant: 'default'
    };
  }
} 

/**
 * Extract a concise error description from Box.ai error messages
 * 
 * @param errorMessage - The full error message from Box.ai
 * @returns A short, user-friendly error description
 */
export function extractConciseErrorDescription(errorMessage: string): string {
  if (!errorMessage) return 'Unknown error';
  
  // Convert to lowercase for pattern matching
  const lowerMessage = errorMessage.toLowerCase();
  
  // Common Box.ai error patterns and their concise descriptions
  const errorPatterns: Array<{ pattern: RegExp | string; description: string }> = [
    // Authentication and permission errors
    { pattern: /unauthorized|401|authentication/i, description: 'Auth failed' },
    { pattern: /forbidden|403|permission/i, description: 'No permission' },
    { pattern: /not found|404/i, description: 'File not found' },
    
    // Rate limiting and quota errors
    { pattern: /rate limit|429|too many requests/i, description: 'Rate limited' },
    { pattern: /quota|limit exceeded/i, description: 'Quota exceeded' },
    
    // Network and timeout errors
    { pattern: /timeout|timed out/i, description: 'Timeout' },
    { pattern: /network|connection/i, description: 'Network error' },
    
    // Box.ai specific errors
    { pattern: /invalid template|template/i, description: 'Invalid template' },
    { pattern: /processing error|failed to process/i, description: 'Processing failed' },
    { pattern: /unsupported file|file type/i, description: 'Unsupported file' },
    { pattern: /extraction failed|failed to extract/i, description: 'Extraction failed' },
    { pattern: /model not available|model error/i, description: 'Model unavailable' },
    { pattern: /should be equal to one of the allowed values|enum/i, description: 'Invalid model' },
    { pattern: /bad_request.*model/i, description: 'Invalid model' },
    
    // Server errors
    { pattern: /500|internal server error|server error/i, description: 'Server error' },
    { pattern: /502|bad gateway/i, description: 'Gateway error' },
    { pattern: /503|service unavailable/i, description: 'Service unavailable' },
    
    // Content-related errors
    { pattern: /content too large|file too large/i, description: 'File too large' },
    { pattern: /no content|empty file/i, description: 'Empty file' },
    { pattern: /corrupted|invalid format/i, description: 'Corrupted file' },
    
    // AI/ML specific errors
    { pattern: /confidence too low|low confidence/i, description: 'Low confidence' },
    { pattern: /no fields found|no data/i, description: 'No data found' }
  ];
  
  // Check each pattern
  for (const { pattern, description } of errorPatterns) {
    if (typeof pattern === 'string') {
      if (lowerMessage.includes(pattern)) {
        return description;
      }
    } else {
      if (pattern.test(errorMessage)) {
        return description;
      }
    }
  }
  
  // If no pattern matches, try to extract key phrases
  if (lowerMessage.includes('failed')) {
    return 'Failed';
  }
  if (lowerMessage.includes('error')) {
    return 'Error';
  }
  if (lowerMessage.includes('invalid')) {
    return 'Invalid';
  }
  
  // As a last resort, truncate the message to a reasonable length
  const truncated = errorMessage.trim().split('.')[0]; // Take first sentence
  if (truncated.length <= 20) {
    return truncated;
  }
  
  // Return first 15 characters + ellipsis
  return errorMessage.trim().substring(0, 15) + '...';
} 