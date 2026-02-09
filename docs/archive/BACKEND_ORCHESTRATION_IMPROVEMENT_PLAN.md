# Backend Processing & Orchestration Improvement Plan
**Date**: October 28, 2025  
**Branch**: feature/dualstate  
**Status**: PLAN - NOT YET IMPLEMENTED

---

## Executive Summary

After reviewing all documentation, code, recent remote updates, and the orchestration layer, this plan outlines improvements to backend processing and orchestration **without breaking the Box AI integration**. The system is currently working well after the Firebase→Cursor migration, but there are opportunities to enhance performance, maintainability, and robustness.

### Key Principles
✅ **Do Not Break Box AI** - All changes must preserve the working Box AI flow  
✅ **Incremental Improvements** - Small, testable changes over big rewrites  
✅ **Backward Compatible** - No breaking changes to existing functionality  
✅ **Production Ready** - Focus on logging, error handling, performance  

---

## Current State Analysis

### ✅ What's Working Well

1. **Unified State Management** - AccuracyDataStore with session tracking
2. **Dual System** - Prompted vs non-prompted extraction working correctly
3. **Error Handling** - Retry logic, error categorization, user-friendly messages
4. **Concurrency Control** - processWithConcurrency managing parallel requests
5. **Box AI Integration** - Proper request/response handling, model configuration
6. **Progress Tracking** - Real-time updates during extraction

### ⚠️ Areas for Improvement

1. **Orchestration Complexity** - Multiple interconnected hooks with unclear dependencies
2. **Excessive Logging** - 505 console statements (not production-ready)
3. **State Update Performance** - Multiple re-renders during extraction
4. **Type Safety** - 138 uses of `any` type, weak API typing
5. **Missing Caching** - Redundant API calls for templates and tokens
6. **Concurrency Tuning** - Fixed limit may not be optimal for all scenarios
7. **Hook Dependencies** - Complex dependency arrays causing unnecessary re-renders

---

## 🎯 Improvement Goals

| Goal | Priority | Impact | Effort | Risk |
|------|----------|--------|--------|------|
| Production-ready logging | 🔴 HIGH | HIGH | 4-6h | LOW |
| Orchestration simplification | 🟡 MEDIUM | HIGH | 8-12h | MEDIUM |
| Type safety improvements | 🟡 MEDIUM | MEDIUM | 6-8h | LOW |
| Performance optimization | 🟢 LOW | MEDIUM | 4-6h | LOW |
| Caching layer | 🟢 LOW | MEDIUM | 3-4h | LOW |
| Error handling enhancement | 🟡 MEDIUM | MEDIUM | 4-6h | LOW |

---

## 📋 Detailed Improvement Plan

## Phase 1: Production Readiness (Priority: 🔴 HIGH)

### 1.1 Implement Production-Ready Logging System
**Status**: CRITICAL  
**Effort**: 4-6 hours  
**Risk**: LOW  

#### Current Issues
- 505 console.log statements across 57 files
- No environment-based conditional logging
- Sensitive data exposure (file IDs, API responses)
- Console clutter in production

#### Proposed Solution

**Step 1**: Enhance existing logger (`src/lib/logger.ts`)

