
'use server';

/**
 * @fileOverview Prompt Generation using Box AI API
 * 
 * This module provides functions to generate and improve extraction prompts
 * using Box AI's text generation capabilities. It supports:
 * 
 * - **Initial prompt generation**: Creates high-quality extraction prompts for metadata fields
 * - **Prompt improvement**: Refines existing prompts based on user feedback
 * - **Document type awareness**: Infers document types from template names for context-aware prompts
 * - **Custom system prompts**: Allows override of default system instructions
 * 
 * ## Architecture
 * 
 * The prompt generation flow:
 * 1. User requests a prompt for a field (name, type, template context)
 * 2. System infers document type from template name
 * 3. Builds structured request with guidelines, examples, and context
 * 4. Calls Box AI text_gen endpoint with Claude model
 * 5. Parses response (handles both plain text and JSON formats)
 * 
 * ## Usage
 * 
 * ```typescript
 * // Generate initial prompt
 * const result = await generateInitialPrompt({
 *   templateName: 'Lease Agreement',
 *   field: { name: 'Effective Date', key: 'effective_date', type: 'date' },
 *   fileIds: ['12345'], // Optional: sample document for context
 * });
 * 
 * // Improve existing prompt
 * const improved = await improvePrompt({
 *   originalPrompt: result.prompt,
 *   userFeedback: 'Include signature block locations',
 *   templateName: 'Lease Agreement',
 *   field: { name: 'Effective Date', key: 'effective_date', type: 'date' },
 * });
 * ```
 * 
 * @module generate-initial-prompt
 * @see {@link generateInitialPrompt} - Main function for generating prompts
 * @see {@link improvePrompt} - Function for improving existing prompts
 */

import { boxApiFetch } from '@/services/box';
import { SYSTEM_MESSAGES, FIELD_TYPE_HEURISTICS, FIELD_KEY_HEURISTICS } from '@/ai/prompts/prompt-engineering';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { BoxAITextGenResponseSchema } from '@/lib/schemas';

/**
 * Parses the AI response to extract the prompt text.
 * 
 * Box AI (especially Claude models) may return responses in various formats:
 * - Plain text prompt
 * - JSON with `newPrompt`, `prompt`, or `improved_prompt` keys
 * - JSON wrapped in markdown code blocks
 * 
 * This function normalizes all these formats to extract just the prompt string.
 * 
 * @param rawResponse - The raw response string from Box AI
 * @returns The extracted prompt text, trimmed of whitespace
 * 
 * @example
 * // Plain text
 * parsePromptResponse("Search for the effective date...") // => "Search for the effective date..."
 * 
 * // JSON response
 * parsePromptResponse('{"newPrompt": "Search for..."}') // => "Search for..."
 * 
 * // Markdown-wrapped JSON
 * parsePromptResponse('```json\n{"prompt": "Search..."}\n```') // => "Search..."
 */
function parsePromptResponse(rawResponse: string): string {
  const trimmed = rawResponse.trim();
  
  // Try to parse as JSON first (Claude models often return structured JSON)
  try {
    // Remove markdown code blocks if present
    let jsonStr = trimmed;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Extract prompt from common JSON structures
    if (parsed.newPrompt && typeof parsed.newPrompt === 'string') {
      return parsed.newPrompt.trim();
    }
    if (parsed.prompt && typeof parsed.prompt === 'string') {
      return parsed.prompt.trim();
    }
    if (parsed.improved_prompt && typeof parsed.improved_prompt === 'string') {
      return parsed.improved_prompt.trim();
    }
  } catch {
    // Not JSON, continue to return as-is
  }
  
  // Return the raw response if it's not JSON
  return trimmed;
}

