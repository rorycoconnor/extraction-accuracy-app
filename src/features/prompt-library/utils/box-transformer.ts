/**
 * @fileOverview Box Metadata Template Transformer
 * 
 * Transforms internal template definitions into Box Metadata Template creation bodies 
 * for POST /2.0/metadata_templates/schema according to Box API requirements.
 */

import type { Template, Field, BoxMetadataTemplate, BoxMetadataField } from '../types';
import { BOX_VALIDATION, FIELD_TYPE_MAPPING } from '../types';

/**
 * Transform internal template to Box API format
 */
export function transformToBoxTemplate(template: Template): BoxMetadataTemplate {
  const validation = {
    errors: [] as string[],
    notes: [] as string[]
  };

  // Transform template key
  const templateKey = generateValidKey(template.key || template.name, 'template', validation);
  
  // Validate and fix template display name
  const displayName = validateDisplayName(template.name, validation);

  // Transform fields
  const fields = template.fields
    .map(field => transformField(field, validation))
    .filter(field => field !== null) as BoxMetadataField[];

  return {
    scope: 'enterprise',
    displayName,
    ...(templateKey ? { templateKey } : {}),
    copyInstanceOnItemCopy: template.copyOnCopy ?? false,
    fields,
    _validation: validation
  };
}

/**
 * Transform a single field to Box format
 */
function transformField(field: Field, validation: { errors: string[]; notes: string[] }): BoxMetadataField | null {
  // Map field type
  const boxType = FIELD_TYPE_MAPPING[field.type];
  if (!boxType) {
    validation.errors.push(`Unrecognized field type "${field.type}" for field "${field.name}"`);
    return null;
  }

  // Add note for taxonomy fields
  if (field.type === 'taxonomy') {
    validation.notes.push(`Taxonomy field "${field.name}" mapped to multiSelect (Box API doesn't support taxonomy type)`);
  }

  // Generate field key
  const key = generateValidKey(field.key || field.name, 'field', validation);
  if (!key) {
    validation.errors.push(`Could not generate valid key for field "${field.name}"`);
    return null;
  }

  // Validate display name
  const displayName = validateDisplayName(field.name, validation);

  // Get the best prompt (highest rated or most recent)
  const bestPrompt = getBestPrompt(field);
  const description = bestPrompt || '';

  const boxField: BoxMetadataField = {
    type: boxType,
    key,
    displayName,
    ...(description ? { description } : {}),
    ...(field.hidden === true ? { hidden: true } : {})
  };

  // Handle enum/multiSelect options
  if (boxType === 'enum' || boxType === 'multiSelect') {
    const options = parseFieldOptions(field);
    if (options.length > 0) {
      boxField.options = options.map(opt => ({ key: opt }));
    } else {
      validation.notes.push(`No options found for ${boxType} field "${field.name}"`);
    }
  }

  return boxField;
}

/**
 * Generate valid Box key from display name
 */
function generateValidKey(input: string, type: 'template' | 'field', validation: { errors: string[]; notes: string[] }): string {
  if (!input) return '';

  const original = input;
  const pattern = type === 'template' ? BOX_VALIDATION.TEMPLATE_KEY_PATTERN : BOX_VALIDATION.FIELD_KEY_PATTERN;
  const maxLength = type === 'template' ? BOX_VALIDATION.MAX_TEMPLATE_KEY_LENGTH : BOX_VALIDATION.MAX_FIELD_KEY_LENGTH;

  // Convert to valid format
  let key = input
    .trim()
    .toLowerCase()
    // Replace spaces and invalid characters with underscores
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '');

  // Ensure starts with letter (Box requirement)
  if (key && !/^[a-zA-Z]/.test(key)) {
    // If it starts with a number, letter, or other character, prepend 'field_' or 'template_'
    const prefix = type === 'template' ? 'template_' : 'field_';
    key = prefix + key;
  }

  // If key is empty or still invalid, create a default key
  if (!key || key.length === 0) {
    key = type === 'template' ? 'template_1' : 'field_1';
  }

  // Truncate if too long
  if (key.length > maxLength) {
    key = key.substring(0, maxLength);
    // Remove trailing underscore if truncation created one
    key = key.replace(/_+$/, '');
  }

  // Final validation - ensure we still start with a letter
  if (!/^[a-zA-Z]/.test(key)) {
    const prefix = type === 'template' ? 't' : 'f';
    key = prefix + '_' + key.replace(/^[^a-zA-Z0-9_-]/, '');
  }

  // Validate final key
  if (!pattern.test(key)) {
    validation.errors.push(`Cannot generate valid ${type} key from "${original}"`);
    return '';
  }

  if (key !== original.toLowerCase()) {
    validation.notes.push(`${type} key transformed: "${original}" → "${key}"`);
  }

  return key;
}

