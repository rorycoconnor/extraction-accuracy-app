/**
 * Prompt generation helpers for Agent-Alpha
 * Builds prompts for Box AI to generate improved extraction instructions
 * 
 * BALANCED: Quality prompts while staying within Box AI limits
 */

import type { AccuracyField } from './types';
import { logger } from './logger';

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
  documentContext?: string; // NEW: Analyzed document context showing WHY extractions failed
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
    documentContext,
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
  
  // NEW: Add deep document analysis if available
  // This shows the ACTUAL document content where extractions failed
  if (documentContext) {
    prompt += documentContext;
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

  // ============================================
  // INVOICE-SPECIFIC FIELD EXAMPLES
  // ============================================

  // Vendor / Supplier Name
  if (lowerName.includes('vendor') || lowerName.includes('supplier')) {
    return `Search for the vendor/supplier name in the invoice. This is the company PROVIDING goods/services (issuing the invoice). Look in: (1) the document header/logo area, (2) "From:" field, (3) "Vendor:", "Supplier:", "Bill From:", "Remit To:", "Service Provider:" labels. Do NOT extract customer names from "Bill To:" or "Ship To:" sections - those are the RECIPIENTS. Return the complete business name with suffixes (Inc, LLC, Corp). If the extracting company appears as the service provider, return "Not Present".`;
  }

  // Amount Due / Total Amount
  if (lowerName.includes('amount due') || (lowerName.includes('total') && lowerName.includes('amount'))) {
    return `Search for the final amount due on this invoice. Look for: "Amount Due:", "Total Due:", "Balance Due:", "Total:", "Grand Total:", "Invoice Total:". This is typically at the bottom of the invoice near payment instructions. Return the EXACT numeric value including cents (e.g., "1234.56" not "1235" or "1234"). Do NOT round! Remove currency symbols but preserve decimal precision exactly as shown.`;
  }

  // Sales Tax
  if (lowerName.includes('sales tax') || (lowerName.includes('tax') && !lowerName.includes('pre'))) {
    return `Search for the sales tax amount on this invoice. Look for: "Sales Tax:", "Tax:", "Tax Amount:", "VAT:", "GST:", "State Tax:". It's usually shown as a line item between subtotal and total. Return the EXACT dollar amount with cents (e.g., "45.67" not "45.7" or "46"). Do NOT return the tax rate percentage. If tax shows "$0.00" or "Exempt", return "0". Return "Not Present" only if no tax line exists.`;
  }

  // Subtotal / Sales Amount
  if (lowerName.includes('subtotal') || lowerName.includes('sales amount') || lowerName.includes('merchandise')) {
    return `Search for the subtotal or sales amount BEFORE tax and shipping. Look for: "Subtotal:", "Sales Amount:", "Merchandise Total:", "Net Amount:", "Taxable Amount:". This appears after line items but before tax/shipping/total. Return the EXACT amount with cents (e.g., "432.50"). Do NOT confuse with the grand total that includes tax. Do NOT round.`;
  }

  // Freight / Shipping
  if (lowerName.includes('freight') || lowerName.includes('shipping') || lowerName.includes('delivery')) {
    return `Search for freight or shipping charges on this invoice. Look for: "Freight:", "Shipping:", "Shipping & Handling:", "S&H:", "Delivery:", "Transport:", "Carrier:". Check the charges breakdown near subtotal/total. IMPORTANT: If freight shows "$0.00", "No Charge", "Included", or "Prepaid", return "0" (not "Not Present"). Return the exact amount with cents. Return "Not Present" only if no freight line exists at all.`;
  }

  // PO Number
  if (lowerName.includes('po number') || lowerName.includes('purchase order')) {
    return `Search for the Purchase Order number on this invoice. Look for: "PO #:", "P.O.:", "PO Number:", "Purchase Order:", "Customer PO:", "Your Order #:", "Reference:". It's usually in the invoice header or billing info section. Do NOT confuse with: Invoice Number (often "INV-xxxx"), Confirmation Numbers, or internal reference codes. Return the exact alphanumeric value as shown. Return "Not Present" if no PO is referenced.`;
  }

  // Payment Terms
  if (lowerName === 'term' || lowerName === 'terms' || lowerName.includes('payment term')) {
    return `Search for payment terms on this invoice. Look for: "Terms:", "Payment Terms:", "Net Terms:", near the due date or in terms section. Common values: "NET 30", "NET 15", "NET 60", "Due on Receipt", "COD". Return the standardized term (e.g., "NET 30" not "Net 30 Days" or "Payment due in 30 days"). Return "Not Present" if no payment terms are specified.`;
  }

  // Invoice Description / Memo
  if (lowerName.includes('description') && !lowerName.includes('item')) {
    return `Search for a description or memo explaining this invoice's purpose. Look in: (1) header area near invoice number, (2) "Subject:", "RE:", "Memo:", "Description:", "Purpose:" fields, (3) reference line. Do NOT extract: the document title "INVOICE", invoice numbers, customer names/addresses, or individual line item descriptions. Return a meaningful description of what this invoice is for. Return "Not Present" if no overall description exists.`;
  }

  // Line Items
  if (lowerName.includes('item') || lowerName.includes('line item')) {
    return `Extract line items from the invoice table. Look in the main itemization table with columns like "Description", "Item", "Qty", "Unit Price", "Amount". Extract ONLY the description/name of each product or service, not quantities or prices. Do NOT include: table headers, subtotal/total rows, tax lines, or notes. Format as comma-separated list if multiple items. Return "Not Present" if no itemized products/services exist.`;
  }

  // Default based on field type
  switch (fieldType) {
    case 'enum':
      const enumOptions = options?.map(o => o.key).join(', ') || '[list of valid options]';
      return `Search the document for the ${fieldName}. Return EXACTLY one of these values: ${enumOptions}. Look in relevant sections and match the closest option. If the exact term isn't found, infer from context. Return "Not Present" only if no relevant information exists.`;
    
    case 'date':
      return `Search the document for the ${fieldName}. Look in headers, signature blocks, and relevant sections. Return the date in YYYY-MM-DD format. If only month and year are given, use the first day of the month. Return "Not Present" if no date is found.`;
    
    case 'number':
      return `Search the document for the ${fieldName}. Return the EXACT numeric value as it appears, including decimal places (e.g., "432.50" not "432" or "433"). Do NOT round numbers - preserve cents/decimals exactly. Remove currency symbols ($, €) but keep the exact numeric value. If a range is given, return the primary/base value. Return "Not Present" if no number is found.`;
    
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

  // INVOICE-SPECIFIC GUIDANCE
  if (lowerName.includes('vendor') || lowerName.includes('supplier')) {
    return `IMPORTANT FOR INVOICES: The "Vendor" is the company SENDING the invoice (providing goods/services). Look in the document header, logo area, "From:" field, or "Remit To:" address. Do NOT confuse with the "Bill To" customer who is RECEIVING the invoice. Common labels: "From:", "Vendor:", "Supplier:", "Bill From:", "Service Provider:".\n`;
  }

  if (lowerName.includes('amount') || lowerName.includes('total') || lowerName.includes('price') || lowerName.includes('cost')) {
    return `CRITICAL FOR NUMBERS: Extract the EXACT value including cents/decimals. Do NOT round! If document shows "$432.50", return "432.50" (not "432" or "433"). If document shows "$1,234.99", return "1234.99". Preserve decimal precision exactly as shown in the document.\n`;
  }

  if (lowerName.includes('sales tax') || lowerName.includes('tax amount')) {
    return `IMPORTANT: Sales tax is usually shown as a separate line item near the subtotal/total. Look for "Tax:", "Sales Tax:", "Tax Amount:", "VAT:", "GST:". It's a dollar amount, not a percentage. Return the exact amount with cents (e.g., "45.67" not "45.7" or "46").\n`;
  }

  if (lowerName.includes('freight') || lowerName.includes('shipping')) {
    return `IMPORTANT: Freight/shipping charges may appear as "$0.00" or "Included" or "Prepaid". These should be returned as "0" not "Not Present". Look for "Freight:", "Shipping:", "Delivery:", "S&H:", "Shipping & Handling:".\n`;
  }

  if (lowerName.includes('po number') || lowerName.includes('purchase order')) {
    return `IMPORTANT: PO Numbers are customer reference numbers, distinct from Invoice Numbers. Look for "PO #:", "P.O.:", "Purchase Order:", "Customer PO:", "Your Order #:". Do NOT confuse with invoice numbers (often starting with "INV").\n`;
  }

  if (lowerName.includes('term') && !lowerName.includes('termination')) {
    return `IMPORTANT FOR INVOICES: Payment terms like "NET 30", "NET 15", "Due on Receipt". Look in the payment terms section, near due date, or in terms/conditions area. Return the standard format (e.g., "NET 30") without extra words like "DAYS".\n`;
  }

  if (lowerName.includes('description') || lowerName.includes('memo') || lowerName.includes('subject')) {
    return `IMPORTANT: Look for a MEANINGFUL description of the transaction purpose, not just "INVOICE" or the document title. Check memo/subject/reference lines. Common locations: near invoice number, in header area, or in "RE:" / "Subject:" / "Memo:" fields.\n`;
  }

  if (lowerName.includes('item') && (lowerName.includes('line') || fieldType === 'multiSelect')) {
    return `IMPORTANT: Line items are the individual products/services in the invoice table. Look in the main table body with columns like "Description", "Item", "Product", "Service". Each row is typically one item. Do NOT include headers, subtotals, or tax lines.\n`;
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
    // Convert to string to handle numbers and other types
    const predictedStr = failure.predicted != null ? String(failure.predicted) : '';
    const predicted = predictedStr.trim();
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
    // Convert to string to handle numbers and other types
    const predictedStr = failureExamples[0].predicted != null ? String(failureExamples[0].predicted) : '';
    const predicted = predictedStr.trim();
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
 * Structured prompt validation result
 * Validates that generated prompts meet quality requirements
 */
export type PromptValidation = {
  isValid: boolean;
  errors: string[];
  // Required elements present?
  hasLocation: boolean;      // "look in", "search in", "find in" with specific locations
  hasSynonyms: boolean;      // at least 5 distinct alternative phrases in quotes
  hasFormat: boolean;        // concrete output format specification
  hasDisambiguation: boolean; // "do not confuse", "do not return"
  hasNotFound: boolean;      // "not present" handling
  // Length constraints
  charCount: number;
  meetsMinLength: boolean;   // >= 150 chars
  // Quality metrics (for debugging/feedback)
  synonymCount?: number;     // Number of distinct quoted phrases found
};

/**
 * Validate a generated prompt against quality checklist
 * Returns structured validation result with specific errors
 */
export function validatePrompt(prompt: string): PromptValidation {
  const trimmed = (prompt || '').trim();
  const errors: string[] = [];
  
  // Check length
  const charCount = trimmed.length;
  const meetsMinLength = charCount >= 150;
  if (!meetsMinLength) {
    errors.push(`Prompt too short: ${charCount} chars (need 150+)`);
  }
  
  // Check for generic pattern
  if (/^extract the .{1,50}(from this document)?\.?$/i.test(trimmed)) {
    errors.push('Prompt is too generic - uses banned "Extract the X" pattern');
  }
  
  // Check for location guidance (WHERE to look)
  // Require specific location references, not just keyword presence
  const locationPatterns = [
    /look in[^.]*(?:section|paragraph|header|footer|signature|block|area|field|table|page)/i,
    /search in[^.]*(?:section|paragraph|header|footer|signature|block|area|field|table|page)/i,
    /check (?:the )?(?:opening|closing|first|last|header|footer|signature|notices?)/i,
    /(?:opening|closing|first|last)\s+(?:paragraph|section|page)/i,
    /\(\d+\)[^.]*(?:section|paragraph|block|area)/i, // numbered locations like "(1) the opening section"
    /signature block|header area|footer area|notices section/i,
  ];
  const locationMatches = locationPatterns.filter(p => p.test(trimmed)).length;
  const hasLocation = locationMatches >= 1 || /look in|search in|find in|check the|located in/i.test(trimmed);
  if (!hasLocation) {
    errors.push('Missing LOCATION guidance - tell AI where to look in document');
  }
  
  // Check for synonyms (WHAT phrases to search for)
  // STRENGTHENED: Require actual quoted phrases, not just keywords
  // Extract quoted phrases (at least 3 chars each to avoid trivial matches)
  const quotedPhrasesRaw = trimmed.match(/"[^"]{3,}"/g) || [];
  // Get unique phrases (case-insensitive)
  const uniqueQuotedPhrases = [...new Set(quotedPhrasesRaw.map(p => p.toLowerCase()))];
  const quotedPhraseCount = uniqueQuotedPhrases.length;
  
  // Also check for comma-separated alternatives (e.g., "look for: X, Y, Z")
  const commaListMatch = trimmed.match(/(?:look for|search for|phrases like)[^.]*[:,]\s*['"]?([^'"]+)['"]?(?:,\s*['"]?([^'"]+)['"]?)+/i);
  const hasCommaList = commaListMatch !== null;
  
  // Require at least 5 distinct quoted phrases OR a clear comma-separated list with keyword
  const hasSynonyms = quotedPhraseCount >= 5 || 
    (quotedPhraseCount >= 3 && hasCommaList) ||
    (quotedPhraseCount >= 3 && /phrases like|variations|synonyms/i.test(trimmed));
  
  if (!hasSynonyms) {
    if (quotedPhraseCount > 0 && quotedPhraseCount < 5) {
      errors.push(`Insufficient SYNONYMS - found ${quotedPhraseCount} phrases, need 5+ distinct alternatives`);
    } else {
      errors.push('Missing SYNONYMS - list 5+ alternative phrases in quotes the value might appear as');
    }
  }
  
  // Check for format specification
  // STRENGTHENED: Require concrete format rules, not just "return" keyword
  const formatPatterns = [
    /return.*(?:format|YYYY|MM|DD|exactly|only the|single line|complete)/i,
    /format.*(?:as|to|should|must)/i,
    /output.*(?:format|as)/i,
    /YYYY-MM-DD|YYYY\/MM\/DD/i,
    /decimal|cents|digits|numeric/i,
    /exactly as|exactly one|exact value/i,
    /including (?:street|city|state|zip|suffix)/i, // address format
    /full (?:legal |entity )?name/i, // name format
  ];
  const hasFormat = formatPatterns.some(p => p.test(trimmed));
  if (!hasFormat) {
    errors.push('Missing FORMAT - specify exact output format (date format, precision, etc.)');
  }
  
  // Check for disambiguation (negative guidance)
  const hasDisambiguation = /do not|don't|not confuse|not return|not include|not extract|avoid|exclude|instead of|rather than/i.test(trimmed);
  if (!hasDisambiguation) {
    errors.push('Missing DISAMBIGUATION - add "Do NOT..." guidance to prevent mistakes');
  }
  
  // Check for not-found handling
  const hasNotFound = /not present|not found|missing|if no|if not|cannot find|doesn't exist|does not exist/i.test(trimmed);
  if (!hasNotFound) {
    errors.push('Missing NOT-FOUND handling - specify what to return if value not found');
  }
  
  // Count how many of the 5 elements are present
  const elementCount = [hasLocation, hasSynonyms, hasFormat, hasDisambiguation, hasNotFound]
    .filter(Boolean).length;
  
  // Require at least 4 of 5 elements for valid prompt
  const isValid = meetsMinLength && elementCount >= 4 && errors.length <= 1;
  
  return {
    isValid,
    errors,
    hasLocation,
    hasSynonyms,
    hasFormat,
    hasDisambiguation,
    hasNotFound,
    charCount,
    meetsMinLength,
    synonymCount: quotedPhraseCount,
  };
}

/**
 * Build a repair prompt to fix validation errors
 * Asks Box AI to fix specific issues with the generated prompt
 */
export function buildPromptRepairRequest(
  originalPrompt: string,
  validation: PromptValidation,
  fieldName: string,
  fieldType: string
): string {
  return `You generated an extraction prompt that has quality issues. Fix them.

## ORIGINAL PROMPT
"${originalPrompt}"

## ISSUES TO FIX
${validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

## REQUIREMENTS
The prompt MUST include:
${!validation.hasLocation ? '- LOCATION: Specific document sections (e.g., "opening paragraph", "signature blocks", "Notices section")' : ''}
${!validation.hasSynonyms ? `- SYNONYMS: At least 5 distinct phrases IN QUOTES (current: ${validation.synonymCount || 0}). Example: "expires on", "terminates on", "valid until", "term ends", "completion date"` : ''}
${!validation.hasFormat ? '- FORMAT: Concrete output specification (e.g., "YYYY-MM-DD format", "full legal entity name including LLC/Inc")' : ''}
${!validation.hasDisambiguation ? '- DISAMBIGUATION: "Do NOT..." guidance to prevent mistakes' : ''}
${!validation.hasNotFound ? '- NOT-FOUND: What to return if value is not found (usually "Not Present")' : ''}
${!validation.meetsMinLength ? `- LENGTH: At least 150 characters (current: ${validation.charCount})` : ''}

## FIELD INFO
Field: "${fieldName}" (type: ${fieldType})

## OUTPUT
Return ONLY valid JSON:
{"newPrompt": "your fixed prompt here", "reasoning": "what you fixed"}`;
}

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
  
  // Helper to check if a prompt is too generic/short
  const isGenericPrompt = (prompt: string): boolean => {
    const trimmed = prompt.trim();
    // Too short - system prompt requires minimum 150 characters
    if (trimmed.length < 150) return true;
    // Generic "Extract the X" pattern without additional detail
    if (/^extract the .{1,50}(from this document)?\.?$/i.test(trimmed)) return true;
    // Check if prompt lacks key elements (should have location, synonyms, format, etc.)
    const hasLocation = /look in|search in|find in|check the|located in/i.test(trimmed);
    const hasSynonyms = /look for|search for|phrases like|variations|synonyms/i.test(trimmed);
    const hasFormat = /return|format|output|provide/i.test(trimmed);
    const hasNotFound = /not present|not found|missing|if no|if not/i.test(trimmed);
    
    // If missing multiple key elements, it's too generic
    const elementCount = [hasLocation, hasSynonyms, hasFormat, hasNotFound].filter(Boolean).length;
    if (elementCount < 3) return true;
    
    return false;
  };
  
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(cleanResponse);
    
    if (parsed.newPrompt && typeof parsed.newPrompt === 'string') {
      const prompt = parsed.newPrompt.trim();
      
      // Check if the prompt is too generic/short
      if (isGenericPrompt(prompt)) {
        logger.warn('Generated prompt is too generic', { 
          promptLength: prompt.length, 
          preview: prompt.substring(0, 50),
          validationFailed: 'needs 150+ chars and key elements (location, synonyms, format, not-found handling)'
        });
        
        // Use fallback if available
        if (fieldName) {
          const fallbackPrompt = getExamplePromptForField(fieldName, 'string');
          logger.warn('Using fallback prompt for field', { fieldName });
          return {
            newPrompt: fallbackPrompt,
            reasoning: `Used fallback prompt because generated prompt was too generic (${prompt.length} chars): "${prompt.substring(0, 50)}..."`,
          };
        }
        
        // If no fieldName for fallback, throw error to trigger retry
        throw new Error(`Generated prompt is too generic (${prompt.length} chars, needs 150+) and lacks required elements. Prompt: "${prompt.substring(0, 100)}..."`);
      }
      
      return {
        newPrompt: prompt,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    }
  } catch (e) {
    logger.debug('JSON parsing failed, trying regex extraction', { error: String(e) });
  }
  
  // Try to extract from text using regex
  const newPromptMatch = cleanResponse.match(/"newPrompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const reasoningMatch = cleanResponse.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  
  if (newPromptMatch) {
    const prompt = newPromptMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
    
    // Check if the prompt is too generic
    if (isGenericPrompt(prompt)) {
      logger.warn('Extracted prompt is too generic', { promptLength: prompt.length, preview: prompt.substring(0, 50) });
      
      if (fieldName) {
        const fallbackPrompt = getExamplePromptForField(fieldName, 'string');
        logger.warn('Using fallback prompt for field', { fieldName, reason: 'extracted prompt too generic' });
        return {
          newPrompt: fallbackPrompt,
          reasoning: `Used fallback prompt because extracted prompt was too generic (${prompt.length} chars): "${prompt.substring(0, 50)}..."`,
        };
      }
      
      // If no fieldName for fallback, throw error to trigger retry
      throw new Error(`Extracted prompt is too generic (${prompt.length} chars, needs 150+) and lacks required elements. Prompt: "${prompt.substring(0, 100)}..."`);
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
    
    if (!isGenericPrompt(prompt)) {
      return {
        newPrompt: prompt,
        reasoning: 'Extracted from JSON block',
      };
    }
  }

  // FALLBACK: Use our high-quality example prompt instead of the bad response
  logger.warn('Failed to parse response, using fallback prompt', { 
    fieldName, 
    rawResponsePreview: response.substring(0, 200) 
  });
  
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
