/**
 * Configuration for Agent-Alpha agentic prompt optimization
 */

export const AGENT_ALPHA_CONFIG = {
  // Maximum number of documents to sample for testing
  MAX_DOCS: 3,

  // Maximum iterations per field before giving up
  MAX_ITERATIONS: 5,

  // Target accuracy (100% = 1.0)
  TARGET_ACCURACY: 1.0,

  // Model to use for prompt generation
  // Claude 4 Sonnet - great balance of quality and cost
  PROMPT_GEN_MODEL: 'aws__claude_4_sonnet',

  // API timeout in milliseconds
  API_TIMEOUT_MS: 30000,
} as const;

