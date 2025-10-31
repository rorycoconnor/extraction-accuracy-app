
import type { BoxTemplate, FileMetadataStore, AccuracyData } from './types';
import { 
  saveGroundTruthAction, 
  getGroundTruthDataAction, 
  saveConfiguredTemplatesAction, 
  saveAccuracyDataAction,
  clearAllGroundTruthDataAction 
} from './actions/json-storage';
import { logger } from './logger';

const CONFIGURED_TEMPLATES_STORAGE_KEY = 'configuredTemplates';

// Helper function to ensure all fields have an `isActive` property for backward compatibility
function ensureFieldsAreActiveByDefault(templates: BoxTemplate[]): BoxTemplate[] {
  return templates.map(template => ({
    ...template,
    fields: template.fields.map(field => ({
      ...field,
      // If isActive is undefined or null, default it to true.
      isActive: field.isActive !== undefined && field.isActive !== null ? field.isActive : true,
    })),
  }));
}

export function getConfiguredTemplates(): BoxTemplate[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const storedTemplates = localStorage.getItem(CONFIGURED_TEMPLATES_STORAGE_KEY);
  if (storedTemplates) {
    try {
      const parsedTemplates = JSON.parse(storedTemplates);
      return ensureFieldsAreActiveByDefault(parsedTemplates);
    } catch (e) {
      logger.error("Failed to parse stored templates", e as Error);
      return [];
    }
  }
  return [];
}

function saveConfiguredTemplates(templates: BoxTemplate[]) {
    if (typeof window === 'undefined') {
        return;
    }
    // Save to localStorage for immediate UI updates
    localStorage.setItem(CONFIGURED_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    
    // Background sync to JSON file for persistent storage
    saveConfiguredTemplatesAction(templates).catch((err) => logger.error('Failed to sync templates to JSON', err));
}

export function addConfiguredTemplates(newTemplates: BoxTemplate[]) {
  const currentTemplates = getConfiguredTemplates();
  const existingIds = new Set(currentTemplates.map(t => t.id));
  
  const uniqueNewTemplates = newTemplates
    .filter(t => !existingIds.has(t.id))
    .map(template => ({
        ...template,
        fields: template.fields.map(field => ({ ...field, isActive: true }))
    }));

  const updatedTemplates = [...currentTemplates, ...uniqueNewTemplates].sort((a,b) => a.displayName.localeCompare(b.displayName));
  saveConfiguredTemplates(updatedTemplates);
}

export function removeConfiguredTemplate(templateId: string) {
    let currentTemplates = getConfiguredTemplates();
    const updatedTemplates = currentTemplates.filter(t => t.id !== templateId);
    saveConfiguredTemplates(updatedTemplates);
}


export function toggleTemplateFieldActive(templateId: string, fieldId: string) {
  let currentTemplates = getConfiguredTemplates();
  const updatedTemplates = currentTemplates.map(template => {
    if (template.id === templateId) {
      return {
        ...template,
        fields: template.fields.map(field => {
          if (field.id === fieldId) {
            // If isActive is undefined, it's the first time, so we treat it as true and toggle to false.
            // Otherwise, we just flip the boolean.
            return { ...field, isActive: !(field.isActive === true) };
          }
          return field;
        }),
      };
    }
    return template;
  });
  saveConfiguredTemplates(updatedTemplates);
}


const FILE_METADATA_STORAGE_KEY = 'fileMetadataStore';
const ACCURACY_DATA_STORAGE_KEY = 'accuracyData';

export function getFileMetadataStore(): FileMetadataStore {
    if (typeof window === 'undefined') {
        return {};
    }
    const storedData = localStorage.getItem(FILE_METADATA_STORAGE_KEY);
    if (storedData) {
        try {
            return JSON.parse(storedData);
        } catch (e) {
            logger.error("Failed to parse file metadata store", e as Error);
            return {};
        }
    }
    return {};
}

function saveFileMetadataStore(data: FileMetadataStore) {
    if (typeof window === 'undefined') {
        logger.warn('Window is undefined, cannot save to localStorage');
        return;
    }
    try {
        localStorage.setItem(FILE_METADATA_STORAGE_KEY, JSON.stringify(data));
        logger.debug('Successfully saved file metadata to localStorage');
    } catch (error) {
        logger.error('Error saving to localStorage', error instanceof Error ? error : { error });
    }
}

export function associateFilesToTemplate(fileIds: string[], templateKey: string) {
  const store = getFileMetadataStore();
  fileIds.forEach(fileId => {
    // We create or update the entry for the file.
    // If ground truth already exists, we preserve it.
    store[fileId] = {
      templateKey: templateKey,
      groundTruth: store[fileId]?.groundTruth || {},
    };
  });
  saveFileMetadataStore(store);
}

export function saveGroundTruthForFile(fileId: string, templateKey: string, data: Record<string, string>) {
    const store = getFileMetadataStore();
    
    // ✅ FIXED: Merge with existing ground truth data instead of overwriting
    const existingGroundTruth = store[fileId]?.groundTruth || {};
    const mergedGroundTruth = {
      ...existingGroundTruth,
      ...data
    };
    
    // 🧹 CLEANUP: Remove empty/invalid fields instead of storing them
    const cleanedGroundTruth: Record<string, string> = {};
    Object.entries(mergedGroundTruth).forEach(([key, value]) => {
      // Simpler validation that matches status calculation
      const trimmedValue = String(value).trim();
      if (value !== undefined && 
          value !== null && 
          trimmedValue !== '') {
        cleanedGroundTruth[key] = trimmedValue;
      }
    });
    
    
    store[fileId] = {
      templateKey: templateKey,
      groundTruth: cleanedGroundTruth,
    };
    
    // Save to localStorage for immediate UI updates
    saveFileMetadataStore(store);
    
    // Background sync to JSON file for persistent storage
    saveGroundTruthAction(fileId, templateKey, cleanedGroundTruth).catch((err) => logger.error('Failed to sync ground truth to JSON', err));
    logger.debug('saveGroundTruthForFile completed', { fileId, templateKey });
}

export function getGroundTruthForFile(fileId: string): Record<string, string> {
    const store = getFileMetadataStore();
    return store[fileId]?.groundTruth || {};
}

// Accuracy Data persistence functions
export function saveAccuracyData(data: AccuracyData | null) {
    if (typeof window === 'undefined') {
        return;
    }
    // Save to localStorage for immediate UI updates
    if (data === null) {
        localStorage.removeItem(ACCURACY_DATA_STORAGE_KEY);
    } else {
        localStorage.setItem(ACCURACY_DATA_STORAGE_KEY, JSON.stringify(data));
    }
    
    // Background sync to JSON file for persistent storage
    saveAccuracyDataAction(data).catch((err) => logger.error('Failed to sync accuracy data to JSON', err));
}

export function getAccuracyData(): AccuracyData | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const storedData = localStorage.getItem(ACCURACY_DATA_STORAGE_KEY);
    if (storedData) {
        try {
            return JSON.parse(storedData);
        } catch (e) {
            logger.error("Failed to parse accuracy data", e as Error);
            return null;
        }
    }
    return null;
}

