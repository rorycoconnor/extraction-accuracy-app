/**
 * Custom hook for managing extraction progress state
 * Handles both basic progress (processed/total) and detailed progress tracking
 */

import { useState, useRef } from 'react';
import type { ExtractionProgress } from '@/lib/types';

interface BasicProgress {
  processed: number;
  total: number;
}

interface DetailedProgress {
  currentFile: string;
  currentFileName: string;
  currentModel: string;
  currentOperation: string;
  successful: number;
  failed: number;
  filesCompleted: string[];
  modelsCompleted: string[];
  startTime: Date;
  estimatedTimeRemaining: number;
  lastUpdateTime: Date;
}

interface UseExtractionProgressReturn {
  // State
  isExtracting: boolean;
  progress: BasicProgress;
  detailedProgress: DetailedProgress;
  runIdRef: React.MutableRefObject<number>;
  
  // Actions
  startExtraction: (totalJobs: number) => void;
  stopExtraction: () => void;
  updateProgress: () => void;
  updateDetailedProgress: (updates: Partial<DetailedProgress>) => void;
  resetProgress: () => void;
  isCurrentRun: (runId: number) => boolean;
}

const PROGRESS_STATES = {
  PREPARING: 'Preparing extraction...',
  EXTRACTING: 'Extracting data...',
  CALCULATING_METRICS: 'Calculating metrics...',
  COMPLETED: 'Extraction completed',
  ERROR: 'Extraction failed'
} as const;

export const useExtractionProgress = (): UseExtractionProgressReturn => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<BasicProgress>({ processed: 0, total: 0 });
  const [detailedProgress, setDetailedProgress] = useState<DetailedProgress>({
    currentFile: '',
    currentFileName: '',
    currentModel: '',
    currentOperation: PROGRESS_STATES.PREPARING,
    successful: 0,
    failed: 0,
    filesCompleted: [],
    modelsCompleted: [],
    startTime: new Date(),
    estimatedTimeRemaining: 0,
    lastUpdateTime: new Date()
  });
  
  const runIdRef = useRef(0);

  const startExtraction = (totalJobs: number) => {
    setIsExtracting(true);
    runIdRef.current = runIdRef.current + 1;
    
    // Initialize both progress states
    setProgress({ processed: 0, total: totalJobs });
    setDetailedProgress({
      currentFile: '',
      currentFileName: '',
      currentModel: '',
      currentOperation: PROGRESS_STATES.EXTRACTING,
      successful: 0,
      failed: 0,
      filesCompleted: [],
      modelsCompleted: [],
      startTime: new Date(),
      estimatedTimeRemaining: 0,
      lastUpdateTime: new Date()
    });
  };

  const stopExtraction = () => {
    setIsExtracting(false);
    setDetailedProgress(prev => ({
      ...prev,
      currentOperation: PROGRESS_STATES.COMPLETED,
      lastUpdateTime: new Date()
    }));
  };

  const updateProgress = () => {
    setProgress(prev => ({
      ...prev,
      processed: prev.processed + 1
    }));
  };

  const updateDetailedProgress = (updates: Partial<ExtractionProgress>) => {
    setDetailedProgress(prev => {
      const newState = { ...prev, ...updates };
      
      // Calculate estimated time remaining if we have start time and completion data
      if (newState.startTime && (updates.successful !== undefined || updates.failed !== undefined)) {
        const currentTime = new Date();
        const elapsed = currentTime.getTime() - newState.startTime.getTime();
        const completedJobs = newState.successful + newState.failed;
        const totalJobs = progress.total;
        
        if (completedJobs > 0 && totalJobs > 0) {
          const averageTimePerJob = elapsed / completedJobs;
          const remainingJobs = totalJobs - completedJobs;
          newState.estimatedTimeRemaining = Math.max(0, averageTimePerJob * remainingJobs);
        }
      }
      
      return {
        ...newState,
        lastUpdateTime: new Date()
      };
    });
  };

  const resetProgress = () => {
    setProgress({ processed: 0, total: 0 });
    setDetailedProgress({
      currentFile: '',
      currentFileName: '',
      currentModel: '',
      currentOperation: PROGRESS_STATES.PREPARING,
      successful: 0,
      failed: 0,
      filesCompleted: [],
      modelsCompleted: [],
      startTime: new Date(),
      estimatedTimeRemaining: 0,
      lastUpdateTime: new Date()
    });
  };

  const isCurrentRun = (runId: number) => {
    return runId === runIdRef.current;
  };

  return {
    // State
    isExtracting,
    progress,
    detailedProgress,
    runIdRef,
    
    // Actions
    startExtraction,
    stopExtraction,
    updateProgress,
    updateDetailedProgress,
    resetProgress,
    isCurrentRun,
  };
};

export { PROGRESS_STATES }; 