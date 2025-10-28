/**
 * Logging Utility
 * 
 * Provides structured logging with log levels and environment-based control.
 * Replaces scattered console.log statements with a centralized logging system.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   
 *   logger.debug('Detailed debugging info', { userId: '123' });
 *   logger.info('General information');
 *   logger.warn('Warning message', { context: 'details' });
 *   logger.error('Error occurred', error);
 * 
 * Environment Variables:
 *   LOG_LEVEL - Set to 'debug', 'info', 'warn', 'error', or 'none' (default: 'info')
 *   NODE_ENV - 'development' enables all logs, 'production' respects LOG_LEVEL
 *   NEXT_PUBLIC_DEBUG_MODE - Set to 'true' to enable verbose logging in production
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;
  private isDebugMode: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
    this.level = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    // Debug mode overrides everything
    if (this.isDebugMode) {
      return LogLevel.DEBUG;
    }

    const envLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    
    switch (envLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'none':
        return LogLevel.NONE;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    // Debug mode shows everything
    if (this.isDebugMode) {
      return true;
    }

    // In development, always log debug and info
    if (this.isDevelopment && level <= LogLevel.INFO) {
      return true;
    }
    
    // Otherwise, respect the configured log level
    return level >= this.level;
  }

  /**
   * Sanitize sensitive data for production logging
   * Removes or masks sensitive fields like fileId, tokens, etc.
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // In development or debug mode, don't sanitize
    if (this.isDevelopment || this.isDebugMode) {
      return data;
    }

    // Clone the object to avoid mutating original
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    // List of sensitive field names to mask
    const sensitiveFields = [
      'fileId',
      'token',
      'accessToken',
      'refreshToken',
      'password',
      'secret',
      'apiKey',
      'authorization'
    ];

    // Recursively sanitize object
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      // Check if this is a sensitive field
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '***';
      } 
      // Recursively sanitize nested objects
      else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });

    return sanitized;
  }

  private formatMessage(level: string, message: string, context?: LogContext | Error): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (!context) {
      return `${prefix} ${message}`;
    }
    
    if (context instanceof Error) {
      return `${prefix} ${message}\nError: ${context.message}\nStack: ${context.stack}`;
    }
    
    // Sanitize context data before logging
    const sanitizedContext = this.sanitizeData(context);
    return `${prefix} ${message} ${JSON.stringify(sanitizedContext)}`;
  }

  /**
   * Debug level logging - verbose information for debugging
   * Only shown in development or when LOG_LEVEL=debug
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }

  /**
   * Info level logging - general information about application flow
   * Shown in development and production (unless LOG_LEVEL=warn or higher)
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, context));
    }
  }

  /**
   * Warning level logging - unexpected but recoverable situations
   * Always shown unless LOG_LEVEL=error or none
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  /**
   * Error level logging - errors that need attention
   * Always shown unless LOG_LEVEL=none
   */
  error(message: string, error?: Error | LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, error));
    }
  }

  /**
   * Create a child logger with a specific context prefix
   * Useful for adding consistent context to all logs in a module
   */
  withContext(contextPrefix: string): ContextLogger {
    return new ContextLogger(this, contextPrefix);
  }
}

/**
 * Context logger that prefixes all messages with a context string
 */
class ContextLogger {
  constructor(
    private logger: Logger,
    private context: string
  ) {}

  debug(message: string, context?: LogContext): void {
    this.logger.debug(`[${this.context}] ${message}`, context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(`[${this.context}] ${message}`, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(`[${this.context}] ${message}`, context);
  }

  error(message: string, error?: Error | LogContext): void {
    this.logger.error(`[${this.context}] ${message}`, error);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export commonly used context loggers for major modules
export const boxLogger = logger.withContext('Box API');
export const extractionLogger = logger.withContext('Extraction');
export const authLogger = logger.withContext('Auth');
export const metricsLogger = logger.withContext('Metrics');

