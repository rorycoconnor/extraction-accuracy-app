# Troubleshooting Guide

This guide covers common issues and solutions for Agent Alpha, Prompt Studio, and the Box Optimizer application.

## Table of Contents

1. [Agent Alpha Issues](#agent-alpha-issues)
2. [Prompt Studio Issues](#prompt-studio-issues)
3. [Extraction Issues](#extraction-issues)
4. [Authentication Issues](#authentication-issues)
5. [Performance Issues](#performance-issues)
6. [UI/Display Issues](#uidisplay-issues)

---

## Agent Alpha Issues

### "Run Comparison First" Error

**Symptom**: Agent Alpha won't start, shows "Run Comparison First" message.

**Cause**: Agent Alpha requires comparison results to identify fields that need optimization.

**Solution**:
1. Select documents from your Box folder
2. Click "Run Comparison" to extract and compare results
3. Wait for comparison to complete
4. Try Agent Alpha again

### "No accuracy data" Error

**Symptom**: Agent Alpha shows "No accuracy data" toast message.

**Cause**: No documents or template is loaded.

**Solution**:
1. Ensure you've selected a template
2. Load documents from Box
3. Run at least one comparison

### "All Fields Accurate" Message

**Symptom**: Agent Alpha completes immediately with "All fields at 100% accuracy."

**Cause**: All enabled fields already have perfect accuracy.

**Solution**:
- This is actually success - your prompts are working well
- If you expected fields to optimize, check that ground truth is set
- Verify fields are not disabled in template configuration

### Agent Alpha Takes Too Long

**Symptom**: Optimization seems stuck or takes excessive time.

**Possible Causes**:
1. Too many documents configured
2. Too many concurrent fields hitting rate limits
3. Complex fields requiring many iterations
4. API latency issues

**Solutions**:
1. Reduce "Test Documents" to 5-8
2. Reduce "Concurrent Fields" to 3
3. Reduce "Max Attempts" to 3-5
4. Check network connectivity

### Fields Not Improving

**Symptom**: Agent Alpha completes but accuracy didn't improve.

**Possible Causes**:
1. No ground truth data for field
2. Ground truth values are incorrect
3. Field extraction is fundamentally difficult
4. Document quality issues (poor OCR)

**Solutions**:
1. Verify ground truth exists and is correct
2. Try manual prompt engineering in Prompt Studio
3. Review document quality in Box
4. Consider using a different AI model

### "Will Skip" Results

**Symptom**: Some fields show "Will Skip - No Improvement."

**Cause**: The optimized prompt performed worse than or equal to the original.

**This is intentional behavior** - Agent Alpha won't apply prompts that don't improve accuracy.

**Solutions**:
1. Review the field manually in Prompt Studio
2. Add more specific ground truth data
3. Try running Agent Alpha again with different settings

---

## Prompt Studio Issues

### Generate Prompt Not Working

**Symptom**: "Generate Prompt" button doesn't produce a prompt.

**Possible Causes**:
1. API authentication expired
2. Network connectivity issues
3. Rate limiting from AI provider

**Solutions**:
1. Check Settings page for authentication status
2. Verify network connectivity
3. Wait a few moments and try again
4. Check browser console for error details

### Test Results Show "ERROR"

**Symptom**: Test results display "ERROR" instead of extracted values.

**Possible Causes**:
1. File not accessible in Box
2. File format not supported
3. API rate limiting
4. Prompt syntax issues

**Solutions**:
1. Verify file still exists in Box
2. Check file permissions
3. Try testing with fewer files
4. Simplify the prompt and retry

### Copy to Clipboard Failed

**Symptom**: Copying prompt shows "Copy Failed" error.

**Cause**: Browser clipboard access was denied or unavailable.

**Solutions**:
1. Ensure you're using HTTPS (not HTTP)
2. Check browser permissions for clipboard
3. Try selecting text manually and using Ctrl/Cmd+C
4. Use a different browser

### Version History Not Showing

**Symptom**: No version history appears for a field.

**Cause**: No versions have been saved yet.

**Solution**:
- Save your first version by clicking "Save as New Version"
- Version history only shows after at least one save

### Prompt Library Empty

**Symptom**: Prompt Library dialog shows no prompts.

**Cause**: No prompts have been saved to the library.

**Solution**:
- Save prompts with the favorite/star feature to add to library
- Import prompts from successful fields

---

## Extraction Issues

### "Pending..." Status Never Completes

**Symptom**: Extraction status shows "Pending..." indefinitely.

**Possible Causes**:
1. API timeout
2. Network issues
3. Rate limiting
4. Server-side processing delay

**Solutions**:
1. Refresh the page and try again
2. Check network connectivity
3. Reduce number of concurrent extractions
4. Wait a few minutes and retry

### Extraction Returns Wrong Values

**Symptom**: Extracted values don't match document content.

**Possible Causes**:
1. Prompt is too vague
2. Document format is unusual
3. OCR quality issues
4. Model limitations

**Solutions**:
1. Make prompt more specific (see [User Guide](./USER_GUIDE.md))
2. Add location hints to prompt
3. Add synonyms for alternative phrases
4. Try a different AI model

### "Not Found" When Value Exists

**Symptom**: Field returns "Not Present" but value is in document.

**Possible Causes**:
1. Prompt doesn't match document phrasing
2. Value is in unexpected location
3. Document layout confuses extraction

**Solutions**:
1. Add more synonyms to the prompt
2. Specify exact location in document
3. Review document to understand layout
4. Use Prompt Studio to test variations

---

## Authentication Issues

### "401 Unauthorized" Errors

**Symptom**: API calls fail with authentication errors.

**Cause**: Box developer token or OAuth token has expired.

**Solutions**:
1. Go to Settings page
2. Re-authenticate with Box
3. Generate a new developer token
4. Check token hasn't been revoked

### "403 Forbidden" Errors

**Symptom**: Cannot access files or folders.

**Cause**: Insufficient permissions for the service account or user.

**Solutions**:
1. Verify folder permissions in Box
2. Ensure service account has access
3. Check enterprise AI is enabled
4. Contact Box admin for permissions

### OAuth Refresh Failures

**Symptom**: App suddenly loses authentication.

**Cause**: Refresh token expired or revoked.

**Solutions**:
1. Log out and re-authenticate
2. Check OAuth app settings in Box Developer Console
3. Verify redirect URIs are correct

---

## Performance Issues

### Slow Page Load

**Symptom**: Application takes long time to load or respond.

**Possible Causes**:
1. Large number of documents
2. Excessive localStorage data
3. Network latency
4. Memory constraints

**Solutions**:
1. Clear old comparison data
2. Reduce document selection
3. Use production build (`npm run build`)
4. Check browser developer tools for bottlenecks

### High Memory Usage

**Symptom**: Browser becomes slow or unresponsive.

**Possible Causes**:
1. Too many documents loaded
2. Large file previews
3. Memory leaks

**Solutions**:
1. Refresh the page periodically
2. Work with smaller document batches
3. Close unused browser tabs
4. Clear localStorage: `localStorage.clear()` in console

### API Rate Limiting (429 Errors)

**Symptom**: Operations fail with "Too Many Requests" errors.

**Cause**: Exceeded API rate limits.

**Solutions**:
1. Reduce concurrent operations
2. Add delays between requests
3. Process documents in smaller batches
4. Wait before retrying

---

## UI/Display Issues

### Modal Doesn't Close

**Symptom**: Agent Alpha or Prompt Studio modal stays open.

**Solution**:
1. Press Escape key
2. Click outside the modal
3. Refresh the page if unresponsive

### Progress Bar Stuck

**Symptom**: Progress indicator doesn't update.

**Possible Causes**:
1. Background process completed
2. UI state out of sync
3. JavaScript error

**Solutions**:
1. Check if operation actually completed
2. Refresh the page
3. Check browser console for errors

### Dark Mode Issues

**Symptom**: UI elements display incorrectly in dark mode.

**Solutions**:
1. Toggle dark mode off and on
2. Refresh the page
3. Clear browser cache
4. Report specific issues to development team

### Table Not Rendering

**Symptom**: Extraction table appears empty or broken.

**Possible Causes**:
1. No data loaded
2. JavaScript error
3. Browser compatibility issue

**Solutions**:
1. Verify data is loaded (check stats panel)
2. Refresh the page
3. Try a different browser
4. Check browser console for errors

---

## Getting More Help

If these solutions don't resolve your issue:

1. **Check Console Logs**: Open browser developer tools (F12) and check Console tab for errors
2. **Review Network Tab**: Look for failed API requests
3. **Clear Cache**: Try clearing browser cache and localStorage
4. **Try Incognito**: Test in incognito/private mode to rule out extensions
5. **Report Issue**: File a GitHub issue with:
   - Steps to reproduce
   - Browser and version
   - Console error messages
   - Screenshots if applicable

## Debug Information

To gather debug info for support:

```javascript
// Run in browser console
console.log('LocalStorage keys:', Object.keys(localStorage));
console.log('Browser:', navigator.userAgent);
console.log('URL:', window.location.href);
```

This information helps diagnose issues faster.
