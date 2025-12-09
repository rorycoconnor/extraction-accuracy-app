/**
 * Utility functions for importing Box templates into the Prompt Library
 */

import type { BoxTemplate, BoxTemplateField } from '@/lib/types';
import type { Template, Field, FieldType, Prompt } from '../types';
import { PromptLibraryStorage } from './storage';
import { getFieldPrompt } from '@/lib/prompt-storage';
import { logger } from '@/lib/logger';

/**
 * Map Box field types to Library field types
 */
function mapBoxTypeToLibraryType(boxType: BoxTemplateField['type']): FieldType {
  const typeMap: Record<string, FieldType> = {
    'string': 'text',
    'float': 'number',
    'number': 'number',
    'date': 'date',
    'enum': 'dropdown_single',
    'multiSelect': 'dropdown_multi',
  };
  
  return typeMap[boxType] || 'text';
}

/**
 * Generate a unique ID for library items
 */
function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Convert a Box template field to a Library field
 * Optionally pulls active prompts from Prompt Studio
 */
function convertBoxFieldToLibraryField(boxField: BoxTemplateField, templateKey?: string): Field {
  // Extract option values from Box format { id, key } to simple string array
  const options: string[] = boxField.options?.map(opt => opt.key) || [];
  const optionsPaste = options.join('\n');
  
  // Try to get active prompt from Prompt Studio
  const prompts: Prompt[] = [];
  if (templateKey) {
    const promptData = getFieldPrompt(boxField.key);
    if (promptData?.activePrompt && promptData.activePrompt.trim()) {
      // Add the active prompt as the first prompt in the Library
      prompts.push({
        id: `prompt-${generateId()}`,
        text: promptData.activePrompt,
        up: 0,
        down: 0,
        createdAt: Date.now(),
        isPinned: true, // Pin it since it's the active prompt
      });
      logger.debug('Added active prompt for field', {
        fieldName: boxField.displayName,
        promptLength: promptData.activePrompt.length,
      });
    }
  }
  
  return {
    id: `field-${generateId()}`,
    name: boxField.displayName,
    type: mapBoxTypeToLibraryType(boxField.type),
    prompts,
    key: boxField.key,
    hidden: false,
    options: options.length > 0 ? options : undefined,
    optionsPaste: options.length > 0 ? optionsPaste : undefined,
  };
}

/**
 * Convert a BoxTemplate to a Library Template
 * Optionally pulls active prompts from Prompt Studio if includePrompts is true
 */
export function convertBoxTemplateToLibrary(
  boxTemplate: BoxTemplate,
  category: string,
  includePrompts: boolean = true
): Template {
  logger.info('Converting Box template to Library format', {
    templateName: boxTemplate.displayName,
    fieldCount: boxTemplate.fields.length,
    category,
    includePrompts,
  });
  
  // Pass templateKey to field conversion if we want to include prompts
  const templateKey = includePrompts ? boxTemplate.templateKey : undefined;
  
  const libraryTemplate: Template = {
    id: `template-${generateId()}`,
    name: boxTemplate.displayName,
    category,
    key: boxTemplate.templateKey,
    copyOnCopy: false,
    fields: boxTemplate.fields.map(field => convertBoxFieldToLibraryField(field, templateKey)),
  };
  
  // Count how many fields got prompts
  const fieldsWithPrompts = libraryTemplate.fields.filter(f => f.prompts.length > 0).length;
  
  // Log field conversion details
  libraryTemplate.fields.forEach((field, idx) => {
    const boxField = boxTemplate.fields[idx];
    logger.debug('Converted field', {
      name: field.name,
      boxType: boxField.type,
      libraryType: field.type,
      optionsCount: field.options?.length || 0,
      promptsCount: field.prompts.length,
    });
  });
  
  logger.info('Template conversion complete', {
    templateName: boxTemplate.displayName,
    totalFields: libraryTemplate.fields.length,
    fieldsWithPrompts,
  });
  
  return libraryTemplate;
}

/**
 * Check if a template with the same name already exists in the Library
 */
export function checkTemplateExistsInLibrary(
  templateName: string,
  existingTemplates: Template[]
): boolean {
  const normalizedName = templateName.toLowerCase().trim();
  return existingTemplates.some(
    t => t.name.toLowerCase().trim() === normalizedName
  );
}

/**
 * Get a summary of what will be imported
 */
export function getImportSummary(boxTemplate: BoxTemplate): {
  templateName: string;
  fieldCount: number;
  fieldsWithOptions: number;
  fieldsWithPrompts: number;
  fieldTypes: Record<string, number>;
} {
  const fieldTypes: Record<string, number> = {};
  let fieldsWithOptions = 0;
  let fieldsWithPrompts = 0;
  
  for (const field of boxTemplate.fields) {
    const libraryType = mapBoxTypeToLibraryType(field.type);
    fieldTypes[libraryType] = (fieldTypes[libraryType] || 0) + 1;
    
    if (field.options && field.options.length > 0) {
      fieldsWithOptions++;
    }
    
    // Check if this field has an active prompt in Prompt Studio
    const promptData = getFieldPrompt(field.key);
    if (promptData?.activePrompt && promptData.activePrompt.trim()) {
      fieldsWithPrompts++;
    }
  }
  
  return {
    templateName: boxTemplate.displayName,
    fieldCount: boxTemplate.fields.length,
    fieldsWithOptions,
    fieldsWithPrompts,
    fieldTypes,
  };
}

