
'use server';

/**
 * @fileOverview Prompt generation using Box AI API
 * 
 * Generates and improves prompts using Box AI text generation.
 */

import { boxApiFetch } from '@/services/box';
import { SYSTEM_MESSAGES, FIELD_TYPE_HEURISTICS, FIELD_KEY_HEURISTICS } from '@/ai/prompts/prompt-engineering';

export async function generateInitialPrompt(
  { templateName, field, fileIds }: { templateName: string; field: { name: string; key: string; type: string; }; fileIds?: string[] }
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

  const response = await boxApiFetch(
    '/ai/text_gen',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `
          SYSTEM: ${SYSTEM_MESSAGES.GENERATE}

          USER: Generate an extraction prompt based on the following context:
          - Template Name: "${templateName}"
          - Metadata Field Name: "${field.name}"
          - Field Type: "${field.type}"
          ${guidelines.length > 0 ? `- Guidelines: \n${guidelines.map(g => `  - ${g}`).join('\n')}` : ''}
        `,
        ...(items.length > 0 ? { items } : {}),
        ai_agent: {
          type: 'ai_agent_text_gen',
          basic_gen: {
            model: 'google__gemini_2_5_pro'
          }
        }
      })
    }
  );

  return { prompt: response.answer, generationMethod: 'standard' };
}

export async function improvePrompt(
  { originalPrompt, userFeedback, templateName, field, fileIds }: { originalPrompt: string; userFeedback: string; templateName: string; field: { name: string; key: string; type: string; }; fileIds?: string[] }
): Promise<{ prompt: string; generationMethod: 'standard' | 'dspy' | 'agent' }> {
  
  // Use selected files for context, fallback to empty items if none provided
  // Box AI Text Gen API only allows 1 file maximum
  const items = (fileIds && fileIds.length > 0
    ? [fileIds[0]] // Take only the first file - Box AI Text Gen has 1 item limit
    : [])
    .map(id => ({ id, type: 'file' as const }));

  const response = await boxApiFetch(
    '/ai/text_gen',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `
          SYSTEM: ${SYSTEM_MESSAGES.IMPROVE}

          USER: Refine the following extraction prompt.
          - Original Prompt: "${originalPrompt}"
          - User Issues/Feedback: "${userFeedback}"
          - Context: The prompt is for the "${field.name}" field (type: ${field.type}) in the "${templateName}" template.
        `,
        ...(items.length > 0 ? { items } : {}),
        ai_agent: {
          type: 'ai_agent_text_gen',
          basic_gen: {
            model: 'google__gemini_2_5_pro'
          }
        }
      })
    }
  );

  return { prompt: response.answer, generationMethod: 'standard' };
}