```typescript
// Enhanced logger with log levels and environment awareness
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  includeTimestamp: boolean;
  includeCaller: boolean;
}

class Logger {
  private config: LoggerConfig;
  
  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    const isDebug = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
    
    this.config = {
      level: isDev || isDebug ? 'debug' : 'warn',
      enabled: true,
      includeTimestamp: true,
      includeCaller: isDev
    };
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      this.log('info', message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, data);
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog('error')) {
      this.log('error', message, error);
    }
  }

  // Specialized Box AI logger that sanitizes sensitive data
  boxAI(level: LogLevel, message: string, data?: any): void {
    if (this.shouldLog(level)) {
      const sanitized = this.sanitizeBoxAIData(data);
      this.log(level, `[Box AI] ${message}`, sanitized);
    }
  }

  private sanitizeBoxAIData(data: any): any {
    if (!data) return data;
    
    // Remove sensitive fields in production
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) return data;
    
    const sanitized = { ...data };
    // Keep only safe fields
    return {
      fileId: sanitized.fileId ? '***' : undefined,
      modelName: sanitized.modelName,
      status: sanitized.status,
      fieldCount: sanitized.fieldCount,
      duration: sanitized.duration
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const timestamp = this.config.includeTimestamp 
      ? `[${new Date().toISOString()}]` 
      : '';
    
    const prefix = `${timestamp} [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'debug':
        console.log(prefix, message, data);
        break;
      case 'info':
        console.info(prefix, message, data);
        break;
      case 'warn':
        console.warn(prefix, message, data);
        break;
      case 'error':
        console.error(prefix, message, data);
        break;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Specialized loggers for different subsystems
export const extractionLogger = {
  debug: (msg: string, data?: any) => logger.boxAI('debug', msg, data),
  info: (msg: string, data?: any) => logger.boxAI('info', msg, data),
  warn: (msg: string, data?: any) => logger.boxAI('warn', msg, data),
  error: (msg: string, error?: any) => logger.boxAI('error', msg, error),
};

export const stateLogger = {
  debug: (msg: string, data?: any) => logger.debug(`[State] ${msg}`, data),
  info: (msg: string, data?: any) => logger.info(`[State] ${msg}`, data),
  warn: (msg: string, data?: any) => logger.warn(`[State] ${msg}`, data),
  error: (msg: string, error?: any) => logger.error(`[State] ${msg}`, error),
};
```

**Step 2**: Replace console statements systematically

Priority order:
1. **Box AI service** (`src/services/box.ts`) - Most critical
2. **Extraction hooks** (`src/hooks/use-model-extraction-runner.tsx`)
3. **State management** (`src/store/AccuracyDataStore.tsx`)
4. **Comparison runner** (`src/hooks/use-enhanced-comparison-runner.tsx`)
5. **Other hooks** (data handlers, extraction setup, etc.)

**Step 3**: Add environment variable for debug mode

```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=false  # Set to true for verbose logging
```

#### Implementation Checklist
- [ ] Enhance `src/lib/logger.ts` with new Logger class
- [ ] Add NEXT_PUBLIC_DEBUG_MODE to environment variables
- [ ] Replace console.log in `src/services/box.ts` (30+ statements)
- [ ] Replace console.log in `src/hooks/use-model-extraction-runner.tsx` (40+ statements)
- [ ] Replace console.log in `src/store/AccuracyDataStore.tsx` (20+ statements)
- [ ] Replace console.log in `src/hooks/use-enhanced-comparison-runner.tsx` (15+ statements)
- [ ] Update remaining files with logger (remaining ~400 statements)
- [ ] Test in development mode (should see all logs)
- [ ] Test in production mode (should see only warn/error)
- [ ] Verify Box AI functionality unchanged

---

### 1.2 Remove Build Error Suppression
**Status**: CRITICAL  
**Effort**: 1 hour + fixes  
**Risk**: MEDIUM (may reveal hidden errors)

#### Current Issue
```typescript
// next.config.ts
typescript: {
  ignoreBuildErrors: true,  // ❌ DANGEROUS
},
eslint: {
  ignoreDuringBuilds: true,  // ❌ DANGEROUS
},
```

#### Proposed Solution

**Step 1**: Remove suppression flags
```typescript
// next.config.ts
typescript: {
  ignoreBuildErrors: false,
},
eslint: {
  ignoreDuringBuilds: false,
},
```

**Step 2**: Fix all revealed errors
```bash
npm run typecheck
npm run lint
```

**Step 3**: Address common issues
- Replace `any` types with proper interfaces
- Fix unused variables
- Add proper null checks
- Fix import issues

#### Implementation Checklist
- [ ] Remove ignoreBuildErrors flag
- [ ] Remove ignoreDuringBuilds flag
- [ ] Run typecheck and document all errors
- [ ] Create fixes for each error (categorized by file)
- [ ] Test build locally
- [ ] Verify Box AI functionality unchanged

---

## Phase 2: Orchestration Optimization (Priority: 🟡 MEDIUM)

### 2.1 Simplify Hook Dependency Chain
**Status**: IMPORTANT  
**Effort**: 8-12 hours  
**Risk**: MEDIUM

#### Current Architecture Analysis

**Hook Dependency Graph**:
```
MainPage
  ├─ useAccuracyDataStore (global state)
  ├─ useAccuracyDataCompat (compatibility layer)
  ├─ useAccuracyData (legacy - still used)
  ├─ useEnhancedComparisonRunner
  │   ├─ useAccuracyDataStore
  │   ├─ useCurrentSession
  │   ├─ useModelExtractionRunner
  │   │   ├─ useToast
  │   │   └─ extractMetadata (server action)
  │   ├─ useGroundTruth
  │   │   └─ GroundTruthProvider (context)
  │   ├─ useDataHandlers
  │   │   ├─ useToast
  │   │   └─ useGroundTruth
  │   └─ useExtractionProgress
  │       └─ multiple useState hooks
  ├─ useExtractionSetup
  │   ├─ useToast
  │   └─ useGroundTruth
  ├─ useDataHandlers
  └─ useUIHandlers
```

**Issues**:
1. **Circular dependencies** - useDataHandlers called from multiple places
2. **Prop drilling** - AccuracyData passed through multiple layers
3. **Duplicate hook calls** - useGroundTruth called in multiple places
4. **Heavy dependency arrays** - Causing unnecessary re-renders
5. **Mixed concerns** - UI, data, and orchestration logic intermingled

#### Proposed Solution: Orchestration Service Pattern

**Step 1**: Create orchestration service layer

**File**: `src/lib/orchestration/extraction-orchestrator.ts` (NEW)

```typescript
/**
 * Extraction Orchestrator
 * 
 * Centralized orchestration for the extraction process.
 * Coordinates state updates, API calls, and progress tracking.
 * 
 * Benefits:
 * - Single responsibility for orchestration logic
 * - Testable without React hooks
 * - Clear separation of concerns
 * - No circular dependencies
 */

import type { 
  AccuracyData, 
  BoxTemplate, 
  FileResult, 
  ApiExtractionResult 
} from '@/lib/types';
import { extractMetadata } from '@/ai/flows/metadata-extraction';
import { processWithConcurrency } from '@/lib/concurrency';
import { executeExtractionWithRetry } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { prepareFieldsForModel, DUAL_SYSTEM } from '@/lib/dual-system-utils';

export interface ExtractionJob {
  fileId: string;
  fileName: string;
  modelName: string;
  fields: any[];
}

export interface ExtractionProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  currentFile: string;
}

