/**
 * Main Page Simplified Component
 * 
 * This component provides the main interface for the Box AI Accuracy Testing Application.
 * It handles document selection, AI model extraction, ground truth comparison, and metrics display.
 * 
 * Key Features:
 * - Document selection and template configuration
 * - AI model extraction with multiple providers
 * - Ground truth data management
 * - Performance metrics calculation and display
 * - Inline editing and prompt studio integration
 */

// ===== REACT & HOOKS IMPORTS =====
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyData } from '@/hooks/use-accuracy-data';
import { useExtractionProgress } from '@/hooks/use-extraction-progress';
import { useEnhancedErrorHandling } from '@/hooks/use-enhanced-error-handling';
import { useModelExtractionRunner } from '@/hooks/use-model-extraction-runner';
import { useGroundTruthPopulator } from '@/hooks/use-ground-truth-populator';
import { useGroundTruth } from '@/hooks/use-ground-truth';

// ===== COMPONENT IMPORTS =====
import ControlBar from '@/components/control-bar';
import ComparisonResults from '@/components/comparison-results';
import EmptyState from '@/components/empty-state';
import ModalContainer from '@/components/modal-container';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

// ===== AI & BUSINESS LOGIC IMPORTS =====
import { calculateFieldMetrics, calculateFieldMetricsWithDebug } from '@/lib/metrics';
import { formatModelName, NOT_PRESENT_VALUE } from '@/lib/utils';
import { 
  createExtractionSummaryMessage, 
  getErrorToastMessage,
  getExtractionSummary
} from '@/lib/error-handler';
import { logger, authLogger } from '@/lib/logger';

// ===== DATA FUNCTIONS IMPORTS =====
import { 
  associateFilesToTemplate, 
  saveGroundTruthForFile, 
  clearAllGroundTruthData,
  getGroundTruthData,
  saveAccuracyData,
  getFileMetadataStore
} from '@/lib/mock-data';

// ===== CONSTANTS & UTILITIES IMPORTS =====
import {
  UI_LABELS,
  TOAST_MESSAGES,
  PROGRESS_STATES,
  AVAILABLE_MODELS,
  FIELD_TYPES,
  DEFAULT_ENUM_OPTIONS,
} from '@/lib/main-page-constants';

// ===== CUSTOM HOOKS FOR HANDLERS =====
import { useUIHandlers } from '@/hooks/use-ui-handlers';
import { useDataHandlers } from '@/hooks/use-data-handlers';
import { useExtractionSetup } from '@/hooks/use-extraction-setup';
import { useEnhancedComparisonRunner } from '@/hooks/use-enhanced-comparison-runner';
import { useOptimizerRunner } from '@/hooks/use-optimizer-runner';
import { useAccuracyDataCompat, useOptimizerState } from '@/store/AccuracyDataStore';
import { quickExportToCSV } from '@/lib/csv-export';

// ===== TYPE IMPORTS =====
import type { 
  AccuracyData, 
  AccuracyField, 
  BoxTemplate, 
  BoxFile, 
  FieldResult, 
  FileResult as FileResultType, 
  FileMetadataStore, 
  PromptVersion, 
  ModelAverages,
  ApiExtractionResult,
  ExtractionProgress
} from '@/lib/types';



// ===== MAIN COMPONENT =====

