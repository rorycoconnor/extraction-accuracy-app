# Product Requirements Document: Field-Specific Compare Types

**Status**: Draft
**Created**: 2025-11-08
**Last Updated**: 2025-11-08
**Author**: Alex Leutenegger, and Claude Code :)
**Stakeholders**: Engineering, Product, QA

---

## Executive Summary

This PRD outlines the implementation of field-specific comparison types for metadata extraction accuracy measurement. Rather than auto-detecting field types and applying generic comparisons, each field will have an explicitly configured compare type that determines how extracted values are validated against ground truth.

### Key Objectives

1. **Explicit Compare Type Configuration**: Each field gets a configurable compare type instead of implicit type detection
2. **Multiple Comparison Strategies**: Support different comparison methods (exact, near-exact, numeric, date, boolean, list, LLM-based)
3. **Flexible Configuration Management**: UI for managing compare types with import/export capabilities
4. **LLM-as-Judge Integration**: Leverage Box AI "generate text" API for semantic comparisons

---

## Table of Contents

1. [Background](#background)
2. [User Stories](#user-stories)
3. [Compare Type Specifications](#compare-type-specifications)
4. [Data Model](#data-model)
5. [UI/UX Requirements](#uiux-requirements)
6. [Technical Requirements](#technical-requirements)
7. [Import/Export Functionality](#importexport-functionality)
8. [Implementation Phases](#implementation-phases)
9. [Success Metrics](#success-metrics)
10. [Open Questions](#open-questions)

---

## Background

### Current State

The application currently uses implicit type detection based on field types defined in metadata templates (string, float, date, enum, multiSelect). Comparisons are performed in `metrics.ts` with basic normalization for strings and date parsing.

**Limitations:**
- No fine-grained control over comparison behavior per field
- Limited comparison strategies (exact match, normalized text, date parsing)
- No semantic understanding for text fields
- No per-field configuration persistence

### Proposed State

Each field will have an explicitly configured **compare type** that is:
- **Separate from the field's data type** (a string field can use exact, near-exact, or LLM comparison)
- **Persistently stored** in a dedicated configuration file
- **Configurable via UI** in a dedicated "Compare Types" tab
- **Importable/exportable** for sharing and version control

---

## User Stories

### Primary User Stories

**US-1: Configure Field Compare Types**
> As a metadata accuracy analyst, I want to set the comparison type for each field in my template so that I can control how extracted values are validated against ground truth.

**US-2: Use Near-Exact Matching for Flexible Text**
> As a user validating company names, I want to use "near exact match" comparison that ignores whitespace and punctuation so that "ABC Corp." matches "ABC Corp" without manual normalization.

**US-3: Use LLM for Semantic Comparison**
> As a user extracting descriptions or summaries, I want to use "LLM as judge" comparison with configurable criteria so that semantically equivalent text is recognized as correct even if worded differently.

**US-4: Set Exact Numeric Comparisons**
> As a user extracting invoice amounts, I want to use exact numeric comparison without tolerance so that "$1,234.56" matches "1234.56" but "$1,234.55" does not.

**US-5: Import/Export Compare Configurations**
> As a team lead, I want to export my compare type configurations and share them with my team so that we all use consistent validation criteria.

**US-6: Manage Compare Types in Dedicated UI**
> As a user, I want a dedicated "Compare Types" tab (similar to the Ground Truth tab) where I can view and edit all field compare types for my template in one place.

---

## Compare Type Specifications

### Compare Type Categories

Each field can be assigned one of the following compare types:

#### 1. **String Compare Types**

##### 1.1 Exact Match
- **Description**: Character-for-character comparison
- **Use Cases**: Contract numbers, IDs, precise codes
- **Behavior**:
  - Case-sensitive comparison
  - No normalization
  - Whitespace significant
- **Example**:
  - Ground Truth: `"INV-2024-001"`
  - ✅ Match: `"INV-2024-001"`
  - ❌ No Match: `"INV-2024-001 "` (trailing space)
  - ❌ No Match: `"inv-2024-001"` (case difference)

##### 1.2 Near Exact Match
- **Description**: Normalized comparison ignoring whitespace and punctuation
- **Use Cases**: Company names, addresses, titles
- **Behavior**:
  - Convert to lowercase
  - Remove all punctuation (periods, commas, hyphens, etc.)
  - Normalize whitespace (multiple spaces → single space, trim)
  - Compare normalized strings
- **Example**:
  - Ground Truth: `"ABC Corp."`
  - ✅ Match: `"ABC Corp"`, `"abc corp"`, `"  ABC   Corp.  "`
  - ❌ No Match: `"ABC Corporation"`

##### 1.3 LLM as Judge
- **Description**: Semantic comparison using Box AI with configurable prompt
- **Use Cases**: Descriptions, summaries, free-text fields, semantic content
- **Behavior**:
  - Call Box AI "generate text" API with custom prompt
  - Prompt includes: ground truth value, extracted value, comparison criteria
  - Parse response to determine match (boolean: match/no match)
  - Log confidence/reasoning if available
- **Configuration Parameters**:
  - `comparisonPrompt` (string): Custom instructions for the LLM (default: "Determine if these two values are semantically equivalent")
  - `model` (optional): AI model to use (default: uses Box AI default)
- **Example Prompt Template**:
  ```
  You are a metadata validation assistant. Compare the following two values and determine if they match according to the criteria.

  Ground Truth: "{groundTruthValue}"
  Extracted Value: "{extractedValue}"

  Criteria: {comparisonPrompt}

  Respond with EXACTLY one of:
  - MATCH: if the values satisfy the criteria
  - NO_MATCH: if the values do not satisfy the criteria

  Then on a new line, provide a brief reason (1 sentence).

  Format:
  MATCH or NO_MATCH
  Reason: [your reason]
  ```
- **Response Parsing**:
  - Extract first line: `MATCH` or `NO_MATCH`
  - Extract reason for logging/debugging
  - Handle errors gracefully (default to NO_MATCH on error)

#### 2. **Number Compare Types**

##### 2.1 Exact Numeric Match
- **Description**: Exact numeric equality after parsing
- **Use Cases**: Invoice amounts, precise measurements, counts
- **Behavior**:
  - Parse both values as numbers (handle commas, currency symbols)
  - Compare using `===` (no tolerance)
  - Handle formatting differences (e.g., "1,234.56" = "1234.56")
- **Example**:
  - Ground Truth: `"1234.56"`
  - ✅ Match: `"1,234.56"`, `"$1234.56"`, `"1234.56"`
  - ❌ No Match: `"1234.57"`, `"1234.5"`

#### 3. **Date Compare Types**

##### 3.1 Date Exact Match
- **Description**: Date equality with flexible format parsing
- **Use Cases**: Contract dates, deadlines, effective dates
- **Behavior**:
  - Parse both dates using flexible date parser (handles multiple formats)
  - Compare dates ignoring time component
  - Handle format variations (ISO, US, European, written formats)
- **Supported Formats**:
  - ISO: `2025-01-15`
  - US: `01/15/2025`, `1/15/25`
  - European: `15/01/2025`
  - Written: `January 15, 2025`, `15 Jan 2025`
  - Abbreviated: `Jan-15-25`, `15-JAN-2025`
- **Example**:
  - Ground Truth: `"2025-01-15"`
  - ✅ Match: `"01/15/2025"`, `"January 15, 2025"`, `"15-Jan-2025"`
  - ❌ No Match: `"2025-01-16"`

#### 4. **Boolean Compare Types**

##### 4.1 Boolean Match
- **Description**: Boolean/Yes-No comparison with flexible parsing
- **Use Cases**: Checkboxes, binary flags, yes/no questions
- **Behavior**:
  - Normalize to boolean value
  - Accepted TRUE values: `"true"`, `"yes"`, `"y"`, `"1"`, `"✓"`, `"checked"`
  - Accepted FALSE values: `"false"`, `"no"`, `"n"`, `"0"`, `"unchecked"`
  - Case-insensitive
- **Example**:
  - Ground Truth: `"Yes"`
  - ✅ Match: `"true"`, `"YES"`, `"y"`, `"1"`
  - ❌ No Match: `"No"`, `"false"`

#### 5. **List Compare Types**

##### 5.1 List Match (Order Insensitive)
- **Description**: Compare lists/arrays ignoring order
- **Use Cases**: Multi-select fields, tags, categories
- **Behavior**:
  - Parse as comma-separated or semicolon-separated values
  - Trim whitespace from each item
  - Sort both lists
  - Compare for equality
- **Example**:
  - Ground Truth: `"Apple, Banana, Cherry"`
  - ✅ Match: `"Cherry, Apple, Banana"`, `"Apple,Banana,Cherry"`
  - ❌ No Match: `"Apple, Banana"` (missing item)

##### 5.2 List Match (Order Sensitive)
- **Description**: Compare lists/arrays with order preservation
- **Use Cases**: Ordered lists, rankings, sequences
- **Behavior**:
  - Parse as comma-separated or semicolon-separated values
  - Trim whitespace from each item
  - Compare in order
- **Example**:
  - Ground Truth: `"First, Second, Third"`
  - ✅ Match: `"First, Second, Third"`
  - ❌ No Match: `"Second, First, Third"` (order differs)

---

## Data Model

### Compare Type Configuration Schema

Compare type configurations are stored in a **separate JSON file** from ground truth data.

**File Location**: `compare-types.json` (stored alongside ground truth in localStorage with JSON file backup)

**Schema**:

```typescript
interface CompareTypeConfig {
  version: string; // Schema version (e.g., "1.0.0")
  templateKey: string; // Template this config applies to
  lastModified: number; // Unix timestamp
  fields: FieldCompareConfig[];
}

interface FieldCompareConfig {
  fieldKey: string; // Field identifier (matches template field key)
  fieldName: string; // Human-readable field name
  compareType: CompareType; // The comparison strategy
  parameters?: CompareParameters; // Optional type-specific parameters
}

type CompareType =
  | 'exact-string'
  | 'near-exact-string'
  | 'llm-judge'
  | 'exact-number'
  | 'date-exact'
  | 'boolean'
  | 'list-unordered'
  | 'list-ordered';

interface CompareParameters {
  // For LLM as Judge
  comparisonPrompt?: string; // Custom comparison criteria
  llmModel?: string; // Optional model override

  // For List comparisons
  separator?: string; // Delimiter (default: ",")

  // Future extensibility
  [key: string]: any;
}
```

**Example Configuration**:

```json
{
  "version": "1.0.0",
  "templateKey": "invoice_template",
  "lastModified": 1699564800000,
  "fields": [
    {
      "fieldKey": "invoice_number",
      "fieldName": "Invoice Number",
      "compareType": "exact-string"
    },
    {
      "fieldKey": "vendor_name",
      "fieldName": "Vendor Name",
      "compareType": "near-exact-string"
    },
    {
      "fieldKey": "total_amount",
      "fieldName": "Total Amount",
      "compareType": "exact-number"
    },
    {
      "fieldKey": "invoice_date",
      "fieldName": "Invoice Date",
      "compareType": "date-exact"
    },
    {
      "fieldKey": "description",
      "fieldName": "Description",
      "compareType": "llm-judge",
      "parameters": {
        "comparisonPrompt": "Determine if the descriptions convey the same meaning, even if worded differently. Focus on the core content, not exact phrasing."
      }
    },
    {
      "fieldKey": "line_items",
      "fieldName": "Line Items",
      "compareType": "list-unordered",
      "parameters": {
        "separator": ";"
      }
    }
  ]
}
```

### Default Compare Types

When a template is first loaded and no compare type config exists, default compare types are assigned based on the template field type:

| Template Field Type | Default Compare Type |
|---------------------|----------------------|
| `string` | `near-exact-string` |
| `float` | `exact-number` |
| `date` | `date-exact` |
| `enum` | `exact-string` |
| `multiSelect` | `list-unordered` |

---

## UI/UX Requirements

### New Tab: "Compare Types"

Similar to the existing "Ground Truth" tab, add a **"Compare Types"** tab to the main interface.

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Ground Truth] [Compare Types] [Results] [Other Tabs...]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Compare Type Configuration                                 │
│  Template: Invoice Template                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Field Name        │ Compare Type   │ Parameters     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Invoice Number    │ [Exact String▼]│                │   │
│  │ Vendor Name       │ [Near Exact ▼] │                │   │
│  │ Total Amount      │ [Exact Number▼]│                │   │
│  │ Invoice Date      │ [Date Exact ▼] │                │   │
│  │ Description       │ [LLM Judge  ▼] │ [Configure...] │   │
│  │ Line Items        │ [List (Unord)▼]│ [Configure...] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Import Config] [Export Config] [Reset to Defaults]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Component Specifications

**Compare Type Dropdown**
- Shows all available compare types for the field
- Groups by category (String, Number, Date, Boolean, List)
- Disabled if no template selected

**Parameters Button/Section**
- Only shown for compare types with configurable parameters (LLM Judge, List types)
- Opens a modal/dialog for detailed configuration
- For LLM Judge:
  - Text area for custom comparison prompt
  - Model selector (optional)
  - Preview/test functionality
- For List types:
  - Separator input (default: comma)
  - Order sensitivity toggle

**Import/Export Buttons**
- **Import**: Opens file picker for JSON config file
  - Validates schema
  - Shows preview of changes before applying
  - Asks for confirmation if overwriting existing config
- **Export**: Downloads current config as JSON file
  - Filename: `{templateKey}-compare-config.json`
  - Includes metadata (version, timestamp, template name)

**Reset to Defaults**
- Restores default compare types based on field types
- Requires confirmation
- Preserves any custom LLM prompts (optional)

#### User Workflows

**Setting Compare Types**
1. User selects template from main interface
2. User navigates to "Compare Types" tab
3. User sees table of all active fields with current compare types
4. User clicks dropdown for a field and selects new compare type
5. If compare type has parameters, user clicks "Configure" and sets parameters
6. Changes are saved automatically (with debounce)
7. User sees toast notification confirming save

**Configuring LLM Judge**
1. User selects "LLM as Judge" for a field
2. "Configure" button appears
3. User clicks "Configure"
4. Modal opens with:
   - Description of LLM Judge functionality
   - Text area for custom comparison prompt (with example)
   - Optional: Model selector
   - "Test" button to try the comparison with sample values
5. User enters custom prompt
6. User clicks "Save"
7. Configuration saved, modal closes

**Importing Configuration**
1. User clicks "Import Config"
2. File picker opens
3. User selects JSON file
4. System validates schema
5. System shows preview:
   - Template name
   - Number of fields configured
   - List of changes (field → old type → new type)
6. User confirms or cancels
7. If confirmed, configuration applied and saved
8. Toast notification confirms import

**Exporting Configuration**
1. User clicks "Export Config"
2. System generates JSON file with current configuration
3. Browser downloads file: `{templateKey}-compare-config-{timestamp}.json`
4. Toast notification confirms export

---

## Technical Requirements

### 1. Compare Type Engine

**File**: `src/lib/compare-engine.ts`

Responsible for executing comparisons based on configured compare types.

```typescript
interface ComparisonResult {
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchType: CompareType;
  details?: string; // For debugging/logging (e.g., LLM reasoning)
  error?: string; // If comparison failed
}

async function compareValues(
  extractedValue: string,
  groundTruthValue: string,
  compareConfig: FieldCompareConfig
): Promise<ComparisonResult>
```

**Implementations for each compare type**:
- `compareExactString()`
- `compareNearExactString()`
- `compareLLMJudge()` ← Calls Box AI
- `compareExactNumber()`
- `compareDateExact()`
- `compareBoolean()`
- `compareListUnordered()`
- `compareListOrdered()`

### 2. Box AI Integration for LLM as Judge

**File**: `src/ai/flows/llm-comparison.ts`

Similar to `generate-initial-prompt.ts`, create a server action that calls Box AI's "generate text" API.

```typescript
export async function evaluateWithLLM({
  groundTruthValue,
  extractedValue,
  comparisonPrompt,
  fileId // Optional: for context
}: {
  groundTruthValue: string;
  extractedValue: string;
  comparisonPrompt: string;
  fileId?: string;
}): Promise<{
  isMatch: boolean;
  reason: string;
  rawResponse: string;
}>
```

**Implementation**:
1. Construct prompt using template (see Compare Type Specification section)
2. Call Box AI `/ai/text_gen` endpoint
3. Parse response to extract MATCH/NO_MATCH
4. Extract reason for logging
5. Return structured result

**Error Handling**:
- If API call fails: log error, return `{ isMatch: false, reason: 'API error', error: '...' }`
- If response parsing fails: log error, return `{ isMatch: false, reason: 'Parse error', error: '...' }`
- If response is ambiguous: default to NO_MATCH

**Caching** (optional, future enhancement):
- Cache LLM responses to avoid redundant API calls
- Key: hash of (groundTruth, extracted, prompt)
- TTL: session-based or configurable

### 3. Compare Type Storage

**File**: `src/lib/compare-type-storage.ts`

Manages persistence of compare type configurations (similar to ground truth storage).

```typescript
interface CompareTypeStore {
  [templateKey: string]: CompareTypeConfig;
}

export function saveCompareTypeConfig(
  templateKey: string,
  config: CompareTypeConfig
): void;

export function getCompareTypeConfig(
  templateKey: string
): CompareTypeConfig | null;

export function exportCompareTypeConfig(
  templateKey: string
): string; // JSON string

export function importCompareTypeConfig(
  jsonString: string
): CompareTypeConfig; // Validates and returns

export function getDefaultCompareTypes(
  template: BoxTemplate
): CompareTypeConfig; // Generate defaults based on field types
```

**Storage Strategy**:
- Store in `localStorage` under key `compareTypeConfigs`
- Backup to JSON file in `/public/data/compare-types/{templateKey}.json`
- Same synchronization strategy as ground truth (restoreDataFromFiles, saveToFile)

### 4. UI Components

**File**: `src/components/compare-types-tab.tsx`

Main tab component for compare type management.

**File**: `src/components/compare-type-editor.tsx`

Modal/dialog for configuring compare type parameters (especially LLM Judge).

**File**: `src/hooks/use-compare-types.tsx`

React context/hook for managing compare type state (similar to `use-ground-truth.tsx`).

```typescript
interface CompareTypeContextType {
  compareTypeConfig: CompareTypeConfig | null;
  setCompareType: (fieldKey: string, compareType: CompareType) => Promise<void>;
  setCompareParameters: (fieldKey: string, parameters: CompareParameters) => Promise<void>;
  importConfig: (jsonString: string) => Promise<void>;
  exportConfig: () => string;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
```

### 5. Integration with Metrics Calculation

**File**: `src/lib/metrics.ts` (update existing)

Update the metrics calculation to use the compare engine instead of inline comparison logic.

**Before**:
```typescript
// Direct inline comparison
const isMatch = normalizeText(predicted) === normalizeText(actual);
```

**After**:
```typescript
// Use compare engine
const compareConfig = getCompareConfigForField(fieldKey);
const result = await compareValues(predicted, actual, compareConfig);
const isMatch = result.isMatch;
```

**File**: `src/hooks/use-metrics-calculator.tsx` (update existing)

Update to handle async comparisons (LLM as Judge is async).

---

## Import/Export Functionality

### Export Format

**Filename**: `{templateKey}-compare-config-{timestamp}.json`

**Example**: `invoice_template-compare-config-20251108.json`

**Content**: Full `CompareTypeConfig` object (see Data Model section)

### Import Validation

When importing, validate:
1. **Schema version**: Check if compatible with current version
2. **Template key**: Warn if different from current template
3. **Field keys**: Warn if fields in config don't exist in template
4. **Compare types**: Validate all compare types are recognized
5. **Parameters**: Validate parameter schema for each type

### Import Behavior

**Merge Strategy**: Full replacement (not merge)
- All existing compare types for the template are replaced
- Option to preview changes before confirming

**Migration**: If schema version differs, attempt automatic migration with warnings

---

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
**Duration**: 2 weeks

**Deliverables**:
1. Data model and TypeScript types
2. Compare type storage (`compare-type-storage.ts`)
3. Basic compare engine (`compare-engine.ts`) with all comparison functions except LLM
4. Default compare type generation based on field types
5. Unit tests for comparison functions

**Success Criteria**:
- All non-LLM compare types working
- Storage and retrieval working with localStorage + file backup
- Default types auto-assigned on template load

### Phase 2: UI/UX (Compare Types Tab)
**Duration**: 2 weeks

**Deliverables**:
1. Compare Types tab component
2. Compare type selector dropdown
3. Parameter configuration modal (basic)
4. Import/Export buttons and functionality
5. Integration with existing template/field system
6. React context/hook (`use-compare-types.tsx`)

**Success Criteria**:
- Users can view and edit compare types for all fields
- Changes persist across sessions
- Import/Export working with validation

### Phase 3: LLM as Judge
**Duration**: 1.5 weeks

**Deliverables**:
1. Box AI integration (`llm-comparison.ts`)
2. Prompt template and response parsing
3. LLM Judge configuration UI (custom prompt editor)
4. Error handling and fallbacks
5. Testing with sample data

**Success Criteria**:
- LLM Judge comparison working via Box AI
- Custom prompts configurable
- Graceful error handling
- Response parsing robust

### Phase 4: Metrics Integration
**Duration**: 1 week

**Deliverables**:
1. Update `metrics.ts` to use compare engine
2. Update `use-metrics-calculator.tsx` for async comparisons
3. Update results display to show compare type used
4. Add comparison details to logs/debug info

**Success Criteria**:
- Accuracy metrics calculated using configured compare types
- All existing functionality preserved
- No performance degradation

### Phase 5: Polish & Documentation
**Duration**: 1 week

**Deliverables**:
1. User documentation
2. Help tooltips in UI
3. Example configurations
4. Performance optimization (caching, debouncing)
5. Comprehensive testing (integration tests)

**Success Criteria**:
- Polished user experience
- Clear documentation
- All edge cases handled
- Performance acceptable

**Total Duration**: ~7-8 weeks

---

## Success Metrics

### User Metrics
- **Adoption Rate**: % of users who configure custom compare types (target: >50% within 3 months)
- **LLM Usage**: % of fields using LLM as Judge (target: >20% of text fields)
- **Import/Export Usage**: % of users who import/export configs (target: >30%)

### System Metrics
- **Comparison Accuracy**: Reduction in false positives/negatives (measure via user feedback)
- **Performance**: P95 comparison latency <500ms (including LLM calls)
- **Reliability**: LLM API success rate >99.5%

### Quality Metrics
- **Bug Rate**: <5 bugs per 100 comparisons
- **User Satisfaction**: NPS >40 for compare types feature

---

## Open Questions

### Technical

1. **LLM Rate Limiting**: How should we handle Box AI rate limits for LLM as Judge?
   - **Options**: Queue system, user notification, fallback to near-exact match
   - **Decision**: TBD

2. **LLM Response Consistency**: How do we handle non-deterministic LLM responses?
   - **Options**: Multiple calls with voting, confidence thresholds, user review mode
   - **Decision**: TBD

3. **Performance**: Should we batch LLM calls for efficiency?
   - **Options**: Batch API calls, parallel processing, sequential with progress indicator
   - **Decision**: TBD

4. **Caching**: Should we cache LLM comparison results?
   - **Options**: Session-based cache, persistent cache with TTL, no cache
   - **Decision**: TBD

### UX

5. **Default Compare Types**: Should defaults be configurable globally or per-template?
   - **Options**: Global defaults, per-template defaults, hybrid
   - **Decision**: Per-template (Phase 1), global defaults (future)

6. **Bulk Edit**: Should we support bulk editing compare types (e.g., set all string fields to near-exact)?
   - **Options**: Yes (with multi-select), No (individual only)
   - **Decision**: Future enhancement

7. **Compare Type Presets**: Should we provide preset configurations for common use cases (invoices, contracts, etc.)?
   - **Options**: Built-in presets, community presets, none
   - **Decision**: Future enhancement

### Product

8. **Versioning**: How do we handle compare type config versioning and migration?
   - **Options**: Semantic versioning with migration scripts, breaking changes require manual update
   - **Decision**: Semantic versioning (included in data model)

9. **Collaboration**: Should compare type configs be shareable across teams/organizations?
   - **Options**: Export/import only, cloud sync, template library
   - **Decision**: Export/import (Phase 2), cloud sync (future)

---

## Appendix

### A. Related Files

- **Ground Truth**: `src/hooks/use-ground-truth.tsx`, `src/components/ground-truth-editor.tsx`
- **Current Comparison**: `src/lib/metrics.ts`, `src/lib/semantic-matcher.ts`
- **Box AI Integration**: `src/ai/flows/generate-initial-prompt.ts`, `src/services/box.ts`
- **Storage**: `src/lib/mock-data.ts`, `src/lib/actions/json-storage.ts`

### B. Dependencies

- **Box AI API**: `/ai/text_gen` endpoint (existing)
- **React Hook Form**: For compare type editor form
- **Zod**: For schema validation (import/export)
- **date-fns**: For date parsing (existing)

### C. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Box AI API changes/deprecation | High | Low | Abstract LLM interface, support multiple providers |
| LLM response inconsistency | Medium | Medium | Add confidence thresholds, user review mode |
| Performance degradation with LLM | Medium | Medium | Implement caching, batching, progress indicators |
| User confusion with many options | Medium | Low | Clear documentation, tooltips, sensible defaults |
| Import/export schema changes | Low | Medium | Semantic versioning, migration scripts |

### D. Future Enhancements

1. **Custom Compare Functions**: Allow users to write JavaScript functions for custom comparisons
2. **Compare Type Templates**: Share and reuse compare type configs across templates
3. **A/B Testing**: Compare different compare type strategies side-by-side
4. **ML-Based Auto-Configuration**: Suggest optimal compare types based on field content
5. **Fuzzy Matching for Numbers**: Tolerance-based numeric comparison
6. **Regular Expression Matching**: Pattern-based string comparison
7. **Multi-LLM Support**: Use different LLMs for different fields
8. **Compare Type Analytics**: Track which compare types perform best

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-08 | 0.1.0 | Initial draft | Product Team |

---

**End of Document**
