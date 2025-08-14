/**
 * Custom hook for managing ground truth data population
 * Handles auto-population from premium model results when no ground truth exists
 */

import { useToast } from '@/hooks/use-toast';
import { formatModelName, NOT_PRESENT_VALUE } from '@/lib/utils';
import { useGroundTruth } from './use-ground-truth';
import { 
  getGroundTruthData, 
  saveGroundTruthForFile 
} from '@/lib/mock-data';
import type { 
  AccuracyData, 
  ApiExtractionResult 
} from '@/lib/types';

interface UseGroundTruthPopulatorReturn {
  // Actions
  autoPopulateGroundTruth: (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ) => Promise<boolean>;
}

// Premium model identifier
const PREMIUM_MODEL = 'enhanced_extract_agent';

// Toast Messages
const TOAST_MESSAGES = {
  GROUND_TRUTH_AUTO_POPULATED: {
    title: 'Ground Truth Auto-Populated',
    description: (modelName: string) => 
      `Ground truth has been automatically populated from ${modelName} results. Review and validate on the Ground Truth page.`
  }
} as const;

export const useGroundTruthPopulator = (): UseGroundTruthPopulatorReturn => {
  const { toast } = useToast();
  const { saveGroundTruth, getGroundTruth } = useGroundTruth();

  const autoPopulateGroundTruth = async (
    accuracyData: AccuracyData,
    apiResults: ApiExtractionResult[]
  ): Promise<boolean> => {
    let groundTruthUpdated = false;
    
    for (const fileResult of accuracyData.results) {
      const currentGroundTruth = getGroundTruth(fileResult.id);
      
      // Check if this file already has ground truth data
      const hasAnyGroundTruth = Object.values(currentGroundTruth).some(value => 
        value && String(value).trim() !== ''
      );
      
      // Only auto-populate if no ground truth exists
      if (!hasAnyGroundTruth) {
        // Find premium model results for this file
        const premiumResults = apiResults.filter(result => 
          result.fileId === fileResult.id && 
          result.modelName === PREMIUM_MODEL && 
          result.success
        );
        
        if (premiumResults.length > 0) {
          const premiumResult = premiumResults[0];
          const extractedData = premiumResult.extractedMetadata as Record<string, any>;
          
          // Populate ground truth for each field using the unified system
          for (const field of accuracyData.fields) {
            const premiumValue = extractedData[field.key];
            let valueToSave: string;
            
            if (premiumValue !== undefined && premiumValue !== null && String(premiumValue).trim() !== '') {
              valueToSave = String(premiumValue);
            } else {
              valueToSave = NOT_PRESENT_VALUE;
            }
            
            // Use the unified ground truth system to save each field
            const success = await saveGroundTruth(fileResult.id, accuracyData.templateKey, field.key, valueToSave);
            if (success) {
              groundTruthUpdated = true;
            }
          }
        }
      }
    }
    
    // Show toast notification if any ground truth was updated
    if (groundTruthUpdated) {
      toast({
        title: TOAST_MESSAGES.GROUND_TRUTH_AUTO_POPULATED.title,
        description: TOAST_MESSAGES.GROUND_TRUTH_AUTO_POPULATED.description(formatModelName(PREMIUM_MODEL)),
      });
    }
    
    return groundTruthUpdated;
  };

  return {
    autoPopulateGroundTruth,
  };
}; 