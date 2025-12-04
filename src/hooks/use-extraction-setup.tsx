/**
 * Custom hook for template extraction setup
 * 
 * This hook handles the initial setup of template-based extraction including
 * template validation, data structure initialization, and state management.
 */

import { useToast } from '@/hooks/use-toast';
import { useGroundTruth } from '@/hooks/use-ground-truth';
import { logger } from '@/lib/logger';
import { 
  UI_LABELS, 
  TOAST_MESSAGES, 
  AVAILABLE_MODELS, 
  ALL_MODELS 
} from '@/lib/main-page-constants';
import { generateInitialPromptForField } from '@/lib/main-page-utils';
import { 
  associateFilesToTemplate,
  getAccuracyData
} from '@/lib/mock-data';
import { 
  getFieldPrompt, 
  migrateFromAccuracyData,
  restorePromptDataFromFiles 
} from '@/lib/prompt-storage';
import type { 
  BoxTemplate, 
  BoxFile, 
  AccuracyData, 
  FieldResult, 
  ModelAverages,
  PromptVersion
} from '@/lib/types';

interface UseExtractionSetupProps {
  setSelectedTemplate: (template: BoxTemplate) => void;
  setIsModalOpen: (open: boolean) => void;
  setAccuracyData: (data: AccuracyData) => void;
  setShownColumns: (columns: Record<string, boolean>) => void;
}

export const useExtractionSetup = ({
  setSelectedTemplate,
  setIsModalOpen,
  setAccuracyData,
  setShownColumns,
}: UseExtractionSetupProps) => {
  const { toast } = useToast();
  const { getGroundTruth } = useGroundTruth();

  /**
   * Handle AI model extraction setup for selected files and template
   * 
   * @param template - The template to use for extraction
   * @param selectedFiles - Array of files to process
   */
  const handleRunExtraction = async (template: BoxTemplate, selectedFiles: BoxFile[]) => {
    const activeFields = template.fields.filter(field => field.isActive);

    if (activeFields.length === 0) {
      toast({
        variant: TOAST_MESSAGES.NO_ACTIVE_FIELDS.variant,
        title: TOAST_MESSAGES.NO_ACTIVE_FIELDS.title,
        description: TOAST_MESSAGES.NO_ACTIVE_FIELDS.description(template.displayName),
      });
      return;
    }

    setSelectedTemplate(template);
    setIsModalOpen(false);
    
    // Associate files to template for compatibility with existing systems
    associateFilesToTemplate(selectedFiles.map(f => f.id), template.templateKey);

    logger.info('Loading ground truth data using unified system', { fileCount: selectedFiles.length });

    // 🔧 NEW: Load existing accuracy data and migrate to cross-template storage
    const existingAccuracyData = getAccuracyData();
    logger.debug('Existing accuracy data', { found: !!existingAccuracyData, templateKey: existingAccuracyData?.templateKey });
    logger.debug('Current template', { templateKey: template.templateKey });
    
    // 🆕 NEW: Ensure prompt data is restored from files
    await restorePromptDataFromFiles();
    
    // 🆕 NEW: Migrate existing prompts to cross-template storage
    if (existingAccuracyData) {
      const migratedCount = migrateFromAccuracyData(existingAccuracyData);
      if (migratedCount > 0) {
        logger.info('Migrated prompts to cross-template storage', { count: migratedCount });
      }
    }

    logger.info('Cross-template prompt storage initialized');

    const newAccuracyData: AccuracyData = {
      templateKey: template.templateKey,
      baseModel: AVAILABLE_MODELS[0],
      fields: activeFields.map((field) => {
        // 🆕 NEW: Get prompt data from cross-template storage
        const crossTemplatePromptData = getFieldPrompt(field.key);
        
        // Log enum field options for debugging
        if ((field.type === 'enum' || field.type === 'multiSelect') && field.options) {
          logger.info('Setting up enum/multiSelect field with options', {
            fieldKey: field.key,
            fieldType: field.type,
            optionCount: field.options.length,
            options: field.options.map(o => o.key).join(', ')
          });
        }
        
        if (crossTemplatePromptData && crossTemplatePromptData.promptHistory.length > 0) {
          // ✅ Use existing cross-template prompt data
          logger.debug('Loading prompt versions for field', { fieldKey: field.key, versionCount: crossTemplatePromptData.promptHistory.length });
          return {
            name: field.displayName,
            key: field.key,
            type: field.type,
            prompt: crossTemplatePromptData.activePrompt,
            promptHistory: crossTemplatePromptData.promptHistory,
            options: field.options // 🔧 FIXED: Persist enum options from template
          };
        } else {
          // 🔧 CHANGED: Create empty prompt for new fields - users can generate in prompt studio
          logger.debug('Creating empty prompt for new field', { fieldKey: field.key });
          return {
            name: field.displayName,
            key: field.key,
            type: field.type,
            prompt: "", // Empty prompt initially
            promptHistory: [], // No initial prompt history
            options: field.options // 🔧 FIXED: Persist enum options from template
          };
        }
      }),
      results: selectedFiles.map((file) => ({
        id: file.id,
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toUpperCase() ?? UI_LABELS.FILE_TYPE_DEFAULT,
        fields: activeFields.reduce(
          (acc, field) => {
            const initialFieldResult: FieldResult = {};
            ALL_MODELS.forEach(modelName => {
              if (modelName === UI_LABELS.GROUND_TRUTH) {
                // 🔧 FIXED: Use unified ground truth system instead of getGroundTruthData()
                const groundTruthData = getGroundTruth(file.id);
                const groundTruthValue = groundTruthData[field.key] ?? '';
                initialFieldResult[modelName] = groundTruthValue;
                logger.debug('Ground truth for file field', { fileId: file.id, fieldKey: field.key, hasValue: !!groundTruthValue });
              } else {
                initialFieldResult[modelName] = UI_LABELS.PENDING_STATUS;
              }
            });
            acc[field.key] = initialFieldResult;
            return acc;
          },
          {} as Record<string, FieldResult>
        ),
      })),
      averages: activeFields.reduce(
        (acc, field) => {
          const modelAvgs: ModelAverages = {};
          AVAILABLE_MODELS.forEach(modelName => {
            modelAvgs[modelName] = { accuracy: 0, precision: 0, recall: 0, f1: 0 };
          });
          acc[field.key] = modelAvgs;
          return acc;
        },
        {} as Record<string, ModelAverages>
      ),
    };
    
    // Show Ground Truth, Gemini 2.0 Flash, and Gemini 2.0 Flash (no prompt) by default when creating a new comparison
    const newShownColumns: Record<string, boolean> = {};
    ALL_MODELS.forEach(modelName => {
      if (modelName === UI_LABELS.GROUND_TRUTH || 
          modelName === 'google__gemini_2_0_flash_001' || 
          modelName === 'google__gemini_2_0_flash_001_no_prompt') {
        newShownColumns[modelName] = true;
      } else {
        newShownColumns[modelName] = false;
      }
    });
    
    setShownColumns(newShownColumns);
    setAccuracyData(newAccuracyData);
    
    logger.info('Accuracy data initialized with prompt version preservation');
  };

  return {
    handleRunExtraction,
  };
}; 