/**
 * Prompt generation helpers for Agent-Alpha
 * Builds prompts for Box AI to generate improved extraction instructions
 * 
 * BALANCED: Quality prompts while staying within Box AI limits
 */

import type { AccuracyField } from './types';

export type AgentAlphaPromptParams = {
  fieldName: string;
  fieldType: AccuracyField['type'];
  currentPrompt: string;
  previousPrompts: string[]; // Up to last 3 prompts tried
  failureExamples: Array<{
    docId: string;
    predicted: string;
    expected: string;
  }>;
  successExamples: Array<{
    docId: string;
    value: string;
  }>;
  iterationNumber: number;
  maxIterations: number;
  options?: Array<{ key: string }>;
  companyName?: string; // The company using this software (to exclude from counter party)
  documentType?: string;
  customInstructions?: string; // If provided, replaces the default prompt template
};

/**
 * Build a prompt for Box AI to generate an improved extraction instruction
 */
export function buildAgentAlphaPrompt(params: AgentAlphaPromptParams): string {
  const {
    fieldName,
    fieldType,
    currentPrompt,
    previousPrompts,
    failureExamples,
    successExamples,
    iterationNumber,
    maxIterations,
    options,
    companyName,
    documentType,
    customInstructions,
  } = params;
  
  // For counter party fields, try to detect the common company that should be EXCLUDED
  const lowerFieldName = fieldName.toLowerCase();
  const isCounterPartyField = lowerFieldName.includes('counter party') || 
    lowerFieldName.includes('counterparty') ||
    lowerFieldName.includes('other party');
  
  let detectedCompany = companyName;
  if (isCounterPartyField && !detectedCompany && failureExamples.length > 0) {
    detectedCompany = detectCommonCompanyFromFailures(failureExamples);
  }

  // Get a high-quality example prompt for this field type
  // Pass the detected company name so counter party examples can reference it
  const examplePrompt = getExamplePromptForField(fieldName, fieldType, options, detectedCompany);

  // If custom instructions provided, use them as the base
  // Otherwise use the default template
  let prompt: string;
  
  if (customInstructions) {
    // Use custom instructions as the intro, then add field-specific context
    prompt = `${customInstructions}

## FIELD TO OPTIMIZE
Field: "${fieldName}" (type: ${fieldType})

## EXAMPLE OF A HIGH-QUALITY PROMPT
"${examplePrompt}"

## CURRENT PROMPT (NOT WORKING WELL)
"${currentPrompt || `Extract the ${fieldName}`}"
`;
  } else {
    // Default template
    prompt = `You are an expert at writing extraction prompts for contract AI systems.

## YOUR TASK
Create a DETAILED extraction prompt for the field "${fieldName}" (type: ${fieldType}).

## EXAMPLE OF A HIGH-QUALITY PROMPT
Here's what a GOOD extraction prompt looks like:

"${examplePrompt}"

Notice how the example:
- Tells the AI WHERE to look in the document
- Lists SPECIFIC phrases/synonyms to search for
- Specifies the EXACT output format required
- Includes what NOT to extract (negative guidance)
- Handles the "not found" case

## CURRENT PROMPT (NOT WORKING WELL)
"${currentPrompt || `Extract the ${fieldName}`}"
`;
  }

  // Add failures with analysis
  if (failureExamples.length > 0) {
    prompt += `\n## FAILURES TO FIX\n`;
    failureExamples.slice(0, 3).forEach((ex, idx) => {
      const predicted = truncate(ex.predicted, 80);
      const expected = truncate(ex.expected, 80);
      prompt += `${idx + 1}. AI returned: "${predicted}"\n   Should be: "${expected}"\n`;
    });
    prompt += `\nAnalyze WHY these failed. Common causes: wrong section, missing synonyms, format mismatch.\n`;
  }

  // Add successes
  if (successExamples.length > 0) {
    prompt += `\n## SUCCESSES (what's working)\n`;
    prompt += successExamples.slice(0, 2).map(ex => `"${truncate(ex.value, 60)}"`).join(', ') + '\n';
  }

  // Add valid options for enum types
  if (options && options.length > 0) {
    prompt += `\n## VALID OPTIONS (must return EXACTLY one of these)\n`;
    prompt += options.map(o => `- ${o.key}`).join('\n') + '\n';
  }

  // Add document context
  if (documentType) {
    prompt += `\n## DOCUMENT TYPE: ${documentType}\n`;
  }
  
  // CRITICAL: For counter party fields, tell the AI which company to EXCLUDE
  if (isCounterPartyField && detectedCompany) {
    prompt += `\n## CRITICAL: COMPANY TO EXCLUDE
The AI keeps incorrectly returning "${detectedCompany}" - this is the company USING this software.
"${detectedCompany}" appears in EVERY contract because they are one party to all agreements.
The COUNTER PARTY is the OTHER company in each agreement, NOT "${detectedCompany}".
Your prompt MUST explicitly tell the AI to EXCLUDE "${detectedCompany}" and find the OTHER party.
`;
  }

  // Add previous failed attempts
  if (previousPrompts.length > 0 && iterationNumber > 1) {
    prompt += `\n## PREVIOUS ATTEMPTS (didn't achieve 100%)\n`;
    previousPrompts.slice(-2).forEach((p, idx) => {
      prompt += `${idx + 1}. "${truncate(p, 100)}"\n`;
    });
    prompt += `Try a DIFFERENT approach than these.\n`;
  }

  // Add field-specific guidance
  const fieldGuidance = getFieldSpecificGuidance(fieldName, fieldType);
  if (fieldGuidance) {
    prompt += `\n## FIELD-SPECIFIC GUIDANCE\n${fieldGuidance}`;
  }

  // Iteration urgency
  if (iterationNumber >= 3) {
    prompt += `\n⚠️ ITERATION ${iterationNumber}/${maxIterations} - Previous approaches failed. Try something significantly different!\n`;
  }

  // Final instructions - VERY EXPLICIT about JSON format
  prompt += `
## REQUIREMENTS FOR YOUR NEW PROMPT
1. Be SPECIFIC - don't just say "Extract the ${fieldName}"
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

  return prompt;
}

/**
 * Get a high-quality example prompt for a given field type
 * @param companyToExclude - Optional: the company name to explicitly exclude (for counter party fields)
 */
export function getExamplePromptForField(
  fieldName: string, 
  fieldType: string, 
  options?: Array<{ key: string }>,
  companyToExclude?: string
): string {
  const lowerName = fieldName.toLowerCase();

  // Counter Party Name
  if (lowerName.includes('counter party') && lowerName.includes('name')) {
    const excludeClause = companyToExclude 
      ? `Do NOT return "${companyToExclude}" - this is the extracting company that appears in every contract.`
      : `Do NOT return the extracting company's name (the company that appears in ALL contracts as one party).`;
    
    return `Search for the OTHER contracting party in this agreement. Look in: (1) the opening paragraph after "by and between" or "Agreement between" - identify BOTH parties, then return the one that is NOT the recurring/extracting company, (2) signature blocks - find the company name that differs from the document preparer. ${excludeClause} Return ONLY the legal entity name exactly as written (e.g., "Acme Corporation" or "Smith Industries LLC"). If no clear counter party is identified, return "Not Present".`;
  }

  // Counter Party Address
  if (lowerName.includes('counter party') && lowerName.includes('address')) {
    const excludeClause = companyToExclude
      ? `Do NOT return the address for "${companyToExclude}" - find the OTHER party's address.`
      : `Do NOT return the extracting company's address.`;
    
    return `Search for the counter party's business address (the OTHER party, not the recurring company). Look in: (1) the opening recitals near the counter party's name, (2) the "Notices" or "Communications" section, (3) signature blocks. ${excludeClause} Return the complete address including street, city, state, and ZIP code, formatted on a single line. If multiple addresses exist, use the one in the Notices section. Return "Not Present" if no address is found.`;
  }

  // End Date
  if (lowerName.includes('end date') || lowerName.includes('expiration') || lowerName.includes('termination date')) {
    return `Search for when this agreement ends. Look for: "expires on", "terminates on", "term ends", "valid until", "expiration date". If no explicit end date exists, CALCULATE it from the Effective Date plus the Term duration (e.g., Effective Date "January 1, 2024" + Term "2 years" = End Date "December 31, 2025"). For perpetual or evergreen agreements with no fixed end, return "Perpetual". Return date in YYYY-MM-DD format. Do NOT confuse with notice periods or renewal dates.`;
  }

  // Effective Date
  if (lowerName.includes('effective date') || lowerName.includes('start date')) {
    return `Search for when this agreement becomes effective. Look for: "effective as of", "effective date", "dated as of", "commences on", "entered into as of". Check the document header, first paragraph, and signature blocks. Return the date in YYYY-MM-DD format. If multiple dates exist, use the explicitly labeled "Effective Date". Do NOT use signature dates unless they are the only dates present. Return "Not Present" if no date is found.`;
  }

  // Renewal Type
  if (lowerName.includes('renewal')) {
    const optionsList = options?.map(o => o.key).join(', ') || 'Autorenewal, Manual Renewal, Evergreen Renewal, No Renewal';
    return `Search the "Term", "Renewal", or "Duration" sections for how this agreement renews. Return EXACTLY one of: ${optionsList}. "Autorenewal" = automatically extends unless notice given. "Manual Renewal" = requires explicit action to renew. "Evergreen Renewal" = continues indefinitely until terminated. "No Renewal" = expires without renewal option. Look for phrases like "automatically renew", "shall renew", "may be renewed", "no renewal". Do NOT guess - if unclear, look for termination language to infer.`;
  }

  // Termination for Convenience
  if (lowerName.includes('termination') && lowerName.includes('convenience')) {
    return `Search the "Termination" section for whether either party can terminate WITHOUT cause. Look for: "terminate for convenience", "terminate at will", "terminate without cause", "terminate for any reason", "terminate at its sole discretion", "terminate upon X days notice" (without requiring breach). Return "Yes" if either party can terminate without cause/breach. Return "No" if termination requires cause, breach, or default. Do NOT classify breach-based termination as "convenience".`;
  }

  // Termination for Cause
  if (lowerName.includes('termination') && lowerName.includes('cause')) {
    return `Search the "Termination" section for cause-based termination rights. Look for: "terminate for cause", "material breach", "default", "failure to perform", "insolvency", "bankruptcy". Return "Yes" if the agreement allows termination for cause/breach. Return "No" if there is no cause-based termination provision. Note: Most contracts have cause-based termination, so "Yes" is common.`;
  }

  // Governing Law
  if (lowerName.includes('governing law') || lowerName.includes('jurisdiction')) {
    return `Search for the governing law clause, typically in a section called "Governing Law", "Applicable Law", or "Choice of Law". Look for: "governed by the laws of", "construed in accordance with the laws of", "subject to the laws of". Return ONLY the state or country name (e.g., "Delaware", "New York", "England"). Do NOT include "State of" prefix or venue/arbitration location. Return "Not Present" if no governing law is specified.`;
  }

  // Contract Type
  if (lowerName.includes('contract type') || lowerName.includes('agreement type')) {
    return `Identify the type of agreement from the document title and first paragraph. Common types: NDA (Non-Disclosure Agreement), MSA (Master Service Agreement), SOW (Statement of Work), Amendment, Lease Agreement, Purchase Agreement, Employment Agreement. Look for the title at the top of the document and phrases like "This Agreement", "This NDA", "This Master Agreement". Return the standard abbreviation or full name. Do NOT return generic terms like "Contract" if a specific type is identifiable.`;
  }

  // Notice Period
  if (lowerName.includes('notice') && lowerName.includes('period')) {
    return `Search for the notice period required for termination or non-renewal. Look in "Termination", "Term", or "Renewal" sections for phrases like: "X days written notice", "notice period of", "prior written notice", "advance notice". Return the notice period as stated (e.g., "30 Days", "60 Days", "90 Days"). If no notice period is specified, return "Not Present". Do NOT confuse with cure periods for breach.`;
  }

  // Default based on field type
  switch (fieldType) {
    case 'enum':
      const enumOptions = options?.map(o => o.key).join(', ') || '[list of valid options]';
      return `Search the document for the ${fieldName}. Return EXACTLY one of these values: ${enumOptions}. Look in relevant sections and match the closest option. If the exact term isn't found, infer from context. Return "Not Present" only if no relevant information exists.`;
    
    case 'date':
      return `Search the document for the ${fieldName}. Look in headers, signature blocks, and relevant sections. Return the date in YYYY-MM-DD format. If only month and year are given, use the first day of the month. Return "Not Present" if no date is found.`;
    
    case 'number':
      return `Search the document for the ${fieldName}. Return the numeric value without currency symbols or units. If a range is given, return the primary/base value. Return "Not Present" if no number is found.`;
    
    default:
      return `Search the entire document for the ${fieldName}. Look in relevant sections, headers, and signature blocks. Extract the exact value as it appears. If multiple values exist, return the most authoritative one. Return "Not Present" if not found.`;
  }
}

