'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { saveGroundTruthForFile, getGroundTruthForFile, getGroundTruthData, restoreDataFromFiles } from '@/lib/mock-data';
import { toast } from '@/hooks/use-toast';
import { TOAST_MESSAGES } from '@/lib/main-page-constants';

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
    console.log('🔄 Loading ground truth data from localStorage...');
    try {
      setIsLoading(true);
      
      // First, try to restore from JSON files if localStorage is empty
      await restoreDataFromFiles();
      
      const rawData = getGroundTruthData();
      console.log('📊 Raw data from localStorage:', rawData);
      
      const processedData: GroundTruthData = {};
      
      Object.entries(rawData).forEach(([fileId, fileData]) => {
        processedData[fileId] = {
          templateKey: fileData.templateKey,
          groundTruth: fileData.groundTruth,
          lastModified: Date.now() // Add timestamp for existing data
        };
      });
      
      console.log('✅ Processed data:', processedData);
      setGroundTruthData(processedData);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to load ground truth data:', err);
      setError('Failed to load ground truth data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get ground truth for a specific file
  const getGroundTruth = useCallback((fileId: string): Record<string, string> => {
    const result = groundTruthData[fileId]?.groundTruth || {};
    console.log('🔍 Getting ground truth for file:', fileId, '→', result);
    return result;
  }, [groundTruthData]);

  // Save ground truth with conflict detection
  const saveGroundTruth = useCallback(async (
    fileId: string,
    templateKey: string,
    fieldKey: string,
    value: string
  ): Promise<boolean> => {
    console.log('🔄 saveGroundTruth called:', { fileId, templateKey, fieldKey, value });
    
    try {
      setIsLoading(true);
      
      // Check for conflicts by comparing with current localStorage data
      const currentStorageData = getGroundTruthForFile(fileId);
      const currentStateData = groundTruthData[fileId];
      
      console.log('📊 Current data:', { 
        currentStorageData, 
        currentStateData,
        hasStorageData: Object.keys(currentStorageData).length > 0,
        hasStateData: !!currentStateData
      });
      
      // Only check for conflicts if we're about to overwrite a field that has been modified elsewhere
      // Compare the current field value in storage with what we expect it to be
      if (currentStateData && currentStorageData[fieldKey] && 
          currentStorageData[fieldKey] !== currentStateData.groundTruth[fieldKey]) {
        console.log('⚠️ Conflict detected for field:', fieldKey, {
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
        loadGroundTruthData().catch(console.error);
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
      
      console.log('📝 Updating state with:', { fileId, updatedFileData });
      
      setGroundTruthData(prev => ({
        ...prev,
        [fileId]: updatedFileData
      }));
      
      // Save to localStorage
      console.log('💾 Saving to localStorage:', { fileId, templateKey, updatedGroundTruth });
      saveGroundTruthForFile(fileId, templateKey, updatedGroundTruth);
      
      // Verify save was successful
      const verifyData = getGroundTruthForFile(fileId);
      console.log('✅ Verification - data after save:', verifyData);
      
      if (verifyData[fieldKey] === value) {
        console.log('✅ Ground truth saved successfully:', { fileId, fieldKey, value });
        
        toast({
          title: TOAST_MESSAGES.GROUND_TRUTH_UPDATED.title,
          description: `Ground truth updated for field "${fieldKey}"`,
        });
        
        setError(null);
        return true;
      } else {
        console.error('❌ Save verification failed:', { expected: value, actual: verifyData[fieldKey] });
        throw new Error('Save verification failed');
      }
      
    } catch (err) {
      console.error('❌ Failed to save ground truth:', err);
      setError('Failed to save ground truth data');
      
      // Rollback optimistic update
      loadGroundTruthData().catch(console.error);
      
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
    console.log('🔄 Refreshing ground truth data...');
    return loadGroundTruthData(); // Return promise so callers can await
  }, [loadGroundTruthData]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load data on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔄 Initial load of ground truth data...');
      loadGroundTruthData().catch(console.error);
    }
  }, [loadGroundTruthData]);

  // Handle window focus and page visibility to detect external changes
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔍 Window focus detected, refreshing ground truth...');
      refreshGroundTruth();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔍 Page became visible, refreshing ground truth...');
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
        console.log('📡 Storage change detected:', e.key);
        refreshGroundTruth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshGroundTruth]);

  // Load data on client-side mount (after SSR hydration)
  useEffect(() => {
    console.log('🚀 GroundTruthProvider: Client-side initialization starting...');
    if (typeof window !== 'undefined') {
      console.log('✅ GroundTruthProvider: Window is available, loading data...');
      loadGroundTruthData().catch(console.error);
    } else {
      console.log('❌ GroundTruthProvider: Still on server side, skipping...');
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