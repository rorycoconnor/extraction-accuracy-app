'use server';

/**
 * Document Analysis Module for Agent-Alpha
 * 
 * Provides deep analysis of documents to understand WHY extractions fail.
 * This enables the agent to write better prompts by seeing actual document context.
 */

import { boxApiFetch } from '@/services/box';
import { logger } from '@/lib/logger';
import { processWithConcurrency } from '@/lib/concurrency';

/**
 * Get file name from Box API
 */
async function getFileName(fileId: string): Promise<string> {
  try {
    const fileInfo = await boxApiFetch(`/files/${fileId}?fields=name`, { method: 'GET' });
    return fileInfo?.name || fileId;
  } catch {
    return fileId; // Fallback to ID if we can't get the name
  }
}

// Maximum characters to include in a snippet
const MAX_SNIPPET_LENGTH = 800;
const MAX_CONTEXT_PER_DOC = 1500;

export type DocumentSnippet = {
  docId: string;
  docName: string;
  fieldKey: string;
  // The actual text from the document where the value should be found
  relevantText: string;
  // Where in the document this was found
  location: string;
  // What the AI observed about the document structure
  structuralNotes: string;
  // If we found the ground truth value, where was it?
  groundTruthLocation?: string;
  // If we found what the AI extracted, where was it?
  extractedValueLocation?: string;
};

export type FailureAnalysis = {
  docId: string;
  docName: string;
  fieldKey: string;
  fieldName: string;
  groundTruth: string;
  extractedValue: string;
  // Deep analysis
  snippets: DocumentSnippet[];
  // Why the extraction likely failed
  failureReason: string;
  // Specific guidance for fixing the prompt
  suggestedFix: string;
};

/**
 * Analyze a failed extraction by examining the actual document content
 */
export async function analyzeFailedExtraction(params: {
  docId: string;
  docName?: string; // Optional - will fetch from Box if not provided
  fieldKey: string;
  fieldName: string;
  groundTruth: string;
  extractedValue: string;
}): Promise<FailureAnalysis> {
  const { docId, fieldKey, fieldName, groundTruth, extractedValue } = params;
  
  // Get file name from Box if not provided
  const docName = params.docName || await getFileName(docId);
  
  logger.info(`📄 Analyzing document for field "${fieldName}"`, { docId, docName });

  try {
    // Step 1: Ask Box AI to analyze where the values appear in the document
    const analysisPrompt = buildAnalysisPrompt(fieldName, groundTruth, extractedValue);
    
    const response = await boxApiFetch('/ai/text_gen', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: docId, type: 'file' }],
        prompt: analysisPrompt,
      }),
    });

    const analysisText = response?.answer || '';
    
    logger.debug(`Document analysis response for ${docId}`, { 
      preview: analysisText.substring(0, 200) 
    });

    // Parse the analysis
    const parsed = parseAnalysisResponse(analysisText, groundTruth, extractedValue);

    return {
      docId,
      docName,
      fieldKey,
      fieldName,
      groundTruth,
      extractedValue,
      snippets: [{
        docId,
        docName,
        fieldKey,
        relevantText: parsed.relevantText,
        location: parsed.location,
        structuralNotes: parsed.structuralNotes,
        groundTruthLocation: parsed.groundTruthLocation,
        extractedValueLocation: parsed.extractedValueLocation,
      }],
      failureReason: parsed.failureReason,
      suggestedFix: parsed.suggestedFix,
    };
  } catch (error) {
    logger.error(`Failed to analyze document ${docId}`, error as Error);
    
    // Return a basic analysis if we couldn't do deep analysis
    return {
      docId,
      docName,
      fieldKey,
      fieldName,
      groundTruth,
      extractedValue,
      snippets: [],
      failureReason: 'Unable to analyze document content',
      suggestedFix: 'Add more specific location guidance and synonyms',
    };
  }
}

/**
 * Analyze multiple failed extractions in parallel
 */
export async function analyzeFailedExtractions(
  failures: Array<{
    docId: string;
    docName?: string; // Optional - will fetch from Box if not provided
    fieldKey: string;
    fieldName: string;
    groundTruth: string;
    extractedValue: string;
  }>,
  maxConcurrency = 2
): Promise<FailureAnalysis[]> {
  logger.info(`📄 Analyzing ${failures.length} failed extractions for document context`);
  
  const analyses = await processWithConcurrency(
    failures,
    maxConcurrency,
    async (failure) => analyzeFailedExtraction(failure)
  );
  
  return analyses;
}

