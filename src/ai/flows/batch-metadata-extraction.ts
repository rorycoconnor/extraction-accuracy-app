'use server';

import { logger } from '@/lib/logger';
import { extractStructuredMetadataWithBoxAI } from '@/services/box';
import { processWithConcurrency } from '@/lib/concurrency';
import type { ExtractMetadataInput, ExtractMetadataOutput } from '@/lib/schemas';

/**
 * @fileOverview Batch metadata extraction using Box AI with true server-side parallelization.
 * This eliminates the server action boundary bottleneck by processing all extractions
 * in a single server action call, acquiring the access token only once.
 */

// Global timeout for entire batch extraction (15 minutes)
// Enhanced Extract Agent with many fields can take 5-10 minutes per file
const BATCH_GLOBAL_TIMEOUT_MS = 900000; // 15 minutes

// Per-job timeout (10 minutes) - must be >= the Enhanced Agent timeout in box.ts
const JOB_TIMEOUT_MS = 600000; // 10 minutes

export interface BatchExtractionJob extends ExtractMetadataInput {
  jobId: string; // Unique identifier for tracking this specific job
}

export interface BatchExtractionResult {
  jobId: string;
  success: boolean;
  data?: Record<string, any>;
  confidenceScores?: Record<string, number>;
  error?: string;
  duration?: number;
  timedOut?: boolean;
}

export interface BatchProgressCallback {
  (completedJob: BatchExtractionResult, completedCount: number, totalCount: number): void;
}

/**
 * Process multiple extraction jobs in parallel on the server-side.
 * This is significantly faster than calling extractMetadata() individually because:
 * 1. Access token is acquired only once
 * 2. No server action boundary crossed for each extraction
 * 3. True parallel execution on the server
 * 
 * @param jobs - Array of extraction jobs to process
 * @param concurrencyLimit - Maximum number of concurrent extractions (default: 10)
 * @param onProgress - Optional callback fired as each extraction completes
 * @returns Array of results in the same order as input jobs
 */
/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, jobId: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Job ${jobId} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function extractMetadataBatch(
  jobs: BatchExtractionJob[],
  concurrencyLimit: number = 10,
  onProgress?: BatchProgressCallback
): Promise<BatchExtractionResult[]> {
  const startTime = Date.now();
  
  logger.info('Starting batch extraction', {
    jobCount: jobs.length,
    concurrencyLimit,
    fileIds: jobs.map(j => j.fileId).slice(0, 5), // Log first 5 file IDs
    globalTimeoutMs: BATCH_GLOBAL_TIMEOUT_MS,
    jobTimeoutMs: JOB_TIMEOUT_MS
  });

  // Track completion for progress callbacks
  let completedCount = 0;
  const totalCount = jobs.length;
  
  // Track if we've hit global timeout
  let globalTimeoutReached = false;
  const globalTimeoutId = setTimeout(() => {
    globalTimeoutReached = true;
    logger.warn('Global batch timeout reached', {
      timeoutMs: BATCH_GLOBAL_TIMEOUT_MS,
      completedCount,
      totalCount
    });
  }, BATCH_GLOBAL_TIMEOUT_MS);

  // Process all jobs with concurrency control and per-job timeout
  const results = await processWithConcurrency(
    jobs,
    concurrencyLimit,
    async (job) => {
      const jobStartTime = Date.now();
      
      // If global timeout already reached, fail fast
      if (globalTimeoutReached) {
        const result: BatchExtractionResult = {
          jobId: job.jobId,
          success: false,
          error: 'Global batch timeout exceeded - job cancelled',
          duration: Date.now() - jobStartTime,
          timedOut: true
        };
        completedCount++;
        if (onProgress) {
          onProgress(result, completedCount, totalCount);
        }
        return result;
      }
      
      try {
        logger.debug('Processing extraction job', {
          jobId: job.jobId,
          fileId: job.fileId,
          model: job.model,
          hasTemplate: !!job.templateKey,
          fieldCount: job.fields?.length || 0
        });

        // Call Box AI with per-job timeout
        const extractionPromise = extractStructuredMetadataWithBoxAI({
          fileId: job.fileId,
          fields: job.fields,
          model: job.model,
          templateKey: job.templateKey
        });
        
        const { extractedData, confidenceScores } = await withTimeout(
          extractionPromise, 
          JOB_TIMEOUT_MS, 
          job.jobId
        );

        const duration = Date.now() - jobStartTime;

        logger.debug('Extraction job successful', {
          jobId: job.jobId,
          fileId: job.fileId,
          model: job.model,
          duration,
          extractedFieldCount: Object.keys(extractedData).length,
          hasConfidenceScores: !!confidenceScores,
          confidenceScoreCount: confidenceScores ? Object.keys(confidenceScores).length : 0
        });

        const result: BatchExtractionResult = {
          jobId: job.jobId,
          success: true,
          data: extractedData,
          confidenceScores,
          duration
        };

        // Fire progress callback if provided
        completedCount++;
        if (onProgress) {
          onProgress(result, completedCount, totalCount);
        }

        return result;

      } catch (error) {
        const duration = Date.now() - jobStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes('timed out');

        logger.error('Extraction job failed', {
          jobId: job.jobId,
          fileId: job.fileId,
          model: job.model,
          error: errorMessage,
          duration,
          timedOut: isTimeout
        });

        const result: BatchExtractionResult = {
          jobId: job.jobId,
          success: false,
          error: isTimeout ? `Extraction timed out after ${JOB_TIMEOUT_MS / 1000}s` : errorMessage,
          duration,
          timedOut: isTimeout
        };

        // Fire progress callback even for failures
        completedCount++;
        if (onProgress) {
          onProgress(result, completedCount, totalCount);
        }

        return result;
      }
    }
  );
  
  // Clean up global timeout
  clearTimeout(globalTimeoutId);

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  logger.info('Batch extraction complete', {
    total: jobs.length,
    successful: successCount,
    failed: failedCount,
    totalDuration,
    averageDuration: totalDuration / jobs.length,
    concurrencyLimit
  });

  return results;
}

/**
 * Single extraction wrapper that uses the batch API under the hood.
 * This maintains backward compatibility while gaining the performance benefits.
 */
export async function extractMetadata(input: ExtractMetadataInput): Promise<ExtractMetadataOutput> {
  const job: BatchExtractionJob = {
    ...input,
    jobId: `single-${Date.now()}`
  };

  const results = await extractMetadataBatch([job], 1);
  const result = results[0];

  if (!result.success) {
    throw new Error(result.error || 'Extraction failed');
  }

  return {
    data: result.data || {},
    confidenceScores: result.confidenceScores
  };
}

