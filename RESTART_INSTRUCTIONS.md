# How to Restart After Refactoring

## Issue
Browser/Next.js is caching old Firebase Studio code that was refactored.

## Solution - Complete Restart Process

### Step 1: Stop the Dev Server
```bash
# Press Ctrl+C in your terminal to stop the dev server
```

### Step 2: Clear All Caches (ALREADY DONE)
```bash
# The .next cache has been cleared automatically
rm -rf .next
```

### Step 3: Start Fresh Dev Server
```bash
npm run dev
```

### Step 4: Clear Browser Cache
1. **In Chrome/Brave**:
   - Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) for hard refresh
   - OR open DevTools (F12) → Network tab → Check "Disable cache"

2. **Or Clear Completely**:
   - Chrome → Settings → Privacy → Clear browsing data
   - Choose "Cached images and files"
   - Click "Clear data"

### Step 5: Test the App
1. Navigate to `http://localhost:9002`
2. Try running an extraction
3. Check console for the new log messages:
   - Should see: "🔍 Processing: Prompted extraction..." or "No-prompt extraction..."
   - Should NOT see any `isNoPromptModel` errors

## What Was Fixed

✅ Created `src/lib/dual-system-utils.ts` - New utility module
✅ Removed duplicate code from `use-model-extraction-runner.tsx`
✅ Simplified `main-page-simplified.tsx` state management
✅ Cleared `.next` build cache

## If Error Persists

If you still see the error after restarting:

1. **Check the terminal** - make sure the old dev server is fully stopped
2. **Check for multiple terminals** - only one dev server should run
3. **Force kill Node processes**:
   ```bash
   killall node
   npm run dev
   ```

4. **Clear node_modules cache** (nuclear option):
   ```bash
   rm -rf node_modules/.cache
   npm run dev
   ```

## Expected Console Output

After restart, you should see these NEW log messages:

```
🔍 Processing: Prompted extraction for google__gemini_2_0_flash_001 (5 fields with prompts)
🔍 API model name: google__gemini_2_0_flash_001
📝 Sample field for google__gemini_2_0_flash_001: { key: 'fieldName', hasPrompt: true, ... }
✅ PROMPT REQUEST: Prompts included for A/B testing
```

Or for no-prompt models:
```
🔍 Processing: No-prompt extraction for google__gemini_2_0_flash_001 (5 fields, prompts stripped)
🔍 API model name: google__gemini_2_0_flash_001
📝 Sample field for google__gemini_2_0_flash_001_no_prompt: { key: 'fieldName', hasPrompt: false, ... }
🚫 NO-PROMPT REQUEST: Prompts removed for A/B testing
```

## Verification Checklist

After restarting, verify:
- [ ] Dev server starts without errors
- [ ] Browser loads without console errors
- [ ] Can select documents
- [ ] Can run extraction (prompted model)
- [ ] Can run extraction (no-prompt model)
- [ ] State persists (save prompts, toggle columns)
- [ ] No `isNoPromptModel is not defined` errors

## Need Help?

If issues persist, check:
1. Terminal output for any build errors
2. Browser console for specific error messages
3. Network tab in DevTools to see if requests are going through

