'use server';

import { logger } from '@/lib/logger';
import { buildOptimizerPrompt, parseOptimizerPromptResponse } from '@/lib/optimizer-prompts';
import type { OptimizerPromptRequest } from '@/lib/optimizer-types';
import { boxApiFetch, clearBlankPlaceholderFileCache, getBlankPlaceholderFileId } from '@/services/box';

const MAX_LOG_PREVIEW = 2000;

const formatPayloadForLog = (payload: unknown) => {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (!raw) return raw;
  return raw.length > MAX_LOG_PREVIEW ? `${raw.slice(0, MAX_LOG_PREVIEW)}…` : raw;
};

const RETRY_DELAY_MS = 1500;

export async function generateOptimizerPrompt(request: OptimizerPromptRequest) {
  const prompt = buildOptimizerPrompt(request);
  let placeholderId = await getBlankPlaceholderFileId();

  const makeRequest = async (attempt: number) => {
    const body = {
      prompt,
      items: [{ id: placeholderId, type: 'file' as const }],
      ai_agent: {
        type: 'ai_agent_text_gen',
        basic_gen: {
          model: 'google__gemini_2_5_pro',
        },
      },
    };

    const response = await boxApiFetch('/ai/text_gen', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const rawAnswer = response?.answer ?? response;
    logger.info('optimizer_prompt_llm_answer', {
      fieldKey: request.fieldKey,
      rawAnswer: formatPayloadForLog(rawAnswer),
      attempt: attempt > 1 ? `retry_${attempt}` : undefined,
    });
    const parsed = parseOptimizerPromptResponse(rawAnswer);
    logger.info('optimizer_prompt_success', { fieldKey: request.fieldKey, attempt });
    return parsed;
  };

  try {
    return await makeRequest(1);
  } catch (error) {
    // Handle missing placeholder file - refresh and retry
    if (isMissingFileError(error)) {
      await clearBlankPlaceholderFileCache();
      placeholderId = await getBlankPlaceholderFileId({ refresh: true });
      logger.info('optimizer_prompt_retrying_missing_file', { fieldKey: request.fieldKey });
      return await makeRequest(2);
    }

    // Single retry for transient errors (network, 5xx, rate limits)
    if (isRetryableError(error)) {
      logger.warn('optimizer_prompt_retrying_transient', { 
        fieldKey: request.fieldKey, 
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      try {
        return await makeRequest(2);
      } catch (retryError) {
        logger.error('optimizer_prompt_retry_failed', { fieldKey: request.fieldKey, error: retryError });
        throw retryError;
      }
    }

    logger.error('optimizer_prompt_failed', { fieldKey: request.fieldKey, error });
    throw error;
  }
}

function isMissingFileError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('404') || message.includes('item_not_found');
}

function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  // Retry on: network errors, 5xx server errors, rate limits, timeouts
  return (
    message.includes('5') && /\b5\d{2}\b/.test(message) || // 5xx errors
    message.includes('rate') ||
    message.includes('timeout') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('network') ||
    message.includes('fetch failed')
  );
}
