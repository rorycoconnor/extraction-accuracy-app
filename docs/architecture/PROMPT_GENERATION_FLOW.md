# Prompt Generation Flow

This document provides a detailed walkthrough of how extraction prompts are generated and optimized in the system.

## Overview

The system supports two prompt generation modes:

1. **Manual Generation** - User-triggered via Prompt Studio UI
2. **Automated Optimization** - Agent-Alpha iterative optimization

Both modes use Box AI's text_gen endpoint with Claude models to generate high-quality extraction prompts.

## Manual Prompt Generation

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Manual Prompt Generation                          │
└─────────────────────────────────────────────────────────────────────────┘

User clicks "Generate Prompt"
            │
            ▼
┌───────────────────────────────────────┐
│ 1. Collect Parameters                 │
│    - templateName: "Commercial Lease" │
│    - field: { name, key, type }       │
│    - fileIds: ["123"] (optional)      │
│    - customSystemPrompt (optional)    │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 2. Infer Document Type                │
│    inferDocumentType(templateName)    │
│    "Commercial Lease" → "Lease Agreement" │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 3. Load Field Heuristics              │
│    - FIELD_TYPE_HEURISTICS[type]      │
│    - FIELD_KEY_HEURISTICS[key]        │
│    Example: date → "YYYY-MM-DD format"│
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 4. Get Example Prompt                 │
│    getExamplePromptReference()        │
│    Shows Claude what good looks like  │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 5. Build Document Type Context        │
│    buildDocumentTypeContext()         │
│    "CRITICAL: This is for Lease..."   │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 6. Construct Generation Request       │
│    SYSTEM: [system prompt]            │
│    [document type context]            │
│    ## TASK                            │
│    Generate prompt for "field"...     │
│    ## REQUIRED ELEMENTS               │
│    1. LOCATION 2. SYNONYMS...         │
│    ## EXAMPLE                         │
│    "[example prompt]"                 │
│    ## OUTPUT                          │
│    Generate ONLY the prompt...        │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 7. Call Box AI text_gen               │
│    POST /ai/text_gen                  │
│    {                                  │
│      prompt: [request],               │
│      items: [{ id: fileId }],         │
│      ai_agent: {                      │
│        type: "ai_agent_text_gen",     │
│        basic_gen: {                   │
│          model: "aws__claude_4_5_opus"│
│        }                              │
│      }                                │
│    }                                  │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 8. Parse Response                     │
│    parsePromptResponse()              │
│    - Try JSON parse                   │
│    - Extract from markdown            │
│    - Handle multiple formats          │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 9. Return Result                      │
│    {                                  │
│      prompt: "Search for...",         │
│      generationMethod: "standard"     │
│    }                                  │
└───────────────────────────────────────┘
```

### Example Generation Request

For a field "Effective Date" (type: date) in template "Commercial Lease":

```
SYSTEM: You are an expert at creating powerful, concise, and effective extraction 
prompts for Box AI. Your task is to generate a single, actionable extraction prompt...

## DOCUMENT TYPE CONTEXT
Document Type: Lease Agreement
Template: "Commercial Lease"

CRITICAL: You are writing extraction prompts for Lease Agreement documents.
Use your knowledge of how Lease Agreement documents are typically structured...

## TASK
Generate a high-quality extraction prompt for the field "Effective Date" (type: date).
Remember: This is for Lease Agreement documents - use appropriate terminology.

## REQUIRED ELEMENTS
Your prompt MUST include:
1. LOCATION: Where to look in the document
2. SYNONYMS: 3-5 alternative phrases the value might appear as, in quotes
3. FORMAT: Exact output format (date format, number precision, etc.)
4. DISAMBIGUATION: "Do NOT..." guidance to prevent common mistakes
5. NOT-FOUND: What to return if value isn't found

## EXAMPLE OF A HIGH-QUALITY PROMPT STRUCTURE
"Search for when this agreement becomes effective. Look for: "effective as of", 
"effective date", "dated as of", "commences on". Check the document header, 
first paragraph, and signature blocks. Return the date in YYYY-MM-DD format..."

