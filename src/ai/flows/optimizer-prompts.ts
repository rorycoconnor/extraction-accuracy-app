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

export async function generateOptimizerPrompt(request: OptimizerPromptRequest) {
  const prompt = buildOptimizerPrompt(request);
  let placeholderId = await getBlankPlaceholderFileId();

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

  try {
    const response = await boxApiFetch('/ai/text_gen', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const rawAnswer = response?.answer ?? response;
    logger.info('optimizer_prompt_llm_answer', {
      fieldKey: request.fieldKey,
      rawAnswer: formatPayloadForLog(rawAnswer),
    });
    const parsed = parseOptimizerPromptResponse(rawAnswer);
    logger.info('optimizer_prompt_success', { fieldKey: request.fieldKey });
    return parsed;
  } catch (error) {
    if (isMissingFileError(error)) {
      await clearBlankPlaceholderFileCache();
      placeholderId = await getBlankPlaceholderFileId({ refresh: true });
      const retryResponse = await boxApiFetch('/ai/text_gen', {
        method: 'POST',
        body: JSON.stringify({ ...body, items: [{ id: placeholderId, type: 'file' as const }] }),
      });
      const rawAnswer = retryResponse?.answer ?? retryResponse;
      logger.info('optimizer_prompt_llm_answer', {
        fieldKey: request.fieldKey,
        rawAnswer: formatPayloadForLog(rawAnswer),
        attempt: 'retry',
      });
      const parsed = parseOptimizerPromptResponse(rawAnswer);
      logger.info('optimizer_prompt_success_after_retry', { fieldKey: request.fieldKey });
      return parsed;
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
