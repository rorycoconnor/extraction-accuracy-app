/**
 * FULL Model Constants - All Available Box AI Models
 * 
 * This file contains ALL models from the official Box AI documentation
 * for developers who want to use the complete model list.
 * 
 * To switch to the full model list:
 * 1. Rename main-page-constants.ts to main-page-constants-streamlined.ts
 * 2. Rename this file to main-page-constants.ts
 * 3. Restart the dev server
 * 
 * Based on: https://developer.box.com/guides/box-ai/ai-models/
 */

// UI Labels (most frequently used strings)
export const UI_LABELS = {
  GROUND_TRUTH: 'Ground Truth',
  PENDING_STATUS: 'Pending...',
  OTHER_OPTION: 'Other',
  UNKNOWN_ERROR: 'Unknown error',
  FILE_TYPE_DEFAULT: 'File',
  VERSION_PREFIX: 'v',
  SUCCESS_VARIANT: 'success',
  DESTRUCTIVE_VARIANT: 'destructive',
  DEFAULT_VARIANT: 'default'
} as const;

// Field Types
export const FIELD_TYPES = {
  DATE: 'date',
  ENUM: 'enum',
  STRING: 'string',
  FILE: 'file'
} as const;

// Toast Messages
export const TOAST_MESSAGES = {
  NO_ACTIVE_FIELDS: {
    title: 'No Active Fields',
    description: (templateName: string) => `The "${templateName}" template has no active fields. Please enable at least one field on the Templates page.`,
    variant: UI_LABELS.DESTRUCTIVE_VARIANT
  },
  GROUND_TRUTH_UPDATED: {
    title: 'Ground Truth Updated',
    description: (fieldName: string, fileName: string) => `Successfully updated ${fieldName} for ${fileName}`
  },
  NO_CHANGES_DETECTED: {
    title: 'No Changes Detected',
    description: 'The new prompt is the same as the active one.'
  },
  PROMPT_SAVED: {
    title: 'Prompt Saved',
    description: 'Previous version saved to history. Current prompt updated.'
  },
  ALREADY_ACTIVE: {
    title: 'Already Active',
    description: 'This prompt version is already the active one.'
  },
  PROMPT_VERSION_CHANGED: {
    title: 'Prompt Version Changed',
    description: 'The selected version is now the active prompt.'
  },
  VERSION_FAVORITED: {
    title: (isFavorite: boolean) => isFavorite ? 'Version Favorited' : 'Favorite Removed',
    description: (versionId: string, isFavorite: boolean) => 
      `Version ${versionId} has been ${isFavorite ? 'added to' : 'removed from'} favorites.`
  },
  ALL_DATA_RESET: {
    title: 'All data reset',
    description: 'All templates, ground truth data, and results have been cleared.'
  },
  NO_DATA_TO_PROCESS: {
    title: 'No data to process',
    description: 'Please select a template and files first.',
    variant: UI_LABELS.DESTRUCTIVE_VARIANT
  },
  GROUND_TRUTH_AUTO_POPULATED: {
    title: 'Ground Truth Auto-Populated',
    description: (modelName: string) => 
      `Ground truth has been automatically populated from ${modelName} results. Review and validate on the Ground Truth page.`
  }
} as const;

// Default Enum Options
export const DEFAULT_ENUM_OPTIONS = {
  CONTRACT_TYPES: [
    { key: 'Service Agreement' },
    { key: 'Master Service Agreement' },
    { key: 'Non-Disclosure Agreement' },
    { key: 'Purchase Agreement' },
    { key: 'License Agreement' },
    { key: 'Employment Agreement' },
    { key: 'Consulting Agreement' },
    { key: 'Vendor Agreement' },
    { key: 'Reseller Agreement' },
    { key: 'Partnership Agreement' },
    { key: UI_LABELS.OTHER_OPTION }
  ],
  CONTRACT_TERMS: [
    { key: '1 Year' },
    { key: '2 Years' },
    { key: '3 Years' },
    { key: '5 Years' },
    { key: 'Indefinite' },
    { key: 'Until Terminated' },
    { key: 'Project-Based' },
    { key: UI_LABELS.OTHER_OPTION }
  ],
  RENEWAL_TYPES: [
    { key: 'Automatic' },
    { key: 'Manual' },
    { key: 'Upon Agreement' },
    { key: 'No Renewal' },
    { key: UI_LABELS.OTHER_OPTION }
  ],
  TERMINATION_OPTIONS: [
    { key: 'Yes' },
    { key: 'No' },
    { key: 'With Cause Only' },
    { key: 'With Notice' },
    { key: UI_LABELS.OTHER_OPTION }
  ],
  YES_NO_OPTIONS: [
    { key: 'Yes' },
    { key: 'No' },
    { key: 'Not Specified' },
    { key: UI_LABELS.OTHER_OPTION }
  ]
} as const;