/**
 * Parameters for generating an initial extraction prompt.
 * 
 * @interface GeneratePromptParams
 * @property {string} templateName - Name of the template (used for document type inference)
 * @property {Object} field - The field to generate a prompt for
 * @property {string} field.name - Human-readable field name (e.g., "Effective Date")
 * @property {string} field.key - Machine key for the field (e.g., "effective_date")
 * @property {string} field.type - Field type: 'string' | 'date' | 'enum' | 'number' | 'multiSelect'
 * @property {string[]} [fileIds] - Optional Box file IDs to use as context (max 1 for Box AI)
 * @property {string} [customSystemPrompt] - Optional override for the default system prompt
 * @property {string} [documentType] - Optional explicit document type (e.g., "Lease Agreement")
 */
export interface GeneratePromptParams {
  templateName: string;
  field: { name: string; key: string; type: string };
  fileIds?: string[];
  customSystemPrompt?: string;
  documentType?: string;
}

/**
 * Parameters for improving an existing extraction prompt.
 * 
 * @interface ImprovePromptParams
 * @property {string} originalPrompt - The current prompt to improve
 * @property {string} userFeedback - User's feedback describing what needs improvement
 * @property {string} templateName - Name of the template (used for document type inference)
 * @property {Object} field - The field the prompt extracts
 * @property {string} field.name - Human-readable field name
 * @property {string} field.key - Machine key for the field
 * @property {string} field.type - Field type
 * @property {string[]} [fileIds] - Optional Box file IDs for context (max 1 for Box AI)
 * @property {string} [customSystemPrompt] - Optional override for the default system prompt
 * @property {string} [documentType] - Optional explicit document type
 */
export interface ImprovePromptParams {
  originalPrompt: string;
  userFeedback: string;
  templateName: string;
  field: { name: string; key: string; type: string };
  fileIds?: string[];
  customSystemPrompt?: string;
  documentType?: string;
}

/**
 * Infers the document type from a template name using keyword matching.
 * 
 * Users often name their templates descriptively (e.g., "NDA Template", "Lease Agreement").
 * This function extracts the document type to provide context-aware prompt generation.
 * 
 * @param templateName - The name of the template to analyze
 * @returns The inferred document type, or undefined if no match found
 * 
 * @example
 * inferDocumentType("NDA Template")           // => "NDA (Non-Disclosure Agreement)"
 * inferDocumentType("Lease Agreement 2024")   // => "Lease Agreement"
 * inferDocumentType("My Custom Template")     // => undefined
 * 
 * @internal
 */
function inferDocumentType(templateName: string): string | undefined {
  const lowerName = templateName.toLowerCase();
  
  if (lowerName.includes('nda') || lowerName.includes('confidential')) {
    return 'NDA (Non-Disclosure Agreement)';
  }
  if (lowerName.includes('msa') || lowerName.includes('master service')) {
    return 'MSA (Master Service Agreement)';
  }
  if (lowerName.includes('sow') || lowerName.includes('statement of work')) {
    return 'SOW (Statement of Work)';
  }
  if (lowerName.includes('lease') || lowerName.includes('rental')) {
    return 'Lease Agreement';
  }
  if (lowerName.includes('contract') || lowerName.includes('agreement')) {
    return 'Contract';
  }
  if (lowerName.includes('invoice') || lowerName.includes('bill')) {
    return 'Invoice';
  }
  if (lowerName.includes('amendment') || lowerName.includes('addendum')) {
    return 'Amendment';
  }
  if (lowerName.includes('sop') || lowerName.includes('procedure')) {
    return 'Standard Operating Procedure';
  }
  if (lowerName.includes('policy') || lowerName.includes('compliance')) {
    return 'Policy/Compliance Document';
  }
  if (lowerName.includes('hr') || lowerName.includes('employee') || lowerName.includes('onboarding')) {
    return 'HR Document';
  }
  if (lowerName.includes('security') || lowerName.includes('audit')) {
    return 'Security/Audit Document';
  }
  
  return undefined;
}

