# Prompt Studio Fix Summary

## Problem Statement

Users reported that prompt studio tests often failed to return AI results when:
1. User runs comparison first
2. Then goes to prompt studio
3. Selects 3 files and runs test
4. AI returns no/wrong results

However, when users went directly to prompt studio without running comparison first, tests worked reliably.

## Investigation Results

### Flow Analysis Completed

✅ **Analyzed comparison flow** → Uses fields-based extraction without templateKey
✅ **Analyzed prompt studio flow** → Was incorrectly passing templateKey
✅ **Analyzed Box AI API behavior** → Discovered the root cause

### Root Cause Identified

The issue was **NOT** related to whether comparison was run first. The actual problem was in how Box AI API calls were made:

**Box AI API Logic** (`src/services/box.ts`):
```typescript
if (templateKey) {
  // Uses Box metadata template
  requestBody.metadata_template = { ... };
  // ❌ IGNORES the fields.prompt parameter
} else if (fields) {
  // Uses inline field definitions
  requestBody.fields = fields;
  // ✅ RESPECTS custom prompts in fields
}
```

**The Bug**:
- Prompt studio was passing `templateKey: accuracyData.templateKey`
- This caused Box AI to use template-based extraction
- Template-based extraction ignores custom prompts
- Result: Tests failed or returned wrong results

**Why it seemed related to comparison**:
- After running comparison, `accuracyData.templateKey` was always populated
- Made the issue more consistently reproducible
- But the bug existed whenever templateKey was set

## Solution Implemented

### File Changed: `src/components/prompt-studio-sheet.tsx`

**Location**: Line 432-440

**Before**:
```typescript
const result = await extractMetadata({
  fileId: job.fileId,
  fields: [testField],
  model: job.modelName,
  templateKey: accuracyData.templateKey  // ❌ This was the bug
});
```

**After**:
```typescript
// IMPORTANT: Don't pass templateKey here - we need to use inline fields to test custom prompts
// When templateKey is provided, Box AI uses the template which ignores custom prompts
// This matches the approach used in use-model-extraction-runner.tsx
const result = await extractMetadata({
  fileId: job.fileId,
  fields: [testField],
  model: job.modelName,
  // templateKey intentionally omitted to enable prompt testing
});
```

### Verification

✅ **No linter errors** introduced
✅ **Schema validation** confirmed (templateKey is optional in ExtractMetadataInput)
✅ **Consistent approach** with comparison runner
✅ **All call sites checked** - only one location needed fixing

## Testing Instructions

Test both scenarios to verify the fix:

### Scenario 1: Direct to Prompt Studio (was working, should still work)
1. Load fresh page
2. Select documents
3. Go to prompt studio
4. Select 3 files
5. Run test
6. ✅ Should return AI results

### Scenario 2: Comparison → Prompt Studio (was failing, should now work)
1. Load fresh page
2. Select documents
3. Run comparison
4. Go to prompt studio
5. Select 3 files
6. Run test
7. ✅ Should return AI results (was failing before fix)

## Technical Details

### Why Comparison Runner Works

The comparison runner (`use-model-extraction-runner.tsx`) already implements this correctly:

```typescript
// Line 195-196: Keep template key for validation purposes, but don't use it for extraction
const templateKeyForValidation = selectedTemplate?.templateKey || accuracyData.templateKey;

// Line 204-205: IMPORTANT: Always use fields-based extraction to enable prompt testing
// We'll validate against template constraints separately
```

And on line 347-351:
```typescript
const response = await extractMetadata({
  fileId: job.fileResult.id,
  fields: fieldsToUse,
  model: actualModelName,
  // NOTE: templateKey is NOT passed here
});
```

### Prompt Studio Now Follows Same Pattern

The fix aligns prompt studio with the comparison runner's approach, ensuring consistent behavior across the application.

## Impact

- **User-facing**: Prompt studio tests will now work consistently regardless of whether comparison was run first
- **Code quality**: Consistent extraction approach across all features
- **Technical debt**: Eliminated a subtle but critical API usage bug
- **Reliability**: Tests will be more predictable and reliable

## Related Documentation

- Full analysis: `docs/PROMPT_STUDIO_ISSUE_ANALYSIS.md`
- Technical specs: `docs/technical-specs.md`
- Box AI integration: `src/services/box.ts`





