import type { Database, Template } from '../types';

/**
 * Import/Export utilities for Prompt Library
 * 
 * This module provides foundation functions for future import/export
 * functionality to allow moving templates between different systems.
 */

export interface ExportData {
  version: string;
  exportDate: string;
  database: Database;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedTemplatesCount?: number;
  skippedTemplatesCount?: number;
}

/**
 * Export the entire prompt library database
 */
export function exportDatabase(database: Database): ExportData {
  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    database: {
      categories: [...database.categories],
      templates: database.templates.map(template => ({
        ...template,
        fields: template.fields.map(field => ({
          ...field,
          prompts: [...field.prompts]
        }))
      }))
    }
  };
}

/**
 * Export specific templates
 */
export function exportTemplates(database: Database, templateIds: string[]): ExportData {
  const selectedTemplates = database.templates.filter(t => templateIds.includes(t.id));
  const usedCategories = [...new Set(selectedTemplates.map(t => t.category))];
  
  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    database: {
      categories: usedCategories,
      templates: selectedTemplates.map(template => ({
        ...template,
        fields: template.fields.map(field => ({
          ...field,
          prompts: [...field.prompts]
        }))
      }))
    }
  };
}

/**
 * Import templates (foundation - will be expanded later)
 */
export function importTemplates(
  currentDatabase: Database, 
  importData: ExportData, 
  options: {
    overwriteExisting?: boolean;
    mergeCategories?: boolean;
  } = {}
): ImportResult {
  try {
    // Validate import data structure
    if (!importData.database || !importData.version) {
      return {
        success: false,
        message: 'Invalid import data format'
      };
    }

    // For now, return a placeholder result
    // This will be expanded with actual import logic in the future
    return {
      success: true,
      message: 'Import functionality will be implemented in a future version',
      importedTemplatesCount: 0,
      skippedTemplatesCount: 0
    };
  } catch (error) {
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Download export data as JSON file
 */
export function downloadExportData(exportData: ExportData, filename?: string) {
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `prompt-library-export-${new Date().toISOString().split('T')[0]}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Utility to generate unique IDs for imported items
 */
export function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate template structure for import
 */
export function validateTemplate(template: any): template is Template {
  return (
    typeof template === 'object' &&
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.category === 'string' &&
    Array.isArray(template.fields)
  );
} 