export function getGroundTruthData(): FileMetadataStore {
    return getFileMetadataStore();
}

export function clearAllGroundTruthData() {
    if (typeof window === 'undefined') {
        return;
    }
    // Clear localStorage for immediate UI updates
    localStorage.removeItem(FILE_METADATA_STORAGE_KEY);
    localStorage.removeItem(ACCURACY_DATA_STORAGE_KEY);
    
    // Background sync to clear JSON files for persistent storage
    clearAllGroundTruthDataAction().catch((err) => logger.error('Failed to clear ground truth JSON files', err));
}

// Restore data from JSON files if localStorage is empty
export async function restoreDataFromFiles() {
    if (typeof window === 'undefined') {
        return;
    }
    
    try {
        // Check if localStorage is empty and restore from JSON files
        const hasLocalStorage = localStorage.getItem(FILE_METADATA_STORAGE_KEY) !== null;
        
        if (!hasLocalStorage) {
            logger.info('Restoring data from JSON files');
            
            // Restore ground truth data
            const groundTruthData = await getGroundTruthDataAction();
            if (Object.keys(groundTruthData).length > 0) {
                localStorage.setItem(FILE_METADATA_STORAGE_KEY, JSON.stringify(groundTruthData));
                logger.info('Restored ground truth data from JSON files', { fileCount: Object.keys(groundTruthData).length });
            }
        }
    } catch (error) {
        logger.error('Failed to restore data from JSON files', error instanceof Error ? error : { error });
    }
}
