import type { OptimizerPromptRequest } from '@/lib/optimizer-types';

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
    + '3. Respond as plain text (no JSON). Use the following format exactly:\n'
    + 'New Prompt:\n<your improved prompt text>\n\nPrompt Theory:\n<concise explanation citing key documents>.\n'
    + '4. Keep `Prompt Theory` under 2 sentences and reference document nicknames when possible.';
}

export function parseOptimizerPromptResponse(answer: unknown) {
  if (answer == null) {
    throw new Error('Optimizer prompt response was empty');
  }

  const rawText = typeof answer === 'string' ? answer : JSON.stringify(answer);
  const normalized = rawText.trim();
  if (!normalized) {
    throw new Error('Optimizer prompt response was blank');
  }

  const promptMatch = normalized.match(/(?:New\s+Prompt|Prompt)\s*:\s*([\s\S]*?)(?:\n{2,}|\r{2,}|Prompt\s+Theory:|Theory:|Reason:|$)/i);
  const theoryMatch = normalized.match(/(?:Prompt\s+Theory|Theory|Reason)\s*:\s*([\s\S]*)/i);

  const newPrompt = promptMatch?.[1]?.trim() || normalized;
  const promptTheory = theoryMatch?.[1]?.trim() || 'Optimizer did not return an explicit theory.';

  if (!newPrompt) {
    throw new Error('Optimizer prompt response missing prompt content');
  }

  return { newPrompt, promptTheory };
}
