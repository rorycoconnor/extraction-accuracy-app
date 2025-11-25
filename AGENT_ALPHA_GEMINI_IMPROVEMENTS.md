# Agent-Alpha: Gemini Best Practices Implementation

## Overview
This document outlines the improvements made to Agent-Alpha's prompt generation based on official Gemini 2.5 Pro and Gemini 3.0 Pro best practices.

**References:**
- [Gemini Prompting Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Gemini 3.0 Pro Documentation](https://ai.google.dev/gemini-api/docs/gemini-3?thinking=high)

---

## Key Decision: Document Content vs. Failure Examples

### ❌ What We DON'T Pass to the Prompt Generator
- **Full document content** - Not needed because:
  - We're generating extraction prompts, not doing extraction
  - Would add massive token costs (8 docs × ~10k tokens = 80k+ tokens)
  - Adds noise and irrelevant content
  - Slows down generation significantly

### ✅ What We DO Pass to the Prompt Generator
1. **Failure Examples** - Predicted vs. Expected values
2. **Success Examples** - Cases where extraction worked
3. **Field Metadata** - Type, options, current prompt
4. **Previous Prompt Attempts** - What was already tried
5. **Extraction Best Practices** - NEW! (see below)

---

## Improvements Implemented

### 1. Extraction Prompt Best Practices (NEW)
Added 7 critical rules that the LLM must follow when generating prompts:

```
1. Explicit Output Format - Always specify exact output
2. Search Scope - Include "Search the entire document"
3. Concise Structure - Use 2-4 sentences OR 3-5 bullet points
4. Negative Guidance - Add "Do NOT classify X as Y" warnings
5. Synonyms & Variations - List alternative phrasings
6. Location Hints - Mention where to look if pattern exists
7. Decision Logic - Provide clear if-then rules
```

**Why This Matters:**
- Gemini documentation emphasizes "clear and specific instructions"
- Constraints improve output quality significantly
- Reduces ambiguity in generated prompts

### 2. Example-Driven Approach (NEW)
Added a concrete example of a high-quality extraction prompt with annotations:

```
Field: Termination for Convenience (enum: Yes/No)
Good Prompt:
"Search the entire document for termination clauses. Extract 'Yes' if the 
agreement allows either party to terminate without cause (described as 'for 
convenience', 'without cause', 'at will', 'for any reason', or 'at its sole 
discretion'). Extract 'No' if all termination rights require a specific cause 
(breach, insolvency, default). Do NOT classify termination due to breach or 
default as convenience termination."

Why it's good:
✓ Explicit output format
✓ Search scope
✓ Synonym coverage
✓ Negative guidance
✓ Concise
✓ Clear decision logic
```

**Why This Matters:**
- Gemini docs state: "Examples work better than explanations"
- Shows, don't tell - the LLM can pattern-match
- Provides a concrete reference point

### 3. Field-Type Specific Guidance (NEW)
Added tailored instructions for each field type:

#### Enum Fields
```
- This is a multiple-choice field. The prompt MUST instruct the model to 
  return ONLY one of the valid options listed above.
- Include guidance on how to handle ambiguous cases or when multiple options 
  seem to apply.
```

#### Date Fields
```
- Specify the exact date format expected (e.g., YYYY-MM-DD, MM/DD/YYYY)
- Tell the model what to return if no date is found
- Consider if relative dates should be calculated or returned as-is
```

#### String Fields
```
- Specify if the model should extract verbatim text or can paraphrase
- Indicate if multiple occurrences exist, which one to return
- Define what to return if the value is not found
```

#### Number Fields
```
- Specify the format (e.g., "return as number without currency symbols")
- Clarify how to handle ranges (e.g., "$100-$200" → midpoint, minimum, full range)
- Define behavior for "Not Present" or "N/A" cases
```

**Why This Matters:**
- Each field type has unique challenges
- Prevents common extraction errors
- Aligns with Gemini's emphasis on "constraints"

### 4. Structured Analysis Questions (NEW)
Added guided questions to help the LLM analyze failures:

```
Before writing the new prompt, consider:
1. Pattern Recognition: What pattern do you see in the failures?
2. Disambiguation: What guidance would help distinguish correct from incorrect?
3. Coverage: Are there alternative phrasings or edge cases the current prompt misses?
```

**Why This Matters:**
- Encourages deeper reasoning (Gemini 3.0 Pro's strength)
- Breaks down the task into logical steps
- Aligns with "abductive reasoning" from Gemini agent best practices

### 5. Enhanced Valid Options Display
```
## Valid Options
The extracted value MUST be exactly one of these options:
- Option 1
- Option 2
...
If none match, return the closest match or specify a default value in your prompt.
```

**Why This Matters:**
- Clear constraints improve accuracy
- "MUST" emphasizes requirement
- Handles edge cases explicitly

---

## Expected Impact

### Prompt Quality Improvements
1. **More Specific** - Prompts will include explicit output formats
2. **Better Coverage** - Synonym variations and negative guidance
3. **Fewer Ambiguities** - Clear decision logic and edge case handling
4. **Type-Appropriate** - Field-specific guidance ensures relevance

### Performance Improvements
1. **Faster Convergence** - Better prompts = fewer iterations needed
2. **Higher Accuracy** - More precise instructions = better extraction
3. **Reduced Token Costs** - No document content = 80%+ token savings
4. **Consistent Quality** - Best practices template ensures repeatability

### Example Comparison

#### Before (Generic)
```
"Extract the termination for convenience from the document."
```
**Issues:** Vague, no output format, no synonyms, no negative guidance

#### After (With Best Practices)
```
"Search the entire document for termination clauses. Extract 'Yes' if the 
agreement allows either party to terminate without cause (described as 'for 
convenience', 'without cause', 'at will', 'for any reason'). Extract 'No' if 
all termination requires specific cause. Do NOT classify breach termination 
as convenience termination."
```
**Improvements:** ✓ Search scope, ✓ Output format, ✓ Synonyms, ✓ Negative guidance, ✓ Decision logic

---

## Testing Recommendations

### Test Case 1: Enum Field with Ambiguity
- **Field:** Termination for Convenience (Yes/No)
- **Expected:** Prompt includes synonym variations and negative guidance
- **Verify:** Generated prompt distinguishes "for convenience" from "for breach"

### Test Case 2: Date Field with Format Issues
- **Field:** Effective Date
- **Expected:** Prompt specifies exact date format (YYYY-MM-DD)
- **Verify:** Generated prompt handles "30 days after signature" cases

### Test Case 3: String Field with Multiple Occurrences
- **Field:** Governing Law
- **Expected:** Prompt specifies which occurrence to return (first, most prominent)
- **Verify:** Generated prompt handles documents with multiple law references

### Test Case 4: Number Field with Ranges
- **Field:** Contract Value
- **Expected:** Prompt clarifies how to handle ranges ("$100-$200")
- **Verify:** Generated prompt specifies return format (midpoint, minimum, etc.)

---

## Files Modified

1. **`src/lib/agent-alpha-prompts.ts`**
   - Added 7 extraction best practices
   - Added example-driven section
   - Added field-type specific guidance
   - Added structured analysis questions
   - Enhanced valid options display

2. **`src/ai/flows/agent-alpha-iteration.ts`**
   - Fixed type imports (AccuracyField['type'])

3. **`src/ai/flows/agent-alpha-process-field.ts`**
   - Fixed type imports (AccuracyField['type'])

---

## Next Steps

1. **Test with Real Data** - Run Agent-Alpha on your Contracts template
2. **Monitor Prompt Quality** - Review generated prompts in preview modal
3. **Measure Convergence** - Track how many iterations are needed per field
4. **Iterate on Best Practices** - Refine the 7 rules based on observed results

---

## Conclusion

By following official Gemini best practices and avoiding unnecessary document content, Agent-Alpha should now generate significantly higher-quality extraction prompts with:
- ✅ Better structure and clarity
- ✅ More comprehensive coverage (synonyms, edge cases)
- ✅ Faster convergence (fewer iterations)
- ✅ Lower token costs (80%+ reduction)
- ✅ Consistent quality (template-driven)

The key insight: **We're not extracting data, we're generating instructions for extraction** - so we need failure patterns, not raw documents.

