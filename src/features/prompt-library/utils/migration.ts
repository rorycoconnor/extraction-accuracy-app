/**
import { logger } from '@/lib/logger';
 * @fileOverview Migration Utilities
 * 
 * Handles migration from old prompt library data format to new Box-compliant format
 */

import type { Database, Template, Field, FieldType } from '../types';

// Legacy field types from v1
type LegacyFieldType = 'Text' | 'Date' | 'DropdownSingle' | 'DropdownMulti' | 'TaxonomySingle' | 'TaxonomyMulti';

interface LegacyField {
  id: string;
  name: string;
  type: LegacyFieldType;
  prompts: Array<{
    id: string;
    text: string;
    up: number;
    down: number;
    createdAt: number;
    isPinned?: boolean;
  }>;
}

interface LegacyTemplate {
  id: string;
  name: string;
  category: string;
  fields: LegacyField[];
}

interface LegacyDatabase {
  categories: string[];
  templates: LegacyTemplate[];
}

// Migration mapping for field types
const LEGACY_TYPE_MAPPING: Record<LegacyFieldType, FieldType> = {
  'Text': 'text',
  'Date': 'date',
  'DropdownSingle': 'dropdown_single',
  'DropdownMulti': 'dropdown_multi',
  'TaxonomySingle': 'taxonomy',
  'TaxonomyMulti': 'taxonomy'
};

/**
 * Migrate legacy prompt library data to new format
 */
export function migrateLegacyData(legacyData: LegacyDatabase): Database {
  logger.info('Starting prompt library migration');
  
  const migratedTemplates: Template[] = legacyData.templates.map(template => {
    const migratedFields: Field[] = template.fields.map(field => ({
      id: field.id,
      name: field.name,
      type: LEGACY_TYPE_MAPPING[field.type] || 'text', // Fallback to 'text'
      prompts: field.prompts,
      key: generateFieldKey(field.name),
      hidden: false,
      options: [],
      optionsPaste: ''
    }));

    return {
      id: template.id,
      name: template.name,
      category: template.category,
      fields: migratedFields,
      key: generateTemplateKey(template.name),
      copyOnCopy: false
    };
  });

  logger.info('Migration complete', { templateCount: migratedTemplates.length, fieldCount: migratedTemplates.reduce((acc, t) => acc + t.fields.length, 0) });
  
  return {
    categories: legacyData.categories,
    templates: migratedTemplates
  };
}

/**
 * Check if data needs migration
 */
export function needsMigration(): boolean {
  // SSR guard
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const oldData = localStorage.getItem('prompt-library-db-v1');
    const newData = localStorage.getItem('prompt-library-db-v2');
    
    return !!(oldData && !newData);
  } catch {
    return false;
  }
}

/**
 * Perform automatic migration if needed
 */
export function autoMigrateIfNeeded(): Database | null {
  // SSR guard
  if (typeof window === 'undefined') {
    logger.debug('autoMigrateIfNeeded(): Server-side, skipping migration');
    return null;
  }

  if (!needsMigration()) {
    return null;
  }

  try {
    const oldDataString = localStorage.getItem('prompt-library-db-v1');
    if (!oldDataString) return null;

    const legacyData: LegacyDatabase = JSON.parse(oldDataString);
    const migratedData = migrateLegacyData(legacyData);
    
    // Save migrated data
    localStorage.setItem('prompt-library-db-v2', JSON.stringify(migratedData));
    
    // Keep old data as backup
    logger.info('Migration complete. Old data preserved in prompt-library-db-v1');
    
    return migratedData;
  } catch (error) {
    logger.error('Migration failed', error);
    return null;
  }
}

/**
 * Import existing Box templates from configuredTemplates.json format
 */
export function importBoxTemplates(boxTemplates: any[]): Template[] {
  return boxTemplates.map((boxTemplate, index) => {
    const fields: Field[] = boxTemplate.fields
      .filter((field: any) => field.isActive !== false) // Include active fields
      .map((field: any) => ({
        id: field.id,
        name: field.displayName,
        type: mapBoxTypeToInternal(field.type),
        prompts: field.description ? [{
          id: `imported-${field.id}`,
          text: field.description,
          up: 0,
          down: 0,
          createdAt: Date.now(),
          isPinned: false
        }] : [],
        key: field.key,
        hidden: field.hidden || false,
        options: field.options?.map((opt: any) => opt.key) || [],
        optionsPaste: ''
      }));

    return {
      id: boxTemplate.id || `imported-${index}`,
      name: boxTemplate.displayName,
      category: 'Imported', // Default category
      fields,
      key: boxTemplate.templateKey,
      copyOnCopy: boxTemplate.copyInstanceOnItemCopy || false
    };
  });
}

/**
 * Map Box field type back to internal type
 */
function mapBoxTypeToInternal(boxType: string): FieldType {
  switch (boxType) {
    case 'string': return 'text';
    case 'float': return 'number';
    case 'date': return 'date';
    case 'enum': return 'dropdown_single';
    case 'multiSelect': return 'dropdown_multi';
    default: return 'text';
  }
}

/**
 * Generate valid field key from name
 */
function generateFieldKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Generate valid template key from name
 */
function generateTemplateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Export current data in Box API format for external use
 */
export function exportForBoxAPI(database: Database): any[] {
  // This would use the transformer we created
  // For now, return a placeholder
  return database.templates.map(template => ({
    name: template.name,
    key: template.key,
    fields: template.fields.map(field => ({
      name: field.name,
      type: field.type,
      key: field.key,
      prompt: field.prompts.find(p => p.isPinned)?.text || field.prompts[0]?.text || '',
      options: field.options
    }))
  }));
} 