/**
 * Build a prompt to analyze where values appear in a document
 */
function buildAnalysisPrompt(fieldName: string, groundTruth: string, extractedValue: string): string {
  const hasExtractedValue = extractedValue && 
    extractedValue !== 'Not Present' && 
    extractedValue !== '' &&
    !extractedValue.startsWith('Error');
    
  const hasGroundTruth = groundTruth && groundTruth !== 'Not Present' && groundTruth !== '';

  let prompt = `You are analyzing a document to understand an extraction error.

FIELD: "${fieldName}"
`;

  if (hasGroundTruth) {
    prompt += `CORRECT VALUE (Ground Truth): "${groundTruth}"
`;
  } else {
    prompt += `CORRECT VALUE: The field should not be present in this document
`;
  }

  if (hasExtractedValue) {
    prompt += `WRONG VALUE EXTRACTED: "${extractedValue}"
`;
  } else {
    prompt += `WRONG VALUE EXTRACTED: Nothing was found (but it should have been)
`;
  }

  prompt += `
TASK: Analyze this document and explain WHY the extraction went wrong.

Please provide your analysis in this EXACT format:

RELEVANT_TEXT_START
[Quote the exact section of the document (up to 500 chars) where the CORRECT value "${groundTruth}" appears, or where it SHOULD appear if not found]
RELEVANT_TEXT_END

LOCATION: [Where in the document is this? e.g., "Top header", "Near 'Bill To' section", "Payment summary table", "Footer area"]

`;

  if (hasExtractedValue && hasGroundTruth && extractedValue !== groundTruth) {
    prompt += `WRONG_VALUE_LOCATION: [Where in the document does "${extractedValue}" appear? Why might the AI have grabbed this instead?]

`;
  }

  prompt += `STRUCTURE_NOTES: [Describe the document structure around this field - is it in a table? Near similar-looking values? Has confusing labels?]

FAILURE_REASON: [In one sentence, explain the most likely reason the AI extracted the wrong value]

SUGGESTED_FIX: [In one sentence, what specific guidance should the extraction prompt include to prevent this error?]`;

  // Special handling for numeric fields - check for rounding
  if (hasGroundTruth && hasExtractedValue) {
    const gtNum = parseFloat(groundTruth.replace(/[$,]/g, ''));
    const exNum = parseFloat(extractedValue.replace(/[$,]/g, ''));
    
    if (!isNaN(gtNum) && !isNaN(exNum)) {
      const diff = Math.abs(gtNum - exNum);
      if (diff > 0 && diff < 1) {
        prompt += `

IMPORTANT: This appears to be a ROUNDING error (${groundTruth} vs ${extractedValue}). 
Pay special attention to whether the document shows cents/decimals and if the AI is rounding.`;
      }
    }
  }

  return prompt;
}

/**
 * Parse the analysis response from Box AI
 */
function parseAnalysisResponse(
  response: string,
  groundTruth: string,
  extractedValue: string
): {
  relevantText: string;
  location: string;
  structuralNotes: string;
  groundTruthLocation?: string;
  extractedValueLocation?: string;
  failureReason: string;
  suggestedFix: string;
} {
  // Extract sections using markers
  const relevantTextMatch = response.match(/RELEVANT_TEXT_START\s*([\s\S]*?)\s*RELEVANT_TEXT_END/i);
  const locationMatch = response.match(/LOCATION:\s*([^\n]+)/i);
  const wrongValueMatch = response.match(/WRONG_VALUE_LOCATION:\s*([^\n]+)/i);
  const structureMatch = response.match(/STRUCTURE_NOTES:\s*([^\n]+)/i);
  const failureMatch = response.match(/FAILURE_REASON:\s*([^\n]+)/i);
  const fixMatch = response.match(/SUGGESTED_FIX:\s*([^\n]+)/i);

  return {
    relevantText: truncate(relevantTextMatch?.[1]?.trim() || response.substring(0, MAX_SNIPPET_LENGTH), MAX_SNIPPET_LENGTH),
    location: locationMatch?.[1]?.trim() || 'Unknown location',
    structuralNotes: structureMatch?.[1]?.trim() || 'No structural notes available',
    groundTruthLocation: locationMatch?.[1]?.trim(),
    extractedValueLocation: wrongValueMatch?.[1]?.trim(),
    failureReason: failureMatch?.[1]?.trim() || 'Unable to determine failure reason',
    suggestedFix: fixMatch?.[1]?.trim() || 'Add more specific guidance to the prompt',
  };
}

