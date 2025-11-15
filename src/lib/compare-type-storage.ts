/**
 * Storage management for compare type configurations
 * Manages persistence of compare type configurations using localStorage + file backup
 */

import type { BoxTemplate } from './types';
import type { CompareTypeConfig, FieldCompareConfig, CompareType } from './compare-types';
import {
  DEFAULT_COMPARE_TYPE_MAP,
  COMPARE_TYPE_CONFIG_VERSION,
  DEFAULT_LLM_COMPARISON_PROMPT
} from './compare-types';
import { logger } from './logger';

const COMPARE_TYPE_STORAGE_KEY = 'compareTypeConfigs';

/**
 * Storage structure for all compare type configurations
 */
interface CompareTypeStore {
  [templateKey: string]: CompareTypeConfig;
}

/**
 * Get all compare type configurations from localStorage
 */
function getAllCompareTypeConfigs(): CompareTypeStore {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(COMPARE_TYPE_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.error('Failed to load compare type configs from localStorage', error as Error);
  }

  return {};
}

/**
 * Save all compare type configurations to localStorage
 */
function saveAllCompareTypeConfigs(store: CompareTypeStore): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(COMPARE_TYPE_STORAGE_KEY, JSON.stringify(store));
    logger.debug('Compare type configs saved to localStorage', {
      templateCount: Object.keys(store).length
    });
  } catch (error) {
    logger.error('Failed to save compare type configs to localStorage', error as Error);
  }
}

/**
 * Get compare type configuration for a specific template
 */
export function getCompareTypeConfig(templateKey: string): CompareTypeConfig | null {
  const store = getAllCompareTypeConfigs();
  return store[templateKey] || null;
}

/**
 * Save compare type configuration for a specific template
 */
export function saveCompareTypeConfig(
  templateKey: string,
  config: CompareTypeConfig
): void {
  const store = getAllCompareTypeConfigs();

  // Update last modified timestamp
  config.lastModified = Date.now();

  store[templateKey] = config;
  saveAllCompareTypeConfigs(store);

  logger.info('Compare type config saved', {
    templateKey,
    fieldCount: config.fields.length
  });
}

/**
 * Generate default compare type configuration based on template fields
 */
export function getDefaultCompareTypes(template: BoxTemplate): CompareTypeConfig {
  // Include ALL fields regardless of isActive status
  const fields: FieldCompareConfig[] = template.fields
    .map(field => ({
      fieldKey: field.key,
      fieldName: field.displayName,
      compareType: DEFAULT_COMPARE_TYPE_MAP[field.type] || 'near-exact-string',
      parameters: undefined,
    }));

  return {
    version: COMPARE_TYPE_CONFIG_VERSION,
    templateKey: template.templateKey,
    lastModified: Date.now(),
    fields,
  };
}

/**
 * Get or create compare type configuration for a template
 * If no config exists, generates and saves default configuration
 */
export function getOrCreateCompareTypeConfig(template: BoxTemplate): CompareTypeConfig {
  let config = getCompareTypeConfig(template.templateKey);

  if (!config) {
    logger.debug('No compare type config found, generating defaults', {
      templateKey: template.templateKey
    });
    config = getDefaultCompareTypes(template);
    saveCompareTypeConfig(template.templateKey, config);
  }

  // Ensure config has ALL template fields (active and inactive)
  const existingFieldKeys = new Set(config.fields.map(f => f.fieldKey));
  const allTemplateFields = template.fields; // Include all fields, not just active ones

  let needsUpdate = false;

  // Add missing fields
  for (const field of allTemplateFields) {
    if (!existingFieldKeys.has(field.key)) {
      logger.debug('Adding missing field to compare type config', {
        fieldKey: field.key
      });
      config.fields.push({
        fieldKey: field.key,
        fieldName: field.displayName,
        compareType: DEFAULT_COMPARE_TYPE_MAP[field.type] || 'near-exact-string',
        parameters: undefined,
      });
      needsUpdate = true;
    }
  }

  // Remove fields that are no longer in the template at all
  const allFieldKeys = new Set(allTemplateFields.map(f => f.key));
  const originalFieldCount = config.fields.length;
  config.fields = config.fields.filter(f => allFieldKeys.has(f.fieldKey));

  if (config.fields.length !== originalFieldCount) {
    logger.debug('Removed obsolete fields from compare type config');
    needsUpdate = true;
  }

  if (needsUpdate) {
    saveCompareTypeConfig(template.templateKey, config);
  }

  return config;
}