/**
 * Validate and fix display name length
 */
function validateDisplayName(name: string, validation: { errors: string[]; notes: string[] }): string {
  if (!name) {
    validation.errors.push('Display name cannot be empty');
    return '';
  }

  const trimmed = name.trim();
  if (trimmed.length > BOX_VALIDATION.MAX_DISPLAY_NAME_LENGTH) {
    const truncated = trimmed.substring(0, BOX_VALIDATION.MAX_DISPLAY_NAME_LENGTH);
    validation.notes.push(`Display name truncated: "${trimmed}" → "${truncated}"`);
    return truncated;
  }

  return trimmed;
}

/**
 * Get the best prompt from a field (pinned first, then first prompt by creation order)
 */
function getBestPrompt(field: Field): string {
  if (!field.prompts || field.prompts.length === 0) {
    return '';
  }

  // Find pinned prompt first
  const pinnedPrompt = field.prompts.find(p => p.isPinned);
  if (pinnedPrompt) {
    return pinnedPrompt.text;
  }

  // Use the first prompt (by creation order) if no pinned prompt
  const sorted = [...field.prompts].sort((a, b) => a.createdAt - b.createdAt);
  return sorted[0].text;
}

/**
 * Parse field options from various input formats
 */
function parseFieldOptions(field: Field): string[] {
  // Priority: explicit options array, then optionsPaste textarea
  if (field.options && field.options.length > 0) {
    return deduplicateOptions(field.options.map(opt => opt.trim()).filter(opt => opt));
  }

  if (field.optionsPaste) {
    // Parse multiline textarea - one option per line
    const options = field.optionsPaste
      .split('\n')
      .map(line => line.trim())
      .filter(line => line) // Remove empty lines
      .map(line => line.replace(/^["']|["']$/g, '')); // Remove surrounding quotes

    return deduplicateOptions(options);
  }

  return [];
}

/**
 * Remove duplicate options while preserving order (first occurrence wins)
 */
function deduplicateOptions(options: string[]): string[] {
  const seen = new Set<string>();
  return options.filter(option => {
    if (seen.has(option)) {
      return false;
    }
    seen.add(option);
    return true;
  });
}

/**
 * Validate Box template for creation
 */
export function validateBoxTemplate(template: BoxMetadataTemplate): boolean {
  return template._validation?.errors?.length === 0;
}

/**
 * Check for duplicate template keys within an array of templates
 */
export function ensureUniqueTemplateKeys(templates: BoxMetadataTemplate[]): BoxMetadataTemplate[] {
  const keyCount: Record<string, number> = {};
  
  return templates.map(template => {
    if (!template.templateKey) return template;
    
    const baseKey = template.templateKey;
    keyCount[baseKey] = (keyCount[baseKey] || 0) + 1;
    
    if (keyCount[baseKey] > 1) {
      const newKey = `${baseKey}_${keyCount[baseKey]}`;
      template._validation?.notes?.push(`Template key made unique: "${baseKey}" → "${newKey}"`);
      return { ...template, templateKey: newKey };
    }
    
    return template;
  });
} 