# Prompt Studio Issue Analysis

## Issue Description

When users run comparison first, then go to prompt studio and test a prompt, the AI often returns no results. However, if users go directly to prompt studio without running comparison first, tests work reliably.

## Root Cause

The issue is **NOT** related to whether comparison was run or not. The actual problem is in how the Box AI API is called from prompt studio:

### Box AI API Behavior

In `src/services/box.ts` (lines 428-439), there's an if-else logic that determines how to call Box AI:

```typescript
// CRITICAL FIX: Use Box metadata template when available
if (templateKey) {
  boxLogger.debug('Using Box metadata template', { templateKey });
  requestBody.metadata_template = {
    template_key: templateKey,
    scope: 'enterprise'
  };
} else if (fields) {
  boxLogger.debug('Using inline field definitions (fallback)');
  requestBody.fields = fields;
} else {
  throw new Error('Either templateKey or fields must be provided');
}
```

**The Critical Issue**: When `templateKey` is provided, Box AI uses the template-based extraction which:
- Uses the template's field definitions from Box's metadata template
- **IGNORES the custom prompts** passed in the `fields` parameter
- Returns results based on the template's default behavior, not the custom prompt being tested

### Flow Comparison

#### Comparison Runner (Working)
Location: `src/hooks/use-model-extraction-runner.tsx` (lines 347-351)

```typescript
const response = await extractMetadata({
  fileId: job.fileResult.id,
  fields: fieldsToUse,
  model: actualModelName,
  // NOTE: templateKey is NOT passed here
});
```

**Result**: Box AI receives only inline field definitions with custom prompts → Works correctly

#### Prompt Studio (Broken)
Location: `src/components/prompt-studio-sheet.tsx` (lines 432-437)

```typescript
const result = await extractMetadata({
  fileId: job.fileId,
  fields: [testField],
  model: job.modelName,
  templateKey: accuracyData.templateKey  // ❌ THIS IS THE PROBLEM
});
```

**Result**: Box AI receives templateKey → Uses template, ignores custom prompt → Returns wrong/no results

## Why It Seemed Related to Comparison

The issue appeared to be related to running comparison first because:

1. Users who went straight to prompt studio were likely testing on fresh data where `accuracyData.templateKey` might not be set
2. After running comparison, the `accuracyData` object is fully populated including the `templateKey`
3. This made the issue more consistently reproducible after comparison runs

But the actual problem is **always present** when `templateKey` is set in `accuracyData` - it just becomes more consistent after comparison runs.

## Solution

Remove the `templateKey` parameter from the prompt studio test extraction call. Prompt studio should always use inline field definitions to test custom prompts.

### Fix Location

File: `src/components/prompt-studio-sheet.tsx` (line 432-437)

**Before:**
```typescript
const result = await extractMetadata({
  fileId: job.fileId,
  fields: [testField],
  model: job.modelName,
  templateKey: accuracyData.templateKey
});
```

**After:**
```typescript
const result = await extractMetadata({
  fileId: job.fileId,
  fields: [testField],
  model: job.modelName,
  // Don't pass templateKey - we need to use inline fields to test custom prompts
});
```

## Implementation Notes

The comparison runner already implements this correctly (see comment on line 204-205 in `use-model-extraction-runner.tsx`):

```typescript
// IMPORTANT: Always use fields-based extraction to enable prompt testing
// We'll validate against template constraints separately
```

Prompt studio needs to follow the same pattern to enable testing of custom prompts.

## Testing Verification

After the fix, test both scenarios:

1. **Direct to Prompt Studio**: Should work ✓
2. **Comparison → Prompt Studio**: Should now work ✓ (was failing before)

Both flows should produce consistent results because they'll use the same extraction approach (inline fields without templateKey).