// Progress Tracking Constants
export const PROGRESS_STATES = {
  PREPARING: 'Preparing extraction...',
  EXTRACTING: 'Extracting data...',
  CALCULATING_METRICS: 'Calculating metrics...',
  COMPLETED: 'Extraction completed',
  ERROR: 'Extraction failed'
} as const;

// Model configuration interface
export interface ModelConfig {
  id: string;
  name: string;
  vendor: string;
  isPremium: boolean;
  isMultiModal: boolean;
}

// ALL Models supported by the Box AI extract_structured endpoint
// Based on official Box AI documentation: https://developer.box.com/guides/box-ai/ai-models/
export const MODEL_CONFIGS: ModelConfig[] = [
  // OpenAI Models (Core)
  {
    id: 'openai__gpt_5_1',
    name: 'OpenAI GPT-5.1',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_1_no_prompt',
    name: 'OpenAI GPT-5.1 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5',
    name: 'OpenAI GPT-5',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_no_prompt',
    name: 'OpenAI GPT-5 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  // Google Gemini Models
  {
    id: 'google__gemini_2_5_pro',
    name: 'Gemini 2.5 Pro',
    vendor: 'Google',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_5_pro_no_prompt',
    name: 'Gemini 2.5 Pro (no prompt)',
    vendor: 'Google',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_5_flash',
    name: 'Gemini 2.5 Flash',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_5_flash_no_prompt',
    name: 'Gemini 2.5 Flash (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_0_flash_001',
    name: 'Gemini 2.0 Flash',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_0_flash_001_no_prompt',
    name: 'Gemini 2.0 Flash (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_0_flash_lite_preview',
    name: 'Gemini 2.0 Flash Lite',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_0_flash_lite_preview_no_prompt',
    name: 'Gemini 2.0 Flash Lite (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_1_5_pro_001',
    name: 'Gemini 1.5 Pro',
    vendor: 'Google',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_1_5_pro_001_no_prompt',
    name: 'Gemini 1.5 Pro (no prompt)',
    vendor: 'Google',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_1_5_flash',
    name: 'Gemini 1.5 Flash',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_1_5_flash_no_prompt',
    name: 'Gemini 1.5 Flash (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  // Enhanced Extract Agent (Box's custom model)
  {
    id: 'enhanced_extract_agent',
    name: 'Enhanced Extract Agent',
    vendor: 'Box',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'enhanced_extract_agent_no_prompt',
    name: 'Enhanced Extract Agent (no prompt)',
    vendor: 'Box',
    isPremium: true, // Premium tier
    isMultiModal: true
  },

  // AWS Claude Models
  {
    id: 'aws__claude_4_5_sonnet',
    name: 'Claude 4.5 Sonnet',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_5_sonnet_no_prompt',
    name: 'Claude 4.5 Sonnet (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_5_haiku',
    name: 'Claude 4.5 Haiku',
    vendor: 'Anthropic',
    isPremium: false, // Standard tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_5_haiku_no_prompt',
    name: 'Claude 4.5 Haiku (no prompt)',
    vendor: 'Anthropic',
    isPremium: false, // Standard tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_sonnet',
    name: 'Claude 4 Sonnet',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_sonnet_no_prompt',
    name: 'Claude 4 Sonnet (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_opus',
    name: 'Claude 4 Opus',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_opus_no_prompt',
    name: 'Claude 4 Opus (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_7_sonnet',
    name: 'Claude 3.7 Sonnet',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_7_sonnet_no_prompt',
    name: 'Claude 3.7 Sonnet (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_5_sonnet',
    name: 'Claude 3.5 Sonnet',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_5_sonnet_no_prompt',
    name: 'Claude 3.5 Sonnet (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_sonnet',
    name: 'Claude 3 Sonnet',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_sonnet_no_prompt',
    name: 'Claude 3 Sonnet (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_haiku',
    name: 'Claude 3 Haiku',
    vendor: 'Anthropic',
    isPremium: false, // Standard tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_3_haiku_no_prompt',
    name: 'Claude 3 Haiku (no prompt)',
    vendor: 'Anthropic',
    isPremium: false, // Standard tier
    isMultiModal: false
  },
  {
    id: 'aws__titan_text_lite',
    name: 'AWS Titan Text Lite',
    vendor: 'AWS',
    isPremium: false, // Standard tier
    isMultiModal: false
  },
  {
    id: 'aws__titan_text_lite_no_prompt',
    name: 'AWS Titan Text Lite (no prompt)',
    vendor: 'AWS',
    isPremium: false, // Standard tier
    isMultiModal: false
  },
  // Azure OpenAI Models (GPT)
  {
    id: 'azure__openai__gpt_4_1',
    name: 'GPT-4.1',
    vendor: 'Azure',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4_1_no_prompt',
    name: 'GPT-4.1 (no prompt)',
    vendor: 'Azure',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4_1_mini',
    name: 'GPT-4.1 Mini',
    vendor: 'Azure',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4_1_mini_no_prompt',
    name: 'GPT-4.1 Mini (no prompt)',
    vendor: 'Azure',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4o',
    name: 'GPT-4o',
    vendor: 'Azure',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4o_no_prompt',
    name: 'GPT-4o (no prompt)',
    vendor: 'Azure',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4o_mini',
    name: 'GPT-4o Mini',
    vendor: 'Azure',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__gpt_4o_mini_no_prompt',
    name: 'GPT-4o Mini (no prompt)',
    vendor: 'Azure',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'azure__openai__text_embedding_ada_002',
    name: 'Text Embedding Ada 002',
    vendor: 'Azure',
    isPremium: false, // Standard tier
    isMultiModal: false // Embeddings only
  },
  // OpenAI Models (Customer-enabled)
  {
    id: 'openai__gpt_o3',
    name: 'OpenAI GPT O3',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier (Beta)
    isMultiModal: true
  },
  {
    id: 'openai__gpt_o3_no_prompt',
    name: 'OpenAI GPT O3 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier (Beta)
    isMultiModal: true
  },
  // IBM Models
  {
    id: 'ibm__llama_4_maverick',
    name: 'IBM Llama 4 Maverick',
    vendor: 'IBM',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'ibm__llama_4_maverick_no_prompt',
    name: 'IBM Llama 4 Maverick (no prompt)',
    vendor: 'IBM',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'ibm__llama_4_scout',
    name: 'IBM Llama 4 Scout',
    vendor: 'IBM',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'ibm__llama_4_scout_no_prompt',
    name: 'IBM Llama 4 Scout (no prompt)',
    vendor: 'IBM',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'ibm__llama_3_2_90b_vision_instruct',
    name: 'IBM Llama 3.2 Vision Instruct',
    vendor: 'IBM',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'ibm__llama_3_2_90b_vision_instruct_no_prompt',
    name: 'IBM Llama 3.2 Vision Instruct (no prompt)',
    vendor: 'IBM',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'ibm__mistral_medium_2505',
    name: 'IBM Mistral Medium 3',
    vendor: 'IBM',
    isPremium: false, // Standard tier (Preview)
    isMultiModal: false
  },
  {
    id: 'ibm__mistral_medium_2505_no_prompt',
    name: 'IBM Mistral Medium 3 (no prompt)',
    vendor: 'IBM',
    isPremium: false, // Standard tier (Preview)
    isMultiModal: false
  },
  {
    id: 'ibm__mistral_small_3_1_24b_instruct_2503',
    name: 'IBM Mistral Small 3.1x',
    vendor: 'IBM',
    isPremium: false, // Standard tier (Preview)
    isMultiModal: false
  },
  {
    id: 'ibm__mistral_small_3_1_24b_instruct_2503_no_prompt',
    name: 'IBM Mistral Small 3.1x (no prompt)',
    vendor: 'IBM',
    isPremium: false, // Standard tier (Preview)
    isMultiModal: false
  },
  // Customer-enabled models (xAI Grok)
  {
    id: 'xai__grok_3_beta',
    name: 'Grok 3 Beta',
    vendor: 'xAI',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'xai__grok_3_beta_no_prompt',
    name: 'Grok 3 Beta (no prompt)',
    vendor: 'xAI',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'xai__grok_3_mini_reasoning_beta',
    name: 'Grok 3 Mini Reasoning Beta',
    vendor: 'xAI',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'xai__grok_3_mini_reasoning_beta_no_prompt',
    name: 'Grok 3 Mini Reasoning Beta (no prompt)',
    vendor: 'xAI',
    isPremium: true, // Premium tier
    isMultiModal: false
  }

];

// Legacy arrays for backward compatibility
export const AVAILABLE_MODELS = MODEL_CONFIGS.map(model => model.id);
export const ALL_MODELS = [UI_LABELS.GROUND_TRUTH, ...AVAILABLE_MODELS];
export const PREMIUM_MODEL = 'enhanced_extract_agent';

// Helper functions
export const getModelConfig = (modelId: string): ModelConfig | undefined => {
  return MODEL_CONFIGS.find(model => model.id === modelId);
};

export const getModelName = (modelId: string): string => {
  if (modelId === UI_LABELS.GROUND_TRUTH) return UI_LABELS.GROUND_TRUTH;
  const config = getModelConfig(modelId);
  return config?.name || modelId;
};

export const isPremiumModel = (modelId: string): boolean => {
  const config = getModelConfig(modelId);
  return config?.isPremium || false;
};

export const isMultiModalModel = (modelId: string): boolean => {
  const config = getModelConfig(modelId);
  return config?.isMultiModal || false;
};
