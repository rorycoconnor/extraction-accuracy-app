
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

  const overrides: Record<string, string> = {
    // Google Gemini Models
    'google__gemini_2_0_flash_001': 'Google 2.0 Flash',
    'google__gemini_2_0_flash_001_no_prompt': 'Google 2.0 Flash (no prompt)',
    'google__gemini_2_5_pro': 'Gemini 2.5 Pro',
    'google__gemini_2_5_pro_no_prompt': 'Gemini 2.5 Pro (no prompt)',
    
    // Enhanced Extract Agent
    'enhanced_extract_agent': 'Enhanced Extract Agent',
    'enhanced_extract_agent_no_prompt': 'Enhanced Extract Agent (no prompt)',
    
    // AWS Claude Models
    'aws__claude_3_7_sonnet': 'Claude 3.7 Sonnet',
    'aws__claude_3_7_sonnet_no_prompt': 'Claude 3.7 Sonnet (no prompt)',
    'aws__claude_4_sonnet': 'Claude 4 Sonnet',
    'aws__claude_4_sonnet_no_prompt': 'Claude 4 Sonnet (no prompt)',
    
    // Azure OpenAI Models
    'azure__openai__gpt_4_1': 'GPT-4.1',
    'azure__openai__gpt_4_1_no_prompt': 'GPT-4.1 (no prompt)',
    'azure__openai__gpt_4_1_mini': 'GPT-4.1 Mini',
    'azure__openai__gpt_4_1_mini_no_prompt': 'GPT-4.1 Mini (no prompt)',
    
    // OpenAI Models (Customer-enabled)
    'openai__o3': 'GPT-o3',
    'openai__o3_no_prompt': 'GPT-o3 (no prompt)',
  };

  if (overrides[modelId]) {
    return overrides[modelId];
  }

  // Generic formatting for other models like 'claude' or 'openai'
  return modelId
    .replace(/__/g, ' ') // Replace double underscores with a space
    .replace(/_/g, ' ')   // Replace single underscores with a space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(' ')
    .trim();
}

    