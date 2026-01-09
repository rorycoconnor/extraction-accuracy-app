import { v4 as uuidv4 } from 'uuid';
import { saveSystemPromptsAction, getSystemPromptsAction } from './actions/json-storage';
import { logger } from './logger';
import { SYSTEM_MESSAGES } from '@/ai/prompts/prompt-engineering';
import { DEFAULT_PROMPT_GENERATION_INSTRUCTIONS } from '@/lib/agent-alpha-config';

// Storage key for localStorage
const SYSTEM_PROMPT_STORAGE_KEY = 'systemPromptsStore';

// Default IDs for built-in system prompts
const DEFAULT_PROMPT_STUDIO_VERSION_ID = 'default-prompt-studio';
const DEFAULT_AGENT_VERSION_ID = 'default-agent';

// Types for system prompt storage
export type SystemPromptType = 'prompt-studio' | 'agent-alpha';

export interface SystemPromptVersion {
  id: string;
  name: string;
  type: SystemPromptType;
  // For Prompt Studio
  generatePrompt?: string;
  improvePrompt?: string;
  // For Agent Alpha
  agentInstructions?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemPromptStore {
  // Separate active versions for each type
  activePromptStudioVersionId: string;
  activeAgentVersionId: string;
  versions: SystemPromptVersion[];
}

// Create the default Prompt Studio system prompt version
function createDefaultPromptStudioVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_PROMPT_STUDIO_VERSION_ID,
    name: 'Default',
    type: 'prompt-studio',
    generatePrompt: SYSTEM_MESSAGES.GENERATE,
    improvePrompt: SYSTEM_MESSAGES.IMPROVE,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

// Create the default Agent Alpha system prompt version
function createDefaultAgentVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_AGENT_VERSION_ID,
    name: 'Default',
    type: 'agent-alpha',
    agentInstructions: DEFAULT_PROMPT_GENERATION_INSTRUCTIONS,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

// Initialize store with default versions for both types
function getInitialStore(): SystemPromptStore {
  return {
    activePromptStudioVersionId: DEFAULT_PROMPT_STUDIO_VERSION_ID,
    activeAgentVersionId: DEFAULT_AGENT_VERSION_ID,
    versions: [createDefaultPromptStudioVersion(), createDefaultAgentVersion()],
  };
}

// Migrate old storage format to new format
function migrateStore(store: any): SystemPromptStore {
  // Check if it's the old format (has activeVersionId instead of type-specific IDs)
  if ('activeVersionId' in store && !('activePromptStudioVersionId' in store)) {
    logger.info('Migrating system prompt store from old format');
    
    // Migrate versions to include type
    const migratedVersions: SystemPromptVersion[] = store.versions.map((v: any) => ({
      ...v,
      type: 'prompt-studio' as SystemPromptType,
      id: v.id === 'default' ? DEFAULT_PROMPT_STUDIO_VERSION_ID : v.id,
    }));
    
    // Add default agent version if not present
    const hasAgentDefault = migratedVersions.some(v => v.type === 'agent-alpha' && v.isDefault);
    if (!hasAgentDefault) {
      migratedVersions.push(createDefaultAgentVersion());
    }
    
    return {
      activePromptStudioVersionId: store.activeVersionId === 'default' ? DEFAULT_PROMPT_STUDIO_VERSION_ID : store.activeVersionId,
      activeAgentVersionId: DEFAULT_AGENT_VERSION_ID,
      versions: migratedVersions,
    };
  }
  
  return store as SystemPromptStore;
}

/**
 * Get the full system prompt store from localStorage
 */
export function getSystemPromptStore(): SystemPromptStore {
  if (typeof window === 'undefined') {
    return getInitialStore();
  }

  try {
    const stored = localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY);
    if (stored) {
      let parsed = JSON.parse(stored);
      
      // Migrate if needed
      parsed = migrateStore(parsed);
      
      // Ensure default versions always exist
      const hasPromptStudioDefault = parsed.versions.some(
        (v: SystemPromptVersion) => v.id === DEFAULT_PROMPT_STUDIO_VERSION_ID
      );
      if (!hasPromptStudioDefault) {
        parsed.versions.unshift(createDefaultPromptStudioVersion());
      }
      
      const hasAgentDefault = parsed.versions.some(
        (v: SystemPromptVersion) => v.id === DEFAULT_AGENT_VERSION_ID
      );
      if (!hasAgentDefault) {
        parsed.versions.push(createDefaultAgentVersion());
      }
      
      return parsed;
    }
  } catch (error) {
    logger.error('Failed to parse system prompt store from localStorage', error instanceof Error ? error : { error });
  }

