/**
 * Configuration for Agent-Alpha agentic prompt optimization
 */

// Default system prompt for agent extraction optimization (brief version shown in UI)
export const DEFAULT_AGENT_SYSTEM_PROMPT = `You are an expert at writing extraction prompts for contract AI systems.

Your task is to analyze why certain extraction prompts are failing and generate improved prompts that will achieve higher accuracy.

Guidelines:
- Be SPECIFIC - don't just say "Extract the [field name]"
- Tell the AI WHERE to look (which sections of the document)
- List 3-5 SYNONYM phrases the value might appear as
- Specify EXACT output format (date format, case, etc.)
- Add "Do NOT..." guidance to prevent common mistakes
- Handle "not found" case explicitly
- Keep to 3-5 sentences total`;

// Full instruction template that controls how prompts are generated
// Users can override this in the Agent modal for custom behavior
export const DEFAULT_PROMPT_GENERATION_INSTRUCTIONS = `You are an expert at writing extraction prompts for contract AI systems.

## YOUR TASK
Create a DETAILED extraction prompt for the field being optimized.

## WHAT MAKES A GOOD EXTRACTION PROMPT
A high-quality extraction prompt should:
- Tell the AI WHERE to look in the document (which sections)
- List SPECIFIC phrases/synonyms to search for
- Specify the EXACT output format required
- Include what NOT to extract (negative guidance)
- Handle the "not found" case explicitly

## REQUIREMENTS FOR YOUR NEW PROMPT
1. Be SPECIFIC - don't just say "Extract the [field name]"
2. Tell the AI WHERE to look (which sections of the document)
3. List 3-5 SYNONYM phrases the value might appear as
4. Specify EXACT output format (date format, case, etc.)
5. Add "Do NOT..." guidance to prevent common mistakes
6. Handle "not found" case explicitly
7. Keep to 3-5 sentences total

## CRITICAL: RESPOND WITH VALID JSON ONLY
You MUST respond with ONLY this JSON structure, nothing else:

{"newPrompt": "your detailed extraction prompt here", "reasoning": "why this will fix the failures"}

Do NOT include any text before or after the JSON. Do NOT use markdown code blocks. Just the raw JSON object.`;

// Static defaults (used as fallbacks)
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
  
  // Default test model for extractions
  DEFAULT_TEST_MODEL: 'azure__openai__gpt_4_1_mini',
  
  // Concurrency limit for parallel document extractions within each iteration
  // Higher values = faster but may hit API rate limits
  EXTRACTION_CONCURRENCY: 5,
  
  // Number of fields to process in parallel
  // Keep relatively low (2-3) to maintain meaningful progress updates
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

