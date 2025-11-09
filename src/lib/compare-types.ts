/**
 * TypeScript types and interfaces for field-specific compare types
 * Based on PRD: field-compare-types-prd.md
 */

/**
 * Available comparison types for field validation
 */
export type CompareType =
  | 'exact-string'          // Character-for-character comparison
  | 'near-exact-string'     // Normalized comparison (case-insensitive, no punctuation)
  | 'llm-judge'            // Semantic comparison using Box AI
  | 'exact-number'         // Exact numeric equality
  | 'date-exact'           // Date equality with flexible format parsing
  | 'boolean'              // Boolean/Yes-No comparison
  | 'list-unordered'       // List comparison ignoring order
  | 'list-ordered';        // List comparison preserving order

/**
 * Parameters for compare types that require configuration
 */
export interface CompareParameters {
  // For LLM as Judge
  comparisonPrompt?: string;  // Custom comparison criteria
  llmModel?: string;          // Optional model override
  fileId?: string;            // File ID for Box AI context (required for LLM comparisons)

  // For List comparisons
  separator?: string;         // Delimiter (default: ",")

  // Future extensibility
  [key: string]: any;
}

/**
 * Configuration for a single field's compare type
 */
export interface FieldCompareConfig {
  fieldKey: string;           // Field identifier (matches template field key)
  fieldName: string;          // Human-readable field name
  compareType: CompareType;   // The comparison strategy
  parameters?: CompareParameters; // Optional type-specific parameters
}

/**
 * Complete compare type configuration for a template
 */
export interface CompareTypeConfig {
  version: string;            // Schema version (e.g., "1.0.0")
  templateKey: string;        // Template this config applies to
  lastModified: number;       // Unix timestamp
  fields: FieldCompareConfig[];
}

/**
 * Result of a comparison operation
 */
export interface ComparisonResult {
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchType: CompareType;
  details?: string;           // For debugging/logging (e.g., LLM reasoning)
  error?: string;             // If comparison failed
}

/**
 * Default compare types based on template field type
 */
export const DEFAULT_COMPARE_TYPE_MAP: Record<string, CompareType> = {
  'string': 'near-exact-string',
  'float': 'exact-number',
  'date': 'date-exact',
  'enum': 'exact-string',
  'multiSelect': 'list-unordered',
};

/**
 * Human-readable labels for compare types
 */
export const COMPARE_TYPE_LABELS: Record<CompareType, string> = {
  'exact-string': 'Exact String Match',
  'near-exact-string': 'Near Exact Match',
  'llm-judge': 'LLM as Judge',
  'exact-number': 'Exact Number',
  'date-exact': 'Date Match',
  'boolean': 'Boolean Match',
  'list-unordered': 'List (Unordered)',
  'list-ordered': 'List (Ordered)',
};

/**
 * Descriptions for each compare type
 */
export const COMPARE_TYPE_DESCRIPTIONS: Record<CompareType, string> = {
  'exact-string': 'Character-for-character comparison (case-sensitive)',
  'near-exact-string': 'Normalized comparison ignoring whitespace and punctuation',
  'llm-judge': 'Semantic comparison using AI to determine equivalence',
  'exact-number': 'Exact numeric equality after parsing',
  'date-exact': 'Date equality with flexible format parsing',
  'boolean': 'Boolean/Yes-No comparison with flexible parsing',
  'list-unordered': 'Compare lists ignoring order',
  'list-ordered': 'Compare lists preserving order',
};

/**
 * Categorization of compare types for UI grouping
 */
export const COMPARE_TYPE_CATEGORIES = {
  'String': ['exact-string', 'near-exact-string', 'llm-judge'] as CompareType[],
  'Number': ['exact-number'] as CompareType[],
  'Date': ['date-exact'] as CompareType[],
  'Boolean': ['boolean'] as CompareType[],
  'List': ['list-unordered', 'list-ordered'] as CompareType[],
};

/**
 * Compare types that require parameter configuration
 */
export const CONFIGURABLE_COMPARE_TYPES: CompareType[] = [
  'llm-judge',
  'list-ordered',
  'list-unordered',
];

/**
 * Default comparison prompt for LLM as Judge
 */
export const DEFAULT_LLM_COMPARISON_PROMPT =
  'Determine if these two values are semantically equivalent. ' +
  'Focus on meaning rather than exact phrasing.';

/**
 * Schema version for compare type configurations
 */
export const COMPARE_TYPE_CONFIG_VERSION = '1.0.0';
