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

export interface BatchExtractionJob extends ExtractMetadataInput {
  jobId: string; // Unique identifier for tracking this specific job
}

export interface BatchExtractionResult {
  jobId: string;
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  duration?: number;
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
export async function extractMetadataBatch(
  jobs: BatchExtractionJob[],
  concurrencyLimit: number = 10,
  onProgress?: BatchProgressCallback
): Promise<BatchExtractionResult[]> {
  const startTime = Date.now();
  
  logger.info('Starting batch extraction', {
    jobCount: jobs.length,
    concurrencyLimit,
    fileIds: jobs.map(j => j.fileId).slice(0, 5) // Log first 5 file IDs
  });

  // Track completion for progress callbacks
  let completedCount = 0;
  const totalCount = jobs.length;

  // Process all jobs with concurrency control
  const results = await processWithConcurrency(
    jobs,
    concurrencyLimit,
    async (job) => {
      const jobStartTime = Date.now();
      
      try {
        logger.debug('Processing extraction job', {
          jobId: job.jobId,
          fileId: job.fileId,
          model: job.model,
          hasTemplate: !!job.templateKey,
          fieldCount: job.fields?.length || 0
        });

        // Call Box AI directly - token acquisition happens inside but is cached
        const extractedData = await extractStructuredMetadataWithBoxAI({
          fileId: job.fileId,
          fields: job.fields,
          model: job.model,
          templateKey: job.templateKey
        });

        const duration = Date.now() - jobStartTime;

        logger.debug('Extraction job successful', {
          jobId: job.jobId,
          fileId: job.fileId,
          model: job.model,
          duration,
          extractedFieldCount: Object.keys(extractedData).length
        });

        const result: BatchExtractionResult = {
          jobId: job.jobId,
          success: true,
          data: extractedData,
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

        logger.error('Extraction job failed', {
          jobId: job.jobId,
          fileId: job.fileId,
          model: job.model,
          error: errorMessage,
          duration
        });

        const result: BatchExtractionResult = {
          jobId: job.jobId,
          success: false,
          error: errorMessage,
          duration
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
    data: result.data || {}
  };
}

