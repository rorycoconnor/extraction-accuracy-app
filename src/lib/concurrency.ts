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
  const results: Promise<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = fn(item).then(res => {
      // When a promise resolves, remove it from the executing pool
      const index = executing.indexOf(e);
      if (index > -1) {
        executing.splice(index, 1);
      }
      return res;
    });

    results.push(p);

    const e = p.then(() => {});
    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
} 