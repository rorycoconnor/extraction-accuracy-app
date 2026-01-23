
'use server';

/**
 * @fileOverview Prompt generation using Box AI API
 * 
 * Generates and improves prompts using Box AI text generation.
 * Supports custom system prompts for both generation and improvement.
 */

import { boxApiFetch } from '@/services/box';
import { SYSTEM_MESSAGES, FIELD_TYPE_HEURISTICS, FIELD_KEY_HEURISTICS } from '@/ai/prompts/prompt-engineering';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { BoxAITextGenResponseSchema } from '@/lib/schemas';

/**
 * Parse the AI response to extract just the prompt text.
 * Handles both plain text and JSON responses (Claude models often return JSON).
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

export interface GeneratePromptParams {
  templateName: string;
  field: { name: string; key: string; type: string };
  fileIds?: string[];
  customSystemPrompt?: string;  // Optional custom system prompt override
}

export interface ImprovePromptParams {
  originalPrompt: string;
  userFeedback: string;
  templateName: string;
  field: { name: string; key: string; type: string };
  fileIds?: string[];
  customSystemPrompt?: string;  // Optional custom system prompt override
}

export async function generateInitialPrompt(
  { templateName, field, fileIds, customSystemPrompt }: GeneratePromptParams
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

  // Build a more structured generation request
  const generationRequest = `
SYSTEM: ${systemPrompt}

## TASK
Generate a high-quality extraction prompt for the field "${field.name}" (type: ${field.type}).

## REQUIRED ELEMENTS
Your prompt MUST include:
1. LOCATION: Where to look in the document (e.g., "Look in the header", "Search the signature blocks")
2. SYNONYMS: 3-5 alternative phrases the value might appear as, in quotes
3. FORMAT: Exact output format (date format, number precision, etc.)
4. DISAMBIGUATION: "Do NOT..." guidance to prevent common mistakes
5. NOT-FOUND: What to return if value isn't found (usually "Not Present")

## EXAMPLE OF A HIGH-QUALITY PROMPT
"${examplePrompt}"

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
 * Get a reference example prompt for a field type to guide improvement
 * Simplified version that doesn't need the full agent-alpha-prompts dependency
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
 * Analyze what's working in the original prompt
 * Returns structured analysis to help preserve good elements
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

export async function improvePrompt(
  { originalPrompt, userFeedback, templateName, field, fileIds, customSystemPrompt }: ImprovePromptParams
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
  
  // Build a more structured improvement request
  let improvementRequest = `
SYSTEM: ${systemPrompt}

## TASK
Improve the extraction prompt below based on user feedback while PRESERVING what already works.

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

## REFERENCE: Example of a high-quality prompt
"${examplePrompt}"

## OUTPUT
Generate ONLY the improved prompt. Preserve what works, fix what the user mentioned, add missing elements.`;

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
