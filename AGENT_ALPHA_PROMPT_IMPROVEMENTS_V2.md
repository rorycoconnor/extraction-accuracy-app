# Agent-Alpha Prompt Generation V2

## Summary
Completely redesigned prompt generation based on Claude 4.5 recommendations for dramatically improved extraction prompt quality.

---

## Key Improvements Implemented

### 1. ✅ Multiple Diverse Examples (Not Just One)
**Before**: Single "Termination for Convenience" example
**After**: Four examples covering different field types:
- **Enum Field**: Termination for Convenience (Yes/No)
- **Date Field**: Contract End Date (with format + calculation guidance)
- **String Field**: Governing Law (with disambiguation)
- **Number Field**: Payment Amount (with formatting rules)

### 2. ✅ Bad vs Good Contrast Patterns
Added explicit "Common Mistakes to AVOID" section:
```
❌ Too Vague: "Extract the date from the document"
❌ No Synonyms: "Extract the contract value"
❌ Ambiguous Logic: "Extract if termination is allowed"
❌ Wrong Scope: "Find the payment amount in Section 5"
❌ No Edge Cases: "Extract the party name"

✅ Good Pattern: Action + scope → Synonyms → Output format → Edge cases → Negative guidance
```

### 3. ✅ Failure Analysis Framework
Systematic diagnosis of failure types:
- **Type 1: Missing Values** → Expand synonyms, add "search entire document"
- **Type 2: Wrong Values** → Add negative guidance, disambiguation rules
- **Type 3: Format Errors** → Specify exact output format with examples
- **Type 4: Inconsistent Logic** → Provide explicit if-then decision tree
- **Type 5: False Positives** → Add conditions for "Not Present"

### 4. ✅ Step-by-Step JSON Response Structure
Requires LLM to think systematically:
```json
{
  "analysis": {
    "failureType": "missing_values|wrong_values|format_errors|...",
    "rootCause": "Brief diagnosis (1 sentence)",
    "keyPatterns": ["Pattern 1", "Pattern 2"]
  },
  "newPrompt": "The improved extraction instruction",
  "improvements": [
    "Added synonym: [specific]",
    "Added negative guidance: [specific]",
    "Clarified output format: [specific]"
  ],
  "reasoning": "Why these changes address the failures"
}
```

### 5. ✅ Document-Type Context
Infers document type from field name and provides relevant context:
- **Contracts**: parties, term, payment, termination, governing law, signatures
- **Leases**: premises, rent, term, renewal options, maintenance responsibilities
- **Invoices**: bill to/from, invoice number, date, line items, total amount

### 6. ✅ Few-Shot Learning from Successes
When successful extractions exist, prompts the LLM to:
> "What aspect of the current prompt enabled these successes? Preserve that aspect while fixing failures."

### 7. ✅ Iteration-Aware Guidance
For iterations > 2, adds urgent guidance:
```
⚠️ CRITICAL: This is iteration 3/5 - previous prompts have not achieved 100% accuracy.
Take a SIGNIFICANTLY DIFFERENT approach. Consider:
- Are you making assumptions about document structure?
- Is the field name misleading?
- Are there multiple valid interpretations?
- Is the current approach fundamentally flawed?

DO NOT make minor tweaks. Make substantial changes.
```

### 8. ✅ Validation Checklist
LLM must verify before submitting:
```
□ Starts with action verb ("Extract", "Search for", "Identify")
□ Includes "search entire document" or similar scope
□ Lists 3+ synonym variations (if applicable)
□ Specifies exact output format with example
□ Contains at least one "Do NOT..." negative guidance
□ Is 2-4 sentences OR 3-5 bullet points (not both)
□ Handles the "not found" case explicitly
□ Is DIFFERENT from previous failed prompts
```

### 9. ✅ Failure Type Auto-Detection
Automatically tags each failure with its type:
```
- Model Extracted: ""
- Expected Value: "Delaware"
- Issue Type: MISSING VALUE (model found nothing when value exists)
```

### 10. ✅ Enhanced Field-Type Guidance
More detailed guidance per field type:
- **Enum**: Decision criteria, disambiguation, default rules
- **Date**: Format, synonyms, relative date handling, Not Present
- **String**: Verbatim vs normalized, multiple occurrences, character limits
- **Number**: Format, ranges, written numbers, N/A handling
- **MultiSelect**: Delimiters, valid options, None handling

---

## Expected Impact

### Before (Generic Prompts)
```
"Extract the governing law from the document."
```
**Problems**: No synonyms, no format, no edge cases, no negative guidance

### After (High-Quality Prompts)
```
"Search the entire document for governing law provisions. Look for phrases 
like 'governed by the laws of', 'subject to the jurisdiction of', or 
'shall be construed in accordance with'. Extract ONLY the jurisdiction 
name (e.g., 'Delaware', 'New York', 'England and Wales'). Do NOT extract 
venue or arbitration locations. If multiple jurisdictions are mentioned, 
return the one specified for governing law interpretation. Return 'Not 
Present' if no governing law clause exists."
```
**Improvements**: ✓ Synonyms ✓ Format ✓ Edge cases ✓ Negative guidance ✓ Not found handling

---

## Technical Details

### File Modified
`src/lib/agent-alpha-prompts.ts`

### New Helper Function
```typescript
function getDocumentType(fieldName: string): string {
  // Infers contract, lease, invoice, or legal/financial
}
```

### Updated Response Type
```typescript
export type AgentAlphaPromptResponse = {
  newPrompt: string;
  reasoning: string;
  analysis?: {
    failureType: string;
    rootCause: string;
    keyPatterns: string[];
  };
  improvements?: string[];
};
```

### Improved Parser
- Handles new structured JSON format
- Falls back to legacy format
- Can extract from code blocks
- Uses raw response as last resort

---

## Testing Recommendations

### Test Case 1: Enum Field with Confusion
- **Field**: Contract Type (NDA, MSA, Amendment)
- **Failures**: Model confuses NDA with confidentiality clauses
- **Expected**: Prompt includes "Do NOT classify..."

### Test Case 2: Date Field with Multiple Dates
- **Field**: Effective Date
- **Failures**: Model extracts signature date instead
- **Expected**: Prompt specifies which date to extract

### Test Case 3: String Field with Variations
- **Field**: Counterparty Name
- **Failures**: Model extracts partial name or wrong party
- **Expected**: Prompt specifies which party, full vs short name

### Test Case 4: Later Iteration
- **Iteration**: 4/5
- **Previous Prompts**: 3 failed attempts
- **Expected**: Prompt takes "significantly different approach"

---

## Comparison: Old vs New Prompt Generation

| Aspect | Old Version | New Version |
|--------|-------------|-------------|
| Examples | 1 (enum only) | 4 (enum, date, string, number) |
| Bad patterns | None | 5 explicit anti-patterns |
| Failure analysis | Basic | 5-type framework |
| Response format | Simple JSON | Structured with analysis |
| Document context | None | Inferred from field name |
| Success learning | Basic | Explicit preservation guidance |
| Iteration awareness | None | Urgent guidance after iter 2 |
| Validation | None | 8-point checklist |
| Failure tagging | None | Auto-detected issue type |

---

## Credits
Enhanced based on recommendations from Claude 4.5 (Sonnet) analysis of the original implementation.

---

**Status**: ✅ Implemented and ready for testing!

