/**
 * Performance tests for batch extraction API
 * Verifies that batch extraction runs in parallel and is faster than sequential
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractMetadataBatch } from '@/ai/flows/batch-metadata-extraction';
import type { BatchExtractionJob } from '@/ai/flows/batch-metadata-extraction';

// Mock the Box AI service
vi.mock('@/services/box', () => ({
  extractStructuredMetadataWithBoxAI: vi.fn()
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

import { extractStructuredMetadataWithBoxAI } from '@/services/box';

describe('Batch Extraction Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process multiple jobs in parallel with progress callbacks', async () => {
    // Track concurrent execution
    let concurrentCount = 0;
    let maxConcurrent = 0;

    // Mock extraction with realistic timing
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      
      // Simulate Box AI latency (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      concurrentCount--;
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    // Create 20 extraction jobs
    const jobs: BatchExtractionJob[] = Array.from({ length: 20 }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${i}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }));

    // Track progress callbacks
    const progressUpdates: Array<{ completed: number; total: number }> = [];

    const startTime = Date.now();
    const results = await extractMetadataBatch(
      jobs, 
      10, // New concurrency limit of 10
      (result, completed, total) => {
        progressUpdates.push({ completed, total });
      }
    );
    const duration = Date.now() - startTime;

    // Verify results
    expect(results).toHaveLength(20);
    expect(results.every(r => r.success)).toBe(true);

    // Verify progress callbacks were fired
    expect(progressUpdates).toHaveLength(20); // One per job
    expect(progressUpdates[0]).toEqual({ completed: 1, total: 20 });
    expect(progressUpdates[19]).toEqual({ completed: 20, total: 20 });

    // Verify parallel execution
    // With 10 concurrent, 20 jobs should take ~1000ms (2 batches of 500ms each)
    expect(duration).toBeLessThan(1500); // Should be much faster than 10000ms (sequential)
    expect(maxConcurrent).toBeGreaterThan(1); // Verify actual parallelism
    expect(maxConcurrent).toBeLessThanOrEqual(10); // Respects concurrency limit
    
    console.log(`✓ Progress callbacks fired: ${progressUpdates.length}, Max concurrent: ${maxConcurrent}`);
  });

  it('should be faster with 30 files than sequential processing', async () => {
    // Mock extraction with realistic timing
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    // Create 30 extraction jobs (simulating 10 files x 3 models)
    const jobs: BatchExtractionJob[] = Array.from({ length: 30 }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${Math.floor(i / 3)}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: `model-${i % 3}`
    }));

    const startTime = Date.now();
    const results = await extractMetadataBatch(jobs, 10); // Increased to 10
    const duration = Date.now() - startTime;

    // Verify results
    expect(results).toHaveLength(30);
    expect(results.every(r => r.success)).toBe(true);

    // With 10 concurrent, 30 jobs @ 200ms each should take ~600ms (3 batches)
    // Sequential would take 6000ms (30 * 200ms)
    expect(duration).toBeLessThan(1000);
    
    console.log(`✓ Batch processing 30 jobs took ${duration}ms (would be ~6000ms sequential)`);
  });

  it('should handle 1 file as fast as multiple files', async () => {
    // Mock extraction
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    // Single job
    const singleJob: BatchExtractionJob[] = [{
      jobId: 'job-1',
      fileId: 'file-1',
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }];

    const startTime = Date.now();
    const results = await extractMetadataBatch(singleJob, 5);
    const duration = Date.now() - startTime;

    // Should complete quickly
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(duration).toBeLessThan(400);
    
    console.log(`✓ Single file extraction took ${duration}ms`);
  });

  it('should respect concurrency limit', async () => {
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    // Mock extraction that tracks concurrency
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      currentConcurrent--;
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    // Create 20 jobs
    const jobs: BatchExtractionJob[] = Array.from({ length: 20 }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${i}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }));

    // Test with concurrency limit of 3
    await extractMetadataBatch(jobs, 3);

    // Verify we never exceeded the limit
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThan(1); // But we did run in parallel
    
    console.log(`✓ Concurrency limit respected: max ${maxConcurrent} concurrent (limit: 3)`);
  });

  it('should handle errors gracefully without blocking other jobs', async () => {
    // Mock extraction where specific jobs fail based on fileId
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async ({ fileId }) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fail specific file IDs (every 3rd one: file-2, file-5, file-8)
      const fileIndex = parseInt(fileId.split('-')[1]);
      if ((fileIndex + 1) % 3 === 0) {
        throw new Error('Simulated extraction failure');
      }
      
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    // Create 9 jobs
    const jobs: BatchExtractionJob[] = Array.from({ length: 9 }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${i}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }));

    const startTime = Date.now();
    const results = await extractMetadataBatch(jobs, 5);
    const duration = Date.now() - startTime;

    // Verify results
    expect(results).toHaveLength(9);
    
    // Count successes and failures
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    expect(successful).toHaveLength(6); // 6 should succeed
    expect(failed).toHaveLength(3); // 3 should fail (file-2, file-5, file-8)
    
    // Verify the specific files that failed
    expect(failed[0].jobId).toBe('job-2');
    expect(failed[1].jobId).toBe('job-5');
    expect(failed[2].jobId).toBe('job-8');
    
    // Failed results should have error messages
    failed.forEach(result => {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Simulated extraction failure');
    });
    
    // Should still complete quickly despite errors
    expect(duration).toBeLessThan(500);
    
    console.log(`✓ Handled errors gracefully: ${successful.length} succeeded, ${failed.length} failed in ${duration}ms`);
  });

  it('should preserve job order in results', async () => {
    // Mock extraction with varying delays
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async ({ fileId }) => {
      // Random delay between 50-150ms
      const delay = 50 + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return { extractedData: { testField: `value-${fileId}` }, confidenceScores: { testField: 0.95 } };
    });

    // Create jobs with specific IDs
    const jobs: BatchExtractionJob[] = Array.from({ length: 10 }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${i}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }));

    const results = await extractMetadataBatch(jobs, 5);

    // Verify results are in the same order as input jobs
    results.forEach((result, index) => {
      expect(result.jobId).toBe(`job-${index}`);
      expect(result.data?.testField).toBe(`value-file-${index}`);
    });
    
    console.log('✓ Job order preserved despite parallel execution');
  });

  it('should provide performance metrics for each job', async () => {
    // Mock extraction
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    const jobs: BatchExtractionJob[] = Array.from({ length: 5 }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${i}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }));

    const results = await extractMetadataBatch(jobs, 3);

    // Verify all results have duration metrics
    results.forEach(result => {
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(150); // At least the simulated delay
    });
    
    const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
    console.log(`✓ Average job duration: ${avgDuration.toFixed(0)}ms`);
  });
});

describe('Batch Extraction vs Sequential Comparison', () => {
  it('should demonstrate significant speedup over sequential processing', async () => {
    const SIMULATED_LATENCY = 300; // ms per extraction
    const JOB_COUNT = 30;
    const CONCURRENCY_LIMIT = 10; // Increased from 5 to 10

    // Mock extraction
    vi.mocked(extractStructuredMetadataWithBoxAI).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, SIMULATED_LATENCY));
      return { extractedData: { testField: 'extracted value' }, confidenceScores: { testField: 0.95 } };
    });

    const jobs: BatchExtractionJob[] = Array.from({ length: JOB_COUNT }, (_, i) => ({
      jobId: `job-${i}`,
      fileId: `file-${i}`,
      fields: [{ key: 'testField', type: 'string', displayName: 'Test Field' }],
      model: 'azure_openai__gpt_4o_mini'
    }));

    // Measure batch processing time with progress tracking
    let progressCallbackCount = 0;
    const batchStartTime = Date.now();
    await extractMetadataBatch(jobs, CONCURRENCY_LIMIT, () => {
      progressCallbackCount++;
    });
    const batchDuration = Date.now() - batchStartTime;

    // Calculate expected sequential time
    const sequentialTime = JOB_COUNT * SIMULATED_LATENCY;
    
    // Calculate expected parallel time (with concurrency limit)
    const batches = Math.ceil(JOB_COUNT / CONCURRENCY_LIMIT);
    const expectedParallelTime = batches * SIMULATED_LATENCY;

    console.log('\n=== Performance Comparison ===');
    console.log(`Jobs: ${JOB_COUNT}, Concurrency: ${CONCURRENCY_LIMIT}`);
    console.log(`Sequential time (theoretical): ${sequentialTime}ms`);
    console.log(`Expected parallel time: ${expectedParallelTime}ms`);
    console.log(`Actual batch time: ${batchDuration}ms`);
    console.log(`Speedup: ${(sequentialTime / batchDuration).toFixed(2)}x faster`);
    console.log(`Progress callbacks: ${progressCallbackCount}/${JOB_COUNT}`);
    console.log('==============================\n');

    // Verify progress callbacks were fired
    expect(progressCallbackCount).toBe(JOB_COUNT);

    // Verify we're significantly faster than sequential
    expect(batchDuration).toBeLessThan(sequentialTime * 0.5); // At least 2x faster
    
    // Verify we're close to the expected parallel time (with some overhead tolerance)
    expect(batchDuration).toBeLessThan(expectedParallelTime * 1.3); // Within 30% overhead
  });
});

