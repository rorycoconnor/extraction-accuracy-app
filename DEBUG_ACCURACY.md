# Debug Steps for Accuracy Issue

## Quick Test

Open browser console and run this after extraction completes:

```javascript
// Check if averages exist in the store
const checkAccuracy = () => {
  // Get the React component tree
  const root = document.querySelector('#__next');
  
  // Log what we can find
  console.log('=== Accuracy Debug ===');
  console.log('1. Check localStorage:');
  const stored = localStorage.getItem('accuracyData');
  if (stored) {
    const data = JSON.parse(stored);
    console.log('Averages in storage:', data.averages);
    console.log('Results count:', data.results?.length);
  } else {
    console.log('No data in localStorage');
  }
};

checkAccuracy();
```

## What to Look For

1. **Are averages calculated?**
   - Check if `data.averages` has values
   - Should look like: `{ "field1": { "model1": { accuracy: 0.8, ... }, ... }, ... }`

2. **Are results populated?**
   - Check if `data.results` has extraction data
   - Each result should have `fields` with model outputs

3. **Console errors?**
   - Look for any errors during "Calculating metrics..." phase
   - Check for async/await issues

## Likely Issues

### Issue 1: Averages not calculated
- **Symptom**: `data.averages` is empty `{}`
- **Cause**: Metrics calculation failing silently
- **Fix**: Check `processExtractionResults` function

### Issue 2: Averages calculated but not displayed
- **Symptom**: `data.averages` has values but table shows "Accuracy 0%"
- **Cause**: UI not reading from correct data source
- **Fix**: Check table component data binding

### Issue 3: Race condition
- **Symptom**: Sometimes works, sometimes doesn't
- **Cause**: Async state updates not completing
- **Fix**: Ensure all promises resolve before dispatch

