# Orchestration Simplification - Testing Guide

**Date**: October 28, 2025  
**Branch**: feature/orchestration-improvements  
**Status**: Ready for Testing

---

## Quick Start

```bash
# Make sure you're on the right branch
git checkout feature/orchestration-improvements

# Pull latest changes
git pull origin feature/orchestration-improvements

# Clear any cached builds
rm -rf .next

# Start development server
npm run dev
```

Then open http://localhost:3000

---

## What Changed?

### Summary of Changes
1. **Eliminated code duplication** - Removed 45 lines of duplicated prompt-stripping logic
2. **Improved logging** - Replaced 7 console statements with production-ready logger
3. **Optimized state management** - Removed unnecessary data copying

### What Stayed the Same?
✅ **Box AI integration** - 100% unchanged  
✅ **API request/response handling** - Identical  
✅ **Field preparation** - Same logic, just centralized  
✅ **Error handling** - Same retry logic  
✅ **Progress tracking** - Same real-time updates  

---

## Testing Checklist

### 1. Basic Extraction Test ⭐ **START HERE**

**Goal**: Verify basic extraction still works

**Steps**:
1. Open the app at http://localhost:3000
2. Go to **Select Documents** page
3. Select a few documents from Box (or use existing)
4. Go to **Templates** page
5. Select or create a template with a few fields
6. Go back to **Home** page
7. Click **Run Comparison**
8. Select at least 2 models (e.g., `google__gemini_2_0_flash_001` and `azure_openai__gpt_4o_mini`)
9. Click **Run Extraction**

**Expected Results**:
- ✅ Progress bar appears and updates in real-time
- ✅ Extraction completes successfully
- ✅ Results appear in the table
- ✅ No errors in browser console
- ✅ Toast notification shows success message

**Check Console Logs**:
You should see structured logs like:
```
[2025-10-28T...] [DEBUG] Debug setup for extraction { modelName: '...', isNoPrompt: false, ... }
[2025-10-28T...] [DEBUG] Processing extraction { modelName: '...', fileId: '...', ... }
[2025-10-28T...] [INFO] Starting enhanced extraction with versioning
[2025-10-28T...] [DEBUG] Progress update { modelName: '...', fileName: '...', success: true }
[2025-10-28T...] [INFO] Extraction completed, processing results with versioning
[2025-10-28T...] [INFO] Results processed and stored with versioning
```

---

### 2. No-Prompt Variant Test ⭐ **CRITICAL**

**Goal**: Verify the dual-system (prompted vs non-prompted) still works

**Steps**:
1. From the **Home** page, click **Run Comparison**
2. Select a model AND its `_no_prompt` variant:
   - ✅ `google__gemini_2_0_flash_001`
   - ✅ `google__gemini_2_0_flash_001_no_prompt`
3. Click **Run Extraction**

**Expected Results**:
- ✅ Both models run successfully
- ✅ Results may differ (prompted vs non-prompted)
- ✅ No errors in console
- ✅ Console logs show:
  - For regular model: `isNoPrompt: false, includesPrompts: true`
  - For no-prompt model: `isNoPrompt: true, includesPrompts: false`

**Verification**:
Check console logs for field preparation:
```
[DEBUG] Debug setup for extraction { 
  modelName: 'google__gemini_2_0_flash_001',
  isNoPrompt: false,
  includesPrompts: true,
  description: 'Prompted extraction for google__gemini_2_0_flash_001 (5 fields with prompts)'
}

[DEBUG] Debug setup for extraction { 
  modelName: 'google__gemini_2_0_flash_001_no_prompt',
  isNoPrompt: true,
  includesPrompts: false,
  description: 'No-prompt extraction for google__gemini_2_0_flash_001 (5 fields, prompts stripped)'
}
```

---

### 3. Error Handling Test

**Goal**: Verify errors are logged correctly

**Steps**:
1. Go to **Settings** page
2. Temporarily invalidate your Box credentials (or wait for token to expire)
3. Try to run an extraction
4. Restore your credentials

**Expected Results**:
- ✅ Error toast appears with user-friendly message
- ✅ Console shows structured error log:
  ```
  [ERROR] Enhanced extraction failed { error: '...' }
  ```
- ✅ No unhandled exceptions
- ✅ App remains functional after error

---

### 4. Progress Tracking Test

**Goal**: Verify real-time progress updates work

**Steps**:
1. Run extraction with multiple files (5+) and multiple models (3+)
2. Watch the progress bar and status messages

**Expected Results**:
- ✅ Progress bar updates smoothly
- ✅ File/model names update in real-time
- ✅ Success/failure counts update correctly
- ✅ Console shows progress logs:
  ```
  [DEBUG] Progress update { modelName: '...', fileName: '...', success: true }
  ```

---

### 5. State Persistence Test

**Goal**: Verify data saves correctly

**Steps**:
1. Run an extraction
2. Wait for completion
3. Refresh the page (F5 or Cmd+R)
4. Check that results are still there

