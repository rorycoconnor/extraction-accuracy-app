import { z } from 'zod';

// ==================== Box AI Field Schemas ====================

export const BoxAIFieldSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'date', 'enum', 'multiSelect', 'number', 'float']),
  displayName: z.string(),
  prompt: z.string().optional(), // Optional to support no-prompt runs
  options: z.array(z.object({ key: z.string() })).optional(), // Enum/multiSelect options
});
export type BoxAIField = z.infer<typeof BoxAIFieldSchema>;

export const ExtractMetadataInputSchema = z.object({
  fileId: z.string().describe('The ID of the file in Box to extract metadata from.'),
  fields: z.array(BoxAIFieldSchema).optional().describe('The fields to extract (optional when using metadata template).'),
  model: z.string().describe('The AI model to use for extraction.'),
  templateKey: z.string().optional().describe('The Box metadata template key to use (optional, alternative to fields).'),
});
export type ExtractMetadataInput = z.infer<typeof ExtractMetadataInputSchema>;

export const ExtractMetadataOutputSchema = z.object({
  data: z.record(z.string()).describe('The extracted metadata as key-value pairs.'),
  confidenceScores: z.record(z.number()).optional().describe('Per-field confidence scores from Box AI (0-1).'),
});
export type ExtractMetadataOutput = z.infer<typeof ExtractMetadataOutputSchema>;

// ==================== Box AI Response Schemas ====================

/**
 * Schema for Box AI text generation response
 */
export const BoxAITextGenResponseSchema = z.object({
  answer: z.string(),
  created_at: z.string().optional(),
  completion_reason: z.string().optional(),
});
export type BoxAITextGenResponse = z.infer<typeof BoxAITextGenResponseSchema>;

/**
 * Schema for Box AI structured extraction response
 */
export const BoxAIExtractionResponseSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
);
export type BoxAIExtractionResponse = z.infer<typeof BoxAIExtractionResponseSchema>;

// ==================== Agent Alpha Prompt Schemas ====================

/**
 * Schema for prompt generation response from the LLM
 */
export const PromptGenerationResponseSchema = z.object({
  newPrompt: z.string().min(1),
  reasoning: z.string().optional(),
});
export type PromptGenerationResponse = z.infer<typeof PromptGenerationResponseSchema>;

// ==================== Box API Error Schema ====================

/**
 * Schema for Box API error responses
 */
export const BoxAPIErrorSchema = z.object({
  type: z.literal('error').optional(),
  status: z.number().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  context_info: z.object({
    errors: z.array(z.object({
      reason: z.string().optional(),
      name: z.string().optional(),
      message: z.string().optional(),
    })).optional(),
  }).optional(),
  help_url: z.string().optional(),
  request_id: z.string().optional(),
});
export type BoxAPIError = z.infer<typeof BoxAPIErrorSchema>;

// ==================== Validation Helpers ====================

/**
 * Safely parse a value with a Zod schema, returning the result or undefined
 */
export function safeParse<T>(schema: z.ZodSchema<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * Parse a value with a Zod schema, throwing on error with a descriptive message
 */
export function parseOrThrow<T>(schema: z.ZodSchema<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`${context}: ${errors}`);
  }
  return result.data;
} 