/**
 * Builds a document type context section for inclusion in prompt generation requests.
 * 
 * This context helps the AI understand:
 * - What type of document it's writing prompts for
 * - Where fields typically appear in that document type
 * - What terminology is appropriate (avoiding cross-contamination from other doc types)
 * 
 * @param documentType - The document type (e.g., "Lease Agreement") or undefined
 * @param templateName - The template name for additional context
 * @param fieldName - The field being extracted (used in guidance)
 * @returns A formatted context string to prepend to the generation request
 * 
 * @example
 * buildDocumentTypeContext("Lease Agreement", "Commercial Lease", "Monthly Rent")
 * // Returns:
 * // ## DOCUMENT TYPE CONTEXT
 * // Document Type: Lease Agreement
 * // Template: "Commercial Lease"
 * // 
 * // CRITICAL: You are writing extraction prompts for Lease Agreement documents...
 * 
 * @internal
 */
function buildDocumentTypeContext(documentType: string | undefined, templateName: string, fieldName: string): string {
  if (!documentType && !templateName) return '';
  
  const docTypeLabel = documentType || 'this document type';
  
  return `## DOCUMENT TYPE CONTEXT
${documentType ? `Document Type: ${documentType}` : ''}
${templateName ? `Template: "${templateName}"` : ''}

CRITICAL: You are writing extraction prompts for ${docTypeLabel} documents.
Use your knowledge of how ${docTypeLabel} documents are typically structured to determine:
1. WHERE "${fieldName}" typically appears in these documents
2. WHAT terminology and labels are commonly used in ${docTypeLabel} documents
3. WHAT sections or areas to search

Do NOT use terminology from other document types. For example:
- Don't use invoice terms (Bill To, Ship To, Vendor) when writing prompts for contracts
- Don't use contract terms (parties, recitals, governing law) when writing prompts for invoices
- Generate location guidance and synonyms specific to ${docTypeLabel} documents.

`;
}

/**
 * Generates an initial extraction prompt for a metadata field using Box AI.
 * 
 * This function creates high-quality, document-type-aware extraction prompts that include:
 * - **Location guidance**: Where to look in the document
 * - **Synonyms**: Alternative phrases the value might appear as
 * - **Format specification**: Exact output format requirements
 * - **Disambiguation**: What NOT to extract (common mistakes)
 * - **Not-found handling**: What to return if value isn't found
 * 
 * ## Flow
 * 
 * 1. Loads field-specific guidelines from heuristics
 * 2. Infers document type from template name (or uses provided)
 * 3. Builds structured generation request with examples
 * 4. Calls Box AI text_gen API with Claude model
 * 5. Validates and parses the response
 * 
 * ## API Constraints
 * 
 * - Box AI Text Gen allows maximum 1 file for context
 * - Uses `AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL` (Claude 4.5 Opus)
 * 
 * @param params - The generation parameters
 * @param params.templateName - Template name for document type inference
 * @param params.field - Field definition with name, key, and type
 * @param params.fileIds - Optional file IDs for context (only first is used)
 * @param params.customSystemPrompt - Optional custom system prompt override
 * @param params.documentType - Optional explicit document type
 * 
 * @returns Promise resolving to generated prompt and generation method
 * @returns {string} prompt - The generated extraction prompt
 * @returns {'standard'|'dspy'|'agent'} generationMethod - Always 'standard' for this function
 * 
 * @throws {Error} If Box AI response fails schema validation
 * 
 * @example
 * ```typescript
 * const result = await generateInitialPrompt({
 *   templateName: 'Commercial Lease',
 *   field: {
 *     name: 'Monthly Rent',
 *     key: 'monthly_rent',
 *     type: 'number'
 *   },
 *   fileIds: ['123456789']
 * });
 * 
 * console.log(result.prompt);
 * // "Search for the monthly rent amount in the Rent section or Payment Terms.
 * //  Look for: 'monthly rent', 'base rent', 'rent amount', 'monthly payment'.
 * //  Return the exact numeric value with cents (e.g., '2500.00').
 * //  Do NOT include security deposits or one-time fees.
 * //  Return 'Not Present' if no monthly rent is specified."
 * ```
 * 
 * @see {@link improvePrompt} - For refining existing prompts
 * @see {@link AGENT_ALPHA_CONFIG} - For model configuration
 */