/**
 * Get all categories from the Library
 */
export function getLibraryCategories(): string[] {
  const database = PromptLibraryStorage.load();
  return database.categories;
}

/**
 * Normalize field name for comparison
 */
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[_\-\s]+/g, '').trim();
}

/**
 * Check if a prompt text already exists in a field's prompts
 */
function promptExistsInField(field: Field, promptText: string): boolean {
  const normalizedNew = promptText.trim().toLowerCase();
  return field.prompts.some(p => p.text.trim().toLowerCase() === normalizedNew);
}

/**
 * Save a Box template to the Prompt Library
 * If template already exists, merges prompts into existing fields
 * Returns success status and any error message
 */
export function saveBoxTemplateToLibrary(
  boxTemplate: BoxTemplate,
  category: string,
  createCategoryIfNeeded: boolean = true
): { success: boolean; errorMessage?: string; templateId?: string; merged?: boolean; promptsAdded?: number } {
  try {
    const database = PromptLibraryStorage.load();
    
    // Check if template with same name already exists
    const existingTemplateIndex = database.templates.findIndex(
      t => t.name.toLowerCase().trim() === boxTemplate.displayName.toLowerCase().trim()
    );
    
    if (existingTemplateIndex >= 0) {
      // Template exists - merge prompts into existing fields
      const existingTemplate = database.templates[existingTemplateIndex];
      let promptsAdded = 0;
      
      for (const boxField of boxTemplate.fields) {
        // Get active prompt from Prompt Studio
        const promptData = getFieldPrompt(boxField.key);
        if (!promptData?.activePrompt || !promptData.activePrompt.trim()) {
          continue; // No active prompt for this field
        }
        
        // Find matching field in Library template (by name)
        const normalizedBoxFieldName = normalizeFieldName(boxField.displayName);
        const existingField = existingTemplate.fields.find(
          f => normalizeFieldName(f.name) === normalizedBoxFieldName
        );
        
        if (!existingField) {
          logger.debug('No matching field found in Library template', {
            fieldName: boxField.displayName,
          });
          continue;
        }
        
        // Check if prompt already exists
        if (promptExistsInField(existingField, promptData.activePrompt)) {
          logger.debug('Prompt already exists in Library field', {
            fieldName: boxField.displayName,
          });
          continue;
        }
        
        // Add the new prompt
        const newPrompt: Prompt = {
          id: `prompt-${generateId()}`,
          text: promptData.activePrompt,
          up: 0,
          down: 0,
          createdAt: Date.now(),
          isPinned: true,
        };
        
        existingField.prompts.unshift(newPrompt); // Add to beginning
        promptsAdded++;
        
        logger.info('Added prompt to existing Library field', {
          fieldName: boxField.displayName,
          promptLength: promptData.activePrompt.length,
        });
      }
      
      if (promptsAdded > 0) {
        // Save updated database
        PromptLibraryStorage.save(database);
        
        logger.info('Merged prompts into existing Library template', {
          templateName: boxTemplate.displayName,
          promptsAdded,
        });
        
        return {
          success: true,
          templateId: existingTemplate.id,
          merged: true,
          promptsAdded,
        };
      } else {
        return {
          success: true,
          templateId: existingTemplate.id,
          merged: true,
          promptsAdded: 0,
        };
      }
    }
    
    // Template doesn't exist - create new one
    
    // Add category if needed
    if (!database.categories.includes(category)) {
      if (createCategoryIfNeeded) {
        database.categories.push(category);
        logger.info('Created new category in Library', { category });
      } else {
        return {
          success: false,
          errorMessage: `Category "${category}" does not exist in the Library.`,
        };
      }
    }
    
    // Convert and add the template
    const libraryTemplate = convertBoxTemplateToLibrary(boxTemplate, category);
    database.templates.push(libraryTemplate);
    
    // Count prompts added
    const promptsAdded = libraryTemplate.fields.reduce((count, f) => count + f.prompts.length, 0);
    
    // Save to storage
    PromptLibraryStorage.save(database);
    
    logger.info('Saved Box template to Library', {
      templateName: boxTemplate.displayName,
      category,
      fieldCount: libraryTemplate.fields.length,
      templateId: libraryTemplate.id,
      promptsAdded,
    });
    
    return {
      success: true,
      templateId: libraryTemplate.id,
      merged: false,
      promptsAdded,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to save Box template to Library', { error: errorMessage });
    return {
      success: false,
      errorMessage,
    };
  }
}

