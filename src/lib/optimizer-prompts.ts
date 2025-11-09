import { z } from 'zod';
import type { OptimizerPromptRequest } from '@/lib/optimizer-types';

const OptimizerPromptResponseSchema = z.object({
  newPrompt: z.string().min(1),
  promptTheory: z.string().min(1),
});

export function buildOptimizerPrompt(request: OptimizerPromptRequest): string {
  const historySection = request.previousPrompts
    .slice(0, 2)
    .map((entry, index) => `Prior Version ${index + 1} (saved ${entry.savedAt}):\n${entry.prompt}`)
    .join('\n\n') || 'No prior versions beyond the active prompt.';

  const theoriesSection = request.theories
    .map((item) => `- [${item.docName}] ${item.theory}`)
    .join('\n') || '- No document theories available. Focus on improving clarity generally.';

  return `SYSTEM: You are an extraction prompt optimizer for Box AI.\n`
    + `Field: ${request.fieldName} (${request.fieldType})\n`
    + `Goal: Improve the prompt so the base model extracts accurate values from varied contracts.\n\n`
    + `Current Prompt:\n${request.currentPrompt}\n\n`
    + `Historical Prompts:\n${historySection}\n\n`
    + `Document Failure Theories:\n${theoriesSection}\n\n`
    + 'Instructions:\n'
    + '1. Incorporate document-specific theories into a revised prompt.\n'
    + '2. Keep the tone prescriptive with explicit anchors (tables, headings, context).\n'
    + '3. Return JSON ONLY with keys `newPrompt` and `promptTheory`.\n'
    + '4. `promptTheory` must cite the most influential documents or patterns in 2 sentences max.';
}

export function parseOptimizerPromptResponse(answer: unknown) {
  let structured: unknown = answer;
  if (typeof answer === 'string') {
    const trimmed = answer.trim();
    try {
      structured = JSON.parse(trimmed);
    } catch (error) {
      throw new Error('Optimizer prompt response was not valid JSON');
    }
  }

  const result = OptimizerPromptResponseSchema.safeParse(structured);
  if (!result.success) {
    throw new Error('Optimizer prompt response missing required keys');
  }

  return result.data;
}
