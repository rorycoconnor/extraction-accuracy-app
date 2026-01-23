/**
 * Shared types for Prompt Studio components
 */

import type { AccuracyField, PromptVersion, AccuracyData, FileResult } from '@/lib/types';

export type PromptStudioSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  field: AccuracyField | null;
  templateName?: string | null;
  onUpdatePrompt: (fieldKey: string, newPrompt: string, generationMethod?: 'standard' | 'dspy' | 'agent') => void;
  onUsePromptVersion: (fieldKey: string, promptVersion: PromptVersion) => void;
  onToggleFavorite?: (fieldKey: string, versionId: string) => void;
  onDeletePromptVersion?: (fieldKey: string, versionId: string) => void;
  selectedFileIds?: string[];
  accuracyData?: AccuracyData | null;
  shownColumns?: Record<string, boolean>;
};

export type CategorizedFiles = {
  mismatches: FileResult[];
  partialMatches: FileResult[];
  differentFormats: FileResult[];
  matches: FileResult[];
};

export type FileSelectionPanelProps = {
  categorizedFiles: CategorizedFiles;
  accuracyData: AccuracyData | null;
  selectedTestFiles: Set<string>;
  setSelectedTestFiles: (files: Set<string>) => void;
  onRunTest: () => void;
  onClose: () => void;
};

export type TestResultsPanelProps = {
  testResults: FileResult[] | null;
  field: AccuracyField;
  shownColumns: Record<string, boolean>;
  isTesting: boolean;
  testProgress: { current: number; total: number };
  onClose: () => void;
};

export type VersionHistoryCardProps = {
  version: PromptVersion;
  versionNumber: number;
  isLatestVersion: boolean;
  isCurrentVersion: boolean;
  field: AccuracyField;
  totalVersions: number;
  onToggleFavorite?: (versionId: string) => void;
  onDeleteVersion: (versionId: string, versionNumber: number) => void;
  onUseVersion: (version: PromptVersion) => void;
  onCopyToClipboard: (text: string) => void;
};
