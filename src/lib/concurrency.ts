/**
 * @fileoverview Concurrency utilities for managing asynchronous operations.
 */

/**
 * Processes a list of items with a controlled level of concurrency.
 *
 * This function maintains a "pool" of active promises, ensuring that no more
 * than `limit` tasks are running at the same time. This is more efficient
 * than sequential batches as it starts new tasks as soon as old ones finish.
 *
 * @template T - The type of items in the input array.
 * @template R - The type of the result from the processing function.
 *
 * @param {T[]} items - The array of items to process.
 * @param {number} limit - The maximum number of concurrent tasks.
 * @param {(item: T) => Promise<R>} fn - The asynchronous function to apply to each item.
 * @returns {Promise<R[]>} A promise that resolves to an array of all results in the original order.
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Set<Promise<void>> = new Set();
  
  // Track timing for diagnostics
  const startTimes: number[] = [];
  const endTimes: number[] = [];
  const batchStartTime = Date.now();

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const item = items[i];
    
    // Create a tracked promise for this item
    const itemPromise = (async () => {
      startTimes[index] = Date.now() - batchStartTime;
      
      try {
        const result = await fn(item);
        results[index] = result;
        endTimes[index] = Date.now() - batchStartTime;
      } catch (error) {
        endTimes[index] = Date.now() - batchStartTime;
        throw error;
      }
    })();

    // Track the promise and auto-remove when done
    const trackedPromise = itemPromise.finally(() => {
      executing.delete(trackedPromise);
    });
    
    executing.add(trackedPromise);

    // Wait for a slot to open if we've hit the limit
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining items to complete
  await Promise.all(executing);
  
  // Log timing diagnostics if there were multiple items
  if (items.length > 1) {
    const overlapCount = countOverlaps(startTimes, endTimes);
    console.log(`[processWithConcurrency] Processed ${items.length} items with limit ${limit}`);
    console.log(`[processWithConcurrency] Overlapping pairs: ${overlapCount} (indicates parallel execution)`);
    console.log(`[processWithConcurrency] Total time: ${Date.now() - batchStartTime}ms`);
  }

  return results;
}

/**
 * Count how many item pairs had overlapping execution times.
 * Higher number = more parallelism.
 */
function countOverlaps(startTimes: number[], endTimes: number[]): number {
  let count = 0;
  for (let i = 0; i < startTimes.length; i++) {
    for (let j = i + 1; j < startTimes.length; j++) {
      // Check if items i and j overlapped in time
      if (startTimes[i] < endTimes[j] && startTimes[j] < endTimes[i]) {
        count++;
      }
    }
  }
  return count;
} 