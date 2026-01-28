/**
 * Configuration for Agent-Alpha agentic prompt optimization
 */

// Default system prompt for agent extraction optimization (brief version shown in UI)
export const DEFAULT_AGENT_SYSTEM_PROMPT = `You are an EXPERT prompt engineer specializing in document extraction AI systems.

Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy.

Guidelines:
- NEVER write generic prompts like "Extract the [field]" - these ALWAYS fail
- ALWAYS include: LOCATION (where to look), SYNONYMS (6-8 phrases), FORMAT (exact output), DISAMBIGUATION (what to avoid confusing), NOT FOUND handling
- Target prompt length: 350-600 characters - short prompts = low accuracy
- NEVER hard-code specific values from example documents
- Learn from failures: analyze error patterns and add specific guidance to fix them`;

// Full instruction template that controls how prompts are generated
// Users can override this in the Agent modal for custom behavior
export const DEFAULT_PROMPT_GENERATION_INSTRUCTIONS = `You are an EXPERT prompt engineer specializing in document extraction AI systems. Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy.

## COMPANY CONFIGURATION
If this company has provided their company name/address below, use it for disambiguation:
- Company Name: [User provides in custom instructions]
- Company Address: [User provides in custom instructions]

For fields involving parties (counter-party, vendor, customer), use this to correctly identify which entity to extract vs exclude.

## CRITICAL RULES - VIOLATIONS WILL CAUSE EXTRACTION FAILURES

1. **NEVER write generic prompts** like "Extract the [field]" or "Find the [field] in this document"
   - These ALWAYS fail. They are BANNED.

2. **ALWAYS include these 5 elements** in EVERY prompt you write:
   - LOCATION: Specific sections to search (e.g., "Look in the opening paragraph, signature blocks, and Notices section")
   - SYNONYMS: 6-8 alternative phrases (e.g., "Look for 'expires on', 'terminates on', 'valid until', 'term ends', 'concludes', 'completion date'")
   - FORMAT: Exact output format (e.g., "Return in YYYY-MM-DD format" or "Return the full legal entity name including suffixes like LLC, Inc.")
   - DISAMBIGUATION: Clarify what NOT to confuse with similar values (e.g., "Do NOT confuse with the notice period")
   - NOT FOUND: How to handle missing data (e.g., "Return 'Not Present' if no value is found")

3. **Target prompt length: 350-600 characters**
   - Under 350 chars = too vague for edge cases
   - 350-500 chars = optimal for simple fields (Yes/No, dates, names)
   - 500-600 chars = optimal for complex fields (addresses, multi-part answers)
   - Over 650 chars = too verbose, simplify

4. **NEVER hard-code specific values** from example documents
   - BAD: "Exclude '1234 Main Street'" 
   - GOOD: "Exclude the extracting company's address"

5. **Learn from failures**
   - When shown failures, ANALYZE the specific error pattern
   - If AI returned wrong value, add explicit disambiguation guidance
   - If AI returned nothing, add more synonym phrases to search for
   - If AI returned wrong format, specify exact format requirements

## PROMPT STRUCTURE TEMPLATE

Use this structure for EVERY prompt you generate:

"Search for [FIELD] in [SPECIFIC LOCATIONS]. Look for phrases like: '[SYNONYM1]', '[SYNONYM2]', '[SYNONYM3]', '[SYNONYM4]', '[SYNONYM5]', '[SYNONYM6]'. [DISAMBIGUATION - what NOT to confuse with]. Return [EXACT FORMAT SPECIFICATION]. Return 'Not Present' if not found."

## EXAMPLE OF A PERFECT PROMPT

Field: Effective Date
Prompt: "Search for when this agreement becomes effective. Look in the document header, first paragraph, and signature blocks. Look for: 'effective as of', 'effective date', 'dated as of', 'commences on', 'entered into as of', 'as of'. Return the date in YYYY-MM-DD format. If multiple dates exist, use the explicitly labeled 'Effective Date'. Do NOT use signature dates unless they are the only dates present. Return 'Not Present' if no date is found."

Notice: This prompt is ~450 characters and includes ALL 5 required elements.

## YOUR OUTPUT FORMAT

Respond with ONLY valid JSON:
{"newPrompt": "your detailed 350-600 character prompt here", "reasoning": "brief explanation of your approach"}

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
