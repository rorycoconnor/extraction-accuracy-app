/**
 * Dual System Utilities
 * 
 * Utilities for managing the dual extraction system (prompted vs non-prompted).
 * The dual system allows testing AI models with and without custom prompts by using
 * a naming convention: models ending in '_no_prompt' have their prompt fields stripped.
 */

// Constants
export const DUAL_SYSTEM = {
  NO_PROMPT_SUFFIX: '_no_prompt',
  
  /**
   * Check if a model name represents a no-prompt variant
   */
  isNoPromptModel: (modelName: string): boolean => {
    return modelName.endsWith(DUAL_SYSTEM.NO_PROMPT_SUFFIX);
  },
  
  /**
   * Get the base model name without the no-prompt suffix
   */
  getBaseModelName: (modelName: string): string => {
    return modelName.replace(DUAL_SYSTEM.NO_PROMPT_SUFFIX, '');
  },
  
  /**
   * Get the no-prompt variant of a model name
   */
  getNoPromptVariant: (modelName: string): string => {
    return `${modelName}${DUAL_SYSTEM.NO_PROMPT_SUFFIX}`;
  }
} as const;

// Types
export interface FieldWithPrompt {
  key: string;
  type: string;
  displayName: string;
  prompt: string;
  options?: { key: string }[];
}

export type FieldWithoutPrompt = Omit<FieldWithPrompt, 'prompt'>;
export type ExtractionField = FieldWithPrompt | FieldWithoutPrompt;

/**
 * Prepare fields for extraction based on whether prompts should be included.
 * 
 * For no-prompt models, this strips the 'prompt' field from all field definitions.
 * For regular models, returns fields unchanged.
 * 
 * @param fields - Array of field definitions
 * @param includePrompts - Whether to include prompt fields
 * @returns Array of fields, with prompts stripped if includePrompts is false
 * 
 * @example
 * // For regular model (with prompts)
 * prepareFieldsForExtraction(fields, true)
 * 
 * // For no-prompt model (strips prompts)
 * prepareFieldsForExtraction(fields, false)
 */
export function prepareFieldsForExtraction<T extends { prompt?: string }>(
  fields: T[],
  includePrompts: boolean
): T[] | Omit<T, 'prompt'>[] {
  if (includePrompts) {
    return fields;
  }
  
  // Strip prompt field from all fields
  return fields.map(field => {
    const { prompt, ...fieldWithoutPrompt } = field;
    return fieldWithoutPrompt as Omit<T, 'prompt'>;
  });
}

/**
 * Prepare fields for extraction based on model name.
 * Automatically determines if prompts should be included based on the model naming convention.
 * 
 * @param fields - Array of field definitions
 * @param modelName - Name of the model (e.g., 'google__gemini_2_0_flash_001' or 'google__gemini_2_0_flash_001_no_prompt')
 * @returns Array of fields, with prompts stripped if model is a no-prompt variant
 * 
 * @example
 * // Regular model - keeps prompts
 * prepareFieldsForModel(fields, 'google__gemini_2_0_flash_001')
 * 
 * // No-prompt variant - strips prompts
 * prepareFieldsForModel(fields, 'google__gemini_2_0_flash_001_no_prompt')
 */
export function prepareFieldsForModel<T extends { prompt?: string }>(
  fields: T[],
  modelName: string
): T[] | Omit<T, 'prompt'>[] {
  const includePrompts = !DUAL_SYSTEM.isNoPromptModel(modelName);
  return prepareFieldsForExtraction(fields, includePrompts);
}

/**
 * Get a debug-friendly description of the field preparation.
 * Useful for logging and debugging.
 */
export function getFieldPreparationInfo(
  modelName: string,
  fieldCount: number
): {
  modelName: string;
  isNoPrompt: boolean;
  baseModel: string;
  includesPrompts: boolean;
  fieldCount: number;
  description: string;
} {
  const isNoPrompt = DUAL_SYSTEM.isNoPromptModel(modelName);
  const baseModel = DUAL_SYSTEM.getBaseModelName(modelName);
  const includesPrompts = !isNoPrompt;
  
  return {
    modelName,
    isNoPrompt,
    baseModel,
    includesPrompts,
    fieldCount,
    description: isNoPrompt
      ? `No-prompt extraction for ${baseModel} (${fieldCount} fields, prompts stripped)`
      : `Prompted extraction for ${modelName} (${fieldCount} fields with prompts)`
  };
}