## FIELD CONTEXT
- Template: "Commercial Lease"
- Field Name: "Effective Date"
- Field Type: date
- Field-Specific Guidelines:
  - Format the output as YYYY-MM-DD.
  - If the date is not present, return "null".

## OUTPUT
Generate ONLY the extraction prompt (3-5 sentences). Include all required elements.
```

## Prompt Improvement Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Prompt Improvement                                │
└─────────────────────────────────────────────────────────────────────────┘

User provides feedback: "Also check signature blocks"
            │
            ▼
┌───────────────────────────────────────┐
│ 1. Analyze Original Prompt            │
│    analyzeOriginalPrompt()            │
│    {                                  │
│      hasLocation: true,               │
│      hasSynonyms: false,              │
│      hasFormat: true,                 │
│      hasDisambiguation: false,        │
│      hasNotFound: true,               │
│      workingElements: [...]           │
│    }                                  │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 2. Identify Missing Elements          │
│    - SYNONYMS (missing)               │
│    - DISAMBIGUATION (missing)         │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 3. Build Improvement Request          │
│    ## ORIGINAL PROMPT                 │
│    "[current prompt]"                 │
│                                       │
│    ## ELEMENTS TO PRESERVE            │
│    - Location guidance                │
│    - Output format specification      │
│    - Not-found handling               │
│                                       │
│    ## ELEMENTS TO ADD                 │
│    - SYNONYMS: Alternative phrases    │
│    - DISAMBIGUATION: "Do NOT..."      │
│                                       │
│    ## USER FEEDBACK                   │
│    "Also check signature blocks"      │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 4. Call Box AI & Parse                │
│    (same as generation)               │
└───────────────────────────────────────┘
```

### Key Principle: Preserve What Works

The improvement flow is designed to **enhance, not replace**. The system:

1. Analyzes the original prompt for working elements
2. Explicitly tells Claude to preserve them
3. Lists only what's missing or needs fixing
4. Incorporates specific user feedback

## Agent-Alpha Optimization Flow

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Agent-Alpha Optimization                             │
└─────────────────────────────────────────────────────────────────────────┘

User clicks "Run Agent-Alpha"
            │
            ▼
┌───────────────────────────────────────┐
│ 1. Configuration                      │
│    - Select model for testing         │
│    - Set max documents                │
│    - Set max iterations               │
│    - (Optional) Custom instructions   │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 2. Sample Documents                   │
│    - Select docs with ground truth    │
│    - Split: 80% train, 20% holdout    │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 3. FOR EACH FIELD (parallel)          │◀──────────────┐
│    runFieldIteration()                │               │
│                                       │               │
│    ┌─────────────────────────────┐    │               │
│    │ Extract from all train docs │    │               │
│    │ (parallel, 5 concurrent)    │    │               │
│    └─────────────────────────────┘    │               │
│              │                        │               │
│              ▼                        │               │
│    ┌─────────────────────────────┐    │               │
│    │ Compare to ground truth     │    │               │
│    │ Calculate accuracy          │    │               │
│    └─────────────────────────────┘    │               │
│              │                        │               │
│              ▼                        │               │
│    ┌─────────────────────────────┐    │               │
│    │ Accuracy >= 100%?           │    │               │
│    │ YES → Mark converged        │    │               │
│    │ NO  → Continue              │    │               │
│    └─────────────────────────────┘    │               │
│              │                        │               │
│              ▼                        │               │
│    ┌─────────────────────────────┐    │               │
│    │ (Optional) Analyze failures │    │               │
│    │ What text is near expected? │    │               │
│    └─────────────────────────────┘    │               │
│              │                        │               │
│              ▼                        │               │
│    ┌─────────────────────────────┐    │               │
│    │ Generate improved prompt    │────┼───────────────┘
│    │ buildAgentAlphaPrompt()     │    │  (next iteration)
│    └─────────────────────────────┘    │
│              │                        │
│              ▼                        │
│    ┌─────────────────────────────┐    │
│    │ Validate prompt quality     │    │
│    │ validatePrompt()            │    │
│    │                             │    │
│    │ Invalid? → Repair/Fallback  │    │
│    └─────────────────────────────┘    │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 4. Holdout Validation                 │
│    Test final prompt on holdout docs  │
│    (validation only, no generation)   │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ 5. Return Results                     │
│    - Final prompts per field          │
│    - Train accuracy                   │
│    - Holdout accuracy                 │
│    - Iteration counts                 │
└───────────────────────────────────────┘
```

### Agent-Alpha Prompt Request Structure

For iteration 2 of field "Counter Party Name" with 1 failure:

```
## DOCUMENT TYPE CONTEXT
Document Type: Contract
Template: "Service Agreement"

