'use client';

import React from 'react';
import { PromptLibraryProvider } from './hooks/use-prompt-library';
import { PromptLibraryMain } from './components/prompt-library-main';

export function PromptLibrary() {
  return (
    <PromptLibraryProvider>
      <PromptLibraryMain />
    </PromptLibraryProvider>
  );
}

// Export types and utilities for potential future use
export type { 
  Database as PromptLibraryDatabase,
  Template as PromptLibraryTemplate,
  Field as PromptLibraryField,
  Prompt as PromptLibraryPrompt,
  FieldType as PromptLibraryFieldType 
} from './types';

export { PromptLibraryStorage } from './utils/storage'; 