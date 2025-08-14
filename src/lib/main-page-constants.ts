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

// Models supported by the Box AI extract_structured endpoint
export const AVAILABLE_MODELS = [
  // Google Gemini Models
  'google__gemini_2_0_flash_001',
  'google__gemini_2_0_flash_001_no_prompt',
  'google__gemini_2_5_pro',
  'google__gemini_2_5_pro_no_prompt',

  // Enhanced Extract Agent
  'enhanced_extract_agent',
  'enhanced_extract_agent_no_prompt',

  // AWS Claude Models
  'aws__claude_3_7_sonnet',
  'aws__claude_3_7_sonnet_no_prompt',
  'aws__claude_4_sonnet',
  'aws__claude_4_sonnet_no_prompt',

  // Azure OpenAI Models (GPT)
  'azure__openai__gpt_4_1',
  'azure__openai__gpt_4_1_no_prompt',
  'azure__openai__gpt_4_1_mini',
  'azure__openai__gpt_4_1_mini_no_prompt',

  // OpenAI Models (Customer-enabled)
  'openai__o3',
  'openai__o3_no_prompt',
];

export const ALL_MODELS = [UI_LABELS.GROUND_TRUTH, ...AVAILABLE_MODELS];
export const PREMIUM_MODEL = 'enhanced_extract_agent'; 