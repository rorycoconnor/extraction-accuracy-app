/**
 * Configuration for Agent-Alpha agentic prompt optimization
 */

import { REASONING_FIRST_PROMPT } from './agent-system-prompts';

// Default system prompt for agent extraction optimization (brief version shown in UI)
export const DEFAULT_AGENT_SYSTEM_PROMPT = `You are a Senior AI Optimization Engineer specializing in Legal & Financial Document Extraction.

Your GOAL is to fix extraction failures by engineering a robust, self-correcting prompt.

Guidelines:
- ANALYZE FAILURES: Why did the AI fail? Wrong value, missing value, or hallucination?
- DIAGNOSE ROOT CAUSE: What was missing in the old prompt?
- ALWAYS include: LOCATION, SYNONYMS (3-5), FORMAT, NEGATIVE CONSTRAINTS, NOT FOUND handling
- Minimum prompt length: 150 characters - short prompts = low accuracy`;

// Full instruction template that controls how prompts are generated
// Users can override this in the Agent modal for custom behavior
// DEFAULT: Uses REASONING_FIRST_PROMPT from agent-system-prompts.ts (Option 1 - Recommended)
export const DEFAULT_PROMPT_GENERATION_INSTRUCTIONS = REASONING_FIRST_PROMPT;

// Static defaults (used as fallbacks)
export const AGENT_ALPHA_CONFIG = {
  // Maximum number of documents to sample for testing
  MAX_DOCS: 5,

  // Maximum iterations per field before giving up
  MAX_ITERATIONS: 5,

  // Target accuracy (100% = 1.0)
  TARGET_ACCURACY: 1.0,

  // Model to use for prompt generation
  // Claude 4 Sonnet - great balance of quality and cost
  PROMPT_GEN_MODEL: 'aws__claude_4_sonnet',

  // API timeout in milliseconds
  API_TIMEOUT_MS: 30000,
  
  // Default test model for extractions
  DEFAULT_TEST_MODEL: 'azure__openai__gpt_4_1_mini',
  
  // Concurrency limit for parallel document extractions within each iteration
  // Higher values = faster but may hit API rate limits
  EXTRACTION_CONCURRENCY: 5,
  
  // Number of fields to process in parallel
  // Reduced to 2 to avoid Box API rate limits (429 errors)
  // Each field makes multiple API calls (extractions + text gen per iteration)
  FIELD_CONCURRENCY: 2,
} as const;

// User-configurable runtime options
export type AgentAlphaRuntimeConfig = {
  maxDocs: number;
  maxIterations: number;
  testModel: string;
  systemPromptOverride?: string; // If set, prepends to the default system prompt
  customInstructions?: string; // If set, replaces the full prompt generation template
};

// Get default runtime config
export function getDefaultRuntimeConfig(): AgentAlphaRuntimeConfig {
  return {
    maxDocs: AGENT_ALPHA_CONFIG.MAX_DOCS,
    maxIterations: AGENT_ALPHA_CONFIG.MAX_ITERATIONS,
    testModel: AGENT_ALPHA_CONFIG.DEFAULT_TEST_MODEL,
    systemPromptOverride: undefined,
    customInstructions: undefined,
  };
}

