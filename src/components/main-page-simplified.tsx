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
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useAccuracyDataCompat } from '@/store/AccuracyDataStore';
import { quickExportToCSV } from '@/lib/csv-export';
import { useOptimizerRunner } from '@/hooks/use-optimizer-runner';

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
  
  // 🔧 DEFENSIVE: Force close all modals handler (recovery mechanism)
  const forceCloseAllModals = () => {
    logger.info('Force closing all modals (recovery mode)');
    setIsModalOpen(false);
    setIsPromptStudioOpen(false);
    setIsInlineEditorOpen(false);
    setShowResetDialog(false);
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
  const {
    runOptimizer,
    optimizerState,
    optimizerProgressLabel,
    resetOptimizer,
  } = useOptimizerRunner({ runComparison: enhancedRunner.handleRunComparison });
  const [isOptimizerSummaryOpen, setIsOptimizerSummaryOpen] = useState(false);

  useEffect(() => {
    if (optimizerState.status === 'review') {
      setIsOptimizerSummaryOpen(true);
    } else if (optimizerState.status === 'idle') {
      setIsOptimizerSummaryOpen(false);
    }
  }, [optimizerState.status, optimizerState.completedAt]);

  // ===== UI HANDLERS HOOK =====
  const { handleOpenPromptStudio, handleToggleFavorite, handleCompleteReset } = useUIHandlers({
    accuracyData,
    setAccuracyData,
    setSelectedFieldForPromptStudio,
    setIsPromptStudioOpen,
    setShowResetDialog,
    clearResults,
  });

  const handleOpenPromptStudioByKey = useCallback((fieldKey: string) => {
    const field = accuracyData?.fields.find((current) => current.key === fieldKey);
    if (!field) {
      logger.warn('Optimizer modal attempted to open Prompt Studio for missing field', { fieldKey });
      return;
    }
    handleOpenPromptStudio(field);
  }, [accuracyData, handleOpenPromptStudio]);

  // ===== DATA HANDLERS HOOK =====
  const { handleOpenInlineEditor, handleSaveInlineGroundTruth, handleUpdatePrompt, handleUsePromptVersion, handleDeletePromptVersion, updatePromptVersionMetrics } = useDataHandlers({
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
  const handleCloseOptimizerSummary = () => {
    setIsOptimizerSummaryOpen(false);
    resetOptimizer();
  };

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
    let totalSkipped = 0;
    let skippedReasons: Record<string, number> = {};
    const enhancedExtractModel = 'enhanced_extract_agent';

    logger.info('Processing data', {
      filesCount: accuracyData.results.length,
      fieldsCount: accuracyData.fields.length,
      templateKey: selectedTemplate.templateKey,
      enhancedExtractModel
    });

    // Check if Enhanced Extract Agent was actually run in the comparison
    const firstFileResult = accuracyData.results[0];
    const firstFieldKey = accuracyData.fields[0]?.key;
    let hasEnhancedExtract = false;
    
    if (firstFileResult && firstFieldKey && firstFileResult.fields[firstFieldKey]) {
      const availableModels = Object.keys(firstFileResult.fields[firstFieldKey]);
      hasEnhancedExtract = availableModels.some(m => m.toLowerCase().includes('enhanced'));
      
      logger.info('Checking for Enhanced Extract model', {
        availableModels,
        hasEnhancedExtract
      });
      
      if (!hasEnhancedExtract) {
        toast({
          title: 'Enhanced Extract Not Found',
          description: 'Please run a comparison with the Enhanced Extract Agent model first, then try copying to ground truth.',
          variant: 'destructive'
        });
        return;
      }
    }

    // Check if extractions are still in progress
    let pendingCount = 0;
    let totalFieldCount = 0;
    
    for (const fileResult of accuracyData.results) {
      for (const fieldConfig of accuracyData.fields) {
        const fieldKey = fieldConfig.key;
        const fieldData = fileResult.fields[fieldKey];
        
        if (fieldData) {
          totalFieldCount++;
          const enhancedValue = fieldData[enhancedExtractModel] || 
            Object.keys(fieldData).find(m => 
              m.toLowerCase().includes('enhanced') && 
              !m.toLowerCase().includes('no prompt')
            );
          
          if (enhancedValue && (fieldData[enhancedValue] === 'Pending...' || !fieldData[enhancedValue])) {
            pendingCount++;
          }
        }
      }
    }
    
    const pendingPercentage = totalFieldCount > 0 ? (pendingCount / totalFieldCount) * 100 : 0;
    
    logger.info('Extraction progress check', {
      pendingCount,
      totalFieldCount,
      pendingPercentage: pendingPercentage.toFixed(1) + '%'
    });
    
    // Warn if more than 20% of fields are still pending
    if (pendingPercentage > 20) {
      toast({
        title: 'Extractions Still In Progress',
        description: `${pendingCount} of ${totalFieldCount} fields are still being extracted (${pendingPercentage.toFixed(0)}%). Only completed fields will be copied. Consider waiting for extractions to finish for better results.`,
        variant: 'default'
      });
      // Continue anyway - user can still copy what's available
    }

    try {
      // 🔧 OPTIMIZED: Batch ground truth updates per file to avoid 50+ toast notifications
      // Build up ground truth data for each file, then save once per file
      
      // Process each file
      for (const fileResult of accuracyData.results) {
        logger.debug(`Processing file`, { fileName: fileResult.fileName, fileId: fileResult.id });
        
        // Build ground truth object for this file
        const fileGroundTruthUpdates: Record<string, string> = {};
        
        // Process each field for this file
        for (const fieldConfig of accuracyData.fields) {
          const fieldKey = fieldConfig.key;
          const fieldData = fileResult.fields[fieldKey];
          
          if (!fieldData) {
            logger.debug(`No field data for field`, { fieldKey, fileName: fileResult.fileName });
            totalSkipped++;
            skippedReasons['no_field_data'] = (skippedReasons['no_field_data'] || 0) + 1;
            continue;
          }
          
          // Log all available models for this field
          const availableModels = Object.keys(fieldData);
          logger.debug(`Field data available`, { 
            fieldKey, 
            fileName: fileResult.fileName,
            availableModels: availableModels,
            allValues: fieldData
          });
          
          // Get the value from Enhanced Extract
          let extractedValue = fieldData[enhancedExtractModel];
          
          // If enhanced_extract_agent is not available, check if any model with "enhanced" exists
          if (!extractedValue || extractedValue === '' || extractedValue === 'Pending...' || extractedValue.startsWith('Error:')) {
            const enhancedModel = availableModels.find(m => 
              m.toLowerCase().includes('enhanced') && 
              !m.toLowerCase().includes('no prompt') &&
              fieldData[m] && 
              fieldData[m] !== '' && 
              fieldData[m] !== 'Pending...' &&
              !fieldData[m].startsWith('Error:')
            );
            
            if (enhancedModel) {
              logger.info(`Using alternative enhanced model`, { 
                fieldKey, 
                fileName: fileResult.fileName,
                originalModel: enhancedExtractModel,
                foundModel: enhancedModel 
              });
              extractedValue = fieldData[enhancedModel];
            }
          }
          
          logger.debug(`Extracted value for field`, { 
            fieldKey, 
            fileName: fileResult.fileName,
            value: extractedValue,
            valueType: typeof extractedValue
          });
          
          // Check if value is valid
          if (!extractedValue || extractedValue === '' || extractedValue === null || extractedValue === undefined) {
            logger.debug(`Skipping field - empty or null value`, { fieldKey, fileName: fileResult.fileName });
            totalSkipped++;
            skippedReasons['empty_value'] = (skippedReasons['empty_value'] || 0) + 1;
            continue;
          }
          
          if (extractedValue === 'Pending...') {
            logger.debug(`Skipping field - still pending`, { fieldKey, fileName: fileResult.fileName });
            totalSkipped++;
            skippedReasons['pending'] = (skippedReasons['pending'] || 0) + 1;
            continue;
          }
          
          if (extractedValue.startsWith('Error:')) {
            logger.debug(`Skipping field - extraction error`, { fieldKey, fileName: fileResult.fileName, error: extractedValue });
            totalSkipped++;
            skippedReasons['error'] = (skippedReasons['error'] || 0) + 1;
            continue;
          }
          
          logger.info(`Queueing valid field value for save`, { fieldKey, fileName: fileResult.fileName, value: extractedValue });
          
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
          
          // Add to batch for this file
          fileGroundTruthUpdates[fieldKey] = valueToSave;
          totalUpdated++;
        }
        
        // 🔧 OPTIMIZED: Save all fields for this file at once (no individual toasts)
        if (Object.keys(fileGroundTruthUpdates).length > 0) {
          logger.info(`Saving ${Object.keys(fileGroundTruthUpdates).length} ground truth values for file`, { 
            fileName: fileResult.fileName,
            fileId: fileResult.id
          });
          
          try {
            saveGroundTruthForFile(fileResult.id, selectedTemplate.templateKey, fileGroundTruthUpdates);
            logger.debug(`Batch save successful for file`, { fileName: fileResult.fileName });
          } catch (error) {
            logger.error(`Batch save failed for file`, { fileName: fileResult.fileName, error });
            // Count all fields in this batch as failed
            const fieldsInBatch = Object.keys(fileGroundTruthUpdates).length;
            totalSkipped += fieldsInBatch;
            totalUpdated -= fieldsInBatch; // Remove from successful count
            skippedReasons['save_failed'] = (skippedReasons['save_failed'] || 0) + fieldsInBatch;
          }
        }
      }

      logger.info(`Auto-populate complete`, { 
        totalUpdated, 
        totalSkipped,
        skippedReasons 
      });

      // Create detailed description message
      let description = `Successfully copied ${totalUpdated} field${totalUpdated !== 1 ? 's' : ''}.`;
      if (totalSkipped > 0) {
        description += ` Skipped ${totalSkipped} field${totalSkipped !== 1 ? 's' : ''}`;
        const reasons = [];
        if (skippedReasons['pending']) reasons.push(`${skippedReasons['pending']} pending`);
        if (skippedReasons['empty_value']) reasons.push(`${skippedReasons['empty_value']} empty`);
        if (skippedReasons['error']) reasons.push(`${skippedReasons['error']} errors`);
        if (skippedReasons['no_field_data']) reasons.push(`${skippedReasons['no_field_data']} no data`);
        if (skippedReasons['save_failed']) reasons.push(`${skippedReasons['save_failed']} save failed`);
        if (reasons.length > 0) {
          description += ` (${reasons.join(', ')})`;
        }
      }

      toast({
        title: totalUpdated > 0 ? 'Ground Truth Updated' : 'No Fields Copied',
        description: description,
        variant: totalUpdated > 0 ? 'default' : 'destructive'
      });

      // 🔧 FIX: AWAIT the refresh so data is actually loaded before we try to use it
      logger.debug('Refreshing ground truth context to reload data from storage');
      await refreshGroundTruth();

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
          
          logger.debug('Updating ground truth for file', { 
            fileId: fileResult.id, 
            fileName: fileResult.fileName,
            fieldCount: Object.keys(fileGroundTruth).length 
          });
          
          // Update each field's ground truth value
          Object.keys(fileResult.fields).forEach(fieldKey => {
            if (fileResult.fields[fieldKey]) {
              const gtValue = fileGroundTruth[fieldKey] || '';
              fileResult.fields[fieldKey]['Ground Truth'] = gtValue;
              
              if (gtValue) {
                logger.debug('Updated ground truth value', { 
                  fileId: fileResult.id, 
                  fieldKey, 
                  value: gtValue 
                });
              }
            }
          });
        });
        
        logger.info('Setting updated accuracy data with ground truth', {
          filesUpdated: updatedAccuracyData.results.length,
          fieldsPerFile: updatedAccuracyData.fields.length
        });
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
       isJudging={enhancedRunner.isJudging}
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
        onRunOptimizer={runOptimizer}
        isOptimizerRunning={['precheck', 'sampling', 'diagnostics', 'prompting'].includes(optimizerState.status)}
        optimizerProgressLabel={optimizerProgressLabel ?? undefined}
        onAutoPopulateGroundTruth={handleAutoPopulateGroundTruth}
         onOpenSummary={openPerformanceModal}
         onClearResults={clearResults}
         onResetData={() => setShowResetDialog(true)}
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
         onCloseOptimizerSummary={handleCloseOptimizerSummary}
         onOpenPromptStudio={handleOpenPromptStudioByKey}
         showResetDialog={showResetDialog}
         onCloseResetDialog={() => setShowResetDialog(false)}
         onConfirmReset={handleCompleteReset}
       />
     </div>
   );
 };

 export default MainPage;