export interface ExtractionResult {
  jobs: ExtractionJob[];
  results: ApiExtractionResult[];
  progress: ExtractionProgress;
}

export class ExtractionOrchestrator {
  private concurrencyLimit: number;
  private onProgressCallback?: (progress: ExtractionProgress) => void;

  constructor(concurrencyLimit: number = 5) {
    this.concurrencyLimit = concurrencyLimit;
  }

  /**
   * Set progress callback for real-time updates
   */
  onProgress(callback: (progress: ExtractionProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Prepare extraction jobs from accuracy data
   */
  prepareJobs(
    accuracyData: AccuracyData,
    selectedModels: string[],
    template: BoxTemplate | null
  ): ExtractionJob[] {
    const jobs: ExtractionJob[] = [];

    // Prepare fields once (optimization)
    const baseFields = this.prepareFields(accuracyData, template);

    for (const fileResult of accuracyData.results) {
      for (const modelName of selectedModels) {
        // Prepare fields for this specific model (prompted vs non-prompted)
        const fieldsForModel = prepareFieldsForModel(baseFields, modelName);

        jobs.push({
          fileId: fileResult.id,
          fileName: fileResult.fileName,
          modelName,
          fields: fieldsForModel as any[]
        });
      }
    }

    logger.info(`Prepared ${jobs.length} extraction jobs`, {
      files: accuracyData.results.length,
      models: selectedModels.length
    });

    return jobs;
  }

  /**
   * Execute extraction jobs with progress tracking
   */
  async executeJobs(jobs: ExtractionJob[]): Promise<ApiExtractionResult[]> {
    const progress: ExtractionProgress = {
      total: jobs.length,
      completed: 0,
      successful: 0,
      failed: 0,
      currentFile: ''
    };

    const updateProgress = (job: ExtractionJob, success: boolean) => {
      progress.completed++;
      progress.currentFile = job.fileName;
      if (success) {
        progress.successful++;
      } else {
        progress.failed++;
      }
      
      if (this.onProgressCallback) {
        this.onProgressCallback({ ...progress });
      }
    };

    // Process jobs with concurrency control
    const results = await processWithConcurrency(
      jobs,
      this.concurrencyLimit,
      async (job) => {
        const actualModelName = DUAL_SYSTEM.getBaseModelName(job.modelName);
        
        logger.debug(`Extracting: ${job.fileName} with ${actualModelName}`);

        const result = await executeExtractionWithRetry(
          async () => {
            return await extractMetadata({
              fileId: job.fileId,
              fields: job.fields,
              model: actualModelName
            });
          },
          {
            fileId: job.fileId,
            fileName: job.fileName,
            modelName: job.modelName
          }
        );

        updateProgress(job, result.success);
        return result;
      }
    );

    logger.info(`Extraction complete`, {
      total: progress.total,
      successful: progress.successful,
      failed: progress.failed
    });

    return results;
  }

  /**
   * Retry failed extractions
   */
  async retryFailedJobs(
    results: ApiExtractionResult[],
    originalJobs: ExtractionJob[]
  ): Promise<ApiExtractionResult[]> {
    // Group by file to find files where ALL models failed
    const fileFailures = new Map<string, ApiExtractionResult[]>();
    
    for (const result of results) {
      if (!result.success) {
        if (!fileFailures.has(result.fileId)) {
          fileFailures.set(result.fileId, []);
        }
        fileFailures.get(result.fileId)!.push(result);
      }
    }

    // Find files where ALL extractions failed
    const filesToRetry: string[] = [];
    for (const [fileId, failures] of fileFailures) {
      const allResultsForFile = results.filter(r => r.fileId === fileId);
      if (failures.length === allResultsForFile.length) {
        filesToRetry.push(fileId);
      }
    }

    if (filesToRetry.length === 0) {
      return [];
    }

    logger.info(`Retrying ${filesToRetry.length} files where all extractions failed`);

    // Create retry jobs
    const retryJobs = originalJobs.filter(job => 
      filesToRetry.includes(job.fileId)
    );

    // Execute retries
    return this.executeJobs(retryJobs);
  }

  /**
   * Helper: Prepare field definitions from accuracy data
   */
  private prepareFields(
    accuracyData: AccuracyData,
    template: BoxTemplate | null
  ): any[] {
    return accuracyData.fields.map(field => ({
      key: field.key,
      type: field.type,
      displayName: field.name,
      prompt: field.prompt,
      ...(field.options && { options: field.options })
    }));
  }
}

// Export factory function
export function createExtractionOrchestrator(
  concurrencyLimit?: number
): ExtractionOrchestrator {
  return new ExtractionOrchestrator(concurrencyLimit);
}
```

**Step 2**: Simplify comparison runner hook

**File**: `src/hooks/use-enhanced-comparison-runner.tsx` (REFACTOR)

```typescript
/**
 * Simplified comparison runner using orchestration service
 */

import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore } from '@/store/AccuracyDataStore';
import { useExtractionProgress } from '@/hooks/use-extraction-progress';
import { createExtractionOrchestrator } from '@/lib/orchestration/extraction-orchestrator';
import { calculateMetrics } from '@/lib/metrics';
import type { BoxTemplate } from '@/lib/types';

export const useEnhancedComparisonRunner = (
  selectedTemplate: BoxTemplate | null
) => {
  const { toast } = useToast();
  const { state, dispatch } = useAccuracyDataStore();
  const progress = useExtractionProgress();
  
  // Create orchestrator instance (reused across runs)
  const orchestratorRef = useRef(
    createExtractionOrchestrator(5) // 5 concurrent requests
  );

  const handleRunComparison = useCallback(async () => {
    if (!state.data) {
      toast({
        title: 'No Data',
        description: 'Please select documents first',
        variant: 'destructive'
      });
      return;
    }

    const orchestrator = orchestratorRef.current;
    
    // Setup progress tracking
    orchestrator.onProgress((p) => {
      progress.updateProgress(p);
    });

    progress.start(0); // Will be updated by orchestrator

    try {
      // 1. Prepare jobs
      const selectedModels = Object.entries(state.data.shownColumns)
        .filter(([, shown]) => shown)
        .map(([model]) => model);

      const jobs = orchestrator.prepareJobs(
        state.data,
        selectedModels,
        selectedTemplate
      );

      progress.start(jobs.length);

      // 2. Execute extractions
      const results = await orchestrator.executeJobs(jobs);

      // 3. Retry failures
      const retryResults = await orchestrator.retryFailedJobs(results, jobs);
      const finalResults = [...results, ...retryResults];

      // 4. Calculate metrics
      const metrics = calculateMetrics(state.data, finalResults);

      // 5. Update state atomically
      dispatch({
        type: 'COMPLETE_COMPARISON_RUN',
        payload: {
          runId: Date.now().toString(),
          results: finalResults,
          averages: metrics.averages,
          apiResults: finalResults
        }
      });

      progress.complete();

      toast({
        title: 'Extraction Complete',
        description: `Processed ${finalResults.length} extractions`,
        variant: 'default'
      });

    } catch (error) {
      progress.stop();
      toast({
        title: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  }, [state.data, selectedTemplate, dispatch, toast, progress]);

  return {
    handleRunComparison,
    isExtracting: progress.isExtracting,
    progress: progress.progress
  };
};
```

#### Benefits of This Refactoring

1. **Separation of Concerns**
   - Orchestration logic separate from React hooks
   - Testable without React testing library
   - Clear boundaries between layers

2. **Reduced Complexity**
   - No circular dependencies
   - Simpler dependency arrays
   - Fewer re-renders

3. **Better Performance**
   - Orchestrator reused across runs
   - No recreating functions unnecessarily
   - Clearer optimization opportunities

4. **Maintainability**
   - Easy to understand control flow
   - Easy to add new orchestration features
   - Clear error boundaries

#### Implementation Checklist
- [ ] Create `src/lib/orchestration/extraction-orchestrator.ts`
- [ ] Add unit tests for ExtractionOrchestrator
- [ ] Refactor `use-enhanced-comparison-runner.tsx`
- [ ] Remove dependency on `use-model-extraction-runner.tsx`
- [ ] Test extraction flow end-to-end
- [ ] Verify Box AI functionality unchanged
- [ ] Monitor performance improvements

---

### 2.2 Optimize Concurrency Configuration
**Status**: NICE TO HAVE  
**Effort**: 3-4 hours  
**Risk**: LOW

#### Current State
- Fixed concurrency limit of 5
- No dynamic adjustment based on:
  - API response times
  - Error rates
  - Available resources

#### Proposed Solution: Adaptive Concurrency

**File**: `src/lib/orchestration/adaptive-concurrency.ts` (NEW)

```typescript
/**
 * Adaptive Concurrency Manager
 * 
 * Dynamically adjusts concurrency based on:
 * - Average response time
 * - Error rate
 * - Success rate
 */

export interface ConcurrencyMetrics {
  avgResponseTime: number;
  errorRate: number;
  successRate: number;
  currentLimit: number;
}

export class AdaptiveConcurrencyManager {
  private minLimit: number = 2;
  private maxLimit: number = 10;
  private currentLimit: number = 5;
  
  private responseTimes: number[] = [];
  private errorCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;

  constructor(min: number = 2, max: number = 10, initial: number = 5) {
    this.minLimit = min;
    this.maxLimit = max;
    this.currentLimit = initial;
  }

  /**
   * Record a request result
   */
  recordRequest(success: boolean, responseTime: number): void {
    this.totalRequests++;
    
    if (success) {
      this.successCount++;
      this.responseTimes.push(responseTime);
      
      // Keep only last 10 response times
      if (this.responseTimes.length > 10) {
        this.responseTimes.shift();
      }
    } else {
      this.errorCount++;
    }

    // Adjust concurrency every 5 requests
    if (this.totalRequests % 5 === 0) {
      this.adjustConcurrency();
    }
  }

  /**
   * Get current concurrency limit
   */
  getCurrentLimit(): number {
    return this.currentLimit;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConcurrencyMetrics {
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;
    
    const errorRate = this.totalRequests > 0
      ? this.errorCount / this.totalRequests
      : 0;
    
    const successRate = this.totalRequests > 0
      ? this.successCount / this.totalRequests
      : 0;

    return {
      avgResponseTime,
      errorRate,
      successRate,
      currentLimit: this.currentLimit
    };
  }

  /**
   * Adjust concurrency based on metrics
   */
  private adjustConcurrency(): void {
    const metrics = this.getMetrics();
    
    // Decrease if high error rate
    if (metrics.errorRate > 0.2) {
      this.decreaseLimit();
      logger.info('Decreased concurrency due to high error rate', metrics);
      return;
    }

    // Decrease if slow response times
    if (metrics.avgResponseTime > 5000) { // 5 seconds
      this.decreaseLimit();
      logger.info('Decreased concurrency due to slow responses', metrics);
      return;
    }

    // Increase if doing well
    if (metrics.errorRate < 0.05 && metrics.avgResponseTime < 2000) {
      this.increaseLimit();
      logger.info('Increased concurrency due to good performance', metrics);
      return;
    }
  }

  private increaseLimit(): void {
    this.currentLimit = Math.min(this.currentLimit + 1, this.maxLimit);
  }

  private decreaseLimit(): void {
    this.currentLimit = Math.max(this.currentLimit - 1, this.minLimit);
  }

  /**
   * Reset metrics (call between runs)
   */
  reset(): void {
    this.responseTimes = [];
    this.errorCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    // Keep current limit as it represents learned optimal value
  }
}
```

#### Implementation Checklist
- [ ] Create `src/lib/orchestration/adaptive-concurrency.ts`
- [ ] Integrate with ExtractionOrchestrator
- [ ] Add metrics logging
- [ ] Test with various load scenarios
- [ ] Verify Box AI rate limits respected

---

## Phase 3: Type Safety & Code Quality (Priority: 🟡 MEDIUM)

### 3.1 Eliminate `any` Types
**Status**: IMPORTANT  
**Effort**: 6-8 hours  
**Risk**: LOW

#### Current State
- 138 uses of `any` type
- Weak API response typing
- Missing interfaces for complex objects

#### Proposed Solution: Comprehensive Type Definitions

**File**: `src/lib/types/box-ai.ts` (NEW)

```typescript
/**
 * Box AI API Types
 * 
 * Complete type definitions for Box AI requests and responses
 */

// ===== REQUEST TYPES =====

export interface BoxAIField {
  key: string;
  type: 'string' | 'date' | 'enum' | 'number' | 'multiSelect';
  displayName: string;
  prompt?: string;
  description?: string;
  options?: BoxAIFieldOption[];
}

export interface BoxAIFieldOption {
  key: string;
}

export interface BoxAIMetadataTemplate {
  template_key: string;
  scope: 'enterprise' | 'global';
}

export interface BoxAIAgentId {
  id: string;
  type: 'ai_agent_id';
}

export interface BoxAIAgentConfig {
  type: 'ai_agent_extract_structured';
  basic_text: { model: string };
  basic_image: { model: string };
  long_text: { model: string };
}

export type BoxAIAgent = BoxAIAgentId | BoxAIAgentConfig;

export interface BoxAIExtractRequest {
  items: Array<{ id: string; type: 'file' }>;
  fields?: BoxAIField[];
  metadata_template?: BoxAIMetadataTemplate;
  ai_agent?: BoxAIAgent;
}

// ===== RESPONSE TYPES =====

export interface BoxAIModelInfo {
  name: string;
  provider: string;
  purpose?: string;
}

export interface BoxAIAgentInfo {
  processor: string;
  models: BoxAIModelInfo[];
}

export interface BoxAIExtractResponse {
  answer: Record<string, any>;
  ai_agent_info?: BoxAIAgentInfo;
  created_at: string;
  completion_reason: string;
}

// Legacy response format
export interface BoxAIExtractResponseLegacy {
  entries: Array<{
    status: 'success' | 'error';
    answer?: Record<string, any>;
    message?: string;
  }>;
}

export type BoxAIResponse = BoxAIExtractResponse | BoxAIExtractResponseLegacy;

// ===== SERVICE TYPES =====

export interface BoxAIExtractParams {
  fileId: string;
  fields?: BoxAIField[];
  model: string;
  templateKey?: string;
}

export interface BoxAIExtractResult {
  data: Record<string, any>;
  metadata?: {
    model: string;
    processor: string;
    duration: number;
  };
}
```

**File**: `src/lib/types/orchestration.ts` (NEW)

```typescript
/**
 * Orchestration Types
 */

import type { ApiExtractionResult, FileResult } from './index';

export interface ExtractionJob {
  fileId: string;
  fileName: string;
  modelName: string;
  fields: any[]; // TODO: Use BoxAIField after refactoring
}

export interface ExtractionProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  currentFile: string;
  currentModel: string;
  startTime: Date;
  estimatedTimeRemaining: number;
}

export interface ExtractionMetrics {
  totalJobs: number;
  completedJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageResponseTime: number;
  totalDuration: number;
}

export interface ComparisonRunResult {
  runId: string;
  sessionId: string;
  results: FileResult[];
  apiResults: ApiExtractionResult[];
  metrics: ExtractionMetrics;
  timestamp: string;
}
```

#### Implementation Checklist
- [ ] Create `src/lib/types/box-ai.ts`
- [ ] Create `src/lib/types/orchestration.ts`
- [ ] Update `src/services/box.ts` to use new types
- [ ] Update orchestration files to use new types
- [ ] Run TypeScript check
- [ ] Fix any type errors
- [ ] Remove `any` types systematically

---

### 3.2 Add Input Validation
**Status**: NICE TO HAVE  
**Effort**: 4-6 hours  
**Risk**: LOW

#### Proposed Solution: Zod Schema Validation

**File**: `src/lib/validation/extraction-schemas.ts` (NEW)

```typescript
/**
 * Validation schemas for extraction inputs
 */

import { z } from 'zod';

export const ExtractionJobSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  modelName: z.string().min(1),
  fields: z.array(z.object({
    key: z.string().min(1),
    type: z.enum(['string', 'date', 'enum', 'number', 'multiSelect']),
    displayName: z.string().min(1),
    prompt: z.string().optional(),
    options: z.array(z.object({ key: z.string() })).optional()
  }))
});

export const ExtractMetadataInputSchema = z.object({
  fileId: z.string().min(1),
  fields: z.array(z.any()).optional(),
  model: z.string().min(1),
  templateKey: z.string().optional()
});

// Type inference from schema
export type ValidatedExtractionJob = z.infer<typeof ExtractionJobSchema>;
export type ValidatedExtractMetadataInput = z.infer<typeof ExtractMetadataInputSchema>;
```

#### Implementation Checklist
- [ ] Install zod if not already present
- [ ] Create validation schemas
- [ ] Add validation at service boundaries
- [ ] Add user-friendly validation error messages
- [ ] Test with invalid inputs

---

## Phase 4: Performance Optimization (Priority: 🟢 LOW)

### 4.1 Add Response Caching Layer
**Status**: NICE TO HAVE  
**Effort**: 3-4 hours  
**Risk**: LOW

#### Current Issue
- Templates fetched repeatedly
- Token refreshes more often than needed
- No caching of extraction results

#### Proposed Solution

**File**: `src/lib/cache/extraction-cache.ts` (NEW)

```typescript
/**
 * Extraction Cache
 * 
 * Caches:
 * - Box AI responses (for retries)
 * - Template definitions
 * - Token information
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class ExtractionCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Cache extraction result (for retry scenarios)
   */
  cacheExtractionResult(
    fileId: string,
    modelName: string,
    result: any
  ): void {
    const key = `extraction:${fileId}:${modelName}`;
    this.set(key, result, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Get cached extraction result
   */
  getCachedExtractionResult(
    fileId: string,
    modelName: string
  ): any | null {
    const key = `extraction:${fileId}:${modelName}`;
    return this.get(key);
  }
}

// Export singleton
export const extractionCache = new ExtractionCache();
```

#### Implementation Checklist
- [ ] Create cache implementation
- [ ] Add caching to template fetches
- [ ] Add caching to token management
- [ ] Add optional caching to extractions (for retries)
- [ ] Add cache invalidation on data changes
- [ ] Test cache hit/miss scenarios

---

### 4.2 Optimize State Updates
**Status**: NICE TO HAVE  
**Effort**: 4-6 hours  
**Risk**: LOW

#### Current Issues
- Multiple re-renders during extraction
- Heavy state objects copied frequently
- No memoization of expensive calculations

#### Proposed Solutions

**1. Add React.memo to expensive components**

```typescript
// src/components/extraction-table.tsx
export const ExtractionTable = React.memo(({ 
  data, 
  onCellEdit 
}: ExtractionTableProps) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.data === nextProps.data;
});
```

**2. Use useMemo for expensive calculations**

```typescript
// Memoize field metrics calculations
const metrics = useMemo(() => {
  return calculateFieldMetrics(accuracyData);
}, [accuracyData.results, accuracyData.fields]);
```

**3. Optimize state updates with immer**

```typescript
import { produce } from 'immer';

// Instead of deep cloning
const newData = JSON.parse(JSON.stringify(data));

// Use immer for efficient updates
const newData = produce(data, draft => {
  draft.results[0].fields.fieldKey.modelName = 'new value';
});
```

#### Implementation Checklist
- [ ] Add React.memo to large components
- [ ] Add useMemo to expensive calculations
- [ ] Consider adding immer for state updates
- [ ] Profile re-render performance
- [ ] Measure improvement

---

## Phase 5: Enhanced Error Handling (Priority: 🟡 MEDIUM)

### 5.1 Implement Circuit Breaker Pattern
**Status**: NICE TO HAVE  
**Effort**: 4-6 hours  
**Risk**: LOW

#### Purpose
Prevent cascading failures when Box AI is experiencing issues

#### Proposed Solution

**File**: `src/lib/resilience/circuit-breaker.ts` (NEW)

```typescript
/**
 * Circuit Breaker
 * 
 * Protects against cascading failures by:
 * - Opening circuit after N failures
 * - Allowing test requests to check recovery
 * - Closing circuit when service recovers
 */

enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing recovery
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(
    threshold: number = 5,      // Open after 5 failures
    timeout: number = 60000,    // Wait 1 minute before half-open
    resetTimeout: number = 30000 // Close after 30 seconds of success
  ) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker half-open, testing recovery');
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info('Circuit breaker CLOSED - service recovered');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
      logger.error('Circuit breaker OPEN - too many failures', {
        failureCount: this.failureCount,
        threshold: this.threshold
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Export singleton for Box AI
export const boxAICircuitBreaker = new CircuitBreaker(5, 60000, 30000);
```

#### Integration with Box Service

```typescript
// src/services/box.ts

import { boxAICircuitBreaker } from '@/lib/resilience/circuit-breaker';

export async function extractStructuredMetadataWithBoxAI(
  params: BoxAIExtractParams
): Promise<Record<string, any>> {
  // Wrap with circuit breaker
  return boxAICircuitBreaker.execute(async () => {
    // Existing extraction logic
    // ...
  });
}
```

#### Implementation Checklist
- [ ] Create circuit breaker implementation
- [ ] Integrate with Box AI service
- [ ] Add circuit state monitoring
- [ ] Test failure scenarios
- [ ] Add user-facing circuit status indicator

---

## 📊 Success Metrics

### Key Performance Indicators

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Production Logs** | 505 console statements | < 50 in production | Count in build output |
| **Type Safety** | 138 `any` types | < 20 `any` types | TypeScript compiler |
| **Build Time** | Unknown | < 60 seconds | `npm run build` |
| **Hook Re-renders** | High | Reduced by 40% | React DevTools Profiler |
| **Error Recovery** | 1 retry attempt | Circuit breaker | Monitor failure rates |
| **Concurrency** | Fixed at 5 | Adaptive 2-10 | Monitor throughput |
| **Test Coverage** | Low | > 70% orchestration | Jest coverage |

---

## 🎯 Implementation Priorities

### Week 1: Critical (Must Do)
1. ✅ Production-ready logging system (4-6h)
2. ✅ Remove build error suppression (1h + fixes)
3. ✅ Fix revealed TypeScript/ESLint errors (varies)

### Week 2: Important (Should Do)
1. ✅ Create orchestration service layer (8-12h)
2. ✅ Refactor comparison runner (4-6h)
3. ✅ Add type definitions for Box AI (4-6h)

### Week 3: Nice to Have (Could Do)
1. ✅ Implement adaptive concurrency (3-4h)
2. ✅ Add response caching (3-4h)
3. ✅ Circuit breaker pattern (4-6h)

### Week 4: Polish (Nice to Do)
1. ✅ Input validation with Zod (4-6h)
2. ✅ Performance optimization (4-6h)
3. ✅ Comprehensive testing (varies)

---

## ⚠️ Risk Mitigation

### Risk: Breaking Box AI Integration

**Mitigation Strategies:**
1. ✅ **Test Suite**: Create integration tests before refactoring
2. ✅ **Feature Flags**: Use environment variables to enable/disable new features
3. ✅ **Incremental Rollout**: Implement changes in small, testable chunks
4. ✅ **Rollback Plan**: Keep old code paths until new ones proven
5. ✅ **Monitoring**: Add extensive logging during transition

### Risk: Performance Regression

**Mitigation Strategies:**
1. ✅ **Baseline Metrics**: Measure current performance before changes
2. ✅ **Load Testing**: Test with various file/model combinations
3. ✅ **Profiling**: Use React DevTools and Chrome DevTools
4. ✅ **Benchmarks**: Create automated performance tests

### Risk: Type Errors Revealed

**Mitigation Strategies:**
1. ✅ **Gradual Strictness**: Fix one file at a time
2. ✅ **Type Shims**: Create temporary type shims if needed
3. ✅ **Team Review**: Get input on complex type issues
4. ✅ **Documentation**: Document non-obvious type decisions

---

## 🧪 Testing Strategy

### Unit Tests (New)
- [ ] Extraction orchestrator logic
- [ ] Adaptive concurrency manager
- [ ] Circuit breaker behavior
- [ ] Cache operations
- [ ] Logger functionality

### Integration Tests (Enhance)
- [ ] Full extraction flow
- [ ] Prompted vs non-prompted extraction
- [ ] Error handling and retries
- [ ] Progress tracking
- [ ] State updates

### End-to-End Tests (Critical)
- [ ] Select documents → run extraction → view results
- [ ] Edit prompts → re-run → compare versions
- [ ] Handle network failures gracefully
- [ ] Circuit breaker activation/recovery
- [ ] Concurrent extractions

---

## 📖 Documentation Updates

### Developer Documentation
- [ ] Update architecture diagrams
- [ ] Document orchestration service
- [ ] Explain hook simplification
- [ ] Type safety guidelines
- [ ] Performance best practices

### API Documentation
- [ ] Box AI integration guide
- [ ] Error handling patterns
- [ ] Retry strategies
- [ ] Concurrency tuning

---

## ✅ Acceptance Criteria

### Phase 1 Complete When:
- [ ] < 50 console.log statements in production build
- [ ] No TypeScript errors in build
- [ ] No ESLint errors in build
- [ ] All existing tests pass

### Phase 2 Complete When:
- [ ] Orchestration service fully functional
- [ ] Comparison runner simplified
- [ ] No circular hook dependencies
- [ ] Performance equal or better than current

### Phase 3 Complete When:
- [ ] < 20 `any` types in codebase
- [ ] All Box AI types properly defined
- [ ] Input validation on all external data
- [ ] Strong type checking enabled

### Phase 4 Complete When:
- [ ] Caching layer operational
- [ ] Adaptive concurrency working
- [ ] 40% reduction in re-renders
- [ ] Measurable performance improvement

### Phase 5 Complete When:
- [ ] Circuit breaker integrated
- [ ] Graceful degradation on failures
- [ ] User-facing error messages improved
- [ ] Error recovery rate > 80%

---

## 🚀 Deployment Strategy

### Stage 1: Development
- Implement changes on feature branch
- Extensive local testing
- Code review with team

### Stage 2: Staging
- Deploy to staging environment
- Run full test suite
- Load testing with production-like data
- Monitor performance metrics

### Stage 3: Production (Gradual)
- Deploy logging improvements first (low risk)
- Deploy type safety improvements (low risk)
- Deploy orchestration refactoring (medium risk - extensive testing)
- Deploy performance optimizations last (monitor closely)

### Rollback Plan
- Keep old code paths with feature flags
- Monitor error rates closely after deployment
- Be prepared to disable new features via environment variables
- Full rollback procedure documented

---

## 📞 Questions & Discussion

### Open Questions
1. **Concurrency Limits**: What are Box AI's actual rate limits?
2. **Caching Strategy**: Should we cache extraction results? For how long?
3. **Error Recovery**: What's acceptable failure rate in production?
4. **Performance Targets**: What's the target extraction throughput?

### Discussion Points
1. Is the orchestration service pattern preferred over hooks?
2. Should we add request queuing for very large batches?
3. Do we need offline support / retry queue persistence?
4. Should we implement request deduplication?

---

## 📝 Notes

### Assumptions
- Box AI rate limits: ~10 requests/second (needs confirmation)
- Average extraction time: 2-5 seconds per file
- Concurrent extractions: 5 is reasonable starting point
- Token expiration: 55 minutes (current implementation)

### Dependencies
- No new npm packages required for Phase 1-2
- May need `immer` for Phase 4 state optimization
- May need enhanced `zod` usage for Phase 3

### Future Enhancements (Out of Scope)
- Real-time collaboration
- Extraction result streaming
- Batch optimization algorithms
- ML-based prompt suggestions
- Advanced analytics dashboard

---

## 🎓 Lessons from Recent Updates

### From Remote Updates (commit a9b810e)
- Major testing improvements implemented
- Logging already enhanced (build on this)
- UI improvements completed
- Smart file selection added to Prompt Studio

### From Refactoring (REFACTORING_SUMMARY.md)
- Dual system utility working well
- State management unified successfully
- No duplication after recent fixes
- Clean separation of concerns achieved

### Key Takeaways
✅ Incremental improvements work better than big rewrites  
✅ Keep Box AI integration sacred - don't touch if working  
✅ Logging is critical but currently too verbose  
✅ Orchestration is complex but can be simplified  
✅ Type safety improves confidence in refactoring  

---

**END OF PLAN**

**Next Step**: Review this plan with the team, prioritize based on business needs, and get approval before implementation.

**Estimated Total Effort**: 40-60 hours across 4 weeks  
**Risk Level**: LOW to MEDIUM (with proper testing)  
**Expected Impact**: HIGH (significant maintainability and robustness improvements)

