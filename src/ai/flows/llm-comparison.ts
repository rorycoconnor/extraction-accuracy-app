/**
 * @fileOverview LLM-based comparison using Box AI
 *
 * Implements the "LLM as Judge" comparison strategy using Box AI's text generation API
 */

'use server';

import { boxApiFetch } from '@/services/box';
import { logger } from '@/lib/logger';

/**
 * Evaluate if two values match using LLM semantic comparison
 *
 * @param groundTruthValue - The ground truth value
 * @param extractedValue - The extracted value to compare
 * @param comparisonPrompt - Custom instructions for comparison criteria
 * @param fileId - Optional file ID for context
 * @returns Result with match status, reason, and raw response
 */
export async function evaluateWithLLM({
  groundTruthValue,
  extractedValue,
  comparisonPrompt,
  fileId,
}: {
  groundTruthValue: string;
  extractedValue: string;
  comparisonPrompt: string;
  fileId?: string;
}): Promise<{
  isMatch: boolean;
  reason: string;
  rawResponse: string;
  error?: string;
}> {
  try {
    // Construct prompt using template
    const prompt = buildComparisonPrompt(groundTruthValue, extractedValue, comparisonPrompt);

    // Box AI text_gen endpoint REQUIRES at least one file item
    // If no fileId provided, we cannot use Box AI
    if (!fileId) {
      logger.warn('LLM comparison called without fileId - Box AI requires file context');
      // return {
      //   isMatch: false,
      //   reason: 'LLM comparison requires a file ID for Box AI context',
      //   rawResponse: '',
      //   error: 'No file ID provided - Box AI text_gen endpoint requires file context'
      // };
    }

    // Prepare items for Box AI (required)
    const items = [{ id: '2040714201496', type: 'file' as const }];

    // Call Box AI text generation API
    const response = await boxApiFetch('/ai/text_gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        items,
        ai_agent: {
          type: 'ai_agent_text_gen',
          basic_gen: {
            model: 'google__gemini_2_5_pro'
          }
        }
      }),
    });

    const rawResponse = response.answer;


    // Parse response to extract match status and reason
    const parseResult = parseComparisonResponse(rawResponse);

    logger.debug('LLM comparison completed', {
      isMatch: parseResult.isMatch,
      reason: parseResult.reason,
    });

    return {
      isMatch: parseResult.isMatch,
      reason: parseResult.reason,
      rawResponse,
    };
  } catch (error) {
    logger.error('LLM comparison failed', {
      error: error as Error,
      groundTruthValue,
      extractedValue,
    });

    return {
      isMatch: false,
      reason: 'LLM comparison API error',
      rawResponse: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build the comparison prompt for LLM
 */
function buildComparisonPrompt(
  groundTruthValue: string,
  extractedValue: string,
  comparisonCriteria: string
): string {
  return `You are a metadata validation assistant. Compare the following two values and determine if they match according to the criteria.

Ground Truth: "${groundTruthValue}"
Extracted Value: "${extractedValue}"

Criteria: ${comparisonCriteria}

Respond with EXACTLY one of:
- MATCH: if the values satisfy the criteria
- NO_MATCH: if the values do not satisfy the criteria

Then on a new line, provide a brief reason (1 sentence).

Format:
MATCH or NO_MATCH
Reason: [your reason]`;
}

/**
 * Parse the LLM response to extract match status and reason
 */
function parseComparisonResponse(response: string): {
  isMatch: boolean;
  reason: string;
} {
  if (!response || typeof response !== 'string') {
    return {
      isMatch: false,
      reason: 'Empty or invalid response',
    };
  }

  const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  if (lines.length === 0) {
    return {
      isMatch: false,
      reason: 'Empty response',
    };
  }

  // Extract first line for match status
  const firstLine = lines[0].toUpperCase();

  let isMatch = false;

  if (firstLine.includes('MATCH') && !firstLine.includes('NO_MATCH')) {
    isMatch = true;
  } else if (firstLine.includes('NO_MATCH') || firstLine.includes('NO MATCH')) {
    isMatch = false;
  } else {
    // Ambiguous response - default to NO_MATCH
    logger.warn('Ambiguous LLM response, defaulting to NO_MATCH', {
      firstLine,
      response,
    });
    return {
      isMatch: false,
      reason: 'Ambiguous response: ' + response.substring(0, 100),
    };
  }

  // Extract reason from second line or remaining text
  let reason = 'No reason provided';

  if (lines.length > 1) {
    // Look for "Reason:" prefix
    const reasonLine = lines.find(line => line.toLowerCase().startsWith('reason:'));
    if (reasonLine) {
      reason = reasonLine.substring(7).trim(); // Remove "Reason:" prefix
    } else {
      // Use second line as reason
      reason = lines[1];
    }
  }

  return {
    isMatch,
    reason,
  };
}
