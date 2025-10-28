import type { PromptVersion } from './types';
import { savePromptDataAction, getPromptDataAction } from './actions/json-storage';
import { logger } from './logger';

// Storage key for localStorage
const PROMPT_STORAGE_KEY = 'promptsStore';

// Types for cross-template prompt storage
export interface FieldPromptData {
  activePrompt: string;
  promptHistory: PromptVersion[];
  lastUsedTemplate?: string; // Track which template last used this prompt
  usageCount?: number; // Track how often this prompt is used
  lastModified: string;
}

export interface PromptStore {
  [fieldKey: string]: FieldPromptData;
}

/**
 * Get all stored prompts for all fields
 */
export function getPromptStore(): PromptStore {
  if (typeof window === 'undefined') {
    return {};
  }
  
  try {
    const stored = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.error('Failed to parse prompt store from localStorage', error as Error);
  }
  
  return {};
}

/**
 * Save the entire prompt store to localStorage and JSON backup
 */
function savePromptStore(store: PromptStore): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    // Save to localStorage for immediate access
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(store));
    
    // Background sync to JSON file for persistent storage
    savePromptDataAction(store).catch((err) => logger.error('Failed to sync prompt data to JSON', err));
    
    logger.debug('Prompt store saved', { fieldCount: Object.keys(store).length });
  } catch (error) {
    logger.error('Failed to save prompt store', error as Error);
  }
}

/**
 * Get prompt data for a specific field key
 */
export function getFieldPrompt(fieldKey: string): FieldPromptData | null {
  const store = getPromptStore();
  return store[fieldKey] || null;
}

/**
 * Get prompt data for a specific field key within a template context
 * This prevents cross-template prompt pollution
 */
export function getFieldPromptForTemplate(fieldKey: string, templateKey: string): FieldPromptData | null {
  const store = getPromptStore();
  const templateAwareKey = `${templateKey}::${fieldKey}`;
  
  // First try template-specific key
  const templateSpecific = store[templateAwareKey];
  if (templateSpecific) {
    return templateSpecific;
  }
  
  // Fallback to global key for backward compatibility
  const global = store[fieldKey];
  if (global && global.lastUsedTemplate === templateKey) {
    return global;
  }
  
  return null;
}

/**
 * Save prompt data for a specific field key
 */
export function saveFieldPrompt(
  fieldKey: string, 
  activePrompt: string, 
  promptHistory: PromptVersion[],
  templateKey?: string
): void {
  const store = getPromptStore();
  const timestamp = new Date().toISOString();
  
  // Get existing data to preserve usage stats
  const existing = store[fieldKey];
  
  store[fieldKey] = {
    activePrompt,
    promptHistory,
    lastUsedTemplate: templateKey || existing?.lastUsedTemplate,
    usageCount: (existing?.usageCount || 0) + 1,
    lastModified: timestamp,
  };
  
  savePromptStore(store);
  
  logger.debug('Saved prompt for field', {
    fieldKey,
    promptLength: activePrompt.length,
    historyCount: promptHistory.length,
    templateKey,
  });
}

/**
 * Save prompt data for a specific field key within a template context
 * This prevents cross-template prompt pollution
 */
export function saveFieldPromptForTemplate(
  fieldKey: string,
  templateKey: string,
  activePrompt: string, 
  promptHistory: PromptVersion[]
): void {
  const store = getPromptStore();
  const timestamp = new Date().toISOString();
  const templateAwareKey = `${templateKey}::${fieldKey}`;
  
  // Get existing data to preserve usage stats
  const existing = store[templateAwareKey];
  
  store[templateAwareKey] = {
    activePrompt,
    promptHistory,
    lastUsedTemplate: templateKey,
    usageCount: (existing?.usageCount || 0) + 1,
    lastModified: timestamp,
  };
  
  savePromptStore(store);
}

/**
 * Update only the active prompt for a field (used when switching prompt versions)
 */
export function updateFieldActivePrompt(fieldKey: string, newPrompt: string): void {
  const store = getPromptStore();
  const existing = store[fieldKey];
  
  if (existing) {
    existing.activePrompt = newPrompt;
    existing.lastModified = new Date().toISOString();
    savePromptStore(store);
    
    logger.debug('Updated active prompt for field', { fieldKey });
  }
}

