import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGroundTruth } from './use-ground-truth';
import { 
  getAccuracyData, 
  saveAccuracyData, 
  getConfiguredTemplates,
  getGroundTruthData
} from '@/lib/mock-data';
import { calculateFieldMetricsWithDebug } from '@/lib/metrics';
import type { AccuracyData, AccuracyField, BoxTemplate, BoxFile, FieldResult, ModelAverages } from '@/lib/types';
import { logger } from '@/lib/logger';

// Import centralized model constants
import { AVAILABLE_MODELS, ALL_MODELS, UI_LABELS } from '@/lib/main-page-constants';

function generateInitialPromptForField(field: any): string {
  return `Extract the ${field.displayName} from this document. Return only the exact value without any additional text or formatting.`;
}

export function useAccuracyData() {
  const [accuracyData, setAccuracyData] = useState<AccuracyData | null>(null);
  const [configuredTemplates, setConfiguredTemplates] = useState<BoxTemplate[]>([]);
  const [shownColumns, setShownColumns] = useState<Record<string, boolean>>({});
  // Remove showMetrics state - it will be computed automatically
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const { groundTruthData, getGroundTruth } = useGroundTruth();
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [apiDebugData, setApiDebugData] = useState<any>(null);
  const [apiRequestDebugData, setApiRequestDebugData] = useState<any>(null);
  const runIdRef = useRef(0);
  const { toast } = useToast();

  // Function to refresh template data only
  const refreshTemplatesOnly = useCallback(() => {
    const newConfiguredTemplates = getConfiguredTemplates();
    setConfiguredTemplates(newConfiguredTemplates);
  }, []);

  // Function to sync accuracy data with template changes
  const syncAccuracyDataWithTemplates = useCallback((newConfiguredTemplates: BoxTemplate[]) => {
    if (!accuracyData) return;
    
    const currentTemplate = newConfiguredTemplates.find(t => t.templateKey === accuracyData.templateKey);
    if (!currentTemplate) return;
    
    const activeFields = currentTemplate.fields.filter(f => f.isActive);
    const currentFields = accuracyData.fields;
    
    // Check if field activation status has changed
    const fieldChanges = {
      added: activeFields.filter(af => !currentFields.some(cf => cf.key === af.key)),
      removed: currentFields.filter(cf => !activeFields.some(af => af.key === cf.key)),
      unchanged: currentFields.filter(cf => activeFields.some(af => af.key === cf.key))
    };
    
    if (fieldChanges.added.length > 0 || fieldChanges.removed.length > 0) {
      // Update accuracy data to reflect field changes
      const newAccuracyData: AccuracyData = {
        ...accuracyData,
        fields: [
          ...fieldChanges.unchanged,
          ...fieldChanges.added.map((field) => {
            // 🔧 CHANGED: Don't auto-generate prompts - let users generate them manually in prompt studio
            return {
              name: field.displayName,
              key: field.key,
              type: field.type,
              prompt: "", // Empty prompt initially
              promptHistory: [] // No initial prompt history
            }
          })
        ],
        results: accuracyData.results.map(fileResult => ({
          ...fileResult,
          fields: {
            ...Object.fromEntries(
              fieldChanges.unchanged.map(field => [
                field.key,
                fileResult.fields[field.key]
              ])
            ),
            ...Object.fromEntries(
              fieldChanges.added.map(field => {
                const initialFieldResult: FieldResult = {};
                const allGroundTruth = getGroundTruthData();
                                 ALL_MODELS.forEach((modelName: string) => {
                   if (modelName === 'Ground Truth') {
                     const groundTruthValue = allGroundTruth[fileResult.id]?.groundTruth?.[field.key] ?? '';
                     initialFieldResult[modelName] = groundTruthValue;
                   } else {
                     initialFieldResult[modelName] = 'Pending...';
                   }
                 });
                return [field.key, initialFieldResult];
              })
            )
          }
        })),
        averages: {
          ...accuracyData.averages,
          ...Object.fromEntries(
            fieldChanges.added.map(field => {
              const modelAvgs: ModelAverages = {};
              AVAILABLE_MODELS.forEach(modelName => {
                modelAvgs[modelName] = { accuracy: 0, precision: 0, recall: 0, f1: 0 };
              });
              return [field.key, modelAvgs];
            })
          )
        }
      };
      
      setAccuracyData(newAccuracyData);
      saveAccuracyData(newAccuracyData);
    }
  }, [accuracyData, getGroundTruth]);

  // Load accuracy data on mount (client-side only)
  useEffect(() => {
    // Extra SSR guard - only run on client
    if (typeof window === 'undefined') {
      logger.debug('useAccuracyData: Still on server, skipping load');
      return;
    }

    const savedAccuracyData = getAccuracyData();
    if (savedAccuracyData) {
      // 🔧 HYDRATION: Populate missing enum options from template
      let hydratedAccuracyData = savedAccuracyData;
      const configTemplates = getConfiguredTemplates();
      const matchingTemplate = configTemplates.find(t => t.templateKey === savedAccuracyData.templateKey);
      
      if (matchingTemplate) {
        const fieldsNeedingHydration = savedAccuracyData.fields.filter(field => 
          field.type === 'enum' && (!field.options || field.options.length === 0)
        );
        
        if (fieldsNeedingHydration.length > 0) {
          logger.info('useAccuracyData: Hydrating missing enum options', { 
            fields: fieldsNeedingHydration.map(f => f.key) 
          });
          
          hydratedAccuracyData = {
            ...savedAccuracyData,
            fields: savedAccuracyData.fields.map(field => {
              if (field.type === 'enum' && (!field.options || field.options.length === 0)) {
                const templateField = matchingTemplate.fields.find(tf => tf.key === field.key);
                if (templateField?.options && templateField.options.length > 0) {
                  logger.debug('useAccuracyData: Hydrated enum options', { 
                    fieldKey: field.key, 
                    optionCount: templateField.options.length 
                  });
                  return {
                    ...field,
                    options: templateField.options
                  };
                }
              }
              return field;
            })
          };
          
          // Save hydrated data back to storage
          saveAccuracyData(hydratedAccuracyData);
        }
      }
      
      setAccuracyData(hydratedAccuracyData);
      
      // Try to restore column visibility from localStorage
      const savedColumnVisibility = localStorage.getItem('shownColumns');
      if (savedColumnVisibility) {
        try {
          const parsedColumns = JSON.parse(savedColumnVisibility);
                     const newShownColumns: Record<string, boolean> = {};
           newShownColumns['Ground Truth'] = true;
           AVAILABLE_MODELS.forEach((model: string) => {
             newShownColumns[model] = parsedColumns[model] ?? false;
           });
          setShownColumns(newShownColumns);
        } catch (error) {
          logger.error('useAccuracyData: Failed to parse saved column visibility', error instanceof Error ? error : { error });
          const newShownColumns: Record<string, boolean> = {};
          newShownColumns['Ground Truth'] = true;
          AVAILABLE_MODELS.forEach((model: string) => {
            newShownColumns[model] = model === 'google__gemini_2_0_flash_001' || model === 'google__gemini_2_0_flash_001_no_prompt';
          });
          setShownColumns(newShownColumns);
        }
      } else {
        const newShownColumns: Record<string, boolean> = {};
        newShownColumns['Ground Truth'] = true;
        AVAILABLE_MODELS.forEach((model: string) => {
          newShownColumns[model] = model === 'google__gemini_2_0_flash_001' || model === 'google__gemini_2_0_flash_001_no_prompt';
        });
        setShownColumns(newShownColumns);
      }
    }
    
    refreshTemplatesOnly();
  }, [refreshTemplatesOnly]);

  // Sync accuracy data when templates change
  useEffect(() => {
    syncAccuracyDataWithTemplates(configuredTemplates);
  }, [configuredTemplates, syncAccuracyDataWithTemplates]);

  // Helper function to recalculate metrics for specific fields
  // NOTE: This is now only used for manual recalculation, not automatic
  const recalculateFieldMetrics = useCallback((data: AccuracyData, fieldsToRecalculate?: string[]): AccuracyData => {
    logger.debug('useAccuracyData: Manually recalculating metrics');
    const fieldsToUpdate = fieldsToRecalculate || data.fields.map(f => f.key);
    const newAverages: Record<string, ModelAverages> = { ...data.averages };
    
    // Create updated results array with fresh ground truth data
    const updatedResults = data.results.map(file => {
      const currentGroundTruth = getGroundTruth(file.id);
      const updatedFields = { ...file.fields };
      
      // Sync ground truth data with component state
      fieldsToUpdate.forEach(fieldKey => {
        if (!updatedFields[fieldKey]) {
          updatedFields[fieldKey] = {};
        }
        updatedFields[fieldKey]['Ground Truth'] = currentGroundTruth[fieldKey] || '';
      });
      
      return { ...file, fields: updatedFields };
    });
    
    fieldsToUpdate.forEach(fieldKey => {
      const field = data.fields.find(f => f.key === fieldKey);
      if (!field) return;
      
      const modelAvgs: ModelAverages = {};
      
      AVAILABLE_MODELS.forEach(modelName => {
        // Collect all predictions and ground truths for this field and model
        const predictions: string[] = [];
        const groundTruths: string[] = [];
        
        updatedResults.forEach(file => {
          // Use the synced ground truth data
          const groundTruth = file.fields[fieldKey]?.['Ground Truth'] ?? '';
          const modelOutput = file.fields[fieldKey]?.[modelName] ?? '';
          
          predictions.push(modelOutput);
          groundTruths.push(groundTruth);
        });
        
        // Calculate metrics using the debug version
        const result = calculateFieldMetricsWithDebug(predictions, groundTruths);
        
        // Store the metrics
        const metrics = {
          accuracy: result.accuracy,
          precision: result.precision,
          recall: result.recall,
          f1: result.f1Score
        };
        
        modelAvgs[modelName] = metrics;
      });
      
      newAverages[fieldKey] = modelAvgs;
    });
    
    logger.debug('useAccuracyData: Metrics recalculation complete');
    return { ...data, results: updatedResults, averages: newAverages };
  }, [getGroundTruth]);

  // DISABLED: This was causing averages to be overwritten after comparison runs
  // The comparison runner now handles all metric calculations and store updates
  // Ground truth syncing happens in the comparison runner's processExtractionResults
  // 
  // useEffect(() => {
  //   if (!accuracyData) return;
  //   logger.debug('useAccuracyData: Ground truth data changed, refreshing accuracy data');
  //   // ... (disabled to prevent overwriting fresh metrics from comparison runs)
  // }, [groundTruthData, accuracyData, getGroundTruth]);

  // Data operations
  const saveAccuracyDataState = useCallback((data: AccuracyData | null) => {
    setAccuracyData(data);
    saveAccuracyData(data);
  }, []);

  // Performance controls
  const openPerformanceModal = useCallback(() => {
    if (accuracyData) {
      // Automatically recalculate metrics using current ground truth data before opening modal
      const updatedData = recalculateFieldMetrics(accuracyData);
      saveAccuracyDataState(updatedData);
    }
    setIsPerformanceModalOpen(true);
  }, [accuracyData, recalculateFieldMetrics, saveAccuracyDataState]);

  const closePerformanceModal = useCallback(() => {
    setIsPerformanceModalOpen(false);
  }, []);

  // Column visibility
  const toggleColumn = useCallback((modelName: string, checked: boolean) => {
    setShownColumns(prev => ({
      ...prev,
      [modelName]: checked
    }));
  }, []);

  const setShownColumnsDirectly = useCallback((columns: Record<string, boolean>) => {
    setShownColumns(columns);
    localStorage.setItem('shownColumns', JSON.stringify(columns));
  }, []);

  // Data operations
  const clearResults = useCallback(() => {
    if (accuracyData) {
      // 🔧 FIX: Preserve custom prompts while clearing only extraction results
      const clearedData: AccuracyData = {
        ...accuracyData,
        results: [], // Clear extraction results
        averages: Object.fromEntries(
          accuracyData.fields.map(field => [
            field.key,
            Object.fromEntries(
              AVAILABLE_MODELS.map(modelName => [
                modelName,
                { accuracy: 0, precision: 0, recall: 0, f1: 0 }
              ])
            )
          ])
        ) // Reset averages but preserve structure
      };
      
      logger.info('useAccuracyData: Clearing results while preserving custom prompts', { 
        fieldCount: accuracyData.fields.length 
      });
      setAccuracyData(clearedData);
      saveAccuracyData(clearedData);
    } else {
      // If no accuracy data, just clear everything
      setAccuracyData(null);
      saveAccuracyData(null);
    }
    
    setShownColumns({});
    localStorage.removeItem('shownColumns');
    toast({
      title: 'Results cleared',
      description: 'All comparison results have been cleared.',
    });
  }, [accuracyData, toast]);

  return {
    // State
    accuracyData,
    configuredTemplates,
    shownColumns,
    isPerformanceModalOpen,
    isExtracting,
    progress,
    apiDebugData,
    apiRequestDebugData,
    runIdRef,
    
    // Actions
    setAccuracyData: saveAccuracyDataState,
    setIsExtracting,
    setProgress,
    setApiDebugData,
    setApiRequestDebugData,
    refreshTemplatesOnly,
    openPerformanceModal,
    closePerformanceModal,
    toggleColumn,
    setShownColumns: setShownColumnsDirectly,
    clearResults,
  };
} 