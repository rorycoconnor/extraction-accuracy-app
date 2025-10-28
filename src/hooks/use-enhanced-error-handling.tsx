/**
import { logger } from '@/lib/logger';
 * Enhanced Error Handling Hook
 * 
 * Provides comprehensive error handling for Box AI operations including:
 * - Retry mechanisms with exponential backoff
 * - User-friendly error messages
 * - Error recovery options
 * - Enhanced logging and debugging
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// Error types for better categorization
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
  BOX_API = 'box_api',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced error interface
export interface EnhancedError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  originalError?: Error;
  context?: Record<string, any>;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  timestamp: Date;
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  retryableErrors: ErrorType[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  exponentialBackoff: true,
  retryableErrors: [ErrorType.NETWORK, ErrorType.RATE_LIMIT, ErrorType.BOX_API]
};

// Enhanced error patterns for better error categorization
const ERROR_PATTERNS = {
  [ErrorType.NETWORK]: [
    /network/i,
    /connection/i,
    /timeout/i,
    /ECONNRESET/i,
    /ENOTFOUND/i,
    /fetch/i
  ],
  [ErrorType.AUTHENTICATION]: [
    /unauthorized/i,
    /authentication/i,
    /token/i,
    /expired/i,
    /invalid.*key/i,
    /403/i,
    /401/i
  ],
  [ErrorType.RATE_LIMIT]: [
    /rate.*limit/i,
    /too.*many.*requests/i,
    /429/i,
    /quota.*exceeded/i
  ],
  [ErrorType.VALIDATION]: [
    /validation/i,
    /invalid.*input/i,
    /bad.*request/i,
    /400/i,
    /malformed/i
  ],
  [ErrorType.BOX_API]: [
    /box.*api/i,
    /extract.*failed/i,
    /ai.*error/i,
    /processing.*failed/i,
    /500/i,
    /502/i,
    /503/i,
    /504/i
  ]
};

// User-friendly error messages
const USER_MESSAGES = {
  [ErrorType.NETWORK]: {
    title: 'Connection Problem',
    message: 'Unable to connect to Box AI. Please check your internet connection and try again.',
    actions: ['Retry', 'Check Network']
  },
  [ErrorType.AUTHENTICATION]: {
    title: 'Authentication Error',
    message: 'Your Box AI credentials are invalid or expired. Please check your settings.',
    actions: ['Update Settings', 'Retry']
  },
  [ErrorType.RATE_LIMIT]: {
    title: 'Rate Limit Exceeded',
    message: 'Too many requests to Box AI. Please wait a moment before trying again.',
    actions: ['Wait and Retry', 'Cancel']
  },
  [ErrorType.VALIDATION]: {
    title: 'Invalid Request',
    message: 'The request contains invalid data. Please check your inputs and try again.',
    actions: ['Review Data', 'Retry']
  },
  [ErrorType.BOX_API]: {
    title: 'Box AI Service Error',
    message: 'Box AI service is temporarily unavailable. This usually resolves quickly.',
    actions: ['Retry', 'Try Later']
  },
  [ErrorType.UNKNOWN]: {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again or contact support.',
    actions: ['Retry', 'Report Issue']
  }
};

export const useEnhancedErrorHandling = () => {
  const [retryConfig, setRetryConfig] = useState<RetryConfig>(DEFAULT_RETRY_CONFIG);
  const [errorHistory, setErrorHistory] = useState<EnhancedError[]>([]);
  const { toast } = useToast();

  // Categorize error based on patterns
  const categorizeError = useCallback((error: Error | string): ErrorType => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(errorMessage))) {
        return type as ErrorType;
      }
    }
    
    return ErrorType.UNKNOWN;
  }, []);

  // Determine error severity
  const getErrorSeverity = useCallback((errorType: ErrorType): ErrorSeverity => {
    switch (errorType) {
      case ErrorType.AUTHENTICATION:
        return ErrorSeverity.HIGH;
      case ErrorType.RATE_LIMIT:
        return ErrorSeverity.MEDIUM;
      case ErrorType.NETWORK:
        return ErrorSeverity.MEDIUM;
      case ErrorType.VALIDATION:
        return ErrorSeverity.LOW;
      case ErrorType.BOX_API:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }, []);

  // Create enhanced error object
  const createEnhancedError = useCallback((
    originalError: Error | string,
    context?: Record<string, any>
  ): EnhancedError => {
    const errorType = categorizeError(originalError);
    const severity = getErrorSeverity(errorType);
    const userMessage = USER_MESSAGES[errorType];
    
    return {
      type: errorType,
      severity,
      message: typeof originalError === 'string' ? originalError : originalError.message,
      userMessage: userMessage.message,
      originalError: typeof originalError === 'string' ? undefined : originalError,
      context,
      retryable: retryConfig.retryableErrors.includes(errorType),
      timestamp: new Date()
    };
  }, [categorizeError, getErrorSeverity, retryConfig.retryableErrors]);

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = useCallback((retryCount: number): number => {
    if (!retryConfig.exponentialBackoff) {
      return retryConfig.baseDelay;
    }
    
    const delay = retryConfig.baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, retryConfig.maxDelay);
  }, [retryConfig]);

  // Sleep utility
  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  // Enhanced retry mechanism
  const executeWithRetry = useCallback(async (
    operation: () => Promise<any>,
    context?: Record<string, any>,
    customConfig?: Partial<RetryConfig>
  ) => {
    const config = { ...retryConfig, ...customConfig };
    let lastError: EnhancedError | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = calculateRetryDelay(attempt - 1);
          await sleep(delay);
        }
        
        return await operation();
      } catch (error) {
        const enhancedError = createEnhancedError(error as Error, {
          ...context,
          attempt: attempt + 1,
          maxRetries: config.maxRetries
        });
        
        lastError = enhancedError;
        
        // Log error for debugging
        logger.error('Attempt failed', { attempt: attempt + 1, maxRetries: config.maxRetries + 1, error: enhancedError });
        
        // If it's the last attempt or error is not retryable, throw
        if (attempt === config.maxRetries || !enhancedError.retryable) {
          break;
        }
        
        // Show retry toast for user feedback
        if (attempt > 0) {
          toast({
            title: `Retry ${attempt + 1}/${config.maxRetries}`,
            description: `Retrying in ${calculateRetryDelay(attempt)}ms...`,
            variant: 'default'
          });
        }
      }
    }
    
    // Add to error history
    if (lastError) {
      setErrorHistory(prev => [...prev.slice(-9), lastError]); // Keep last 10 errors
      
      // Show user-friendly error message
      const userMessage = USER_MESSAGES[lastError.type];
      toast({
        title: userMessage.title,
        description: userMessage.message,
        variant: 'destructive'
      });
    }
    
    throw lastError;
  }, [retryConfig, calculateRetryDelay, sleep, createEnhancedError, toast]);

  // Box AI extraction with enhanced error handling
  const executeBoxAIExtraction = useCallback(async (
    extractionFn: () => Promise<any>,
    context: { fileId: string; fileName: string; modelName: string }
  ) => {
    try {
      const result = await executeWithRetry(extractionFn, context);
      return {
        success: true,
        data: result,
        error: null,
        ...context
      };
    } catch (error) {
      const enhancedError = error as EnhancedError;
      return {
        success: false,
        data: null,
        error: enhancedError,
        ...context
      };
    }
  }, [executeWithRetry]);

  // Get error statistics
  const getErrorStatistics = useCallback(() => {
    const totalErrors = errorHistory.length;
    const errorsByType = errorHistory.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<ErrorType, number>);
    
    const errorsBySeverity = errorHistory.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
    
    return {
      totalErrors,
      errorsByType,
      errorsBySeverity,
      lastError: errorHistory[errorHistory.length - 1]
    };
  }, [errorHistory]);

  // Clear error history
  const clearErrorHistory = useCallback(() => {
    setErrorHistory([]);
  }, []);

  // Update retry configuration
  const updateRetryConfig = useCallback((newConfig: Partial<RetryConfig>) => {
    setRetryConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
    // Core error handling
    executeWithRetry,
    executeBoxAIExtraction,
    createEnhancedError,
    
    // Configuration
    retryConfig,
    updateRetryConfig,
    
    // Error information
    errorHistory,
    getErrorStatistics,
    clearErrorHistory,
    
    // Error types and constants
    ErrorType,
    ErrorSeverity,
    USER_MESSAGES
  };
};

export default useEnhancedErrorHandling; 