export async function generateInitialPrompt(
  { templateName, field, fileIds, customSystemPrompt, documentType }: GeneratePromptParams
): Promise<{ prompt: string; generationMethod: 'standard' | 'dspy' | 'agent' }> {

  const guidelines = [
    ...(FIELD_TYPE_HEURISTICS[field.type] || []),
    ...(Object.keys(FIELD_KEY_HEURISTICS).find(key => field.key.toLowerCase().includes(key))
        ? FIELD_KEY_HEURISTICS[Object.keys(FIELD_KEY_HEURISTICS).find(key => field.key.toLowerCase().includes(key))!]
        : [])
  ];

  // Use selected files for context, fallback to empty items if none provided
  // Box AI Text Gen API only allows 1 file maximum
  const items = (fileIds && fileIds.length > 0
    ? [fileIds[0]] // Take only the first file - Box AI Text Gen has 1 item limit
    : [])
    .map(id => ({ id, type: 'file' as const }));

  // Use custom system prompt if provided, otherwise fall back to default
  const systemPrompt = customSystemPrompt ?? SYSTEM_MESSAGES.GENERATE;
  
  // Get an example prompt to guide generation
  const examplePrompt = getExamplePromptReference(field.name, field.type);
  
  // Infer document type from template name if not explicitly provided
  const effectiveDocType = documentType || inferDocumentType(templateName);
  
  // Build document type context
  const docTypeContext = buildDocumentTypeContext(effectiveDocType, templateName, field.name);

  // Build a more structured generation request
  const generationRequest = `
SYSTEM: ${systemPrompt}

${docTypeContext}## TASK
Generate a high-quality extraction prompt for the field "${field.name}" (type: ${field.type}).
${effectiveDocType ? `Remember: This is for ${effectiveDocType} documents - use appropriate terminology.` : ''}

## REQUIRED ELEMENTS
Your prompt MUST include:
1. LOCATION: Where to look in the document (e.g., "Look in the header", "Search the signature blocks")
2. SYNONYMS: 3-5 alternative phrases the value might appear as, in quotes
3. FORMAT: Exact output format (date format, number precision, etc.)
4. DISAMBIGUATION: "Do NOT..." guidance to prevent common mistakes
5. NOT-FOUND: What to return if value isn't found (usually "Not Present")

## EXAMPLE OF A HIGH-QUALITY PROMPT STRUCTURE
"${examplePrompt}"

Adapt the terminology and locations to be appropriate for ${effectiveDocType || 'this document type'}.

## FIELD CONTEXT
- Template: "${templateName}"
- Field Name: "${field.name}"
- Field Type: ${field.type}
${guidelines.length > 0 ? `- Field-Specific Guidelines:\n${guidelines.map(g => `  - ${g}`).join('\n')}` : ''}

## OUTPUT
Generate ONLY the extraction prompt (3-5 sentences). Include all required elements.`;

  const rawResponse = await boxApiFetch(
    '/ai/text_gen',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: generationRequest,
        ...(items.length > 0 ? { items } : {}),
        ai_agent: {
          type: 'ai_agent_text_gen',
          basic_gen: {
            // Use same model as Agent-Alpha for consistency
            model: AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL
          }
        }
      })
    }
  );

  // Validate the response schema
  const validationResult = BoxAITextGenResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    throw new Error(`Invalid Box AI response: ${validationResult.error.message}`);
  }
  const response = validationResult.data;

  // Parse response to extract just the prompt (handles JSON responses from Claude)
  const prompt = parsePromptResponse(response.answer);
  return { prompt, generationMethod: 'standard' };
}

