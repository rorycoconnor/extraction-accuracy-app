'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { saveGroundTruthForFile, getGroundTruthForFile, getGroundTruthData, restoreDataFromFiles } from '@/lib/mock-data';
import { toast } from '@/hooks/use-toast';
import { TOAST_MESSAGES } from '@/lib/main-page-constants';
import { logger } from '@/lib/logger';

// Types
interface GroundTruthData {
  [fileId: string]: {
    templateKey: string;
    groundTruth: Record<string, string>;
    lastModified: number;
  };
}

interface GroundTruthContextType {
  groundTruthData: GroundTruthData;
  getGroundTruth: (fileId: string) => Record<string, string>;
  saveGroundTruth: (fileId: string, templateKey: string, fieldKey: string, value: string) => Promise<boolean>;
  refreshGroundTruth: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const GroundTruthContext = createContext<GroundTruthContextType | undefined>(undefined);

// Provider component
export function GroundTruthProvider({ children }: { children: React.ReactNode }) {
  // Initialize with empty state to handle SSR, then load data in useEffect
  const [groundTruthData, setGroundTruthData] = useState<GroundTruthData>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load ground truth data from localStorage (with JSON file backup)
  const loadGroundTruthData = useCallback(async () => {
    logger.debug('useGroundTruth: Loading ground truth data from localStorage');
    try {
      setIsLoading(true);
      
      // First, try to restore from JSON files if localStorage is empty
      await restoreDataFromFiles();
      
      const rawData = getGroundTruthData();
      logger.debug('useGroundTruth: Raw data from localStorage', { fileCount: Object.keys(rawData).length });
      
      const processedData: GroundTruthData = {};
      
      Object.entries(rawData).forEach(([fileId, fileData]) => {
        processedData[fileId] = {
          templateKey: fileData.templateKey,
          groundTruth: fileData.groundTruth,
          lastModified: Date.now() // Add timestamp for existing data
        };
      });
      
      logger.info('useGroundTruth: Processed ground truth data', { fileCount: Object.keys(processedData).length });
      setGroundTruthData(processedData);
      setError(null);
    } catch (err) {
      logger.error('useGroundTruth: Failed to load ground truth data', err as Error);
      setError('Failed to load ground truth data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get ground truth for a specific file
  const getGroundTruth = useCallback((fileId: string): Record<string, string> => {
    const result = groundTruthData[fileId]?.groundTruth || {};
    logger.debug('useGroundTruth: Getting ground truth for file', { fileId, fieldCount: Object.keys(result).length });
    return result;
  }, [groundTruthData]);

  // Save ground truth with conflict detection
  const saveGroundTruth = useCallback(async (
    fileId: string,
    templateKey: string,
    fieldKey: string,
    value: string
  ): Promise<boolean> => {
    logger.debug('useGroundTruth: saveGroundTruth called', { fileId, templateKey, fieldKey, value });
    
    try {
      setIsLoading(true);
      
      // Check for conflicts by comparing with current localStorage data
      const currentStorageData = getGroundTruthForFile(fileId);
      const currentStateData = groundTruthData[fileId];
      
      logger.debug('useGroundTruth: Current data check', { 
        hasStorageData: Object.keys(currentStorageData).length > 0,
        hasStateData: !!currentStateData
      });
      
      // Only check for conflicts if we're about to overwrite a field that has been modified elsewhere
      // Compare the current field value in storage with what we expect it to be
      if (currentStateData && currentStorageData[fieldKey] && 
          currentStorageData[fieldKey] !== currentStateData.groundTruth[fieldKey]) {
        logger.warn('useGroundTruth: Conflict detected for field', {
          fieldKey,
          storageValue: currentStorageData[fieldKey],
          stateValue: currentStateData.groundTruth[fieldKey],
          newValue: value
        });
        
        toast({
          title: 'Conflict Detected',
          description: `Field "${fieldKey}" has been modified elsewhere. Refreshing data...`,
          variant: 'destructive',
        });
        
        // Refresh data and retry after a short delay
        loadGroundTruthData().catch((err) => logger.error('useGroundTruth: Refresh after conflict failed', err));
        return false;
      }
      
      // Update state optimistically
      const updatedGroundTruth = {
        ...currentStateData?.groundTruth,
        [fieldKey]: value
      };
      
      const updatedFileData = {
        templateKey,
        groundTruth: updatedGroundTruth,
        lastModified: Date.now()
      };
      
      logger.debug('useGroundTruth: Updating state', { fileId, fieldCount: Object.keys(updatedGroundTruth).length });
      
      setGroundTruthData(prev => ({
        ...prev,
        [fileId]: updatedFileData
      }));
      
      // Save to localStorage
      logger.debug('useGroundTruth: Saving to localStorage', { fileId, templateKey });
      saveGroundTruthForFile(fileId, templateKey, updatedGroundTruth);
      
      // Verify save was successful
      const verifyData = getGroundTruthForFile(fileId);
      logger.debug('useGroundTruth: Verification after save', { fileId, fieldKey });
      
      if (verifyData[fieldKey] === value) {
        logger.info('useGroundTruth: Ground truth saved successfully', { fileId, fieldKey });
        
        toast({
          title: TOAST_MESSAGES.GROUND_TRUTH_UPDATED.title,
          description: `Ground truth updated for field "${fieldKey}"`,
        });
        
        setError(null);
        return true;
      } else {
        logger.error('useGroundTruth: Save verification failed', { expected: value, actual: verifyData[fieldKey] });
        throw new Error('Save verification failed');
      }
      
    } catch (err) {
      logger.error('useGroundTruth: Failed to save ground truth', err as Error);
      setError('Failed to save ground truth data');
      
      // Rollback optimistic update
      loadGroundTruthData().catch((err) => logger.error('useGroundTruth: Rollback failed', err));
      
      toast({
        title: 'Save Failed',
        description: 'Failed to save ground truth data. Please try again.',
        variant: 'destructive',
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [groundTruthData, loadGroundTruthData]);

  // Refresh ground truth data
  const refreshGroundTruth = useCallback(() => {
    logger.debug('useGroundTruth: Refreshing ground truth data');
    return loadGroundTruthData(); // Return promise so callers can await
  }, [loadGroundTruthData]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load data on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      logger.debug('useGroundTruth: Initial load of ground truth data');
      loadGroundTruthData().catch((err) => logger.error('useGroundTruth: Initial load failed', err));
    }
  }, [loadGroundTruthData]);

  // Handle window focus and page visibility to detect external changes
  useEffect(() => {
    const handleFocus = () => {
      logger.debug('useGroundTruth: Window focus detected, refreshing');
      refreshGroundTruth();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        logger.debug('useGroundTruth: Page became visible, refreshing');
        refreshGroundTruth();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshGroundTruth]);

  // Handle storage events for cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fileMetadataStore' || e.key === 'accuracyData') {
        logger.debug('useGroundTruth: Storage change detected', { key: e.key });
        refreshGroundTruth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshGroundTruth]);

  // Load data on client-side mount (after SSR hydration)
  useEffect(() => {
    logger.debug('useGroundTruth: Client-side initialization starting');
    if (typeof window !== 'undefined') {
      logger.debug('useGroundTruth: Window is available, loading data');
      loadGroundTruthData().catch((err) => logger.error('useGroundTruth: Client-side load failed', err));
    } else {
      logger.debug('useGroundTruth: Still on server side, skipping');
    }
  }, [loadGroundTruthData]);

  const value: GroundTruthContextType = {
    groundTruthData,
    getGroundTruth,
    saveGroundTruth,
    refreshGroundTruth,
    isLoading,
    error,
    clearError,
  };

  return (
    <GroundTruthContext.Provider value={value}>
      {children}
    </GroundTruthContext.Provider>
  );
}

// Hook to use ground truth context
export function useGroundTruth() {
  const context = useContext(GroundTruthContext);
  if (context === undefined) {
    throw new Error('useGroundTruth must be used within a GroundTruthProvider');
  }
  return context;
}

// Export types
export type { GroundTruthData, GroundTruthContextType }; 