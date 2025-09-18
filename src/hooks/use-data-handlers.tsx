/**
 * Custom hook for data management handlers
 * 
 * This hook contains handlers that manage core data operations like ground truth editing
 * and prompt management. These handlers have more complex business logic than UI handlers
 * but are still self-contained.
 */

import { useToast } from '@/hooks/use-toast';
import { UI_LABELS, TOAST_MESSAGES } from '@/lib/main-page-constants';
import { useGroundTruth } from './use-ground-truth';
import { 
  getGroundTruthData, 
  saveGroundTruthForFile, 
  saveAccuracyData 
} from '@/lib/mock-data';
import { 
  saveFieldPrompt, 
  updateFieldActivePrompt,
  addPromptVersion 
} from '@/lib/prompt-storage';
import type { 
  AccuracyData, 
  AccuracyField, 
  BoxFile, 
  PromptVersion 
} from '@/lib/types';

interface UseDataHandlersProps {
  accuracyData: AccuracyData | null;
  setAccuracyData: (data: AccuracyData) => void;
  selectedCellForEdit: {
    file: BoxFile;
    field: AccuracyField;
    currentValue: string;
  } | null;
  setSelectedCellForEdit: (cell: {
    file: BoxFile;
    field: AccuracyField;
    currentValue: string;
  } | null) => void;
  setIsInlineEditorOpen: (open: boolean) => void;
  setSelectedFieldForPromptStudio: (field: AccuracyField) => void;
}