/**
 * Gets a reference example prompt for a field type to guide prompt generation.
 * 
 * This provides high-quality example prompts that demonstrate the structure
 * and elements that make extraction prompts effective. The AI uses these
 * examples to understand the expected format and adapt them for specific fields.
 * 
 * Example prompts include:
 * - Location guidance (where to search)
 * - Synonym phrases (alternative labels)
 * - Format specifications (output format)
 * - Disambiguation rules (what NOT to extract)
 * - Not-found handling
 * 
 * @param fieldName - The field name to match against known patterns
 * @param fieldType - The field type ('date', 'enum', 'number', 'string')
 * @returns A high-quality example prompt string
 * 
 * @example
 * getExamplePromptReference("Effective Date", "date")
 * // Returns a date-specific example with YYYY-MM-DD format guidance
 * 
 * getExamplePromptReference("Counter Party", "string")
 * // Returns guidance specific to extracting the other contracting party
 * 
 * @internal
 */
function getExamplePromptReference(fieldName: string, fieldType: string): string {
  const lowerName = fieldName.toLowerCase();
  
  // Date fields
  if (fieldType === 'date' || lowerName.includes('date')) {
    return `Search for when this agreement becomes effective. Look for: "effective as of", "effective date", "dated as of", "commences on". Check the document header, first paragraph, and signature blocks. Return the date in YYYY-MM-DD format. If multiple dates exist, use the explicitly labeled "Effective Date". Do NOT use signature dates unless they are the only dates present. Return "Not Present" if no date is found.`;
  }
  
  // Enum fields
  if (fieldType === 'enum') {
    return `Search the document for the ${fieldName}. Return EXACTLY one of the valid options. Look in relevant sections and match the closest option. If the exact term isn't found, infer from context. Return "Not Present" only if no relevant information exists.`;
  }
  
  // Counter party fields
  if (lowerName.includes('counter party') || lowerName.includes('counterparty')) {
    return `Search for the OTHER contracting party in this agreement. Look in: (1) the opening paragraph after "by and between", (2) signature blocks. Do NOT return the extracting company's name. Return ONLY the legal entity name exactly as written. If no clear counter party is identified, return "Not Present".`;
  }
  
  // Amount/number fields
  if (fieldType === 'number' || lowerName.includes('amount') || lowerName.includes('total')) {
    return `Search the document for the ${fieldName}. Return the EXACT numeric value as it appears, including decimal places. Do NOT round numbers - preserve cents/decimals exactly. Remove currency symbols but keep the exact numeric value. Return "Not Present" if no number is found.`;
  }
  
  // Default
  return `Search the entire document for the ${fieldName}. Look in relevant sections, headers, and signature blocks. Extract the exact value as it appears. If multiple values exist, return the most authoritative one. Return "Not Present" if not found.`;
}

/**
 * Analyzes an existing prompt to identify which quality elements are present.
 * 
 * This analysis helps the improvement process preserve working elements
 * while adding missing ones. A high-quality prompt should have all 5 elements:
 * 
 * 1. **Location**: WHERE to look in the document
 * 2. **Synonyms**: Alternative phrases/labels to search for
 * 3. **Format**: Output format specification
 * 4. **Disambiguation**: What NOT to extract (negative guidance)
 * 5. **Not-found**: Handling for missing values
 * 
 * @param prompt - The prompt to analyze
 * @returns Analysis result with boolean flags and list of working elements
 * 
 * @example
 * const analysis = analyzeOriginalPrompt("Search in the header for the date. Return in YYYY-MM-DD format.");
 * // Returns:
 * // {
 * //   hasLocation: true,        // "Search in the header"
 * //   hasSynonyms: false,       // No quoted phrases
 * //   hasFormat: true,          // "YYYY-MM-DD format"
 * //   hasDisambiguation: false, // No "Do NOT" guidance
 * //   hasNotFound: false,       // No "Not Present" handling
 * //   workingElements: ["Location guidance", "Output format specification"]
 * // }
 * 
 * @internal
 */
