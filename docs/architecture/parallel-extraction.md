# Parallel AI Extraction Architecture

## Overview

The application uses true server-side parallel processing for AI extraction calls, eliminating the Next.js Server Action boundary bottleneck that previously caused sequential execution.

## Problem Solved

The app had parallel processing code (`processWithConcurrency`), but it wasn't actually running in parallel due to:

1. **Server Action Bottleneck**: Each `extractMetadata()` call crossed the Next.js Server Action boundary individually
2. **Token Acquisition Overhead**: `getAccessToken()` called for every extraction via `await cookies()`
3. **Sequential Server Boundaries**: While promises fired in parallel on the client, each waited for server action processing

## Solution: Batch Extraction API

Created `extractMetadataBatch` in `src/ai/flows/batch-metadata-extraction.ts` that:
- Accepts multiple extraction jobs in a single server action call
- Acquires access token once (leveraging existing caching)
- Processes all extractions in true parallel on the server-side
- Returns all results together
- Maintains existing error handling and retry logic

### Architecture

```
CLIENT (Browser)
  Prepare Jobs (e.g., 15 jobs)
    |
    | Single Batch Call (one server action)
    v
SERVER (Next.js)
  extractMetadataBatch
    1. Get Access Token (once)
    2. Process with Concurrency (10 parallel)
       Batch 1: [Job1] [Job2] [Job3] ... [Job10]  --> Box AI API
       Batch 2: [Job11] [Job12] ... [Job15]        --> Box AI API
    3. Return all results
    |
    | Results + progress callbacks
    v
CLIENT (Browser)
  Update UI (real-time progress)
```

## Real-Time Progress

Progress callbacks fire as each extraction completes:

```typescript
export interface BatchProgressCallback {
  (completedJob: BatchExtractionResult, completedCount: number, totalCount: number): void;
}

export async function extractMetadataBatch(
  jobs: BatchExtractionJob[],
  concurrencyLimit: number = 10,
  onProgress?: BatchProgressCallback
): Promise<BatchExtractionResult[]>
```

### What Users See
- Button shows "Processing 5/34 extractions" with live count updates
- Table cells fill in as extractions complete
- Color coding updates in real-time
- Smooth progress indication throughout

## Performance

### Concurrency: 10 parallel requests

| Scenario   | Files | Models | Total Jobs | Sequential | Parallel (10) | Speedup |
|------------|-------|--------|------------|------------|---------------|---------|
| Small      | 1     | 3      | 3          | 6-9s       | 2-3s          | 2-3x    |
| Medium     | 5     | 3      | 15         | 30-45s     | 4-6s          | ~5x     |
| Large      | 10    | 3      | 30         | 60-90s     | 6-9s          | ~10x    |
| Very Large | 30    | 3      | 90         | 3-5min     | 18-27s        | ~10x    |

**Automated test result**: 9.96x speedup over sequential processing.

### Why Concurrency 10?
- Box AI can handle 10+ concurrent requests
- Tested without rate limiting issues
- Good balance between speed and stability
- Can be adjusted if rate limiting (HTTP 429) occurs

## Key Files

| File | Role |
|------|------|
| `src/ai/flows/batch-metadata-extraction.ts` | Batch extraction server function |
| `src/hooks/use-model-extraction-runner.tsx` | Extraction runner hook (uses batch API) |
| `src/components/prompt-studio/prompt-studio-sheet.tsx` | Prompt Studio (uses batch API for testing) |
| `src/lib/concurrency.ts` | Generic concurrency utility |
| `src/__tests__/performance/batch-extraction.test.ts` | Performance tests (8 tests) |