CRITICAL: You are writing extraction prompts for Contract documents...

You are an expert at writing extraction prompts for document AI systems.

## YOUR TASK
Create a DETAILED extraction prompt for the field "Counter Party Name" (type: string).
Remember: This is for Contract documents - use appropriate terminology.

## EXAMPLE OF A HIGH-QUALITY PROMPT STRUCTURE
"Search for the OTHER contracting party in this agreement. Look in: (1) the opening 
paragraph after "by and between", (2) signature blocks. Do NOT return "Acme Corp" - 
this is the extracting company... Return ONLY the legal entity name..."

## CURRENT PROMPT (NOT WORKING WELL)
"Extract the counter party name from the document"

## FAILURES TO FIX
1. AI returned: "Acme Corp"
   Should be: "Widget Industries LLC"

Analyze WHY these failed. Common causes: wrong section, missing synonyms, format mismatch.

## CRITICAL: COMPANY TO EXCLUDE
The AI keeps incorrectly returning "Acme Corp" - this is the company USING this software.
"Acme Corp" appears in EVERY contract because they are one party to all agreements.
The COUNTER PARTY is the OTHER company in each agreement, NOT "Acme Corp".
Your prompt MUST explicitly tell the AI to EXCLUDE "Acme Corp" and find the OTHER party.

## PREVIOUS ATTEMPTS (didn't achieve 100%)
1. "Extract the counter party name from the document"
Try a DIFFERENT approach than these.

## FIELD-SPECIFIC GUIDANCE
IMPORTANT: "Counter party" means the OTHER party in the agreement, not the company 
doing the extraction...

⚠️ ITERATION 2/5 - Previous approaches failed. Try something significantly different!

## REQUIREMENTS FOR YOUR NEW PROMPT
1. Be SPECIFIC - don't just say "Extract the Counter Party Name"
2. Tell the AI WHERE to look (which sections of the document)
3. List 3-5 SYNONYM phrases the value might appear as
4. Specify EXACT output format (date format, case, etc.)
5. Add "Do NOT..." guidance to prevent common mistakes
6. Handle "not found" case explicitly
7. Keep to 3-5 sentences total

## CRITICAL: RESPOND WITH VALID JSON ONLY
{"newPrompt": "your detailed extraction prompt here", "reasoning": "why this will fix the failures"}
```

## Prompt Validation Flow

```
Generated Prompt
        │
        ▼
┌───────────────────────────────────────┐
│ validatePrompt()                      │
├───────────────────────────────────────┤
│ Check 1: Length >= 150 chars          │
│ Check 2: Not generic "Extract the X"  │
│ Check 3: Has location guidance        │
│ Check 4: Has 5+ synonyms in quotes    │
│ Check 5: Has format specification     │
│ Check 6: Has disambiguation           │
│ Check 7: Has not-found handling       │
└───────────────────────────────────────┘
        │
        ▼
   ┌────┴────┐
   │ Valid?  │
   └────┬────┘
        │
   ┌────┴────┐
   │    NO   │───────────────────┐
   └────┬────┘                   │
        │                        ▼
        │         ┌───────────────────────────┐
        │         │ buildPromptRepairRequest()│
        │         │ Ask Claude to fix issues  │
        │         └───────────────────────────┘
        │                        │
        │                        ▼
        │         ┌───────────────────────────┐
        │         │ Call Box AI for repair    │
        │         └───────────────────────────┘
        │                        │
        │                        ▼
        │         ┌───────────────────────────┐
        │         │ Validate repaired prompt  │
        │         └───────────────────────────┘
        │                        │
        │              ┌────────┴────────┐
        │              │ Still invalid?  │
        │              └────────┬────────┘
        │                       │
        │              ┌────────┴────────┐
        │              │      YES        │
        │              └────────┬────────┘
        │                       │
        │                       ▼
        │         ┌───────────────────────────┐
        │         │ Use fallback example      │
        │         │ getExamplePromptForField()│
        │         └───────────────────────────┘
        │                       │
   ┌────┴────┐                  │
   │   YES   │◀─────────────────┘
   └────┬────┘
        │
        ▼
  Use Validated Prompt