/**
 * Build a condensed summary of failure analyses for the prompt generator
 */
export async function buildDocumentContextForPrompt(analyses: FailureAnalysis[]): Promise<string> {
  if (analyses.length === 0) {
    return '';
  }

  let context = `\n## DOCUMENT ANALYSIS (Why Extractions Failed)\n`;
  context += `The following analysis shows ACTUAL document content where errors occurred:\n\n`;

  for (const analysis of analyses.slice(0, 3)) { // Limit to 3 docs to stay within token limits
    context += `### Document: ${analysis.docName}\n`;
    context += `- Expected: "${truncate(analysis.groundTruth, 80)}"\n`;
    context += `- AI Extracted: "${truncate(analysis.extractedValue, 80)}"\n`;
    context += `- Location: ${analysis.snippets[0]?.location || 'Unknown'}\n`;
    context += `- Failure Reason: ${analysis.failureReason}\n`;
    
    if (analysis.snippets[0]?.relevantText) {
      context += `- Document Text:\n\`\`\`\n${truncate(analysis.snippets[0].relevantText, 400)}\n\`\`\`\n`;
    }
    
    context += `- Fix: ${analysis.suggestedFix}\n\n`;
  }

  // Add special section for common patterns
  const commonPatterns = detectCommonFailurePatterns(analyses);
  if (commonPatterns.length > 0) {
    context += `### Common Patterns Detected:\n`;
    for (const pattern of commonPatterns) {
      context += `⚠️ ${pattern}\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Detect common failure patterns across multiple documents
 */
function detectCommonFailurePatterns(analyses: FailureAnalysis[]): string[] {
  const patterns: string[] = [];
  
  // Check for rounding errors
  const roundingErrors = analyses.filter(a => {
    const gtNum = parseFloat(a.groundTruth.replace(/[$,]/g, ''));
    const exNum = parseFloat(a.extractedValue.replace(/[$,]/g, ''));
    if (!isNaN(gtNum) && !isNaN(exNum)) {
      const diff = Math.abs(gtNum - exNum);
      return diff > 0 && diff < 1;
    }
    return false;
  });
  
  if (roundingErrors.length > 0) {
    patterns.push(`ROUNDING: AI is rounding numbers instead of extracting exact values with decimals. Add explicit instruction: "Return the EXACT amount including cents (e.g., 123.45, not 123 or 124)"`);
  }

  // Check for similar wrong values (e.g., always extracting the same company)
  const wrongValues = analyses.map(a => a.extractedValue).filter(v => v && v !== 'Not Present');
  const valueCounts: Record<string, number> = {};
  for (const v of wrongValues) {
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  }
  
  for (const [value, count] of Object.entries(valueCounts)) {
    if (count >= 2) {
      patterns.push(`REPEATED ERROR: AI keeps extracting "${value}" incorrectly. This value should be explicitly excluded in the prompt.`);
    }
  }

  // Check for "Not Present" when value exists
  const missedValues = analyses.filter(a => 
    (!a.extractedValue || a.extractedValue === 'Not Present') && 
    a.groundTruth && a.groundTruth !== 'Not Present'
  );
  
  if (missedValues.length >= 2) {
    patterns.push(`MISSING VALUES: AI is returning "Not Present" when values exist. Add more synonyms and search locations.`);
  }

  // Check for format issues
  const formatIssues = analyses.filter(a => {
    // Same content but different format
    const gtNorm = a.groundTruth.toLowerCase().replace(/[^a-z0-9]/g, '');
    const exNorm = a.extractedValue.toLowerCase().replace(/[^a-z0-9]/g, '');
    return gtNorm === exNorm && a.groundTruth !== a.extractedValue;
  });
  
  if (formatIssues.length > 0) {
    patterns.push(`FORMAT MISMATCH: Values match but format differs. Add explicit format instructions (e.g., "Return with $ symbol" or "Use YYYY-MM-DD format").`);
  }

  return patterns;
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
