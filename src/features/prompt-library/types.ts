// Prompt Library Types
export type FieldType =
  | 'Text'
  | 'Date'
  | 'DropdownSingle'
  | 'DropdownMulti'
  | 'TaxonomySingle'
  | 'TaxonomyMulti';

export interface Prompt {
  id: string;
  text: string;
  up: number;
  down: number;
  createdAt: number;
  isPinned?: boolean;
}

export type Field = {
  id: string;
  name: string;
  type: FieldType;
  prompts: Prompt[];
};

export type Template = {
  id: string;
  name: string;
  category: string;
  fields: Field[];
};

export type Database = {
  categories: string[];
  templates: Template[];
};

export type SearchFilters = {
  category: string | null;
  template: string | null;
  searchTerm: string;
};

// Local storage key for prompt library data
export const STORAGE_KEY = 'prompt-library-db-v1';

// Constants
export const ALL_CATEGORIES = 'ALL';
export const ALL_TEMPLATES = 'ALL'; 