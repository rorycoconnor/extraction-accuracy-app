/**
 * Custom hook for simple UI state handlers
 * 
 * This hook contains handlers that primarily manage UI state without complex business logic.
 * These are the safest handlers to extract as they have minimal dependencies.
 */

import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { TOAST_MESSAGES } from '@/lib/main-page-constants';
import { clearAllGroundTruthData, saveAccuracyData } from '@/lib/mock-data';
import type { AccuracyField, AccuracyData, PromptVersion } from '@/lib/types';

interface UseUIHandlersProps {
  accuracyData: AccuracyData | null;
  setAccuracyData: (data: AccuracyData) => void;
  setSelectedFieldForPromptStudio: (field: AccuracyField) => void;
  setIsPromptStudioOpen: (open: boolean) => void;
  setShowResetDialog: (show: boolean) => void;
  clearResults: () => void;
}

export const useUIHandlers = ({
  accuracyData,
  setAccuracyData,
  setSelectedFieldForPromptStudio,
  setIsPromptStudioOpen,
  setShowResetDialog,
  clearResults,
}: UseUIHandlersProps) => {
  const { toast } = useToast();

  /**
   * Open prompt studio for a specific field
   * 
   * @param field - The accuracy field to edit prompts for
   */
  const handleOpenPromptStudio = (field: AccuracyField) => {
    setSelectedFieldForPromptStudio(field);
    setIsPromptStudioOpen(true);
  };

  /**
   * Toggle favorite status for a prompt version
   * 
   * @param fieldKey - The key of the field
   * @param versionId - The ID of the prompt version to toggle
   */
  const handleToggleFavorite = (fieldKey: string, versionId: string) => {
    if (!accuracyData) return;

    const newAccuracyData = JSON.parse(JSON.stringify(accuracyData));
    const fieldToUpdate = newAccuracyData.fields.find((f: AccuracyField) => f.key === fieldKey);
    
    if (!fieldToUpdate) return;

    const versionToUpdate = fieldToUpdate.promptHistory.find((v: PromptVersion) => v.id === versionId);
    if (!versionToUpdate) return;

    versionToUpdate.isFavorite = !versionToUpdate.isFavorite;
    
    // Update state and persist to localStorage/JSON
    setAccuracyData(newAccuracyData);
    saveAccuracyData(newAccuracyData);
    setSelectedFieldForPromptStudio(fieldToUpdate);
    
    logger.debug('Toggled favorite status', {
      fieldKey,
      versionId,
      isFavorite: versionToUpdate.isFavorite
    });
    
    toast({ 
      title: TOAST_MESSAGES.VERSION_FAVORITED.title(versionToUpdate.isFavorite), 
      description: TOAST_MESSAGES.VERSION_FAVORITED.description(versionToUpdate.id, versionToUpdate.isFavorite) 
    });
  };

  /**
   * Complete reset of all accuracy data and ground truth
   */
  const handleCompleteReset = () => {
    clearAllGroundTruthData();
    clearResults();
    setShowResetDialog(false);
    toast({
      title: TOAST_MESSAGES.ALL_DATA_RESET.title,
      description: TOAST_MESSAGES.ALL_DATA_RESET.description,
    });
  };

  return {
    handleOpenPromptStudio,
    handleToggleFavorite,
    handleCompleteReset,
  };
}; 