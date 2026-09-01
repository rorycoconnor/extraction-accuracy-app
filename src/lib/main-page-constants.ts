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
    id: 'google__gemini_3_5_flash',
    name: 'Gemini 3.5 Flash',
    vendor: 'Google',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_5_flash_no_prompt',
    name: 'Gemini 3.5 Flash (no prompt)',
    vendor: 'Google',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_5_flash_lite',
    name: 'Gemini 3.5 Flash Lite',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_5_flash_lite_no_prompt',
    name: 'Gemini 3.5 Flash Lite (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_1_flash_lite',
    name: 'Gemini 3.1 Flash Lite',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_1_flash_lite_no_prompt',
    name: 'Gemini 3.1 Flash Lite (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_flash',
    name: 'Gemini 3 Flash',
    vendor: 'Google',
    isPremium: false, // Standard tier (Beta / customer-enabled)
    isMultiModal: true
  },
  {
    id: 'google__gemini_3_flash_no_prompt',
    name: 'Gemini 3 Flash (no prompt)',
    vendor: 'Google',
    isPremium: false, // Standard tier (Beta / customer-enabled)
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
    id: 'aws__claude_opus_5',
    name: 'Claude Opus 5',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_opus_5_no_prompt',
    name: 'Claude Opus 5 (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_sonnet_5',
    name: 'Claude Sonnet 5',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_sonnet_5_no_prompt',
    name: 'Claude Sonnet 5 (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_8_opus',
    name: 'Claude 4.8 Opus',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_8_opus_no_prompt',
    name: 'Claude 4.8 Opus (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_7_opus',
    name: 'Claude 4.7 Opus',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'aws__claude_4_7_opus_no_prompt',
    name: 'Claude 4.7 Opus (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'aws__claude_4_6_opus',
    name: 'Claude 4.6 Opus',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'aws__claude_4_6_opus_no_prompt',
    name: 'Claude 4.6 Opus (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'aws__claude_4_6_sonnet',
    name: 'Claude 4.6 Sonnet',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'aws__claude_4_6_sonnet_no_prompt',
    name: 'Claude 4.6 Sonnet (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'aws__claude_4_5_opus',
    name: 'Claude 4.5 Opus',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier
    isMultiModal: false
  },
  {
    id: 'aws__claude_4_5_opus_no_prompt',
    name: 'Claude 4.5 Opus (no prompt)',
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
    id: 'aws__claude_fable_5',
    name: 'Claude Fable 5',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier (Beta / customer-enabled)
    isMultiModal: false
  },
  {
    id: 'aws__claude_fable_5_no_prompt',
    name: 'Claude Fable 5 (no prompt)',
    vendor: 'Anthropic',
    isPremium: true, // Premium tier (Beta / customer-enabled)
    isMultiModal: false
  },
  // OpenAI Models (GPT)
  {
    id: 'openai__gpt_5_6_sol',
    name: 'GPT-5.6 Sol',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_6_sol_no_prompt',
    name: 'GPT-5.6 Sol (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_6_terra',
    name: 'GPT-5.6 Terra',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_6_terra_no_prompt',
    name: 'GPT-5.6 Terra (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_5',
    name: 'GPT-5.5',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_5_no_prompt',
    name: 'GPT-5.5 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_4',
    name: 'GPT-5.4',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_4_no_prompt',
    name: 'GPT-5.4 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_4_mini',
    name: 'GPT-5.4 Mini',
    vendor: 'OpenAI',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_4_mini_no_prompt',
    name: 'GPT-5.4 Mini (no prompt)',
    vendor: 'OpenAI',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_2',
    name: 'GPT-5.2',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_2_no_prompt',
    name: 'GPT-5.2 (no prompt)',
    vendor: 'OpenAI',
    isPremium: true, // Premium tier
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
    id: 'openai__gpt_5_mini',
    name: 'GPT-5 Mini',
    vendor: 'OpenAI',
    isPremium: false, // Standard tier
    isMultiModal: true
  },
  {
    id: 'openai__gpt_5_mini_no_prompt',
    name: 'GPT-5 Mini (no prompt)',
    vendor: 'OpenAI',
    isPremium: false, // Standard tier
    isMultiModal: true
  },

];