  return getInitialStore();
}

/**
 * Save the entire system prompt store to localStorage and JSON backup
 */
function saveSystemPromptStore(store: SystemPromptStore): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Save to localStorage for immediate access
    localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, JSON.stringify(store));

    // Background sync to JSON file for persistent storage
    saveSystemPromptsAction(store).catch((err) => 
      logger.error('Failed to sync system prompts to JSON', err)
    );

    logger.debug('System prompt store saved', { versionCount: store.versions.length });
  } catch (error) {
    logger.error('Failed to save system prompt store', error instanceof Error ? error : { error });
  }
}

// ============================================================================
// PROMPT STUDIO FUNCTIONS
// ============================================================================

/**
 * Get the currently active Prompt Studio system prompt version
 */
export function getActiveSystemPrompt(): SystemPromptVersion {
  const store = getSystemPromptStore();
  const active = store.versions.find(v => v.id === store.activePromptStudioVersionId);
  
  // Fallback to default if active version not found
  if (!active) {
    const defaultVersion = store.versions.find(v => v.id === DEFAULT_PROMPT_STUDIO_VERSION_ID);
    return defaultVersion || createDefaultPromptStudioVersion();
  }
  
  return active;
}

/**
 * Set the active Prompt Studio system prompt version by ID
 */
export function setActiveSystemPrompt(versionId: string): boolean {
  const store = getSystemPromptStore();
  const version = store.versions.find(v => v.id === versionId);
  
  if (!version || version.type !== 'prompt-studio') {
    logger.warn('Attempted to set active Prompt Studio system prompt to invalid version', { versionId });
    return false;
  }
  
  store.activePromptStudioVersionId = versionId;
  saveSystemPromptStore(store);
  
  logger.info('Active Prompt Studio system prompt changed', { versionId });
  return true;
}

/**
 * Create a new Prompt Studio system prompt version
 */
