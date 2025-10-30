'use server';

import { logger } from '@/lib/logger';

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
    // Type guard for error handling
    const errorToLog = error instanceof Error ? error : undefined;
    logger.error('Error extracting metadata', errorToLog);
    
    // Preserve the original error details for better debugging
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract metadata: ${originalMessage}`);
  }
}