function analyzeOriginalPrompt(prompt: string): {
  hasLocation: boolean;
  hasSynonyms: boolean;
  hasFormat: boolean;
  hasDisambiguation: boolean;
  hasNotFound: boolean;
  workingElements: string[];
} {
  const hasLocation = /look in|search in|find in|check the|located in|look for/i.test(prompt);
  const hasSynonyms = /"[^"]+"/g.test(prompt) || /look for:.*,/i.test(prompt);
  const hasFormat = /return.*format|YYYY|exactly|only the|single line/i.test(prompt);
  const hasDisambiguation = /do not|don't|not confuse|not return|avoid|exclude/i.test(prompt);
  const hasNotFound = /not present|not found|if no|if not/i.test(prompt);
  
  const workingElements: string[] = [];
  if (hasLocation) workingElements.push('Location guidance (WHERE to look)');
  if (hasSynonyms) workingElements.push('Synonym phrases to search for');
  if (hasFormat) workingElements.push('Output format specification');
  if (hasDisambiguation) workingElements.push('Disambiguation rules (what NOT to do)');
  if (hasNotFound) workingElements.push('Not-found handling');
  
  return { hasLocation, hasSynonyms, hasFormat, hasDisambiguation, hasNotFound, workingElements };
}

/**
 * Improves an existing extraction prompt based on user feedback.
 * 
 * This function takes a working (or partially working) prompt and refines it
 * while preserving elements that are already effective. Key principles:
 * 
 * - **Preserve what works**: Analyzes the original prompt to identify working elements
 * - **Add missing elements**: Identifies gaps (location, synonyms, format, etc.)
 * - **Address feedback**: Incorporates specific user feedback into improvements
 * - **Maintain structure**: Keeps the logical flow of the original prompt
 * 
 * ## Improvement Process
 * 
 * 1. Analyzes original prompt to identify working elements
 * 2. Identifies missing quality elements
 * 3. Builds improvement request with:
 *    - Original prompt + working elements to preserve
 *    - Missing elements to add
 *    - User feedback to address
 *    - Document type context
 * 4. Calls Box AI for refined prompt
 * 5. Parses and validates response
 * 
 * @param params - The improvement parameters
 * @param params.originalPrompt - The current prompt to improve
 * @param params.userFeedback - User's description of what needs improvement
 * @param params.templateName - Template name for document type context
 * @param params.field - Field definition with name, key, and type
 * @param params.fileIds - Optional file IDs for context (max 1 used)
 * @param params.customSystemPrompt - Optional custom system prompt
 * @param params.documentType - Optional explicit document type
 * 
 * @returns Promise resolving to improved prompt and generation method
 * @returns {string} prompt - The improved extraction prompt
 * @returns {'standard'|'dspy'|'agent'} generationMethod - Always 'standard'
 * 
 * @throws {Error} If Box AI response fails schema validation
 * 
 * @example
 * ```typescript
 * const improved = await improvePrompt({
 *   originalPrompt: "Search for the effective date in YYYY-MM-DD format.",
 *   userFeedback: "Also check signature blocks and add more synonyms",
 *   templateName: "Lease Agreement",
 *   field: { name: "Effective Date", key: "effective_date", type: "date" }
 * });
 * 
 * console.log(improved.prompt);
 * // "Search for when this agreement becomes effective. Look in the header,
 * //  first paragraph, and signature blocks. Look for: 'effective as of',
 * //  'effective date', 'dated as of', 'commences on', 'entered into'.
 * //  Return in YYYY-MM-DD format. Do NOT use signature dates unless
 * //  explicitly labeled as effective date. Return 'Not Present' if not found."
 * ```
 * 
 * @see {@link generateInitialPrompt} - For creating new prompts
 * @see {@link analyzeOriginalPrompt} - Internal analysis function
 */
