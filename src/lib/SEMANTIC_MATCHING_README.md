# Semantic Matching Feature

## 🎯 Overview

The semantic matching feature enhances the "Where Found" functionality by finding matches even when the ground truth and document text use different but equivalent terms.

**Example**: Ground truth `"NDA"` will now highlight `"Non Disclosure Agreement"` in the document.

## ✅ What's Included

- **50+ pre-configured acronym expansions** for business, legal, insurance, and HR documents
- **Bidirectional matching** (NDA ↔ Non Disclosure Agreement)
- **Number formatting support** (4000000 ↔ 4,000,000)
- **Easy enable/disable controls**
- **Simple dictionary management**
- **Zero false positives** (only exact synonym matches)

## 🚀 Quick Start

### Basic Usage
The feature is **enabled by default** and works automatically. No code changes needed in your application.

### Console Management
Open your browser console and try these commands:

```javascript
// Import the utilities
import { 
  listAllExpansions, 
  addExpansion, 
  removeExpansion,
  toggleSemanticMatching,
  enableSemanticMatching,
  disableSemanticMatching
} from '@/lib/semantic-matcher-utils';

// View current status
listAllExpansions();

// Add a custom expansion
addExpansion('API', ['Application Programming Interface', 'A.P.I.']);

// Remove an expansion
removeExpansion('API');

// Disable the feature
disableSemanticMatching();

// Re-enable with debug mode
enableSemanticMatching(true);
```

## 📚 Pre-configured Expansions

### Contract/Legal Terms
- **NDA**: Non Disclosure Agreement, Non-Disclosure Agreement
- **DPA**: Data Processing Agreement, Data Protection Agreement  
- **MSA**: Master Service Agreement, Master Services Agreement
- **SOW**: Statement of Work, Statement of Works
- **SLA**: Service Level Agreement, Service-Level Agreement

### Business Entities
- **LLC**: Limited Liability Company, L.L.C.
- **Corp**: Corporation, Corp.
- **Inc**: Incorporated, Inc.
- **Ltd**: Limited, Ltd., Limited Company

### Insurance Terms
- **GL**: General Liability
- **WC**: Workers Compensation, Workers Comp
- **E&O**: Errors and Omissions, Errors & Omissions
- **D&O**: Directors and Officers, Directors & Officers

### Executive Titles
- **CEO**: Chief Executive Officer, C.E.O.
- **CFO**: Chief Financial Officer, C.F.O.
- **CTO**: Chief Technology Officer, C.T.O.
- **COO**: Chief Operating Officer, C.O.O.
- **VP**: Vice President, V.P., Vice-President

### Number Formatting
- **4000000**: 4,000,000
- **1500**: 1,500
- **12.50**: 12.50 (exact decimal match)
- **1000000**: 1,000,000, 1.000.000 (European), 1 000 000 (space-separated)

[View complete list: run `listAllExpansions()` in console]

## 🛠️ Management Functions

### Add Expansions
```javascript
// Single expansion
addExpansion('CEO', 'Chief Executive Officer');

// Multiple expansions for one acronym
addExpansion('API', ['Application Programming Interface', 'A.P.I.']);

// Multiple acronyms at once
addMultipleExpansions([
  { acronym: 'CRM', expansions: ['Customer Relationship Management'] },
  { acronym: 'ERP', expansions: ['Enterprise Resource Planning'] }
]);
```

### Remove Expansions
```javascript
// Remove a specific acronym
removeExpansion('API');
```

### Control the Feature
```javascript
// Enable/disable
enableSemanticMatching();
disableSemanticMatching();
toggleSemanticMatching();

// Enable with debug logging
enableSemanticMatching(true);
```

### Quick Presets
```javascript
// Apply domain-specific presets
setupForContracts();    // Contract/legal terms
setupForInsurance();    // Insurance terms  
setupForHR();          // HR/employment terms
```

## 🔧 Technical Details

### File Structure
```
src/lib/
├── semantic-matcher.ts           # Core matching logic
├── semantic-matcher-utils.ts     # Management utilities
├── context-finder.ts            # Integration point
└── SEMANTIC_MATCHING_README.md  # This file
```

### Integration Points
- **context-finder.ts**: Lines 77-100 (clearly marked section)
- **Import**: Line 6 (single import statement)

### Performance Impact
- **Minimal**: Only runs if exact matches fail
- **Fast**: Simple dictionary lookups, no complex algorithms
- **Memory**: ~5KB for full dictionary

## 🚨 Easy Removal

If you need to remove this feature completely:

### Option 1: Disable (Recommended)
```javascript
disableSemanticMatching();
```

### Option 2: Complete Removal
1. **Remove the import** in `context-finder.ts` (line 6):
   ```typescript
   // DELETE THIS LINE:
   import { findSemanticMatch, isSemanticMatchingEnabled } from './semantic-matcher';
   ```

2. **Remove the integration section** in `context-finder.ts` (lines 77-100):
   ```typescript
   // DELETE THIS ENTIRE SECTION:
   // ==========================================
   // SEMANTIC MATCHING (Isolated Module)
   // ==========================================
   // ... all code between these comments
   // ==========================================
   // END SEMANTIC MATCHING
   // ==========================================
   ```

3. **Delete the files**:
   ```bash
   rm src/lib/semantic-matcher.ts
   rm src/lib/semantic-matcher-utils.ts
   rm src/lib/SEMANTIC_MATCHING_README.md
   ```

## 🎛️ Configuration Options

### Default Settings
```typescript
{
  enabled: true,           // Feature on/off
  confidence: 'medium',    // Confidence level for matches
  caseSensitive: false,    // Case-insensitive matching
  debug: false            // Debug logging
}
```

### Modify Settings
```javascript
// Enable debug mode to see matching activity
setSemanticDebugMode(true);

// Export current configuration
const config = exportConfiguration();
console.log(config);
```

## 🐛 Troubleshooting

### Feature Not Working
1. Check if enabled: `isSemanticMatchingEnabled()`
2. Enable debug mode: `setSemanticDebugMode(true)`
3. Check console for semantic matching logs

### False Positives
1. Remove problematic expansion: `removeExpansion('ACRONYM')`
2. Report issue with specific example

### Performance Issues
1. Disable temporarily: `disableSemanticMatching()`
2. Check dictionary size: `getSemanticMatchingStats()`

## 📈 Future Enhancements

Potential improvements (not implemented):
- Field-specific expansions
- Context-aware matching
- Machine learning from user feedback
- Custom confidence thresholds
- Regular expression patterns

## 🤝 Contributing

To add more expansions:
1. Use `addExpansion()` to test new mappings
2. Validate with real documents
3. Add to the default dictionary in `semantic-matcher.ts`

---

**Questions?** Check the console utilities or review the source code in `semantic-matcher.ts`. 