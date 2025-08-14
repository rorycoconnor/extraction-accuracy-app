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

// Define model constants - Updated to match the actual models used in the app
const AVAILABLE_MODELS = [
  // Google Gemini Models
  'google__gemini_2_0_flash_001',
  'google__gemini_2_0_flash_001_no_prompt',
  'google__gemini_2_5_pro',
  'google__gemini_2_5_pro_no_prompt',

  // Enhanced Extract Agent
  'enhanced_extract_agent',
  'enhanced_extract_agent_no_prompt',

  // AWS Claude Models
  'aws__claude_3_7_sonnet',
  'aws__claude_3_7_sonnet_no_prompt',
  'aws__claude_4_sonnet',
  'aws__claude_4_sonnet_no_prompt',

  // Azure OpenAI Models (GPT)
  'azure__openai__gpt_4_1',
  'azure__openai__gpt_4_1_no_prompt',
  'azure__openai__gpt_4_1_mini',
  'azure__openai__gpt_4_1_mini_no_prompt',

  // OpenAI Models (Customer-enabled)
  'openai__o3',
  'openai__o3_no_prompt',
];

const ALL_MODELS = ['Ground Truth', ...AVAILABLE_MODELS];

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

  // Load accuracy data on mount
  useEffect(() => {
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
          console.log('🔧 Hydrating missing enum options for fields:', fieldsNeedingHydration.map(f => f.key));
          
          hydratedAccuracyData = {
            ...savedAccuracyData,
            fields: savedAccuracyData.fields.map(field => {
              if (field.type === 'enum' && (!field.options || field.options.length === 0)) {
                const templateField = matchingTemplate.fields.find(tf => tf.key === field.key);
                if (templateField?.options && templateField.options.length > 0) {
                  console.log(`✅ Hydrated enum options for ${field.key}:`, templateField.options);
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
          console.error('Failed to parse saved column visibility:', error);
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
  const recalculateFieldMetrics = useCallback((data: AccuracyData, fieldsToRecalculate?: string[]): AccuracyData => {
    console.log('🔄 Auto-recalculating metrics for Model Performance Summary...');
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
    
    console.log('✅ Metrics recalculation complete');
    return { ...data, results: updatedResults, averages: newAverages };
  }, [getGroundTruth]);

  // CRITICAL FIX: Automatically refresh accuracy data when ground truth changes
  useEffect(() => {
    if (!accuracyData) return;
    
    console.log('🔄 Ground truth data changed, refreshing accuracy data...');
    
    // Recalculate all metrics to reflect the new ground truth data
    const updatedData = recalculateFieldMetrics(accuracyData);
    
    // Only update if the data actually changed to avoid infinite loops
    const hasGroundTruthChanged = JSON.stringify(updatedData.results) !== JSON.stringify(accuracyData.results);
    
    if (hasGroundTruthChanged) {
      console.log('✅ Ground truth values changed, updating accuracy data...');
      setAccuracyData(updatedData);
      saveAccuracyData(updatedData);
    }
  }, [groundTruthData, accuracyData, recalculateFieldMetrics]);

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
      
      console.log('🗑️ Clearing results while preserving custom prompts for fields:', accuracyData.fields.map(f => f.key));
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