/**
 * Update compare type for a specific field
 */
export function setCompareType(
  templateKey: string,
  fieldKey: string,
  compareType: CompareType
): void {
  const config = getCompareTypeConfig(templateKey);

  if (!config) {
    logger.error('Cannot set compare type: config not found', { templateKey });
    return;
  }

  const field = config.fields.find(f => f.fieldKey === fieldKey);

  if (!field) {
    logger.error('Cannot set compare type: field not found', { templateKey, fieldKey });
    return;
  }

  field.compareType = compareType;

  // Clear parameters when changing compare type
  // (they may not be applicable to the new type)
  field.parameters = undefined;

  // Add default parameters for LLM judge
  if (compareType === 'llm-judge') {
    field.parameters = {
      comparisonPrompt: DEFAULT_LLM_COMPARISON_PROMPT,
    };
  }

  saveCompareTypeConfig(templateKey, config);

  logger.info('Compare type updated', { templateKey, fieldKey, compareType });
}

/**
 * Update parameters for a specific field
 */
export function setCompareParameters(
  templateKey: string,
  fieldKey: string,
  parameters: Record<string, any>
): void {
  const config = getCompareTypeConfig(templateKey);

  if (!config) {
    logger.error('Cannot set parameters: config not found', { templateKey });
    return;
  }

  const field = config.fields.find(f => f.fieldKey === fieldKey);

  if (!field) {
    logger.error('Cannot set parameters: field not found', { templateKey, fieldKey });
    return;
  }

  field.parameters = { ...field.parameters, ...parameters };

  saveCompareTypeConfig(templateKey, config);

  logger.info('Compare parameters updated', { templateKey, fieldKey, parameters });
}

/**
 * Export compare type configuration as JSON string
 */
export function exportCompareTypeConfig(templateKey: string): string {
  const config = getCompareTypeConfig(templateKey);

  if (!config) {
    throw new Error(`No compare type config found for template: ${templateKey}`);
  }

  return JSON.stringify(config, null, 2);
}

/**
 * Import and validate compare type configuration from JSON string
 */
export function importCompareTypeConfig(jsonString: string): CompareTypeConfig {
  let config: CompareTypeConfig;

  try {
    config = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }

  // Validate schema
  if (!config.version || !config.templateKey || !config.fields || !Array.isArray(config.fields)) {
    throw new Error('Invalid compare type config schema');
  }

  // Validate each field config
  for (const field of config.fields) {
    if (!field.fieldKey || !field.fieldName || !field.compareType) {
      throw new Error('Invalid field config: missing required properties');
    }
  }

  // Update version if needed (future: migration logic)
  if (config.version !== COMPARE_TYPE_CONFIG_VERSION) {
    logger.warn('Compare type config version mismatch', {
      configVersion: config.version,
      currentVersion: COMPARE_TYPE_CONFIG_VERSION,
    });
    // For now, just update the version
    config.version = COMPARE_TYPE_CONFIG_VERSION;
  }

  return config;
}

/**
 * Import and save compare type configuration
 */
export function importAndSaveCompareTypeConfig(jsonString: string): CompareTypeConfig {
  const config = importCompareTypeConfig(jsonString);
  saveCompareTypeConfig(config.templateKey, config);

  logger.info('Compare type config imported and saved', {
    templateKey: config.templateKey,
    fieldCount: config.fields.length,
  });

  return config;
}

/**
 * Reset compare type configuration to defaults
 */
export function resetToDefaults(template: BoxTemplate): void {
  const config = getDefaultCompareTypes(template);
  saveCompareTypeConfig(template.templateKey, config);

  logger.info('Compare type config reset to defaults', {
    templateKey: template.templateKey
  });
}

/**
 * Delete compare type configuration for a template
 */
export function deleteCompareTypeConfig(templateKey: string): void {
  const store = getAllCompareTypeConfigs();
  delete store[templateKey];
  saveAllCompareTypeConfigs(store);

  logger.info('Compare type config deleted', { templateKey });
}

/**
 * Get compare config for a specific field
 */
export function getCompareConfigForField(
  templateKey: string,
  fieldKey: string
): FieldCompareConfig | null {
  const config = getCompareTypeConfig(templateKey);

  if (!config) {
    return null;
  }

  return config.fields.find(f => f.fieldKey === fieldKey) || null;
}
