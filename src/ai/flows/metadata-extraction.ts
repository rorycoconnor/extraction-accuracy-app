
'use server';

/**
 * @fileOverview Metadata extraction using Box AI directly.
 * This file provides a simple wrapper around the Box AI service.
 */

import { extractStructuredMetadataWithBoxAI } from '@/services/box';
import type { ExtractMetadataInput, ExtractMetadataOutput } from '@/lib/schemas';

export async function extractMetadata(input: ExtractMetadataInput): Promise<ExtractMetadataOutput> {
  const { fileId, fields, model, templateKey } = input;
  
  try {
    const extractedData = await extractStructuredMetadataWithBoxAI({
      fileId,
      fields,
      model,
      templateKey
    });
    
    return {
      data: extractedData
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    
    // Preserve the original error details for better debugging
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract metadata: ${originalMessage}`);
  }
}
