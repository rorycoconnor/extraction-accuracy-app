'use server';

import { getBoxFileContent } from '@/services/box';
import { findValueContext, type ContextMatch } from '@/lib/context-finder';
import { logger } from '@/lib/logger';

export async function getFieldContext(
  fileId: string, 
  fieldKey: string, 
  extractedValue: string
): Promise<ContextMatch | null> {
  try {
    // Get the document text content
    const documentText = await getBoxFileContent(fileId);
    
    if (!documentText || documentText.includes('Document content is not ready')) {
      return null;
    }
    
    // Find the context for this field value
    const context = findValueContext(extractedValue, documentText, fieldKey);
    
    return context;
  } catch (error) {
    logger.error('Error finding context for field', { fieldKey, fileId, error: error instanceof Error ? error : String(error) });
    return null;
  }
}

export async function getMultipleFieldContexts(
  fileId: string,
  fieldData: Record<string, string>
): Promise<Record<string, ContextMatch | null>> {
  try {
    // Get the document text content
    const documentText = await getBoxFileContent(fileId);
    
    if (!documentText || documentText.includes('Document content is not ready')) {
      return {};
    }
    
    // Find context for all field values
    const contexts: Record<string, ContextMatch | null> = {};
    
    for (const [fieldKey, value] of Object.entries(fieldData)) {
      if (value && value.trim() !== '') {
        contexts[fieldKey] = findValueContext(value, documentText, fieldKey);
      } else {
        contexts[fieldKey] = null;
      }
    }
    
    return contexts;
  } catch (error) {
    logger.error('Error finding contexts for file', { fileId, error: error instanceof Error ? error : String(error) });
    return {};
  }
} 