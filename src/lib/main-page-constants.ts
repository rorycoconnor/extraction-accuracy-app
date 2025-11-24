/**
 * Constants for the Main Page Component
 * 
 * This file contains all the constants used in the main page component
 * to improve maintainability and reduce file size.
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

// Models supported by the Box AI extract_structured endpoint
// Based on official Box AI documentation: https://developer.box.com/guides/box-ai/ai-models/
export const MODEL_CONFIGS: ModelConfig[] = [
  // Google Gemini Models
  {
    id: 'google__gemini_2_5_flash',
    name: 'Google 2.5 Flash',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_2_5_flash_no_prompt',
    name: 'Google 2.5 Flash (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
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
    id: 'openai__gpt_5_1',
    name: 'GPT-5.1',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_1_no_prompt',
    name: 'GPT-5.1 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5',
    name: 'GPT-5',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_no_prompt',
    name: 'GPT-5 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_o3',
    name: 'OpenAI O3',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier (Beta)
    isMultiModal: true
  },
  {
    id: 'openai__gpt_o3_no_prompt',
    name: 'OpenAI O3 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier (Beta)
    isMultiModal: true
  },

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