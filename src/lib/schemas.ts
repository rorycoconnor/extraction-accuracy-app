import {z} from 'zod';

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