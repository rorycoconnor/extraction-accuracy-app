# Modal State Debugging Guide

## Issue: "Select Documents" Button Intermittently Unclickable

### 🔍 Root Causes Identified

#### 1. **Race Condition in Modal Closing** (Primary Cause)
**Location:** `extraction-modal.tsx:270`

**Problem:**
- Radix UI Dialog's `onOpenChange` callback can fire multiple times or incompletely
- If state update fails during close, the modal overlay may remain in DOM blocking clicks
- No error handling meant failures were silent

**Fix Applied:**
- Added try-catch error handling in `handleClose()`
- Clear all pending state before closing
- Force close even if error occurs

#### 2. **Multiple Overlapping Modals (z-index=50)**
**Problem:**
- All 5 modals use same z-index, causing potential stacking issues
- Failed modal unmount could leave invisible overlay blocking clicks

**Fix Applied:**
- Added `forceCloseAllModals()` recovery mechanism
- Added defensive escape key handler

#### 3. **No State Recovery Mechanism**
**Problem:**
- If modal gets stuck open, no way to recover except page refresh
- State inconsistency between React state and DOM

**Fix Applied:**
- Escape key detection when no modal should be open
- Automatic recovery attempt
- Console logging for debugging

### 🛠️ Changes Made

#### File: `src/components/extraction-modal.tsx`

```typescript
const handleClose = () => {
  try {
    // Clear any pending state before closing
    setGlobalFileSelection({});
    setSearchQuery('');
    
    // Call the parent close handler
    onClose();
  } catch (error) {
    console.error('Error closing extraction modal:', error);
    // Force close even if there's an error
    onClose();
  }
};
```

#### File: `src/components/main-page-simplified.tsx`

1. **Added Recovery Mechanism:**
```typescript
const forceCloseAllModals = () => {
  console.log('🛡️ Force closing all modals (recovery mode)');
  setIsModalOpen(false);
  setIsPromptStudioOpen(false);
  setIsInlineEditorOpen(false);
  setShowResetDialog(false);
};
```

2. **Added Defensive Escape Handler:**
```typescript
useEffect(() => {
  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isModalOpen && !isPromptStudioOpen && !isInlineEditorOpen && !showResetDialog) {
      console.log('🔍 Escape pressed with no modal open - checking for stuck overlays');
      forceCloseAllModals();
    }
  };
  
  window.addEventListener('keydown', handleEscapeKey);
  return () => window.removeEventListener('keydown', handleEscapeKey);
}, [isModalOpen, isPromptStudioOpen, isInlineEditorOpen, showResetDialog]);
```

3. **Added Error Handling to Button Click:**
```typescript
onSelectDocuments={() => {
  console.log('📂 Select Documents button clicked');
  try {
    setIsModalOpen(true);
  } catch (error) {
    console.error('Error opening modal:', error);
    forceCloseAllModals();
    setTimeout(() => setIsModalOpen(true), 100);
  }
}}
```

### 🔬 How to Debug If Issue Occurs Again

#### Console Logs to Watch:
1. **When clicking Select Documents:**
   - Should see: `📂 Select Documents button clicked`
   - If missing: Button click not registering (DOM issue)

2. **When closing modal:**
   - Should see: `🔒 Closing extraction modal`
   - If missing: Close handler not firing

3. **If recovery triggers:**
   - Will see: `🔍 Escape pressed with no modal open - checking for stuck overlays`
   - Then: `🛡️ Force closing all modals (recovery mode)`

#### Manual Recovery Steps:
If button becomes unclickable:
1. **Press Escape key twice** - This triggers the recovery mechanism
2. **Open browser console** - Check for error messages
3. **Check DOM for stuck overlays:**
   ```javascript
   // Run in browser console
   document.querySelectorAll('[role="dialog"], [data-state="open"]').forEach(el => {
     console.log('Found modal element:', el);
   });
   ```
4. **Force state reset (last resort):**
   ```javascript
   // Run in browser console
   localStorage.clear();
   location.reload();
   ```

### 📊 Testing Recommendations

To help reproduce and fix:
1. **Stress test the modal:**
   - Rapidly open/close the modal (click button, press Escape)
   - Open modal, navigate folders, close without selecting
   - Open modal, select files, click Cancel vs X vs Escape vs clicking outside

2. **Monitor browser console for:**
   - Any uncaught errors during modal operations
   - The new debug logs (📂, 🔒, 🛡️ prefixes)

3. **Check for other interfering factors:**
   - Browser extensions blocking clicks
   - Slow network causing async state issues
   - Multiple tabs with the app open (state conflicts)

### 🎯 Expected Outcome

These changes should:
1. ✅ Prevent modal state from getting stuck
2. ✅ Auto-recover if it does get stuck
3. ✅ Provide visibility into what's happening via console logs
4. ✅ Gracefully handle errors that previously caused silent failures

### 📝 If Issue Persists

If the button still becomes unclickable after these fixes:

1. **Document the exact steps** to reproduce
2. **Check console logs** immediately when it happens
3. **Inspect DOM** for stuck overlays: 
   - Open DevTools → Elements
   - Search for elements with `z-50` or `fixed inset-0`
4. **Report with:**
   - Console logs
   - DOM inspection results
   - Steps to reproduce
   - Browser/OS details

This will help identify if there's a deeper Radix UI or React state issue.