/**
 * Add a new prompt version to a field's history
 */
export function addPromptVersion(fieldKey: string, promptVersion: PromptVersion): void {
  const store = getPromptStore();
  const existing = store[fieldKey];
  
  if (existing) {
    // Check if this exact prompt already exists in history
    const isDuplicate = existing.promptHistory.some(v => v.prompt === promptVersion.prompt);
    
    if (!isDuplicate) {
      existing.promptHistory.push(promptVersion);
      existing.lastModified = new Date().toISOString();
      savePromptStore(store);
      
      logger.debug('Added new prompt version for field', { fieldKey });
    } else {
      logger.debug('Duplicate prompt detected for field, skipping', { fieldKey });
    }
  }
}

/**
 * Get all field keys that have stored prompts
 */
export function getAvailableFieldKeys(): string[] {
  const store = getPromptStore();
  return Object.keys(store).sort();
}

/**
 * Migrate prompts from AccuracyData to cross-template storage
 * This preserves existing prompts when switching to the new system
 */
export function migrateFromAccuracyData(accuracyData: any): number {
  if (!accuracyData?.fields) {
    return 0;
  }
  
  const store = getPromptStore();
  let migratedCount = 0;
  
  logger.info('Starting prompt migration from AccuracyData');
  
  accuracyData.fields.forEach((field: any) => {
    const fieldKey = field.key;
    const existingStoreData = store[fieldKey];
    
    // Only migrate if we don't already have data for this field, or if the AccuracyData has more recent data
    const shouldMigrate = !existingStoreData || 
      (field.promptHistory && field.promptHistory.length > existingStoreData.promptHistory.length);
    
    if (shouldMigrate && (field.prompt || (field.promptHistory && field.promptHistory.length > 0))) {
      store[fieldKey] = {
        activePrompt: field.prompt || '',
        promptHistory: field.promptHistory || [],
        lastUsedTemplate: accuracyData.templateKey,
        usageCount: 1,
        lastModified: new Date().toISOString(),
      };
      
      migratedCount++;
      logger.debug('Migrated field', { fieldKey, versionCount: field.promptHistory?.length || 0 });
    }
  });
  
  if (migratedCount > 0) {
    savePromptStore(store);
    logger.info('Migration complete', { migratedCount });
  }
  
  return migratedCount;
}

/**
 * Restore prompt data from JSON file backup (used during app initialization)
 */
export async function restorePromptDataFromFiles(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    // Check if localStorage is empty or outdated
    const localData = getPromptStore();
    const hasLocalData = Object.keys(localData).length > 0;
    
    if (!hasLocalData) {
      // Try to restore from JSON file
      const fileData = await getPromptDataAction();
      if (fileData && Object.keys(fileData).length > 0) {
        localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(fileData));
        logger.info('Restored prompt data from JSON file', { fieldCount: Object.keys(fileData).length });
      }
    }
  } catch (error) {
    logger.error('Failed to restore prompt data from files', error as Error);
  }
}

/**
 * Clear all stored prompts (used for debugging/reset)
 */
export function clearPromptStore(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem(PROMPT_STORAGE_KEY);
  savePromptDataAction({}).catch((err) => logger.error('Failed to clear prompt data JSON', err));
  logger.info('Prompt store cleared');
}

/**
 * Get statistics about stored prompts
 */
export function getPromptStoreStats(): {
  totalFields: number;
  totalPrompts: number;
  fieldsWithHistory: number;
  mostUsedField: string | null;
} {
  const store = getPromptStore();
  const fields = Object.entries(store);
  
  const totalPrompts = fields.reduce((sum, [_, data]) => sum + data.promptHistory.length, 0);
  const fieldsWithHistory = fields.filter(([_, data]) => data.promptHistory.length > 0).length;
  
  const mostUsedField = fields.length > 0 
    ? fields.reduce((max, [key, data]) => {
        return (data.usageCount || 0) > (max.usageCount || 0) ? { key, usageCount: data.usageCount || 0 } : max;
      }, { key: '', usageCount: 0 }).key || null
    : null;
  
  return {
    totalFields: fields.length,
    totalPrompts,
    fieldsWithHistory,
    mostUsedField,
  };
} 