/**
 * Configuration for Agent-Alpha agentic prompt optimization
 */

// Default system prompt for agent extraction optimization (brief version shown in UI)
export const DEFAULT_AGENT_SYSTEM_PROMPT = `You are an EXPERT prompt engineer specializing in document extraction AI systems.

Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy.

Guidelines:
- NEVER write generic prompts like "Extract the [field]" - these ALWAYS fail
- ALWAYS include: LOCATION (where to look), SYNONYMS (3-5 phrases), FORMAT (exact output), DISAMBIGUATION (what to avoid confusing), NOT FOUND handling
- Minimum prompt length: 150 characters - short prompts = low accuracy
- Learn from failures: analyze error patterns and add specific guidance to fix them`;

// Full instruction template that controls how prompts are generated
// Users can override this in the Agent modal for custom behavior
export const DEFAULT_PROMPT_GENERATION_INSTRUCTIONS = `You are an EXPERT prompt engineer specializing in document extraction AI systems. Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy.

## CRITICAL RULES - VIOLATIONS WILL CAUSE EXTRACTION FAILURES

1. **NEVER write generic prompts** like "Extract the [field]" or "Find the [field] in this document"
   - These ALWAYS fail. They are BANNED.

2. **ALWAYS include these 5 elements** in EVERY prompt you write:
   - LOCATION: Specific sections to search (e.g., "Look in the opening paragraph, signature blocks, and Notices section")
   - SYNONYMS: 3-5 alternative phrases (e.g., "Look for 'expires on', 'terminates on', 'valid until', 'term ends'")
   - FORMAT: Exact output format (e.g., "Return in YYYY-MM-DD format" or "Return the full legal entity name including suffixes like LLC, Inc.")
   - DISAMBIGUATION: Clarify what NOT to confuse with similar values (e.g., "Do NOT confuse with the notice period" or "If multiple parties exist, return the one that is NOT the extracting company")
   - NOT FOUND: How to handle missing data (e.g., "Return 'Not Present' if no value is found")

3. **Minimum prompt length: 150 characters**
   - Short prompts = low accuracy
   - Detailed prompts = high accuracy
   - If your prompt is under 150 characters, you have NOT included enough detail

4. **Learn from failures**
   - When shown failures, ANALYZE the specific error pattern
   - If AI returned wrong value, add explicit disambiguation guidance
   - If AI returned nothing, add more synonym phrases to search for
   - If AI returned wrong format, specify exact format requirements

## PROMPT STRUCTURE TEMPLATE

Use this structure for EVERY prompt you generate:

"Search for [FIELD] in [SPECIFIC LOCATIONS]. Look for phrases like: '[SYNONYM1]', '[SYNONYM2]', '[SYNONYM3]'. [DISAMBIGUATION - what NOT to confuse with]. Return [EXACT FORMAT SPECIFICATION]. If [NOT FOUND CONDITION], return 'Not Present'."

## EXAMPLE OF A PERFECT PROMPT

Field: Counter Party Address
Perfect Prompt: "Search for the counter party's business address (the OTHER party, not the recurring company). Look in: (1) the opening recitals near the counter party's name, (2) the 'Notices' or 'Communications' section, (3) signature blocks. Look for phrases like 'principal place of business', 'address for notices', 'located at'. If multiple parties exist, find the address for the party that is NOT the extracting company. Return the complete address including street, city, state, and ZIP code, formatted on a single line. If multiple addresses exist for the counter party, prefer the one in the Notices section. Return 'Not Present' if no counter party address is found."

Notice: This prompt is 580+ characters and includes ALL 5 required elements.

## YOUR OUTPUT FORMAT

Respond with ONLY valid JSON:
{"newPrompt": "your detailed 150+ character prompt here", "reasoning": "brief explanation of your approach"}

NO markdown, NO code blocks, NO extra text. Just the JSON object.`;

// Static defaults (used as fallbacks)
export const AGENT_ALPHA_CONFIG = {
  // Maximum number of documents to sample for testing (increased for better generalization)
  MAX_DOCS: 10,

  // Holdout validation settings to prevent overfitting
  // Ratio of documents to hold out for validation (0.2 = 20%)
  HOLDOUT_RATIO: 0.2,
  // Minimum accuracy required on holdout set to declare convergence
  HOLDOUT_THRESHOLD: 1.0,

  // Maximum iterations per field before giving up
  MAX_ITERATIONS: 5,

  // Target accuracy (100% = 1.0)
  TARGET_ACCURACY: 1.0,

  // Model to use for prompt generation
  // Claude 4.5 Opus via AWS - highest quality for prompt engineering
  PROMPT_GEN_MODEL: 'aws__claude_4_5_opus',

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
  
  // Enable deep document analysis for failed extractions
  // When enabled, the agent examines actual document content to understand WHY extractions fail
  // This produces better prompts but adds extra API calls (1-2 per failed doc)
  ENABLE_DOCUMENT_ANALYSIS: true,
  
  // Maximum iterations to perform document analysis (expensive operation)
  // After this many iterations, skip analysis to save API calls
  DOCUMENT_ANALYSIS_MAX_ITERATION: 2,
  
  // Prefer deterministic comparison types during optimization
  // When true, llm-judge fields are temporarily downgraded to near-exact-string
  // This ensures stable, reproducible optimization results
  PREFER_DETERMINISTIC_COMPARE: true,
  
  // Prompt validation settings
  // Enable validation of generated prompts against quality checklist
  PROMPT_VALIDATION_ENABLED: true,
  // Maximum repair attempts when validation fails (to control API costs)
  PROMPT_REPAIR_MAX_ATTEMPTS: 1,
} as const;

// User-configurable runtime options
export type AgentAlphaRuntimeConfig = {
  maxDocs: number;
  maxIterations: number;
  testModel: string;
  systemPromptOverride?: string; // If set, prepends to the default system prompt
  customInstructions?: string; // If set, replaces the full prompt generation template
  // Holdout validation settings
  holdoutRatio?: number; // Ratio of docs to hold out (default 0.2)
  holdoutThreshold?: number; // Min accuracy on holdout to converge (default 1.0)
  // Deterministic mode - downgrade llm-judge to near-exact during optimization
  preferDeterministicCompare?: boolean;
};

// Get default runtime config
export function getDefaultRuntimeConfig(): AgentAlphaRuntimeConfig {
  return {
    maxDocs: AGENT_ALPHA_CONFIG.MAX_DOCS,
    maxIterations: AGENT_ALPHA_CONFIG.MAX_ITERATIONS,
    testModel: AGENT_ALPHA_CONFIG.DEFAULT_TEST_MODEL,
    systemPromptOverride: undefined,
    customInstructions: undefined,
    holdoutRatio: AGENT_ALPHA_CONFIG.HOLDOUT_RATIO,
    holdoutThreshold: AGENT_ALPHA_CONFIG.HOLDOUT_THRESHOLD,
    preferDeterministicCompare: AGENT_ALPHA_CONFIG.PREFER_DETERMINISTIC_COMPARE,
  };
}