export async function improvePrompt(
  { originalPrompt, userFeedback, templateName, field, fileIds, customSystemPrompt, documentType }: ImprovePromptParams
): Promise<{ prompt: string; generationMethod: 'standard' | 'dspy' | 'agent' }> {
  
  // Use selected files for context, fallback to empty items if none provided
  // Box AI Text Gen API only allows 1 file maximum
  const items = (fileIds && fileIds.length > 0
    ? [fileIds[0]] // Take only the first file - Box AI Text Gen has 1 item limit
    : [])
    .map(id => ({ id, type: 'file' as const }));

  // Use custom system prompt if provided, otherwise fall back to default
  const systemPrompt = customSystemPrompt ?? SYSTEM_MESSAGES.IMPROVE;
  
  // Get an example of what a good prompt looks like for this field type
  const examplePrompt = getExamplePromptReference(field.name, field.type);
  
  // Analyze what's working in the original prompt
  const analysis = analyzeOriginalPrompt(originalPrompt);
  
  // Infer document type from template name if not explicitly provided
  const effectiveDocType = documentType || inferDocumentType(templateName);
  
  // Build document type context
  const docTypeContext = buildDocumentTypeContext(effectiveDocType, templateName, field.name);
  
  // Build a more structured improvement request
  let improvementRequest = `
SYSTEM: ${systemPrompt}

${docTypeContext}## TASK
Improve the extraction prompt below based on user feedback while PRESERVING what already works.
${effectiveDocType ? `Remember: This is for ${effectiveDocType} documents - use appropriate terminology.` : ''}

## ORIGINAL PROMPT (to improve)
"${originalPrompt}"
`;

  // Add analysis of what's working
  if (analysis.workingElements.length > 0) {
    improvementRequest += `
## ELEMENTS TO PRESERVE (these are working - keep them!)
${analysis.workingElements.map(e => `- ${e}`).join('\n')}
`;
  }
  
  // Add what might be missing
  const missingElements: string[] = [];
  if (!analysis.hasLocation) missingElements.push('LOCATION: Where to look in the document');
  if (!analysis.hasSynonyms) missingElements.push('SYNONYMS: Alternative phrases to search for (3-5 in quotes)');
  if (!analysis.hasFormat) missingElements.push('FORMAT: Exact output format specification');
  if (!analysis.hasDisambiguation) missingElements.push('DISAMBIGUATION: "Do NOT..." guidance');
  if (!analysis.hasNotFound) missingElements.push('NOT-FOUND: What to return if value not found');
  
  if (missingElements.length > 0) {
    improvementRequest += `
## ELEMENTS TO ADD (currently missing)
${missingElements.map(e => `- ${e}`).join('\n')}
`;
  }
  
  improvementRequest += `
## USER FEEDBACK (what needs to change)
"${userFeedback}"

## FIELD CONTEXT
- Field Name: "${field.name}"
- Field Type: ${field.type}
- Template: "${templateName}"
${effectiveDocType ? `- Document Type: ${effectiveDocType}` : ''}

## REFERENCE: Example of a high-quality prompt structure
"${examplePrompt}"

Adapt terminology to be appropriate for ${effectiveDocType || 'this document type'}.

## OUTPUT
Generate ONLY the improved prompt. Preserve what works, fix what the user mentioned, add missing elements.
Use terminology appropriate for ${effectiveDocType || 'this document type'} documents.`;

  const rawResponse = await boxApiFetch(
    '/ai/text_gen',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: improvementRequest,
        ...(items.length > 0 ? { items } : {}),
        ai_agent: {
          type: 'ai_agent_text_gen',
          basic_gen: {
            // Use same model as Agent-Alpha for consistency
            model: AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL
          }
        }
      })
    }
  );

  // Validate the response schema
  const validationResult = BoxAITextGenResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    throw new Error(`Invalid Box AI response: ${validationResult.error.message}`);
  }
  const response = validationResult.data;

  // Parse response to extract just the prompt (handles JSON responses from Claude)
  const prompt = parsePromptResponse(response.answer);
  return { prompt, generationMethod: 'standard' };
}