export function createSystemPromptVersion(
  name: string,
  generatePrompt: string,
  improvePrompt: string
): SystemPromptVersion {
  const store = getSystemPromptStore();
  const now = new Date().toISOString();
  
  const newVersion: SystemPromptVersion = {
    id: uuidv4(),
    name,
    type: 'prompt-studio',
    generatePrompt,
    improvePrompt,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  
  store.versions.push(newVersion);
  saveSystemPromptStore(store);
  
  logger.info('Created new Prompt Studio system prompt version', { id: newVersion.id, name });
  return newVersion;
}

/**
 * Update an existing Prompt Studio system prompt version
 */
export function updateSystemPromptVersion(
  id: string,
  updates: Partial<Pick<SystemPromptVersion, 'name' | 'generatePrompt' | 'improvePrompt'>>
): SystemPromptVersion | null {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id && v.type === 'prompt-studio');
  
  if (versionIndex === -1) {
    logger.warn('Attempted to update non-existent Prompt Studio system prompt version', { id });
    return null;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow updating the default version
  if (version.isDefault) {
    logger.warn('Attempted to update default Prompt Studio system prompt version', { id });
    return null;
  }
  
  const updatedVersion: SystemPromptVersion = {
    ...version,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  store.versions[versionIndex] = updatedVersion;
  saveSystemPromptStore(store);
  
  logger.info('Updated Prompt Studio system prompt version', { id, name: updatedVersion.name });
  return updatedVersion;
}

/**
 * Delete a Prompt Studio system prompt version
 */
export function deleteSystemPromptVersion(id: string): boolean {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id && v.type === 'prompt-studio');
  
  if (versionIndex === -1) {
    logger.warn('Attempted to delete non-existent Prompt Studio system prompt version', { id });
    return false;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow deleting the default version
  if (version.isDefault) {
    logger.warn('Attempted to delete default Prompt Studio system prompt version', { id });
    return false;
  }
  
  // If deleting the active version, switch to default
  if (store.activePromptStudioVersionId === id) {
    store.activePromptStudioVersionId = DEFAULT_PROMPT_STUDIO_VERSION_ID;
  }
  
  store.versions.splice(versionIndex, 1);
  saveSystemPromptStore(store);
  
  logger.info('Deleted Prompt Studio system prompt version', { id, name: version.name });
  return true;
}

/**
 * Get all Prompt Studio system prompt versions
 */
export function getAllSystemPromptVersions(): SystemPromptVersion[] {
  const store = getSystemPromptStore();
  return store.versions.filter(v => v.type === 'prompt-studio');
}

/**
 * Reset to default Prompt Studio system prompt
 */
export function resetToDefaultSystemPrompt(): void {
  const store = getSystemPromptStore();
  store.activePromptStudioVersionId = DEFAULT_PROMPT_STUDIO_VERSION_ID;
  saveSystemPromptStore(store);
  
  logger.info('Reset to default Prompt Studio system prompt');
}

// ============================================================================
// AGENT ALPHA FUNCTIONS
// ============================================================================

/**
 * Get the currently active Agent Alpha system prompt version
 */
export function getActiveAgentSystemPrompt(): SystemPromptVersion {
  const store = getSystemPromptStore();
  const active = store.versions.find(v => v.id === store.activeAgentVersionId);
  
  // Fallback to default if active version not found
  if (!active) {
    const defaultVersion = store.versions.find(v => v.id === DEFAULT_AGENT_VERSION_ID);
    return defaultVersion || createDefaultAgentVersion();
  }
  
  return active;
}

/**
 * Set the active Agent Alpha system prompt version by ID
 */
export function setActiveAgentSystemPrompt(versionId: string): boolean {
  const store = getSystemPromptStore();
  const version = store.versions.find(v => v.id === versionId);
  
  if (!version || version.type !== 'agent-alpha') {
    logger.warn('Attempted to set active Agent system prompt to invalid version', { versionId });
    return false;
  }
  
  store.activeAgentVersionId = versionId;
  saveSystemPromptStore(store);
  
  logger.info('Active Agent system prompt changed', { versionId });
  return true;
}

/**
 * Create a new Agent Alpha system prompt version
 */
export function createAgentSystemPromptVersion(
  name: string,
  agentInstructions: string
): SystemPromptVersion {
  const store = getSystemPromptStore();
  const now = new Date().toISOString();
  
  const newVersion: SystemPromptVersion = {
    id: uuidv4(),
    name,
    type: 'agent-alpha',
    agentInstructions,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  
  store.versions.push(newVersion);
  saveSystemPromptStore(store);
  
  logger.info('Created new Agent system prompt version', { id: newVersion.id, name });
  return newVersion;
}

/**
 * Update an existing Agent Alpha system prompt version
 */
export function updateAgentSystemPromptVersion(
  id: string,
  updates: Partial<Pick<SystemPromptVersion, 'name' | 'agentInstructions'>>
): SystemPromptVersion | null {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id && v.type === 'agent-alpha');
  
  if (versionIndex === -1) {
    logger.warn('Attempted to update non-existent Agent system prompt version', { id });
    return null;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow updating the default version
  if (version.isDefault) {
    logger.warn('Attempted to update default Agent system prompt version', { id });
    return null;
  }
  
  const updatedVersion: SystemPromptVersion = {
    ...version,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  store.versions[versionIndex] = updatedVersion;
  saveSystemPromptStore(store);
  
  logger.info('Updated Agent system prompt version', { id, name: updatedVersion.name });
  return updatedVersion;
}

/**
 * Delete an Agent Alpha system prompt version
 */
export function deleteAgentSystemPromptVersion(id: string): boolean {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id && v.type === 'agent-alpha');
  
  if (versionIndex === -1) {
    logger.warn('Attempted to delete non-existent Agent system prompt version', { id });
    return false;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow deleting the default version
  if (version.isDefault) {
    logger.warn('Attempted to delete default Agent system prompt version', { id });
    return false;
  }
  
  // If deleting the active version, switch to default
  if (store.activeAgentVersionId === id) {
    store.activeAgentVersionId = DEFAULT_AGENT_VERSION_ID;
  }
  
  store.versions.splice(versionIndex, 1);
  saveSystemPromptStore(store);
  
  logger.info('Deleted Agent system prompt version', { id, name: version.name });
  return true;
}

/**
 * Get all Agent Alpha system prompt versions
 */
export function getAllAgentSystemPromptVersions(): SystemPromptVersion[] {
  const store = getSystemPromptStore();
  return store.versions.filter(v => v.type === 'agent-alpha');
}

/**
 * Reset to default Agent Alpha system prompt
 */
export function resetToDefaultAgentSystemPrompt(): void {
  const store = getSystemPromptStore();
  store.activeAgentVersionId = DEFAULT_AGENT_VERSION_ID;
  saveSystemPromptStore(store);
  
  logger.info('Reset to default Agent system prompt');
}

// ============================================================================
// SHARED UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a specific system prompt version by ID (any type)
 */
export function getSystemPromptVersionById(id: string): SystemPromptVersion | null {
  const store = getSystemPromptStore();
  return store.versions.find(v => v.id === id) || null;
}

/**
 * Restore system prompt data from JSON file backup (used during app initialization)
 */
export async function restoreSystemPromptsFromFiles(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Check if localStorage is empty or only has defaults
    const localData = getSystemPromptStore();
    const hasOnlyDefaults = localData.versions.every(v => v.isDefault);

    if (hasOnlyDefaults) {
      // Try to restore from JSON file
      const fileData = await getSystemPromptsAction();
      if (fileData && fileData.versions && fileData.versions.length > 0) {
        // Migrate if needed
        const migratedData = migrateStore(fileData);
        
        // Ensure default versions exist in restored data
        const hasPromptStudioDefault = migratedData.versions.some(
          (v: SystemPromptVersion) => v.id === DEFAULT_PROMPT_STUDIO_VERSION_ID
        );
        if (!hasPromptStudioDefault) {
          migratedData.versions.unshift(createDefaultPromptStudioVersion());
        }
        
        const hasAgentDefault = migratedData.versions.some(
          (v: SystemPromptVersion) => v.id === DEFAULT_AGENT_VERSION_ID
        );
        if (!hasAgentDefault) {
          migratedData.versions.push(createDefaultAgentVersion());
        }
        
        localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, JSON.stringify(migratedData));
        logger.info('Restored system prompt data from JSON file', { versionCount: migratedData.versions.length });
      }
    }
  } catch (error) {
    logger.error('Failed to restore system prompt data from files', error instanceof Error ? error : { error });
  }
}

/**
 * Clear all stored system prompts (used for debugging/reset)
 */
export function clearSystemPromptStore(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(SYSTEM_PROMPT_STORAGE_KEY);
  saveSystemPromptsAction(getInitialStore()).catch((err) => 
    logger.error('Failed to clear system prompts JSON', err)
  );
  logger.info('System prompt store cleared');
}
