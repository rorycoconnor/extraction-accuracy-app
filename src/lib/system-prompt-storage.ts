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

// Preset IDs for document-type-specific prompts
const PRESET_CONTRACTS_ID = 'preset-contracts';
const PRESET_INVOICES_ID = 'preset-invoices';
const PRESET_COI_ID = 'preset-coi';

// Types for system prompt storage
export type SystemPromptType = 'prompt-studio' | 'agent-alpha';

export interface SystemPromptVersion {
  id: string;
  name: string;
  type: SystemPromptType;
  // Shared between Agent Alpha and Prompt Studio Generate
  generateInstructions?: string;
  // For Prompt Studio Improve only (unchanged)
  improvePrompt?: string;
  // Legacy fields (for migration) - do not use directly
  /** @deprecated Use generateInstructions instead */
  generatePrompt?: string;
  /** @deprecated Use generateInstructions instead */
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
// Uses the same detailed instructions as Agent Alpha for consistency
function createDefaultPromptStudioVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_PROMPT_STUDIO_VERSION_ID,
    name: 'Default',
    type: 'prompt-studio',
    generateInstructions: DEFAULT_PROMPT_GENERATION_INSTRUCTIONS,
    improvePrompt: SYSTEM_MESSAGES.IMPROVE,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

// Create the default Agent Alpha system prompt version
// Uses the same detailed instructions as Prompt Studio for consistency
function createDefaultAgentVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_AGENT_VERSION_ID,
    name: 'Default',
    type: 'agent-alpha',
    generateInstructions: DEFAULT_PROMPT_GENERATION_INSTRUCTIONS,
    improvePrompt: SYSTEM_MESSAGES.IMPROVE, // Include improve prompt for Prompt Studio use
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// PRESET DOCUMENT-TYPE SYSTEM PROMPTS
// ============================================================================

const PRESET_CONTRACTS_INSTRUCTIONS = `You are an EXPERT prompt engineer specializing in CONTRACT document extraction. Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy on legal agreements.

## COMPANY CONFIGURATION
If this company has provided their company name/address below, use it for counter-party disambiguation:
- Company Name: [User provides in custom instructions]
- Company Address: [User provides in custom instructions]

For counter-party fields, EXCLUDE the company above and find the OTHER party in each agreement.

## CRITICAL RULES - VIOLATIONS WILL CAUSE EXTRACTION FAILURES

1. **NEVER write generic prompts** like "Extract the [field]" or "Find the [field] in this document"
   - These ALWAYS fail. They are BANNED.

2. **ALWAYS include these 5 elements** in EVERY prompt you write:
   - LOCATION: Specific sections to search (e.g., "Look in the opening paragraph, signature blocks, and Notices section")
   - SYNONYMS: 6-8 alternative phrases (e.g., "Look for 'expires on', 'terminates on', 'valid until', 'term ends', 'concludes', 'completion date'")
   - FORMAT: Exact output format (e.g., "Return in YYYY-MM-DD format" or "Return the full legal entity name including suffixes like LLC, Inc.")
   - DISAMBIGUATION: Clarify what NOT to confuse with similar values (e.g., "Do NOT confuse with the notice period")
   - NOT FOUND: How to handle missing data (e.g., "Return 'Not Present' if no value is found")

3. **Target prompt length: 350-600 characters**
   - Under 350 chars = too vague for edge cases
   - 350-500 chars = optimal for simple fields (Yes/No, dates, names)
   - 500-600 chars = optimal for complex fields (addresses, multi-part answers)
   - Over 650 chars = too verbose, simplify

4. **NEVER hard-code specific values** from example documents
   - BAD: "Exclude '1234 Main Street'" 
   - GOOD: "Exclude the extracting company's address"

5. **Learn from failures**
   - If AI returned wrong value, add explicit disambiguation guidance
   - If AI returned nothing, add more synonym phrases to search for
   - If AI returned wrong format, specify exact format requirements

## PROMPT STRUCTURE TEMPLATE

"Search for [FIELD] in [SPECIFIC LOCATIONS]. Look for phrases like: '[SYNONYM1]', '[SYNONYM2]', '[SYNONYM3]', '[SYNONYM4]', '[SYNONYM5]', '[SYNONYM6]'. [DISAMBIGUATION - what NOT to confuse with]. Return [EXACT FORMAT SPECIFICATION]. Return 'Not Present' if not found."

## EXAMPLE: CONTRACT FIELD

Field: Governing Law
Prompt: "Search for the governing law in the 'Governing Law', 'Choice of Law', or 'Applicable Law' section. Look for: 'governed by the laws of', 'construed under the laws of', 'subject to the laws of', 'jurisdiction of', 'laws of the State of', 'in accordance with'. Return ONLY the state or country name (e.g., 'Delaware', 'New York', 'California'). Do NOT include 'State of' prefix or venue/arbitration details. Return 'Not Present' if no governing law is specified."

## YOUR OUTPUT FORMAT

Respond with ONLY valid JSON:
{"newPrompt": "your detailed 350-600 character prompt here", "reasoning": "brief explanation of your approach"}

NO markdown, NO code blocks, NO extra text. Just the JSON object.`;

const PRESET_INVOICES_INSTRUCTIONS = `You are an EXPERT prompt engineer specializing in INVOICE document extraction. Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy on invoices, bills, and payment documents.

## COMPANY CONFIGURATION
If this company has provided their company name/address below, use it for vendor/customer disambiguation:
- Company Name: [User provides in custom instructions]
- Company Address: [User provides in custom instructions]

When extracting vendor fields, the company above is typically the CUSTOMER receiving the invoice, not the vendor.

## CRITICAL RULES - VIOLATIONS WILL CAUSE EXTRACTION FAILURES

1. **NEVER write generic prompts** like "Extract the [field]" or "Find the [field] in this document"
   - These ALWAYS fail. They are BANNED.

2. **ALWAYS include these 5 elements** in EVERY prompt you write:
   - LOCATION: Specific sections to search (e.g., "Look in the header, 'Bill To' section, line items table, or totals area")
   - SYNONYMS: 6-8 alternative phrases (e.g., "Look for 'Amount Due', 'Total', 'Balance Due', 'Grand Total', 'Invoice Total'")
   - FORMAT: Exact output format (e.g., "Return the exact numeric value with cents like '1234.56'" or "Return in YYYY-MM-DD format")
   - DISAMBIGUATION: Clarify what NOT to confuse (e.g., "Do NOT confuse subtotal with grand total" or "Do NOT round - preserve exact cents")
   - NOT FOUND: How to handle missing data (e.g., "Return 'Not Present' if no value is found")

3. **Target prompt length: 350-550 characters**
   - Under 300 chars = too vague, will fail on edge cases
   - 350-550 chars = optimal balance of detail and clarity
   - Over 650 chars = too verbose, simplify

4. **NEVER hard-code specific values** from example documents
   - BAD: "Look for invoice #12345"
   - GOOD: "Look for the invoice number in the header"

5. **Learn from failures**
   - If AI returned wrong value, add explicit disambiguation guidance
   - If AI returned nothing, add more synonym phrases to search for
   - If AI returned wrong format, specify exact format requirements

## PROMPT STRUCTURE TEMPLATE

"Search for [FIELD] in [SPECIFIC LOCATIONS]. Look for phrases like: '[SYNONYM1]', '[SYNONYM2]', '[SYNONYM3]', '[SYNONYM4]', '[SYNONYM5]', '[SYNONYM6]'. [DISAMBIGUATION - what NOT to confuse with]. Return [EXACT FORMAT SPECIFICATION]. Return 'Not Present' if not found."

## EXAMPLE: INVOICE FIELD

Field: Total Amount Due
Prompt: "Search for the final amount due in the totals section at the bottom of the invoice. Look for: 'Amount Due', 'Total Due', 'Balance Due', 'Grand Total', 'Invoice Total', 'Total Amount', 'Please Pay'. This is the final amount AFTER tax and shipping. Do NOT return the subtotal (before tax) or individual line item amounts. Return the EXACT numeric value with cents (e.g., '1234.56'). Do NOT round. Return 'Not Present' if no total is found."

## YOUR OUTPUT FORMAT

Respond with ONLY valid JSON:
{"newPrompt": "your detailed 350-550 character prompt here", "reasoning": "brief explanation of your approach"}

NO markdown, NO code blocks, NO extra text. Just the JSON object.`;

const PRESET_COI_INSTRUCTIONS = `You are an EXPERT prompt engineer specializing in CERTIFICATE OF INSURANCE (COI) extraction. Your ONLY job is to write DETAILED, SPECIFIC extraction prompts that achieve 100% accuracy on insurance certificates and coverage verification documents.

## COMPANY CONFIGURATION
If this company has provided their company name/address below, use it for certificate holder identification:
- Company Name: [User provides in custom instructions]
- Company Address: [User provides in custom instructions]

The company above is typically the CERTIFICATE HOLDER requesting proof of insurance from vendors/contractors.

## CRITICAL RULES - VIOLATIONS WILL CAUSE EXTRACTION FAILURES

1. **NEVER write generic prompts** like "Extract the [field]" or "Find the [field] in this document"
   - These ALWAYS fail. They are BANNED.

2. **ALWAYS include these 5 elements** in EVERY prompt you write:
   - LOCATION: Specific sections to search (e.g., "Look in the 'Insured' box, coverage table, or 'Certificate Holder' section")
   - SYNONYMS: 6-8 alternative phrases (e.g., "Look for 'Policy Effective Date', 'Eff Date', 'Coverage Begins', 'Inception Date'")
   - FORMAT: Exact output format (e.g., "Return in YYYY-MM-DD format" or "Return the dollar amount without commas like '1000000'")
   - DISAMBIGUATION: Clarify what NOT to confuse (e.g., "Do NOT confuse General Liability limits with Auto Liability limits")
   - NOT FOUND: How to handle missing data (e.g., "Return 'Not Present' if no value is found")

3. **Target prompt length: 350-550 characters**
   - Under 300 chars = too vague, will fail on edge cases
   - 350-550 chars = optimal balance of detail and clarity
   - Over 650 chars = too verbose, simplify

4. **NEVER hard-code specific values** from example documents
   - BAD: "Look for policy #ABC123"
   - GOOD: "Look for the policy number in the coverage row"

5. **Learn from failures**
   - If AI returned wrong value, add explicit disambiguation guidance
   - If AI returned nothing, add more synonym phrases to search for
   - If AI returned wrong format, specify exact format requirements

## PROMPT STRUCTURE TEMPLATE

"Search for [FIELD] in [SPECIFIC LOCATIONS]. Look for phrases like: '[SYNONYM1]', '[SYNONYM2]', '[SYNONYM3]', '[SYNONYM4]', '[SYNONYM5]', '[SYNONYM6]'. [DISAMBIGUATION - what NOT to confuse with]. Return [EXACT FORMAT SPECIFICATION]. Return 'Not Present' if not found."

## EXAMPLE: COI FIELD

Field: General Liability Each Occurrence Limit
Prompt: "Search for the General Liability 'Each Occurrence' limit in the coverage table. Look in the row labeled 'Commercial General Liability' or 'CGL'. Look for: 'Each Occurrence', 'Per Occurrence', 'Occurrence Limit', 'Each Claim', 'Per Claim', 'Occ'. Do NOT confuse with 'General Aggregate' (total annual limit) or 'Products/Completed Ops' limits. Return the dollar amount as a number without commas or dollar signs (e.g., '1000000' not '$1,000,000'). Return 'Not Present' if no occurrence limit is found."

## YOUR OUTPUT FORMAT

Respond with ONLY valid JSON:
{"newPrompt": "your detailed 350-550 character prompt here", "reasoning": "brief explanation of your approach"}

NO markdown, NO code blocks, NO extra text. Just the JSON object.`;

// Create preset versions for document types (available to both Agent and Prompt Studio)
function createContractsPresetVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: PRESET_CONTRACTS_ID,
    name: 'Contracts',
    type: 'agent-alpha',
    generateInstructions: PRESET_CONTRACTS_INSTRUCTIONS,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createInvoicesPresetVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: PRESET_INVOICES_ID,
    name: 'Invoices',
    type: 'agent-alpha',
    generateInstructions: PRESET_INVOICES_INSTRUCTIONS,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createCOIPresetVersion(): SystemPromptVersion {
  const now = new Date().toISOString();
  return {
    id: PRESET_COI_ID,
    name: 'Certificates of Insurance',
    type: 'agent-alpha',
    generateInstructions: PRESET_COI_INSTRUCTIONS,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

// Initialize store with default versions for both types
function getInitialStore(): SystemPromptStore {
  return {
    activePromptStudioVersionId: DEFAULT_PROMPT_STUDIO_VERSION_ID,
    activeAgentVersionId: DEFAULT_AGENT_VERSION_ID,
    versions: [
      createDefaultPromptStudioVersion(), 
      createDefaultAgentVersion(),
      // Document-type presets
      createContractsPresetVersion(),
      createInvoicesPresetVersion(),
      createCOIPresetVersion(),
    ],
  };
}

// Migrate old storage format to new format
function migrateStore(store: any): SystemPromptStore {
  let needsSave = false;
  
  // Check if it's the old format (has activeVersionId instead of type-specific IDs)
  if ('activeVersionId' in store && !('activePromptStudioVersionId' in store)) {
    logger.info('Migrating system prompt store from old format (activeVersionId)');
    
    // Migrate versions to include type
    store.versions = store.versions.map((v: any) => ({
      ...v,
      type: 'prompt-studio' as SystemPromptType,
      id: v.id === 'default' ? DEFAULT_PROMPT_STUDIO_VERSION_ID : v.id,
    }));
    
    store.activePromptStudioVersionId = store.activeVersionId === 'default' ? DEFAULT_PROMPT_STUDIO_VERSION_ID : store.activeVersionId;
    store.activeAgentVersionId = DEFAULT_AGENT_VERSION_ID;
    delete store.activeVersionId;
    needsSave = true;
  }
  
  // Migrate agentInstructions and generatePrompt to generateInstructions
  if (store.versions) {
    store.versions = store.versions.map((v: any) => {
      let migrated = { ...v };
      
      // Migrate agentInstructions to generateInstructions
      if (v.agentInstructions && !v.generateInstructions) {
        migrated.generateInstructions = v.agentInstructions;
        delete migrated.agentInstructions;
        needsSave = true;
        logger.info(`Migrated agentInstructions to generateInstructions for version: ${v.name}`);
      }
      
      // Migrate generatePrompt to generateInstructions (if no generateInstructions already)
      if (v.generatePrompt && !v.generateInstructions) {
        migrated.generateInstructions = v.generatePrompt;
        delete migrated.generatePrompt;
        needsSave = true;
        logger.info(`Migrated generatePrompt to generateInstructions for version: ${v.name}`);
      }
      
      // Ensure Default versions use the detailed DEFAULT_PROMPT_GENERATION_INSTRUCTIONS
      // This fixes old cached defaults that had the simpler SYSTEM_MESSAGES.GENERATE
      if (v.isDefault && v.generateInstructions && !v.generateInstructions.includes('CRITICAL RULES')) {
        migrated.generateInstructions = DEFAULT_PROMPT_GENERATION_INSTRUCTIONS;
        migrated.improvePrompt = SYSTEM_MESSAGES.IMPROVE;
        needsSave = true;
        logger.info(`Updated Default version to use detailed instructions: ${v.name}`);
      }
      
      return migrated;
    });
  }
  
  // Add default agent version if not present
  const hasAgentDefault = store.versions?.some((v: any) => v.type === 'agent-alpha' && v.isDefault);
  if (!hasAgentDefault) {
    store.versions = store.versions || [];
    store.versions.push(createDefaultAgentVersion());
    needsSave = true;
  }
  
  if (needsSave) {
    logger.info('System prompt store migration completed');
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
      
      // Ensure preset versions exist (add if missing)
      const hasContractsPreset = parsed.versions.some(
        (v: SystemPromptVersion) => v.id === PRESET_CONTRACTS_ID
      );
      if (!hasContractsPreset) {
        parsed.versions.push(createContractsPresetVersion());
      }
      
      const hasInvoicesPreset = parsed.versions.some(
        (v: SystemPromptVersion) => v.id === PRESET_INVOICES_ID
      );
      if (!hasInvoicesPreset) {
        parsed.versions.push(createInvoicesPresetVersion());
      }
      
      const hasCOIPreset = parsed.versions.some(
        (v: SystemPromptVersion) => v.id === PRESET_COI_ID
      );
      if (!hasCOIPreset) {
        parsed.versions.push(createCOIPresetVersion());
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
 * Note: Now returns any version type since generate instructions are shared
 */
export function getActiveSystemPrompt(): SystemPromptVersion {
  const store = getSystemPromptStore();
  const active = store.versions.find(v => v.id === store.activePromptStudioVersionId);
  
  // Fallback to default if active version not found
  if (!active) {
    const defaultVersion = store.versions.find(v => v.id === DEFAULT_PROMPT_STUDIO_VERSION_ID);
    return defaultVersion || createDefaultPromptStudioVersion();
  }
  
  // Ensure generateInstructions is populated from legacy fields if needed
  if (!active.generateInstructions) {
    if (active.agentInstructions) {
      active.generateInstructions = active.agentInstructions;
    } else if (active.generatePrompt) {
      active.generateInstructions = active.generatePrompt;
    }
  }
  
  return active;
}

/**
 * Set the active Prompt Studio system prompt version by ID
 * Also syncs with Agent Alpha to keep both using the same generate instructions
 */
export function setActiveSystemPrompt(versionId: string): boolean {
  const store = getSystemPromptStore();
  const version = store.versions.find(v => v.id === versionId);
  
  if (!version) {
    logger.warn('Attempted to set active Prompt Studio system prompt to non-existent version', { versionId });
    return false;
  }
  
  // Set both active IDs to sync Agent and Prompt Studio
  store.activePromptStudioVersionId = versionId;
  store.activeAgentVersionId = versionId;
  saveSystemPromptStore(store);
  
  logger.info('Active system prompt changed (synced Agent and Prompt Studio)', { versionId, name: version.name });
  return true;
}

/**
 * Create a new Prompt Studio system prompt version
 * Note: Uses generateInstructions (shared with Agent) and improvePrompt (Prompt Studio only)
 */
export function createSystemPromptVersion(
  name: string,
  generateInstructions: string,
  improvePrompt: string
): SystemPromptVersion {
  const store = getSystemPromptStore();
  const now = new Date().toISOString();
  
  const newVersion: SystemPromptVersion = {
    id: uuidv4(),
    name,
    type: 'prompt-studio',
    generateInstructions,
    improvePrompt,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  
  store.versions.push(newVersion);
  saveSystemPromptStore(store);
  
  logger.info('Created new system prompt version', { id: newVersion.id, name });
  return newVersion;
}

/**
 * Update an existing system prompt version (works for any type)
 * Note: Uses generateInstructions (shared with Agent) and improvePrompt (Prompt Studio only)
 */
export function updateSystemPromptVersion(
  id: string,
  updates: Partial<Pick<SystemPromptVersion, 'name' | 'generateInstructions' | 'improvePrompt'>>
): SystemPromptVersion | null {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id);
  
  if (versionIndex === -1) {
    logger.warn('Attempted to update non-existent system prompt version', { id });
    return null;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow updating the default version
  if (version.isDefault) {
    logger.warn('Attempted to update default system prompt version', { id });
    return null;
  }
  
  const updatedVersion: SystemPromptVersion = {
    ...version,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  store.versions[versionIndex] = updatedVersion;
  saveSystemPromptStore(store);
  
  logger.info('Updated system prompt version', { id, name: updatedVersion.name });
  return updatedVersion;
}

/**
 * Delete a system prompt version (works for any type)
 */
export function deleteSystemPromptVersion(id: string): boolean {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id);
  
  if (versionIndex === -1) {
    logger.warn('Attempted to delete non-existent system prompt version', { id });
    return false;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow deleting the default version
  if (version.isDefault) {
    logger.warn('Attempted to delete default system prompt version', { id });
    return false;
  }
  
  // If deleting the active version, switch to default (for both)
  if (store.activePromptStudioVersionId === id) {
    store.activePromptStudioVersionId = DEFAULT_PROMPT_STUDIO_VERSION_ID;
  }
  if (store.activeAgentVersionId === id) {
    store.activeAgentVersionId = DEFAULT_AGENT_VERSION_ID;
  }
  
  store.versions.splice(versionIndex, 1);
  saveSystemPromptStore(store);
  
  logger.info('Deleted system prompt version', { id, name: version.name });
  return true;
}

/**
 * Get all system prompt versions (available to both Prompt Studio and Agent)
 * Note: Returns deduplicated versions - when names conflict, prefers agent-alpha type
 * (which has more detailed instructions)
 */
export function getAllSystemPromptVersions(): SystemPromptVersion[] {
  const store = getSystemPromptStore();
  
  // Ensure generateInstructions is populated from legacy fields
  const versionsWithInstructions = store.versions.map(v => {
    if (!v.generateInstructions) {
      if (v.agentInstructions) {
        v.generateInstructions = v.agentInstructions;
      } else if (v.generatePrompt) {
        v.generateInstructions = v.generatePrompt;
      }
    }
    return v;
  });
  
  // Deduplicate by name, merging fields from both types
  // Agent-alpha has better generateInstructions, prompt-studio has improvePrompt
  const versionsByName = new Map<string, SystemPromptVersion>();
  for (const v of versionsWithInstructions) {
    const existing = versionsByName.get(v.name);
    if (!existing) {
      versionsByName.set(v.name, v);
    } else {
      // Merge: prefer agent-alpha's generateInstructions, but keep prompt-studio's improvePrompt
      const merged: SystemPromptVersion = {
        ...existing,
        // Take generateInstructions from agent-alpha if available
        generateInstructions: (v.type === 'agent-alpha' ? v.generateInstructions : existing.generateInstructions) || existing.generateInstructions || v.generateInstructions,
        // Keep improvePrompt from whichever has it
        improvePrompt: existing.improvePrompt || v.improvePrompt,
        // Prefer agent-alpha type for the merged version
        type: existing.type === 'agent-alpha' || v.type === 'agent-alpha' ? 'agent-alpha' : existing.type,
      };
      versionsByName.set(v.name, merged);
    }
  }
  
  // Ensure ALL versions have improvePrompt (use default if not set)
  // This is needed for Prompt Studio which uses improvePrompt for the "Improve Prompt" feature
  const result = Array.from(versionsByName.values()).map(v => ({
    ...v,
    improvePrompt: v.improvePrompt || SYSTEM_MESSAGES.IMPROVE,
  }));
  
  return result;
}

/**
 * Reset to default system prompt (syncs both Agent and Prompt Studio)
 */
export function resetToDefaultSystemPrompt(): void {
  const store = getSystemPromptStore();
  store.activePromptStudioVersionId = DEFAULT_PROMPT_STUDIO_VERSION_ID;
  store.activeAgentVersionId = DEFAULT_PROMPT_STUDIO_VERSION_ID; // Sync to same default
  saveSystemPromptStore(store);
  
  logger.info('Reset to default system prompt (synced Agent and Prompt Studio)');
}

// ============================================================================
// AGENT ALPHA FUNCTIONS
// ============================================================================

/**
 * Get the currently active Agent Alpha system prompt version
 * Note: Now returns any version type since generate instructions are shared
 */
export function getActiveAgentSystemPrompt(): SystemPromptVersion {
  const store = getSystemPromptStore();
  const active = store.versions.find(v => v.id === store.activeAgentVersionId);
  
  // Fallback to default if active version not found
  if (!active) {
    const defaultVersion = store.versions.find(v => v.id === DEFAULT_AGENT_VERSION_ID);
    return defaultVersion || createDefaultAgentVersion();
  }
  
  // Ensure generateInstructions is populated from legacy fields if needed
  if (!active.generateInstructions) {
    if (active.agentInstructions) {
      active.generateInstructions = active.agentInstructions;
    } else if (active.generatePrompt) {
      active.generateInstructions = active.generatePrompt;
    }
  }
  
  return active;
}

/**
 * Set the active Agent Alpha system prompt version by ID
 * Also syncs with Prompt Studio to keep both using the same generate instructions
 */
export function setActiveAgentSystemPrompt(versionId: string): boolean {
  const store = getSystemPromptStore();
  const version = store.versions.find(v => v.id === versionId);
  
  if (!version) {
    logger.warn('Attempted to set active Agent system prompt to non-existent version', { versionId });
    return false;
  }
  
  // Set both active IDs to sync Agent and Prompt Studio
  store.activeAgentVersionId = versionId;
  store.activePromptStudioVersionId = versionId;
  saveSystemPromptStore(store);
  
  logger.info('Active system prompt changed (synced Agent and Prompt Studio)', { versionId, name: version.name });
  return true;
}

/**
 * Create a new system prompt version (available to both Agent and Prompt Studio)
 */
export function createAgentSystemPromptVersion(
  name: string,
  generateInstructions: string
): SystemPromptVersion {
  const store = getSystemPromptStore();
  const now = new Date().toISOString();
  
  const newVersion: SystemPromptVersion = {
    id: uuidv4(),
    name,
    type: 'agent-alpha', // Type is kept for backward compatibility but both types use generateInstructions
    generateInstructions,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  
  store.versions.push(newVersion);
  saveSystemPromptStore(store);
  
  logger.info('Created new system prompt version', { id: newVersion.id, name });
  return newVersion;
}

/**
 * Update an existing system prompt version (works for any type)
 */
export function updateAgentSystemPromptVersion(
  id: string,
  updates: Partial<Pick<SystemPromptVersion, 'name' | 'generateInstructions'>>
): SystemPromptVersion | null {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id);
  
  if (versionIndex === -1) {
    logger.warn('Attempted to update non-existent system prompt version', { id });
    return null;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow updating the default version
  if (version.isDefault) {
    logger.warn('Attempted to update default system prompt version', { id });
    return null;
  }
  
  const updatedVersion: SystemPromptVersion = {
    ...version,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  store.versions[versionIndex] = updatedVersion;
  saveSystemPromptStore(store);
  
  logger.info('Updated system prompt version', { id, name: updatedVersion.name });
  return updatedVersion;
}

/**
 * Delete a system prompt version (works for any type)
 */
export function deleteAgentSystemPromptVersion(id: string): boolean {
  const store = getSystemPromptStore();
  const versionIndex = store.versions.findIndex(v => v.id === id);
  
  if (versionIndex === -1) {
    logger.warn('Attempted to delete non-existent system prompt version', { id });
    return false;
  }
  
  const version = store.versions[versionIndex];
  
  // Don't allow deleting the default version
  if (version.isDefault) {
    logger.warn('Attempted to delete default system prompt version', { id });
    return false;
  }
  
  // If deleting the active version, switch to default (for both)
  if (store.activeAgentVersionId === id) {
    store.activeAgentVersionId = DEFAULT_AGENT_VERSION_ID;
  }
  if (store.activePromptStudioVersionId === id) {
    store.activePromptStudioVersionId = DEFAULT_PROMPT_STUDIO_VERSION_ID;
  }
  
  store.versions.splice(versionIndex, 1);
  saveSystemPromptStore(store);
  
  logger.info('Deleted system prompt version', { id, name: version.name });
  return true;
}

/**
 * Get all system prompt versions (available to both Agent and Prompt Studio)
 * Note: Returns deduplicated versions - when names conflict, prefers agent-alpha type
 * (which has more detailed instructions)
 */
export function getAllAgentSystemPromptVersions(): SystemPromptVersion[] {
  // Use the same logic as getAllSystemPromptVersions for consistency
  return getAllSystemPromptVersions();
}

/**
 * Reset to default system prompt (syncs both Agent and Prompt Studio)
 */
export function resetToDefaultAgentSystemPrompt(): void {
  const store = getSystemPromptStore();
  store.activeAgentVersionId = DEFAULT_AGENT_VERSION_ID;
  store.activePromptStudioVersionId = DEFAULT_AGENT_VERSION_ID; // Sync to same default
  saveSystemPromptStore(store);
  
  logger.info('Reset to default system prompt (synced Agent and Prompt Studio)');
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