**Expected Results**:
- ✅ Results persist after page refresh
- ✅ No data loss
- ✅ Console shows auto-save working:
  ```
  [DEBUG] Auto-save triggered
  ```

---

### 6. Multi-Select Field Test

**Goal**: Verify multi-select field formatting works

**Steps**:
1. Create a template with a **multi-select** field
2. Run extraction
3. Check the results for that field

**Expected Results**:
- ✅ Multi-select values formatted correctly (e.g., "Option1, Option2, Option3")
- ✅ Console shows formatting log:
  ```
  [DEBUG] Formatted multi-select value { fieldKey: '...', original: 'Option1,Option2', formatted: 'Option1, Option2' }
  ```

---

### 7. Ground Truth Test

**Goal**: Verify ground truth is preserved

**Steps**:
1. Go to **Ground Truth** page
2. Set ground truth values for a few fields
3. Run extraction
4. Check that ground truth values are still there (not overwritten)

**Expected Results**:
- ✅ Ground truth values preserved
- ✅ Extraction results appear alongside ground truth
- ✅ Metrics calculated correctly

---

## Performance Verification

### Check for Performance Issues

**Before Testing**:
- Note the time it takes to run extraction with 5 files and 3 models

**After Testing**:
- Time should be **the same or faster** (optimizations should help)
- No UI freezing or lag
- Memory usage stable (check browser DevTools → Performance)

**Expected**:
- ✅ Extraction speed unchanged or improved
- ✅ UI remains responsive
- ✅ No memory leaks

---

## Console Log Verification

### Development Mode (Current)

You should see **DEBUG, INFO, WARN, ERROR** logs:

```
[2025-10-28T20:30:00.000Z] [DEBUG] Debug setup for extraction { ... }
[2025-10-28T20:30:00.100Z] [DEBUG] Processing extraction { ... }
[2025-10-28T20:30:00.200Z] [INFO] Starting enhanced extraction with versioning
[2025-10-28T20:30:01.000Z] [DEBUG] Progress update { ... }
[2025-10-28T20:30:05.000Z] [INFO] Extraction completed, processing results with versioning
[2025-10-28T20:30:05.100Z] [DEBUG] Field not found in extraction response { ... }
[2025-10-28T20:30:05.200Z] [INFO] Results processed and stored with versioning
```

### Production Mode (Optional Test)

To test production logging:
```bash
npm run build
npm start
```

You should see **ONLY WARN and ERROR** logs (no DEBUG or INFO in production).

---

## Common Issues & Solutions

### Issue: "ReferenceError: DUAL_SYSTEM is not defined"

**Solution**: Clear Next.js cache and restart
```bash
rm -rf .next
npm run dev
```

### Issue: Console logs not appearing

**Solution**: Check browser console filter settings
- Make sure "All levels" is selected
- Check that console is not cleared on navigation

### Issue: Extraction fails with "Field options missing"

**Solution**: This is expected behavior - make sure your template has options for enum/multiSelect fields

### Issue: Results not persisting after refresh

**Solution**: Check browser localStorage
- Open DevTools → Application → Local Storage
- Check for `accuracyData` key
- If missing, there may be a save error (check console for errors)

---

## Success Criteria

### ✅ All Tests Pass
- [ ] Basic extraction works
- [ ] No-prompt variant works
- [ ] Error handling works
- [ ] Progress tracking works
- [ ] State persistence works
- [ ] Multi-select formatting works
- [ ] Ground truth preserved

### ✅ No Regressions
- [ ] Extraction speed unchanged or faster
- [ ] UI remains responsive
- [ ] No new errors in console
- [ ] Box AI integration unchanged

### ✅ Logging Improvements Verified
- [ ] Structured logs in console
- [ ] Environment-aware logging
- [ ] No console.log statements
- [ ] Production-ready

---

## Next Steps After Testing

### If All Tests Pass ✅

1. **Mark testing TODO as complete**
2. **Notify team** that orchestration improvements are ready for review
3. **Request code review** from senior developer
4. **Prepare for merge** to main branch

### If Issues Found ❌

1. **Document the issue** (what happened, expected vs actual)
2. **Check console logs** for error details
3. **Report to development team** with:
   - Steps to reproduce
   - Console logs
   - Screenshots if applicable
4. **Do not merge** until issues are resolved

---

## Questions?

If you encounter any issues or have questions during testing:

1. **Check console logs** - Most issues will have detailed error messages
2. **Review the summary** - `docs/ORCHESTRATION_SIMPLIFICATION_SUMMARY.md`
3. **Check the plan** - `docs/BACKEND_ORCHESTRATION_IMPROVEMENT_PLAN.md`
4. **Ask for help** - Provide console logs and steps to reproduce

---

## Testing Completed By

**Name**: _________________  
**Date**: _________________  
**Result**: ✅ Pass / ❌ Fail  
**Notes**: _________________

---

**Happy Testing! 🚀**

