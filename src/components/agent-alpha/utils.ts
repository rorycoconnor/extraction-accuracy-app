/**
 * Utility functions for Agent-Alpha modal components
 */

import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import type { AgentAlphaPendingResults } from '@/lib/agent-alpha-types';

export function calculateAvgImprovement(results: AgentAlphaPendingResults['results']): string {
  if (results.length === 0) return '0.0';
  const totalImprovement = results.reduce((sum, r) => sum + (r.finalAccuracy - r.initialAccuracy), 0);
  return ((totalImprovement / results.length) * 100).toFixed(1);
}

export function formatEstimatedTime(totalFields: number, maxIterations?: number, maxDocs?: number): string {
  const iterations = maxIterations || AGENT_ALPHA_CONFIG.MAX_ITERATIONS;
  const docs = maxDocs || AGENT_ALPHA_CONFIG.MAX_DOCS;
  const fieldConcurrency = AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY;
  
  // With parallelization:
  // - Documents are extracted in parallel (5 at a time)
  // - Fields are processed in parallel (2 at a time)
  // Each iteration takes ~6-8 seconds (parallel doc extraction)
  // Average iterations per field is typically ~2-3 (not always max)
  const avgIterationsPerField = Math.min(iterations, 3);
  const secondsPerIteration = 6 + (docs / AGENT_ALPHA_CONFIG.EXTRACTION_CONCURRENCY) * 3;
  const secondsPerField = avgIterationsPerField * secondsPerIteration;
  
  // Fields processed in parallel batches
  const fieldBatches = Math.ceil(totalFields / fieldConcurrency);
  const estimatedSeconds = fieldBatches * secondsPerField;
  
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = Math.round(estimatedSeconds % 60);
  
  if (minutes === 0) {
    return `~${seconds}s`;
  }
  return `~${minutes}m ${seconds}s`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function formatTimeDifference(actualMs: number, estimatedMs: number): string {
  const diffMs = Math.abs(actualMs - estimatedMs);
  const diffSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  
  const sign = actualMs <= estimatedMs ? '-' : '+';
  if (minutes === 0) {
    return `${sign}${seconds}s`;
  }
  return `${sign}${minutes}m ${seconds}s`;
}

// Calculate total time from individual field results when actualTimeMs is 0
export function calculateTotalTimeFromResults(results: AgentAlphaPendingResults['results']): string {
  // This is a fallback - ideally actualTimeMs should be set properly
  // Estimate ~70 seconds per field based on observed logs
  const estimatedMs = results.length * 70 * 1000;
  return formatDuration(estimatedMs);
}