export const useDataHandlers = ({
  accuracyData,
  setAccuracyData,
  selectedCellForEdit,
  setSelectedCellForEdit,
  setIsInlineEditorOpen,
  setSelectedFieldForPromptStudio,
}: UseDataHandlersProps) => {
  const { toast } = useToast();
  const { saveGroundTruth, getGroundTruth } = useGroundTruth();

  /**
   * Open the inline editor for ground truth editing
   * 
   * @param fileId - The ID of the file to edit
   * @param fieldKey - The key of the field to edit
   */
  const handleOpenInlineEditor = (fileId: string, fieldKey: string) => {
    if (!accuracyData) return;
    
    const file = accuracyData.results.find(r => r.id === fileId);
    const field = accuracyData.fields.find(f => f.key === fieldKey);
    
    if (!file || !field) return;
    
    const currentValue = file.fields[fieldKey]?.[UI_LABELS.GROUND_TRUTH] || '';
    
    const boxFile: BoxFile = {
      id: fileId,
      name: file.fileName,
      type: 'file',
    };
    
    setSelectedCellForEdit({
      file: boxFile,
      field: field,
      currentValue: currentValue
    });
    setIsInlineEditorOpen(true);
  };

  /**
   * Save inline ground truth edits
   * 
   * @param fileId - The ID of the file being edited
   * @param fieldKey - The key of the field being edited
   * @param newValue - The new ground truth value
   */
  const handleSaveInlineGroundTruth = async (fileId: string, fieldKey: string, newValue: string) => {
    if (!accuracyData) return;
    
    const templateKey = accuracyData.templateKey;
    
    // Save through unified ground truth system
    const success = await saveGroundTruth(fileId, templateKey, fieldKey, newValue);
    
    if (success) {
      // Update component state to reflect the change with deep copying
      const updatedResults = accuracyData.results.map(result => {
        if (result.id === fileId) {
          // Deep copy the file result and its fields
          return {
            ...result,
            fields: {
              ...result.fields,
              [fieldKey]: {
                ...result.fields[fieldKey],
                [UI_LABELS.GROUND_TRUTH]: newValue
              }
            }
          };
        }
        return result;
      });
      
      const updatedAccuracyData = {
        ...accuracyData,
        results: updatedResults
      };
      
      console.log('💾 handleSaveInlineGroundTruth: Updated accuracy data for', fileId, fieldKey, newValue);
      
      setAccuracyData(updatedAccuracyData);
      saveAccuracyData(updatedAccuracyData);
      
      // Close the inline editor after successful save
      setIsInlineEditorOpen(false);
      setSelectedCellForEdit(null);
      
      toast({
        title: 'Ground Truth Updated',
        description: `Successfully updated ${fieldKey} for ${fileId}`,
      });
    }
  };

  /**
   * Update the prompt for a specific field and save the previous version to history
   * 
   * @param fieldKey - The key of the field to update
   * @param newPrompt - The new prompt text
   */
  const handleUpdatePrompt = (fieldKey: string, newPrompt: string) => {
    if (!accuracyData) return;

    const fieldInCurrentState = accuracyData.fields.find(f => f.key === fieldKey);
    if (!fieldInCurrentState) return;
    if (fieldInCurrentState.prompt === newPrompt) {
      toast({ 
        title: TOAST_MESSAGES.NO_CHANGES_DETECTED.title, 
        description: TOAST_MESSAGES.NO_CHANGES_DETECTED.description 
      });
      return;
    }
  
    const newAccuracyData = JSON.parse(JSON.stringify(accuracyData));
    const fieldToUpdate = newAccuracyData.fields.find((f: AccuracyField) => f.key === fieldKey)!;
  
    // 🔧 FIX: Don't capture metrics when saving prompt - only after running comparison
    // Metrics should only be added after a run comparison is completed with this specific prompt
    const newVersionNumber = fieldToUpdate.promptHistory.length + 1;
    fieldToUpdate.promptHistory.unshift({
      id: `${UI_LABELS.VERSION_PREFIX}${newVersionNumber}`,
      prompt: newPrompt,
      savedAt: new Date().toISOString(),
      metrics: undefined, // 🔧 No metrics until after running comparison
    });
    
    // Now update the active prompt to the new one
    fieldToUpdate.prompt = newPrompt;
  
    // Update state and persist to localStorage/JSON
    setAccuracyData(newAccuracyData);
    saveAccuracyData(newAccuracyData);
    
    // 🆕 NEW: Also save to cross-template prompt storage
    saveFieldPrompt(
      fieldKey,
      newPrompt,
      fieldToUpdate.promptHistory,
      accuracyData.templateKey
    );
    
    setSelectedFieldForPromptStudio(fieldToUpdate);
    
    console.log('✅ Prompt version saved to both systems without metrics:', {
      fieldKey,
      newPrompt: newPrompt.substring(0, 100) + '...',
      versionCount: fieldToUpdate.promptHistory.length,
      latestVersion: fieldToUpdate.promptHistory[0]?.id,
      note: 'Metrics will be added after running comparison'
    });
    
    toast({ 
      title: TOAST_MESSAGES.PROMPT_SAVED.title, 
      description: TOAST_MESSAGES.PROMPT_SAVED.description 
    });
  };

  /**
   * Switch to a different prompt version from history
   * 
   * @param fieldKey - The key of the field to update
   * @param promptVersion - The prompt version to switch to
   */
  const handleUsePromptVersion = (fieldKey: string, promptVersion: PromptVersion) => {
    if (!accuracyData) return;

    const fieldInCurrentState = accuracyData.fields.find(f => f.key === fieldKey);
    if (!fieldInCurrentState) return;

    if (fieldInCurrentState.prompt === promptVersion.prompt) {
      toast({ 
        title: TOAST_MESSAGES.ALREADY_ACTIVE.title, 
        description: TOAST_MESSAGES.ALREADY_ACTIVE.description 
      });
      return;
    }

    const newAccuracyData = JSON.parse(JSON.stringify(accuracyData));
    const fieldToUpdate = newAccuracyData.fields.find((f: AccuracyField) => f.key === fieldKey)!;

    fieldToUpdate.prompt = promptVersion.prompt;

    // Update state and persist to localStorage/JSON
    setAccuracyData(newAccuracyData);
    saveAccuracyData(newAccuracyData);
    
    // 🆕 NEW: Also update cross-template prompt storage
    updateFieldActivePrompt(fieldKey, promptVersion.prompt);
    
    setSelectedFieldForPromptStudio(fieldToUpdate);
    
    console.log('✅ Switched to prompt version in both systems:', {
      fieldKey,
      versionId: promptVersion.id,
      prompt: promptVersion.prompt.substring(0, 100) + '...'
    });
    
    toast({ 
      title: TOAST_MESSAGES.PROMPT_VERSION_CHANGED.title, 
      description: TOAST_MESSAGES.PROMPT_VERSION_CHANGED.description 
    });
  };

  /**
   * Delete a specific prompt version from history
   * 
   * @param fieldKey - The key of the field to update
   * @param versionId - The ID of the version to delete
   */
  const handleDeletePromptVersion = (fieldKey: string, versionId: string) => {
    if (!accuracyData) return;

    const fieldInCurrentState = accuracyData.fields.find(f => f.key === fieldKey);
    if (!fieldInCurrentState) return;

    // Don't allow deleting if it's the only version
    if (fieldInCurrentState.promptHistory.length <= 1) {
      toast({
        variant: "destructive",
        title: "Cannot Delete",
        description: "Cannot delete the last remaining prompt version."
      });
      return;
    }

    const newAccuracyData = JSON.parse(JSON.stringify(accuracyData));
    const fieldToUpdate = newAccuracyData.fields.find((f: AccuracyField) => f.key === fieldKey)!;

    // Find and remove the version
    const versionIndex = fieldToUpdate.promptHistory.findIndex(v => v.id === versionId);
    if (versionIndex === -1) return;

    const deletedVersion = fieldToUpdate.promptHistory[versionIndex];
    fieldToUpdate.promptHistory.splice(versionIndex, 1);

    // If the deleted version was the active prompt, switch to the most recent version
    if (fieldToUpdate.prompt === deletedVersion.prompt && fieldToUpdate.promptHistory.length > 0) {
      fieldToUpdate.prompt = fieldToUpdate.promptHistory[0].prompt;
      
      // Also update cross-template prompt storage
      updateFieldActivePrompt(fieldKey, fieldToUpdate.prompt);
      
      toast({
        title: "Active Prompt Changed",
        description: "The deleted version was active. Switched to the most recent version."
      });
    }

    // Update state and persist to localStorage/JSON
    setAccuracyData(newAccuracyData);
    saveAccuracyData(newAccuracyData);
    
    // Update cross-template prompt storage
    saveFieldPrompt(
      fieldKey,
      fieldToUpdate.prompt,
      fieldToUpdate.promptHistory,
      accuracyData.templateKey
    );
    
    setSelectedFieldForPromptStudio(fieldToUpdate);
    
    console.log('✅ Prompt version deleted:', {
      fieldKey,
      deletedVersionId: versionId,
      remainingVersions: fieldToUpdate.promptHistory.length
    });
  };

  /**
   * Update prompt version metrics after a run comparison is completed
   * This ensures metrics are only added after actually testing the prompt
   * 
   * @param accuracyData - The accuracy data with updated metrics
   */
  const updatePromptVersionMetrics = (updatedAccuracyData: AccuracyData) => {
    if (!accuracyData) return updatedAccuracyData;

    const newAccuracyData = JSON.parse(JSON.stringify(updatedAccuracyData));
    let hasUpdates = false;

    // Update metrics for each field's active prompt version
    newAccuracyData.fields.forEach((field: AccuracyField) => {
      if (field.promptHistory.length === 0) return;

      // Find the version that matches the current active prompt
      const currentVersionIndex = field.promptHistory.findIndex(
        (version: PromptVersion) => version.prompt === field.prompt
      );

      if (currentVersionIndex !== -1) {
        const currentVersion = field.promptHistory[currentVersionIndex];
        
        // Only update if this version doesn't have metrics yet
        if (!currentVersion.metrics) {
          const fieldMetrics = updatedAccuracyData.averages[field.key];
          
          if (fieldMetrics) {
            const modelNames = Object.keys(fieldMetrics).filter(name => name !== UI_LABELS.GROUND_TRUTH);
            if (modelNames.length > 0) {
              const modelMetrics: Record<string, { f1: number; accuracy: number; precision: number; recall: number; }> = {};
              
              modelNames.forEach(modelName => {
                const metrics = fieldMetrics[modelName] || { f1: 0, accuracy: 0, precision: 0, recall: 0 };
                modelMetrics[modelName] = {
                  f1: metrics.f1,
                  accuracy: metrics.accuracy,
                  precision: metrics.precision,
                  recall: metrics.recall,
                };
              });
              
              // Update the version with metrics
              field.promptHistory[currentVersionIndex] = {
                ...currentVersion,
                metrics: {
                  modelMetrics,
                  filesCount: updatedAccuracyData.results.length,
                  lastRunAt: new Date().toISOString(),
                }
              };
              
              hasUpdates = true;
              console.log(`✅ Updated metrics for prompt version ${currentVersion.id} in field ${field.key}`);
            }
          }
        }
      }
    });

    if (hasUpdates) {
      console.log('✅ Prompt version metrics updated after run comparison');
    }

    return newAccuracyData;
  };

  return {
    handleOpenInlineEditor,
    handleSaveInlineGroundTruth,
    handleUpdatePrompt,
    handleUsePromptVersion,
    handleDeletePromptVersion,
    updatePromptVersionMetrics,
  };
}; 