```

## Response Parsing Flow

Claude may return responses in various formats. The parsing flow handles all of them:

```
Raw Response
     │
     ▼
┌─────────────────────────────────┐
│ Clean markdown code blocks      │
│ ```json ... ``` → ...           │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│ Try JSON.parse()                │
│ {"newPrompt": "...", ...}       │
└─────────────────────────────────┘
     │
     ├─── Success ───▶ Extract newPrompt
     │
     ▼ (failure)
┌─────────────────────────────────┐
│ Try regex extraction            │
│ /"newPrompt"\s*:\s*"(...)"/     │
└─────────────────────────────────┘
     │
     ├─── Success ───▶ Extract newPrompt
     │
     ▼ (failure)
┌─────────────────────────────────┐
│ Try JSON block match            │
│ /\{[\s\S]*?"newPrompt"...}/     │
└─────────────────────────────────┘
     │
     ├─── Success ───▶ Extract newPrompt
     │
     ▼ (failure)
┌─────────────────────────────────┐
│ Use fallback example prompt     │
│ (if fieldName provided)         │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│ Quality check                   │
│ isGenericPrompt()?              │
│ - Too short (< 150 chars)?      │
│ - "Extract the X" pattern?      │
│ - Missing key elements?         │
└─────────────────────────────────┘
     │
     ├─── Generic ───▶ Use fallback
     │
     ▼
Return Parsed Prompt
```

## Best Practices

### For Prompt Generation

1. **Always include document type context** - Prevents cross-contamination of terminology
2. **Provide example prompts** - Shows Claude the expected structure
3. **List required elements explicitly** - Ensures completeness
4. **Use field-specific heuristics** - Leverages domain knowledge

### For Prompt Improvement

1. **Analyze before improving** - Know what's working
2. **Preserve working elements** - Don't break what's not broken
3. **Address specific feedback** - Focus changes on user concerns
4. **Add missing elements** - Improve completeness incrementally

### For Agent-Alpha

1. **Use holdout validation** - Prevents overfitting
2. **Limit iterations** - Diminishing returns after 3-5
3. **Enable document analysis** - Understand WHY extractions fail
4. **Validate generated prompts** - Ensure quality standards

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Generic prompts | Claude ignoring instructions | Increase emphasis on requirements |
| Wrong terminology | Missing document type context | Ensure inferDocumentType() matches |
| Same company returned | Counter party not excluded | Check detectCommonCompanyFromFailures() |
| Parse failures | Unexpected response format | Check parsePromptResponse() coverage |
| Validation failures | Missing required elements | Review validation patterns |

### Debug Logging

Enable detailed logging to trace prompt generation:

```typescript
// In agent-alpha-iteration.ts
logger.info(`📝 Raw Box AI response: "${rawAnswer}"`);
logger.debug(`📝 Full raw response: ${JSON.stringify(rawAnswer)}`);

// In agent-alpha-prompts.ts
logger.warn('Generated prompt is too generic', { promptLength, preview });
logger.debug('JSON parsing failed, trying regex extraction', { error });
```

## Related Documentation

- [AI Prompt System Architecture](./AI_PROMPT_SYSTEM.md)
- [Agent-Alpha Types](../../src/lib/agent-alpha-types.ts)
- [Agent-Alpha Config](../../src/lib/agent-alpha-config.ts)