/**
 * Get field-specific guidance for common problem fields
 */
function getFieldSpecificGuidance(fieldName: string, fieldType: string): string {
  const lowerName = fieldName.toLowerCase();

  if (lowerName.includes('counter party')) {
    return `IMPORTANT: "Counter party" means the OTHER party in the agreement, not the company doing the extraction. In "Agreement between Company A and Company B", if Company A is extracting, then Company B is the counter party.\n`;
  }

  if (lowerName.includes('end date')) {
    return `IMPORTANT: End dates are often NOT explicitly stated. You may need to CALCULATE: Effective Date + Term = End Date. Example: "effective January 1, 2024" + "term of 2 years" = End Date "December 31, 2025".\n`;
  }

  if (lowerName.includes('termination') && lowerName.includes('convenience')) {
    return `IMPORTANT: "For convenience" means WITHOUT needing a reason/cause/breach. This is different from "for cause" termination which requires breach or default.\n`;
  }

  if (lowerName.includes('renewal')) {
    return `IMPORTANT: Distinguish between: Autorenewal (automatic), Manual (requires action), Evergreen (indefinite), No Renewal (one-time). Look for "automatically renew" vs "may renew" vs "shall not renew".\n`;
  }

  return '';
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

/**
 * Detect the common company name that appears in failures
 * This is likely the "extracting company" that should be EXCLUDED from counter party results
 * 
 * Logic: If the AI keeps returning the same company name incorrectly,
 * that's probably the company using this software (appears in every contract)
 */
export function detectCommonCompanyFromFailures(
  failureExamples: Array<{ predicted: string; expected: string }>
): string | undefined {
  if (failureExamples.length === 0) return undefined;
  
  // Count how many times each predicted value appears incorrectly
  const predictedCounts: Record<string, number> = {};
  
  for (const failure of failureExamples) {
    const predicted = failure.predicted?.trim();
    if (predicted && predicted !== 'Not Present' && predicted.length > 2) {
      predictedCounts[predicted] = (predictedCounts[predicted] || 0) + 1;
    }
  }
  
  // Find the most common incorrect prediction
  let mostCommon: string | undefined;
  let maxCount = 0;
  
  for (const [value, count] of Object.entries(predictedCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = value;
    }
  }
  
  // Only return if it appears in at least 2 failures (pattern, not coincidence)
  if (mostCommon && maxCount >= 2) {
    return mostCommon;
  }
  
  // Alternative: if there's only 1 failure but the predicted value looks like a company name
  // (contains Inc., LLC, Corp., etc.), return it
  if (failureExamples.length >= 1) {
    const predicted = failureExamples[0].predicted?.trim();
    if (predicted && /\b(Inc\.?|LLC|Corp\.?|Co\.?|Ltd\.?|Limited|Corporation)\b/i.test(predicted)) {
      return predicted;
    }
  }
  
  return undefined;
}

export type AgentAlphaPromptResponse = {
  newPrompt: string;
  reasoning: string;
};

/**
 * Parse the response from Box AI prompt generation
 * Now with fallback to example prompts if parsing fails
 */
export function parseAgentAlphaPromptResponse(response: string, fieldName?: string): AgentAlphaPromptResponse {
  // Clean up the response - remove markdown code blocks if present
  let cleanResponse = response.trim();
  
  // Remove markdown code blocks
  if (cleanResponse.startsWith('```json')) {
    cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(cleanResponse);
    
    if (parsed.newPrompt && typeof parsed.newPrompt === 'string') {
      const prompt = parsed.newPrompt.trim();
      
      // Check if the prompt is too short (bad prompt)
      // NOTE: We no longer reject prompts starting with "Extract" - many good prompts do!
      // We only reject if the prompt is too short (less than 100 chars is suspiciously brief)
      if (prompt.length < 100) {
        console.warn(`[Agent-Alpha] Generated prompt is too short (${prompt.length} chars): "${prompt.substring(0, 50)}..."`);
        // Use fallback
        if (fieldName) {
          const fallbackPrompt = getExamplePromptForField(fieldName, 'string');
          return {
            newPrompt: fallbackPrompt,
            reasoning: 'Used fallback prompt because generated prompt was too short',
          };
        }
      }
      
      return {
        newPrompt: prompt,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    }
  } catch (e) {
    console.warn(`[Agent-Alpha] JSON parsing failed: ${e}`);
  }
  
  // Try to extract from text using regex
  const newPromptMatch = cleanResponse.match(/"newPrompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const reasoningMatch = cleanResponse.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  
  if (newPromptMatch) {
    const prompt = newPromptMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
    
    // Check if the prompt is too short
    if (prompt.length < 100) {
      console.warn(`[Agent-Alpha] Extracted prompt is too short (${prompt.length} chars): "${prompt.substring(0, 50)}..."`);
      if (fieldName) {
        const fallbackPrompt = getExamplePromptForField(fieldName, 'string');
        return {
          newPrompt: fallbackPrompt,
          reasoning: 'Used fallback prompt because extracted prompt was too short',
        };
      }
    }
    
    return {
      newPrompt: prompt,
      reasoning: reasoningMatch ? reasoningMatch[1].replace(/\\"/g, '"').trim() : 'Extracted from text',
    };
  }
  
  // Try to find any JSON-like structure
  const jsonMatch = cleanResponse.match(/\{[\s\S]*?"newPrompt"\s*:\s*"([\s\S]*?)"[\s\S]*?\}/);
  if (jsonMatch) {
    const prompt = jsonMatch[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (prompt.length >= 100) {
      return {
        newPrompt: prompt,
        reasoning: 'Extracted from JSON block',
      };
    }
  }

  // FALLBACK: Use our high-quality example prompt instead of the bad response
  console.warn(`[Agent-Alpha] Failed to parse response, using fallback prompt for field: ${fieldName}`);
  console.warn(`[Agent-Alpha] Raw response was: ${response.substring(0, 200)}...`);
  
  if (fieldName) {
    const fallbackPrompt = getExamplePromptForField(fieldName, 'string');
    return {
      newPrompt: fallbackPrompt,
      reasoning: 'Used fallback prompt because response could not be parsed',
    };
  }

  // Last resort - if we can't even use fallback
  throw new Error('Failed to parse prompt generation response and no fallback available');
}
