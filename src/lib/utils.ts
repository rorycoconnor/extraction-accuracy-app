
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Standardized value for fields that are not present in documents
export const NOT_PRESENT_VALUE = "Not Present";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Try to find a field value in the extracted metadata using various strategies
 * This handles cases where field keys might not match exactly
 */
export function findFieldValue(extractedMetadata: Record<string, any>, fieldKey: string): any {
  // Strategy 1: Exact match
  if (extractedMetadata[fieldKey] !== undefined) {
    return extractedMetadata[fieldKey];
  }
  
  // Strategy 2: Case-insensitive match
  const lowerFieldKey = fieldKey.toLowerCase();
  const exactMatch = Object.keys(extractedMetadata).find(key => 
    key.toLowerCase() === lowerFieldKey
  );
  if (exactMatch && extractedMetadata[exactMatch] !== undefined) {
    return extractedMetadata[exactMatch];
  }
  
  // Strategy 3: Partial match (contains)
  const partialMatch = Object.keys(extractedMetadata).find(key => 
    key.toLowerCase().includes(lowerFieldKey) || lowerFieldKey.includes(key.toLowerCase())
  );
  if (partialMatch && extractedMetadata[partialMatch] !== undefined) {
    return extractedMetadata[partialMatch];
  }
  
  // Strategy 4: Common variations
  const variations = [
    fieldKey.replace(/_/g, ''),           // Remove underscores
    fieldKey.replace(/([A-Z])/g, '_$1').toLowerCase(), // camelCase to snake_case
    fieldKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), // snake_case to camelCase
  ];
  
  for (const variation of variations) {
    if (extractedMetadata[variation] !== undefined) {
      return extractedMetadata[variation];
    }
  }
  
  return undefined;
}

export function formatModelName(modelId: string): string {
  if (!modelId) return '';
  if (modelId === 'Ground Truth') return 'Ground Truth';

  // Import the centralized model configuration
  const { getModelName } = require('@/lib/main-page-constants');
  return getModelName(modelId);
}

    