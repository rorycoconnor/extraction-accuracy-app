/**
 * Shared types for Agent-Alpha modal components
 */

import type { AgentAlphaState, AgentAlphaPendingResults } from '@/lib/agent-alpha-types';
import type { AgentAlphaRuntimeConfig } from '@/lib/agent-alpha-config';
import type { SystemPromptVersion } from '@/lib/system-prompt-storage';

export interface AgentAlphaModalProps {
  isOpen: boolean;
  agentAlphaState: AgentAlphaState;
  results: AgentAlphaPendingResults | null;
  availableModels?: string[];
  defaultModel?: string; // Model from last comparison run
  onApply: () => void;
  onCancel: () => void;
  onStartWithConfig?: (config: AgentAlphaRuntimeConfig) => void;
}

export interface ConfigureViewProps {
  config: AgentAlphaRuntimeConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentAlphaRuntimeConfig>>;
  availableModels: string[];
  // Version management
  versions: SystemPromptVersion[];
  selectedVersionId: string;
  activeVersionId: string;
  editedInstructions: string;
  hasModifiedInstructions: boolean;
  // Handlers
  onVersionSelect: (versionId: string) => void;
  onInstructionsChange: (value: string) => void;
  onSaveAsNew: (versionName: string) => void;
  onUpdateCurrent: () => void;
  onSetAsActive: () => void;
  onDeleteVersion: () => void;
}

export interface RunningViewProps {
  agentAlphaState: AgentAlphaState;
}

export interface PreviewViewProps {
  results: AgentAlphaPendingResults;
}

export interface ErrorViewProps {
  errorMessage?: string;
  onClose: () => void;
}

export const CREATE_NEW_ID = '__create_new__';