const MainPage: React.FC = () => {
  // ===== NEW UNIFIED DATA STORE =====
  const compatData = useAccuracyDataCompat();
  
  // ===== FALLBACK TO OLD SYSTEM IF NEW SYSTEM NOT READY =====
  const {
    accuracyData: fallbackAccuracyData,
    configuredTemplates: fallbackConfiguredTemplates,
    shownColumns: fallbackShownColumns,
    isPerformanceModalOpen: fallbackIsPerformanceModalOpen,
    setAccuracyData: fallbackSetAccuracyData,
    setApiDebugData: fallbackSetApiDebugData,
    setApiRequestDebugData: fallbackSetApiRequestDebugData,
    openPerformanceModal: fallbackOpenPerformanceModal,
    closePerformanceModal: fallbackClosePerformanceModal,
    toggleColumn: fallbackToggleColumn,
    setShownColumns: fallbackSetShownColumns,
    clearResults: fallbackClearResults,
  } = useAccuracyData();

  // Use new system if available, otherwise fall back to old system
  const accuracyData = compatData?.accuracyData ?? fallbackAccuracyData;
  const configuredTemplates = fallbackConfiguredTemplates; // Keep using old system for templates
  const shownColumns = compatData?.shownColumns ?? fallbackShownColumns;
  const isPerformanceModalOpen = fallbackIsPerformanceModalOpen; // Keep using old system for modals
  const setAccuracyData = compatData?.setAccuracyData ?? fallbackSetAccuracyData;
  const setApiDebugData = fallbackSetApiDebugData; // Keep using old system for debug
  const setApiRequestDebugData = fallbackSetApiRequestDebugData;
  const openPerformanceModal = fallbackOpenPerformanceModal;
  const closePerformanceModal = fallbackClosePerformanceModal;
  const toggleColumn = compatData?.toggleColumn ?? fallbackToggleColumn;
  const setShownColumns = compatData?.setShownColumns ?? fallbackSetShownColumns;
  const clearResults = compatData?.clearResults ?? fallbackClearResults;
  
  // Debug logging to understand which system is being used
  React.useEffect(() => {
    if (compatData?.clearResults) {
      logger.debug('Using unified store clearResults');
    } else {
      logger.debug('Using fallback clearResults');
    }
  }, [compatData?.clearResults]);

  const {
    isExtracting,
    progress,
    detailedProgress,
    runIdRef,
    startExtraction,
    stopExtraction,
    updateProgress,
    updateDetailedProgress,
    resetProgress,
    isCurrentRun,
  } = useExtractionProgress();

  // Enhanced error handling hook available for future use
  // Currently using executeExtractionWithRetry from lib/error-handler
  // const {
  //   executeWithRetry,
  //   executeBoxAIExtraction,
  //   errorHistory,
  //   getErrorStatistics,
  //   clearErrorHistory,
  // } = useEnhancedErrorHandling();

  const { toast } = useToast();
  const { autoPopulateGroundTruth } = useGroundTruthPopulator();
  const { refreshGroundTruth, saveGroundTruth, getGroundTruth } = useGroundTruth();
  
  // ===== MODEL EXTRACTION RUNNER HOOK =====
  const { runExtractions, apiDebugData, apiRequestDebugData } = useModelExtractionRunner();
  
  // ===== AUTHENTICATION STATE (for dashboard) =====
  // Use the same two-step approach as the Settings page for reliable auth detection
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isBoxAuthenticated, setIsBoxAuthenticated] = useState(false);
  const [authMethod, setAuthMethod] = useState<string>('');
  const [oauthStatus, setOauthStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  
  // Step 1: Check OAuth status (same as Settings page)
  useEffect(() => {
    const checkOAuthStatus = async () => {
      try {
        authLogger.debug('Checking OAuth status');
        const response = await fetch('/api/auth/box/status');
        const data = await response.json();
        
        if (data.success) {
          const status = data.status.isConnected ? 'connected' : 'disconnected';
          setOauthStatus(status);
          authLogger.debug('OAuth status retrieved', { isConnected: status });
        } else {
          setOauthStatus('disconnected');
          authLogger.debug('OAuth status: disconnected (no data)');
        }
      } catch (error) {
        authLogger.error('Failed to check OAuth status', error as Error);
        setOauthStatus('disconnected');
      }
    };
    
    // Check on mount
    checkOAuthStatus();
    
    // Re-check when page becomes visible (user navigates back to home)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        authLogger.debug('Page visible again, re-checking auth status');
        checkOAuthStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Check once on mount only, just like Settings page
  
  // Step 2: Fetch user info based on OAuth status (same as Settings page)
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsAuthChecking(true);
        authLogger.debug('Fetching user info');
        
        const response = await fetch('/api/auth/box/user');
        const data = await response.json();
        
        authLogger.debug('User info response', {
          success: data.success,
          hasUser: !!data.user,
          authMethod: data.authMethod,
        });
        
        if (data.success && data.user) {
          setIsBoxAuthenticated(true);
          setAuthMethod(data.authMethod || '');
          authLogger.info('Authentication confirmed', { authMethod: data.authMethod });
        } else {
          setIsBoxAuthenticated(false);
          setAuthMethod('');
          authLogger.warn('Not authenticated', { error: data.error });
        }
      } catch (error) {
        authLogger.error('Failed to fetch user info', error as Error);
        setIsBoxAuthenticated(false);
        setAuthMethod('');
      } finally {
        setIsAuthChecking(false);
      }
    };
    
    fetchUserInfo();
  }, [oauthStatus]); // Refetch when OAuth status changes (same as Settings page!)

  // ===== LOCAL STATE =====
  // Modal state management with defensive initialization
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPromptStudioOpen, setIsPromptStudioOpen] = useState(false);
  const [selectedFieldForPromptStudio, setSelectedFieldForPromptStudio] = useState<AccuracyField | null>(null);
  const [isInlineEditorOpen, setIsInlineEditorOpen] = useState(false);
  const [selectedCellForEdit, setSelectedCellForEdit] = useState<{
    file: BoxFile;
    field: AccuracyField;
    currentValue: string;
  } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<BoxTemplate | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isOptimizerSummaryOpen, setIsOptimizerSummaryOpen] = useState(false);
  
  // ===== OPTIMIZER STATE =====
  const optimizerState = useOptimizerState();
  
  // 🔧 DEFENSIVE: Force close all modals handler (recovery mechanism)
  const forceCloseAllModals = () => {
    logger.info('Force closing all modals (recovery mode)');
    setIsModalOpen(false);
    setIsPromptStudioOpen(false);
    setIsInlineEditorOpen(false);
    setShowResetDialog(false);
    setIsOptimizerSummaryOpen(false);
  };
  
  // 🔧 DEFENSIVE: Add keyboard escape handler for recovery
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isModalOpen && !isPromptStudioOpen && !isInlineEditorOpen && !showResetDialog) {
        // If Escape is pressed but no modal thinks it's open, we might be in a stuck state
        logger.debug('Escape pressed with no modal open - checking for stuck overlays');
        forceCloseAllModals();
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isModalOpen, isPromptStudioOpen, isInlineEditorOpen, showResetDialog]);
  
  // ===== ENHANCED COMPARISON RUNNER =====
  const enhancedRunner = useEnhancedComparisonRunner(selectedTemplate);
  
  // ===== OPTIMIZER RUNNER HOOK =====
  const optimizerRunner = useOptimizerRunner({ 
    runComparison: enhancedRunner.handleRunComparison 
  });

  // ===== UI HANDLERS HOOK =====
  const { handleOpenPromptStudio, handleToggleFavorite, handleCompleteReset } = useUIHandlers({
    accuracyData,
    setAccuracyData,
    setSelectedFieldForPromptStudio,
    setIsPromptStudioOpen,
    setShowResetDialog,
    clearResults,
  });

  // ===== DATA HANDLERS HOOK =====
  const { handleOpenInlineEditor, handleSaveInlineGroundTruth, handleUpdatePrompt, handleUsePromptVersion, handleDeletePromptVersion, handleResetAllPrompts, updatePromptVersionMetrics } = useDataHandlers({
    accuracyData,
    setAccuracyData,
    selectedCellForEdit,
    setSelectedCellForEdit,
    setIsInlineEditorOpen,
    setSelectedFieldForPromptStudio,
  });

  // ===== EXTRACTION SETUP HOOK =====
  const { handleRunExtraction } = useExtractionSetup({
    setSelectedTemplate,
    setIsModalOpen,
    setAccuracyData,
    setShownColumns,
  });

  // ===== COMPONENT INITIALIZATION =====
  useEffect(() => {
    // Refresh ground truth data when the home page loads
    // This ensures we pick up any changes made on the ground truth page
    logger.info('Home page mounting, refreshing ground truth data');
    refreshGroundTruth();
  }, [refreshGroundTruth]);

  // ===== EVENT HANDLERS =====
  
  // Handle opening prompt studio from optimizer summary
  const handleOpenPromptStudioFromOptimizer = (fieldKey: string) => {
    const field = accuracyData?.fields.find(f => f.key === fieldKey);
    if (field) {
      setSelectedFieldForPromptStudio(field);
      setIsPromptStudioOpen(true);
      setIsOptimizerSummaryOpen(false);
    }
  };
  
  // Handle downloading CSV results
  const handleDownloadResults = () => {
    if (!accuracyData) {
      toast({
        title: "No Data Available",
        description: "Please run a comparison first to generate data for export.",
        variant: "destructive",
      });
      return;
    }

    try {
      quickExportToCSV(accuracyData, shownColumns, undefined, accuracyData.fieldSettings);
      toast({
        title: "Export Successful",
        description: "CSV file has been downloaded to your computer.",
      });
    } catch (error) {
      logger.error('Export error', error instanceof Error ? error : { error });
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  /**
   * Handle running AI comparison across selected models - ENHANCED VERSION
   */
  const handleRunComparison = enhancedRunner.handleRunComparison;

  /**
   * Handle toggling field inclusion in metrics calculation
   */
  const handleToggleFieldMetrics = (fieldKey: string, include: boolean) => {
    if (!accuracyData) {
      logger.warn('No accuracy data to update');
      return;
    }
    
    const updatedData = {
      ...accuracyData,
      fieldSettings: {
        ...accuracyData.fieldSettings,
        [fieldKey]: { includeInMetrics: include }
      }
    };
    
    // 🔧 FIX: Use direct object instead of callback for unified store
    setAccuracyData(updatedData);
  };

  /**
   * Handle copying Enhanced Extract results to ground truth
   */
  const handleAutoPopulateGroundTruth = async () => {
    logger.info('Starting auto-populate ground truth');
    
    if (!accuracyData || !accuracyData.results || accuracyData.results.length === 0) {
      toast({
        title: 'No Data Available',
        description: 'Please run a comparison first to generate results.',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedTemplate) {
      toast({
        title: 'No Template Selected',
        description: 'Please select documents first.',
        variant: 'destructive'
      });
      return;
    }

    let totalUpdated = 0;
    const enhancedExtractModel = 'enhanced_extract_agent';

    logger.debug('Processing data', {
      filesCount: accuracyData.results.length,
      fieldsCount: accuracyData.fields.length,
      enhancedExtractModel
    });

    try {
      // Process each file
      for (const fileResult of accuracyData.results) {
        logger.debug(`Processing file`, { fileName: fileResult.fileName, fileId: fileResult.id });
        
        // Process each field for this file
        for (const fieldConfig of accuracyData.fields) {
          const fieldKey = fieldConfig.key;
          const fieldData = fileResult.fields[fieldKey];
          
          logger.debug(`Processing field`, { 
            fieldKey, 
            hasFieldData: !!fieldData,
            availableModels: fieldData ? Object.keys(fieldData) : []
          });
          
          if (!fieldData) {
            logger.debug(`No field data`, { fieldKey });
            continue;
          }
          
          // Get the value from Enhanced Extract
          const extractedValue = fieldData[enhancedExtractModel];
          
          logger.debug(`Enhanced Extract value`, { fieldKey, value: extractedValue });
          
          if (extractedValue && extractedValue !== '' && extractedValue !== null && extractedValue !== undefined) {
            logger.debug(`Saving field value`, { fieldKey, value: extractedValue });
            
            // 🔧 Normalize date format to match manual ground truth editor format
            let valueToSave = extractedValue;
            if (fieldConfig.type === 'date') {
              const parsedDate = new Date(extractedValue);
              if (!isNaN(parsedDate.getTime())) {
                // Convert to ISO format (YYYY-MM-DD) to match ground truth editor
                valueToSave = parsedDate.toISOString().split('T')[0];
                logger.debug(`Normalized date`, { fieldKey, original: extractedValue, normalized: valueToSave });
              }
            }
            
            const success = await saveGroundTruth(
              fileResult.id,
              selectedTemplate.templateKey,
              fieldKey,
              valueToSave
            );
            
            logger.debug(`Save result`, { fieldKey, success });
            
            if (success) {
              totalUpdated++;
            }
          } else {
            logger.debug(`Skipping field - no valid value`, { fieldKey });
          }
        }
      }

      logger.info(`Auto-populate complete`, { totalUpdated });

      toast({
        title: 'Ground Truth Updated',
        description: `Successfully copied ${totalUpdated} fields from Enhanced Extract to ground truth.`,
      });

      // Refresh ground truth to show the updates
      refreshGroundTruth();

      // 🔧 ADDED: Force refresh of the main accuracy data to show ground truth in the grid
      logger.debug('Triggering accuracy data refresh to update grid');
      
      // Get the refreshed ground truth data
      const refreshedGroundTruthData = getGroundTruthData();
      logger.debug('Refreshed ground truth data', { dataCount: Object.keys(refreshedGroundTruthData).length });
      
      // Update the accuracy data with the new ground truth values
      if (accuracyData && setAccuracyData) {
        const updatedAccuracyData = JSON.parse(JSON.stringify(accuracyData)); // Deep copy
        
        // Update each file's ground truth values
        updatedAccuracyData.results.forEach((fileResult: any) => {
          const fileGroundTruth = refreshedGroundTruthData[fileResult.id]?.groundTruth || {};
          
          // Update each field's ground truth value
          Object.keys(fileResult.fields).forEach(fieldKey => {
            if (fileResult.fields[fieldKey]) {
              fileResult.fields[fieldKey]['Ground Truth'] = fileGroundTruth[fieldKey] || '';
            }
          });
        });
        
        logger.debug('Setting updated accuracy data with ground truth');
        setAccuracyData(updatedAccuracyData);
      }

    } catch (error) {
      logger.error('Error during auto-populate', error instanceof Error ? error : { error });
      toast({
        title: 'Update Failed',
        description: 'An error occurred while updating ground truth.',
        variant: 'destructive'
      });
    }
  };

  // ===== DASHBOARD DATA PREPARATION =====

  // Calculate ground truth stats
  const groundTruthStats = useMemo(() => {
    if (!accuracyData || !accuracyData.results || accuracyData.results.length === 0) {
      return undefined;
    }

    const groundTruthData = getGroundTruthData();
    const totalFiles = accuracyData.results.length;
    const filesWithGroundTruth = accuracyData.results.filter(result => {
      const gtData = groundTruthData[result.id];
      return gtData && Object.keys(gtData.groundTruth || {}).length > 0;
    }).length;

    return {
      totalFiles,
      filesWithGroundTruth,
      completionPercentage: totalFiles > 0 ? Math.round((filesWithGroundTruth / totalFiles) * 100) : 0
    };
  }, [accuracyData]);

  // Get last activity info
  const lastActivity = useMemo(() => {
    if (!accuracyData || !accuracyData.results || accuracyData.results.length === 0) {
      return null;
    }

    return {
      type: 'Comparison',
      date: new Date(), // Could be enhanced to store actual run date
      filesProcessed: accuracyData.results.length
    };
  }, [accuracyData]);

 // ===== COMPONENT RENDER =====
 
 return (
     <div className="flex flex-col h-full">
       <ControlBar
        accuracyData={accuracyData}
        isExtracting={enhancedRunner.isExtracting}
        isOptimizerRunning={optimizerRunner.optimizerState.status !== 'idle'}
        optimizerProgressLabel={optimizerRunner.optimizerProgressLabel}
        progress={enhancedRunner.progress}
        shownColumns={shownColumns}
        onSelectDocuments={() => {
          logger.debug('Select Documents button clicked');
          try {
            setIsModalOpen(true);
          } catch (error) {
            logger.error('Error opening modal', error instanceof Error ? error : { error });
            forceCloseAllModals();
            setTimeout(() => setIsModalOpen(true), 100);
          }
        }}
        onRunComparison={handleRunComparison}
        onRunOptimizer={optimizerRunner.runOptimizer}
         onAutoPopulateGroundTruth={handleAutoPopulateGroundTruth}
         onOpenSummary={openPerformanceModal}
         onClearResults={clearResults}
         onResetData={() => setShowResetDialog(true)}
         onResetPrompts={handleResetAllPrompts}
         onColumnToggle={toggleColumn}
         onDownloadResults={handleDownloadResults}
       />
       
       <div className="flex-1 min-h-0">
         {accuracyData && accuracyData.results && accuracyData.results.length > 0 ? (
          <ComparisonResults
            accuracyData={accuracyData}
            shownColumns={shownColumns}
            onOpenPromptStudio={handleOpenPromptStudio}
            onOpenInlineEditor={handleOpenInlineEditor}
            onOpenSummary={openPerformanceModal}
            onToggleFieldMetrics={handleToggleFieldMetrics}
            isExtracting={enhancedRunner.isExtracting}
          />
         ) : (
           <div className="p-4 md:p-8 h-full flex gap-6">
             {/* Empty State - 70% width */}
             <div className="flex-[7] min-w-[400px]">
               <EmptyState />
             </div>

             {/* Dashboard Cards - 30% width */}
             <div className="flex-[3] overflow-y-auto max-h-full">
               <DashboardSidebar
                 isAuthenticated={isBoxAuthenticated}
                 authMethod={authMethod}
                 metadataTemplates={configuredTemplates}
                 groundTruthStats={groundTruthStats}
                 isLoading={isAuthChecking}
               />
             </div>
           </div>
         )}
       </div>
       
       <ModalContainer 
        isExtractionModalOpen={isModalOpen}
        configuredTemplates={configuredTemplates}
        onCloseExtractionModal={() => {
          logger.debug('Closing extraction modal');
          setIsModalOpen(false);
        }}
        onRunExtraction={handleRunExtraction}
         isPromptStudioOpen={isPromptStudioOpen}
         selectedFieldForPromptStudio={selectedFieldForPromptStudio}
         selectedTemplateName={selectedTemplate?.displayName}
         onClosePromptStudio={() => setIsPromptStudioOpen(false)}
         onUpdatePrompt={handleUpdatePrompt}
         onUsePromptVersion={handleUsePromptVersion}
         onToggleFavorite={handleToggleFavorite}
         onDeletePromptVersion={handleDeletePromptVersion}
         isInlineEditorOpen={isInlineEditorOpen}
         selectedCellForEdit={selectedCellForEdit}
         selectedTemplate={selectedTemplate}
         onCloseInlineEditor={() => setIsInlineEditorOpen(false)}
         onSaveInlineGroundTruth={handleSaveInlineGroundTruth}
         isPerformanceModalOpen={isPerformanceModalOpen}
         accuracyData={accuracyData}
         shownColumns={shownColumns}
         onClosePerformanceModal={closePerformanceModal}
         isOptimizerSummaryOpen={isOptimizerSummaryOpen}
         optimizerSampledDocs={optimizerState.sampledDocs}
         optimizerFieldSummaries={optimizerState.fieldSummaries}
         onCloseOptimizerSummary={() => setIsOptimizerSummaryOpen(false)}
         onOpenPromptStudio={handleOpenPromptStudioFromOptimizer}
         showResetDialog={showResetDialog}
         onCloseResetDialog={() => setShowResetDialog(false)}
         onConfirmReset={handleCompleteReset}
       />
     </div>
   );
 };

 export default MainPage;