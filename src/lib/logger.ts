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

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.level = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
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
    // In development, always log debug and info
    if (this.isDevelopment && level <= LogLevel.INFO) {
      return true;
    }
    
    // Otherwise, respect the configured log level
    return level >= this.level;
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
    
    return `${prefix} ${message} ${JSON.stringify(context)}`;
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

