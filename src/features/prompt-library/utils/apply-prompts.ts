/**
 * Utility functions for pushing prompts from the Prompt Library to Prompt Studio
 */

import type { Template, Field, Prompt } from '../types';
import type { BoxTemplate, BoxTemplateField, PromptVersion } from '@/lib/types';
import { getConfiguredTemplates } from '@/lib/mock-data';
import { saveFieldPrompt, getFieldPrompt } from '@/lib/prompt-storage';
import { logger } from '@/lib/logger';

export interface FieldMatch {
  libraryField: Field;
  boxField: BoxTemplateField;
  selectedPrompt: Prompt;
  status: 'matched' | 'no-prompt';
}

export interface UnmatchedField {
  field: Field;
  reason: 'no-match-in-box' | 'no-prompts';
}

export interface PushPromptsResult {
  success: boolean;
  matchedTemplate: BoxTemplate | null;
  fieldMatches: FieldMatch[];
  unmatchedFields: UnmatchedField[];
  pushedCount: number;
  errorMessage?: string;
}

/**
 * Normalize a field name for comparison
 * Handles variations like "Counter Party Name" vs "counterPartyName"
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\-\s]+/g, '') // Remove underscores, hyphens, spaces
    .trim();
}

/**
 * Find a configured Box template that matches the Library template by name
 */
export function findMatchingBoxTemplate(libraryTemplate: Template): BoxTemplate | null {
  const configuredTemplates = getConfiguredTemplates();
  
  // Try exact match first
  let match = configuredTemplates.find(
    t => t.displayName.toLowerCase() === libraryTemplate.name.toLowerCase()
  );
  
  if (match) {
    return match;
  }
  
  // Try normalized match
  const normalizedLibraryName = normalizeFieldName(libraryTemplate.name);
  match = configuredTemplates.find(
    t => normalizeFieldName(t.displayName) === normalizedLibraryName
  );
  
  return match || null;
}

/**
 * Get the best prompt from a field (pinned > highest rated > most recent)
 */
export function getBestPrompt(field: Field): Prompt | null {
  if (!field.prompts || field.prompts.length === 0) {
    return null;
  }
  
  // 1. Check for pinned prompt
  const pinnedPrompt = field.prompts.find(p => p.isPinned);
  if (pinnedPrompt) {
    return pinnedPrompt;
  }
  
  // 2. Find highest rated (up - down score)
  const sortedByRating = [...field.prompts].sort((a, b) => {
    const scoreA = (a.up || 0) - (a.down || 0);
    const scoreB = (b.up || 0) - (b.down || 0);
    return scoreB - scoreA;
  });
  
  // If top prompt has positive score, use it
  const topRated = sortedByRating[0];
  if ((topRated.up || 0) - (topRated.down || 0) > 0) {
    return topRated;
  }
  
  // 3. Fall back to most recent
  const sortedByDate = [...field.prompts].sort((a, b) => b.createdAt - a.createdAt);
  return sortedByDate[0];
}

/**
 * Match Library fields to Box template fields
 */
export function matchFields(
  libraryTemplate: Template,
  boxTemplate: BoxTemplate
): { matches: FieldMatch[]; unmatched: UnmatchedField[] } {
  const matches: FieldMatch[] = [];
  const unmatched: UnmatchedField[] = [];
  
  // Create a map of normalized Box field names to fields
  const boxFieldMap = new Map<string, BoxTemplateField>();
  for (const field of boxTemplate.fields) {
    const normalizedName = normalizeFieldName(field.displayName);
    boxFieldMap.set(normalizedName, field);
    
    // Also add by key if different
    const normalizedKey = normalizeFieldName(field.key);
    if (normalizedKey !== normalizedName) {
      boxFieldMap.set(normalizedKey, field);
    }
  }
  
  // Match each Library field
  for (const libraryField of libraryTemplate.fields) {
    const normalizedName = normalizeFieldName(libraryField.name);
    const boxField = boxFieldMap.get(normalizedName);
    
    if (!boxField) {
      unmatched.push({
        field: libraryField,
        reason: 'no-match-in-box',
      });
      continue;
    }
    
    const bestPrompt = getBestPrompt(libraryField);
    if (!bestPrompt) {
      unmatched.push({
        field: libraryField,
        reason: 'no-prompts',
      });
      continue;
    }
    
    matches.push({
      libraryField,
      boxField,
      selectedPrompt: bestPrompt,
      status: 'matched',
    });
  }
  
  return { matches, unmatched };
}

