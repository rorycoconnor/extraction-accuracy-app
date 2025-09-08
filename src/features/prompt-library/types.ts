// Prompt Library Types - Updated for Box API Compliance
export type FieldType =
  | 'text'        // Maps to Box 'string' 
  | 'number'      // Maps to Box 'float' (Box deprecated 'integer')
  | 'date'        // Maps to Box 'date'
  | 'dropdown_single' // Maps to Box 'enum'
  | 'dropdown_multi'  // Maps to Box 'multiSelect'  
  | 'taxonomy'    // Maps to Box 'multiSelect' (taxonomies are typically multi-value)

// Box-compliant field types (for internal mapping)
export type BoxFieldType = 'string' | 'float' | 'date' | 'enum' | 'multiSelect';

// Field type mapping for Box API transformation
export const FIELD_TYPE_MAPPING: Record<FieldType, BoxFieldType> = {
  'text': 'string',
  'number': 'float',  // Always use float per Box API guidelines
  'date': 'date', 
  'dropdown_single': 'enum',
  'dropdown_multi': 'multiSelect',
  'taxonomy': 'multiSelect'  // Box API doesn't have taxonomy type - use multiSelect for hierarchical data
};

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
  // New fields for Box API compliance
  key?: string;           // Box field key (auto-generated if not provided)
  hidden?: boolean;       // Box hidden field
  options?: string[];     // For enum/multiSelect fields (raw values)
  optionsPaste?: string;  // Multi-line text input for options
};

// New: Box Metadata Template structure for API compliance
export interface BoxMetadataTemplate {
  scope: 'enterprise';
  displayName: string;
  templateKey?: string;
  copyInstanceOnItemCopy?: boolean;
  fields: BoxMetadataField[];
  _validation?: {
    errors: string[];
    notes: string[];
  };
}

export interface BoxMetadataField {
  type: BoxFieldType;
  key: string;
  displayName: string;
  description?: string;  // Where prompts are stored
  hidden?: boolean;
  options?: Array<{ key: string }>;  // Box format for enum options
}

export type Template = {
  id: string;
  name: string;
  category: string;
  fields: Field[];
  // New fields for Box API compliance
  key?: string;           // Box template key (auto-generated if not provided)  
  copyOnCopy?: boolean;   // Box copyInstanceOnItemCopy
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
export const STORAGE_KEY = 'prompt-library-db-v2'; // Updated version for migration

// Constants
export const ALL_CATEGORIES = 'ALL';
export const ALL_TEMPLATES = 'ALL';

// Box API validation patterns
export const BOX_VALIDATION = {
  TEMPLATE_KEY_PATTERN: /^[a-zA-Z_][-a-zA-Z0-9_]*$/,
  FIELD_KEY_PATTERN: /^[a-zA-Z_][-a-zA-Z0-9_]*$/,
  MAX_DISPLAY_NAME_LENGTH: 4096,
  MAX_TEMPLATE_KEY_LENGTH: 64,
  MAX_FIELD_KEY_LENGTH: 256,
} as const; 