// Legacy arrays for backward compatibility
export const AVAILABLE_MODELS = MODEL_CONFIGS.map(model => model.id);
export const ALL_MODELS = [UI_LABELS.GROUND_TRUTH, ...AVAILABLE_MODELS];
export const PREMIUM_MODEL = 'enhanced_extract_agent';

const MODEL_ORDER_INDEX = new Map(MODEL_CONFIGS.map((model, index) => [model.id, index]));

/**
 * Orders models by their position in MODEL_CONFIGS so each model stays next to its
 * own "(no prompt)" variant. Sorting the raw IDs as strings does not work: e.g.
 * `google__gemini_3_5_flash_lite` sorts between `google__gemini_3_5_flash` and
 * `google__gemini_3_5_flash_no_prompt`, and `google__gemini_3_5_*` sorts before
 * `google__gemini_3_flash`.
 */
export const compareModelIds = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a === UI_LABELS.GROUND_TRUTH) return -1;
  if (b === UI_LABELS.GROUND_TRUTH) return 1;

  const indexA = MODEL_ORDER_INDEX.get(a);
  const indexB = MODEL_ORDER_INDEX.get(b);

  if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
  // Defensive only: callers should filter retired models with isKnownModel first.
  if (indexA !== undefined) return -1;
  if (indexB !== undefined) return 1;
  return a.localeCompare(b);
};

export const sortModelIds = (modelIds: readonly string[]): string[] =>
  [...modelIds].sort(compareModelIds);

/**
 * Saved results can reference models that have since been removed from MODEL_CONFIGS.
 * Those are retired and must stay hidden from the UI and exports.
 */
export const isKnownModel = (modelId: string): boolean => MODEL_ORDER_INDEX.has(modelId);

export const sortKnownModelIds = (modelIds: readonly string[]): string[] =>
  sortModelIds(modelIds.filter(isKnownModel));

// Columns pre-selected on first run. Must stay in sync with MODEL_CONFIGS ids,
// otherwise the comparison grid opens with no models selected.
export const DEFAULT_SELECTED_MODELS: string[] = [
  'google__gemini_3_5_flash',
  'google__gemini_3_5_flash_no_prompt'
];

export const isDefaultSelectedModel = (modelId: string): boolean =>
  DEFAULT_SELECTED_MODELS.includes(modelId);

/**
 * Rebuilds a column-visibility map against the current MODEL_CONFIGS.
 *
 * Saved state outlives the model list, so it can still select models that have
 * since been retired. Those keys are dropped here and newly added models pick up
 * their default, keeping persisted state from silently driving extraction runs
 * against model IDs Box no longer serves.
 */
export const sanitizeShownColumns = (
  shownColumns?: Record<string, boolean> | null
): Record<string, boolean> => {
  const sanitized: Record<string, boolean> = {
    [UI_LABELS.GROUND_TRUTH]: shownColumns?.[UI_LABELS.GROUND_TRUTH] ?? true,
  };

  for (const modelId of AVAILABLE_MODELS) {
    sanitized[modelId] = shownColumns?.[modelId] ?? isDefaultSelectedModel(modelId);
  }

  return sanitized;
};

/**
 * The models a comparison run should actually extract with: visible, not Ground
 * Truth, and still present in MODEL_CONFIGS.
 */
export const getActiveModelsForRun = (
  shownColumns: Record<string, boolean>
): string[] =>
  sortModelIds(
    Object.entries(shownColumns)
      .filter(
        ([modelName, isShown]) =>
          isShown && modelName !== UI_LABELS.GROUND_TRUTH && isKnownModel(modelName)
      )
      .map(([modelName]) => modelName)
  );

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