/**
 * Push prompts from Library template to Prompt Studio (Box template)
 */
export function pushPromptsToPromptStudio(
  libraryTemplate: Template,
  boxTemplate: BoxTemplate,
  fieldMatches: FieldMatch[]
): { pushedCount: number; errors: string[] } {
  const errors: string[] = [];
  let pushedCount = 0;
  
  for (const match of fieldMatches) {
    try {
      const timestamp = new Date().toISOString();
      
      // Get existing prompt data for this field
      const existingData = getFieldPrompt(match.boxField.key);
      const existingHistory: PromptVersion[] = existingData?.promptHistory || [];
      
      // Create new prompt version
      const newVersion: PromptVersion = {
        id: `library-${timestamp}-${match.libraryField.id}`,
        prompt: match.selectedPrompt.text,
        savedAt: timestamp,
        source: 'imported' as const,
        generationMethod: 'standard' as const,
        note: `Pushed from Library: ${libraryTemplate.name} / ${match.libraryField.name}`,
      };
      
      // Combine history (new version first)
      const newHistory = [newVersion, ...existingHistory];
      
      // Save using the field key
      saveFieldPrompt(
        match.boxField.key,
        match.selectedPrompt.text,
        newHistory,
        boxTemplate.templateKey
      );
      
      pushedCount++;
      logger.info(`Pushed prompt for field: ${match.boxField.displayName}`, {
        libraryField: match.libraryField.name,
        boxField: match.boxField.key,
        promptLength: match.selectedPrompt.text.length,
      });
    } catch (error) {
      const errorMsg = `Failed to push prompt for ${match.libraryField.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error(errorMsg, error instanceof Error ? error : { error });
    }
  }
  
  return { pushedCount, errors };
}

/**
 * Main function to analyze and optionally push prompts
 * Call with dryRun=true to just get the preview, dryRun=false to actually push
 */
export function analyzeAndPushPrompts(
  libraryTemplate: Template,
  dryRun: boolean = true
): PushPromptsResult {
  // Find matching Box template
  const boxTemplate = findMatchingBoxTemplate(libraryTemplate);
  
  if (!boxTemplate) {
    return {
      success: false,
      matchedTemplate: null,
      fieldMatches: [],
      unmatchedFields: libraryTemplate.fields.map(f => ({
        field: f,
        reason: 'no-match-in-box' as const,
      })),
      pushedCount: 0,
      errorMessage: `No matching template found in Prompt Studio. Make sure you have a template named "${libraryTemplate.name}" configured.`,
    };
  }
  
  // Match fields
  const { matches, unmatched } = matchFields(libraryTemplate, boxTemplate);
  
  if (matches.length === 0) {
    return {
      success: false,
      matchedTemplate: boxTemplate,
      fieldMatches: [],
      unmatchedFields: unmatched,
      pushedCount: 0,
      errorMessage: 'No fields could be matched between the Library template and the Box template.',
    };
  }
  
  // If dry run, just return the preview
  if (dryRun) {
    return {
      success: true,
      matchedTemplate: boxTemplate,
      fieldMatches: matches,
      unmatchedFields: unmatched,
      pushedCount: 0, // Not pushed yet
    };
  }
  
  // Actually push the prompts
  const { pushedCount, errors } = pushPromptsToPromptStudio(libraryTemplate, boxTemplate, matches);
  
  return {
    success: errors.length === 0,
    matchedTemplate: boxTemplate,
    fieldMatches: matches,
    unmatchedFields: unmatched,
    pushedCount,
    errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

