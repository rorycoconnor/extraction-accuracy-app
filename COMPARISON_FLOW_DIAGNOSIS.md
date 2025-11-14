# Run Comparison Flow Diagnosis

## What I Found

### Code Flow Analysis

1. **Main Page Component** (`src/components/main-page-simplified.tsx`)
   - Uses `useEnhancedComparisonRunner` hook with `selectedTemplate`
   - Passes `handleRunComparison` to ControlBar
   - Connection appears correct: Line 792 `onRunComparison={handleRunComparison}`

2. **Enhanced Comparison Runner** (`src/hooks/use-enhanced-comparison-runner.tsx`)
   - Properly uses `selectedTemplate` parameter
   - Passes it to `runExtractions` on line 175
   - Has correct dependencies in useCallback (line 263-277)
   - Uses AccuracyDataStore for state management

3. **Template Selection Flow** (`src/hooks/use-extraction-setup.tsx`)
   - `setSelectedTemplate(template)` called on line 70 when files are selected
   - Creates accuracyData structure with fields and results
   - Initializes shownColumns with default models

4. **Control Bar** (`src/components/control-bar.tsx`)
   - Button on line 247-259 calls `onRunComparison` 
   - Properly disabled when `isExtracting` or `!accuracyData`

### Test Results

Tests show some mocking issues but no critical failures in core logic:
- ✅ 320 tests passed
- ❌ 30 tests failed (mostly mocking issues in `use-metrics-calculator.test.tsx`)
- The failures are related to `calculateFieldMetricsWithDebugAsync` not being properly mocked

### Potential Issues

1. **selectedTemplate might be null** when Run Comparison is clicked
   - Check: Is template properly set after selecting documents?
   
2. **AccuracyDataStore state synchronization**
   - The runner uses `state.data` from store
   - Main page uses both new store (compatData) and old system (fallback)
   - Possible timing/sync issue between the two systems

3. **Our recent changes to Templates page**
   - We added `useAccuracyDataCompat` import to templates page
   - We modified Prompt Studio integration
   - These changes shouldn't affect main page, but worth verifying

## Diagnostic Steps

### Step 1: Check Console for Errors
When you click "Run Comparison", open browser DevTools console and look for:
- Any JavaScript errors
- Logger output starting with "Starting enhanced extraction"
- Toast notifications

### Step 2: Verify selectedTemplate
Add this temporarily to main-page-simplified.tsx after line 285:
```typescript
useEffect(() => {
  console.log('🔍 Selected Template:', selectedTemplate);
}, [selectedTemplate]);
```

### Step 3: Check accuracyData
Add this temporarily after line 111:
```typescript
useEffect(() => {
  console.log('🔍 Accuracy Data:', {
    hasData: !!accuracyData,
    templateKey: accuracyData?.templateKey,
    resultCount: accuracyData?.results?.length,
    fieldCount: accuracyData?.fields?.length
  });
}, [accuracyData]);
```

### Step 4: Test Button Click
Add this temporarily to line 379:
```typescript
const handleRunComparison = () => {
  console.log('🔍 Run Comparison Clicked!', {
    hasTemplate: !!selectedTemplate,
    hasAccuracyData: !!accuracyData,
    isExtracting: enhancedRunner.isExtracting
  });
  enhancedRunner.handleRunComparison();
};
```

## What to Look For

1. **Does selectedTemplate exist?** If null, the extraction won't work
2. **Does accuracyData have results?** Should have files loaded from document selection
3. **Are there any console errors?** Could indicate a breaking change
4. **Does the button appear disabled?** Indicates missing data

## Questions for User

1. What specifically happens when you click "Run Comparison"?
   - Nothing happens?
   - Gets an error?
   - Starts but doesn't complete?
   - Works but results are wrong?

2. Can you see the "Run Comparison" button?
   - Is it enabled or disabled?
   - What's the button text?

3. Did you select documents before clicking "Run Comparison"?
   - Template selected?
   - Files selected?
   - "Files Loaded" toast appeared?

4. Any errors in the browser console?

