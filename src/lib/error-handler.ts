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
  
  // Common Box.ai error patterns and their concise descriptions
  // Order matters - more specific patterns should come first
  const errorPatterns: Array<{ pattern: RegExp; description: string }> = [
    // Authentication and token errors (most common issues)
    { pattern: /token.*expir|expir.*token/i, description: 'Token expired' },
    { pattern: /401\s*unauthorized|unauthorized/i, description: 'Token expired' },
    { pattern: /invalid.*token|token.*invalid/i, description: 'Invalid token' },
    { pattern: /authentication|auth.*fail/i, description: 'Auth failed' },
    { pattern: /403\s*forbidden|forbidden/i, description: 'No permission' },
    { pattern: /permission denied|access denied/i, description: 'Access denied' },
    
    // Rate limiting (second most common)
    { pattern: /429|too many requests/i, description: 'Rate limited' },
    { pattern: /rate.?limit/i, description: 'Rate limited' },
    { pattern: /quota.*exceed|exceed.*quota/i, description: 'Quota exceeded' },
    
    // Prompt/content size errors
    { pattern: /prompt.*exceed.*length|exceed.*maximum.*length/i, description: 'Prompt too long' },
    { pattern: /content.*too.*large|payload.*too.*large/i, description: 'Content too large' },
    { pattern: /file.*too.*large|size.*exceed/i, description: 'File too large' },
    
    // Timeout errors
    { pattern: /504|gateway.*timeout/i, description: 'Gateway timeout' },
    { pattern: /timeout|timed?\s*out/i, description: 'Timeout' },
    { pattern: /request.*took.*too.*long/i, description: 'Request timeout' },
    
    // Network errors
    { pattern: /network.*error|connection.*fail/i, description: 'Network error' },
    { pattern: /econnrefused|econnreset/i, description: 'Connection failed' },
    { pattern: /dns|host.*not.*found/i, description: 'DNS error' },
    
    // Not found errors
    { pattern: /404|not\s*found/i, description: 'Not found' },
    { pattern: /file.*not.*exist|does.*not.*exist/i, description: 'File not found' },
    
    // Box AI specific errors
    { pattern: /model.*not.*available|model.*unavailable/i, description: 'Model unavailable' },
    { pattern: /invalid.*model|model.*invalid/i, description: 'Invalid model' },
    { pattern: /should be equal to one of the allowed values/i, description: 'Invalid model' },
    { pattern: /bad.*request.*model/i, description: 'Invalid model' },
    { pattern: /invalid.*template|template.*invalid/i, description: 'Invalid template' },
    { pattern: /template.*not.*found/i, description: 'Template not found' },
    { pattern: /extraction.*fail/i, description: 'Extraction failed' },
    { pattern: /processing.*fail|fail.*process/i, description: 'Processing failed' },
    { pattern: /unsupported.*file|file.*type.*not/i, description: 'Unsupported file' },
    
    // Server errors
    { pattern: /500|internal.*server/i, description: 'Server error' },
    { pattern: /502|bad.*gateway/i, description: 'Bad gateway' },
    { pattern: /503|service.*unavailable/i, description: 'Service down' },
    
    // Content errors
    { pattern: /empty.*file|no.*content/i, description: 'Empty file' },
    { pattern: /corrupt|invalid.*format/i, description: 'Corrupted file' },
    { pattern: /cannot.*read|unreadable/i, description: 'Unreadable file' },
    
    // AI/ML specific
    { pattern: /confidence.*low|low.*confidence/i, description: 'Low confidence' },
    { pattern: /no.*field|no.*data.*found/i, description: 'No data found' },
    { pattern: /failed.*parse|parse.*error/i, description: 'Parse error' },
  ];
  
  // Check each pattern
  for (const { pattern, description } of errorPatterns) {
    if (pattern.test(errorMessage)) {
      return description;
    }
  }
  
  // Try to extract HTTP status code if present
  const statusMatch = errorMessage.match(/(\d{3})\s+(\w+)/);
  if (statusMatch) {
    const [, code, status] = statusMatch;
    return `${code} ${status}`;
  }
  
  // Try to extract the key error phrase after "Details:" or "Error:"
  const detailsMatch = errorMessage.match(/(?:Details|Error):\s*(.{1,30})/i);
  if (detailsMatch) {
    const details = detailsMatch[1].trim();
    // Clean up and return
    return details.replace(/[.!?]+$/, '').substring(0, 25);
  }
  
  // If no pattern matches, try to extract meaningful phrases
  const lowerMessage = errorMessage.toLowerCase();
  if (lowerMessage.includes('failed')) return 'Operation failed';
  if (lowerMessage.includes('invalid')) return 'Invalid request';
  if (lowerMessage.includes('error')) return 'Unknown error';
  
  // As a last resort, take first meaningful part of message
  const firstPart = errorMessage.trim().split(/[.!?\n]/)[0];
  if (firstPart && firstPart.length <= 30) {
    return firstPart;
  }
  
  // Return first 25 characters + ellipsis
  return errorMessage.trim().substring(0, 25).trim() + '...';
} 