# AI Prompt System Architecture

This document describes the architecture of the AI prompt generation and optimization system used for metadata extraction from documents.

## Overview

The system uses Box AI (with Claude models) to:
1. **Generate** extraction prompts for metadata fields
2. **Optimize** prompts iteratively using Agent-Alpha
3. **Validate** prompt quality against a checklist
4. **Extract** metadata from documents using optimized prompts

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User Interface Layer                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Prompt Studio UI    │    Agent-Alpha Modal    │    Template Editor     │
│  - Generate prompts  │    - Configure run      │    - Edit prompts      │
│  - Improve prompts   │    - Monitor progress   │    - View accuracy     │
│  - Test extractions  │    - Review results     │    - Apply changes     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Layer                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/extract-metadata     │    /api/prompts/*    │    /api/agent-alpha │
│  - Structured extraction   │    - CRUD operations │    - Run optimizer  │
│  - Box AI integration      │    - Prompt storage  │    - Get results    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI Flows Layer                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐                   │
│  │ generate-initial-    │    │ agent-alpha-         │                   │
│  │ prompt.ts            │    │ iteration.ts         │                   │
│  │                      │    │                      │                   │
│  │ • generateInitial-   │    │ • runFieldIteration  │                   │
│  │   Prompt()           │    │   - Extract          │                   │
│  │ • improvePrompt()    │    │   - Compare          │                   │
│  │                      │    │   - Generate         │                   │
│  └──────────────────────┘    └──────────────────────┘                   │
│                                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐                   │
│  │ agent-alpha-         │    │ metadata-            │                   │
│  │ prompts.ts           │    │ extraction.ts        │                   │
│  │                      │    │                      │                   │
│  │ • buildAgentAlpha-   │    │ • extractMetadata()  │                   │
│  │   Prompt()           │    │ • batchExtract()     │                   │
│  │ • validatePrompt()   │    │                      │                   │
│  │ • parseResponse()    │    │                      │                   │
│  └──────────────────────┘    └──────────────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Services Layer                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  box.ts                                                                  │
│  • boxApiFetch() - Authenticated API calls                              │
│  • extractStructuredMetadataWithBoxAI() - Structured extraction         │
│  • getBlankPlaceholderFileId() - Placeholder for text_gen               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Box AI APIs                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  /ai/text_gen              │         /ai/extract_structured             │
│  • Prompt generation       │         • Metadata extraction               │
│  • Prompt improvement      │         • Template mode                     │
│  • Prompt repair           │         • Fields mode                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Prompt Generation (`generate-initial-prompt.ts`)

Handles manual prompt generation and improvement via the Prompt Studio UI.

**Functions:**
- `generateInitialPrompt()` - Creates a new prompt for a field
- `improvePrompt()` - Refines an existing prompt based on feedback

**Features:**
- Document type inference from template names
- Field-type-specific heuristics
- Example prompt references for guidance

### 2. Agent-Alpha Optimization (`agent-alpha-iteration.ts`)

Automated iterative prompt optimization system.

**Algorithm:**
```
FOR each iteration (1 to MAX_ITERATIONS):
    1. Extract field from all sampled documents (parallel)
    2. Compare extractions to ground truth
    3. Calculate accuracy
    4. IF accuracy >= TARGET_ACCURACY:
         RETURN (converged)
    5. Analyze failures (optional document analysis)
    6. Generate improved prompt using Claude
    7. Validate prompt quality
    8. IF invalid: repair or fallback
```

**Key Features:**
- Parallel document extraction (configurable concurrency)
- Holdout validation to prevent overfitting
- Prompt validation and repair
- Document analysis for failure understanding

### 3. Prompt Building (`agent-alpha-prompts.ts`)

Constructs requests for Claude to generate/improve prompts.

**Components:**
- Document type context
- Failure/success examples
- Previous attempts (to avoid repetition)
- Field-specific guidance
- Counter party detection

### 4. Prompt Validation

Every generated prompt is validated against 5 quality elements:

| Element | Description | Detection Pattern |
|---------|-------------|-------------------|
| Location | Where to look | "look in", "search in" + section names |
| Synonyms | Alternative phrases | 5+ quoted phrases |
| Format | Output format | "YYYY-MM-DD", "exactly", numeric precision |
| Disambiguation | Negative guidance | "do not", "don't", "avoid" |
| Not-Found | Missing value handling | "not present", "if no" |

**Requirements:**
- Minimum 150 characters
- At least 4 of 5 elements present
- No generic "Extract the X" patterns

## Data Flow

### Manual Prompt Generation

```
User Request
    │
    ▼
┌─────────────────────┐
│ generateInitialPrompt│
├─────────────────────┤
│ 1. Load heuristics  │
│ 2. Infer doc type   │
│ 3. Build request    │
│ 4. Call Box AI      │
│ 5. Parse response   │
└─────────────────────┘
    │
    ▼
Generated Prompt
```

### Agent-Alpha Optimization

```
User Starts Run
    │
    ▼
┌─────────────────────┐
│ Sample Documents    │
│ (train + holdout)   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐     ┌─────────────────────┐
│ FOR each field      │────▶│ runFieldIteration   │
│                     │◀────│ (parallel by field) │
└─────────────────────┘     └─────────────────────┘
    │                               │
    │                               ▼
    │                       ┌─────────────────────┐
    │                       │ Extract (parallel)  │
    │                       │ Compare to GT       │
    │                       │ Generate new prompt │
    │                       └─────────────────────┘
    │                               │
    ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Holdout Validation  │     │ Continue iterations │
│ (final accuracy)    │     │ until converged     │
└─────────────────────┘     └─────────────────────┘
    │
    ▼
Optimized Prompts
```

## Configuration

### Agent-Alpha Config (`agent-alpha-config.ts`)

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_DOCS` | 10 | Maximum documents to sample |
| `MAX_ITERATIONS` | 5 | Maximum optimization iterations |
| `TARGET_ACCURACY` | 1.0 | Convergence threshold (100%) |
| `HOLDOUT_RATIO` | 0.2 | Fraction held for validation |
| `EXTRACTION_CONCURRENCY` | 5 | Parallel extractions per iteration |
| `FIELD_CONCURRENCY` | 2 | Parallel field optimizations |
| `PROMPT_GEN_MODEL` | `aws__claude_4_5_opus` | Model for prompt generation |
| `ENABLE_DOCUMENT_ANALYSIS` | true | Analyze failed documents |

### Prompt Engineering Config (`prompt-engineering.ts`)

Contains:
- System messages for generation/improvement
- Field type heuristics (date formats, enum handling)
- Field key heuristics (counter party, invoice fields)

## Models Used

| Task | Model | Rationale |
|------|-------|-----------|
| Prompt Generation | Claude 4.5 Opus | Highest quality for prompt engineering |
| Metadata Extraction | GPT-4.1 Mini (default) | Fast, accurate, cost-effective |
| Extraction (configurable) | Various | User can select preferred model |

## Error Handling

### Prompt Validation Failures

1. **Repair Attempt**: Ask Claude to fix specific issues
2. **Fallback**: Use high-quality example prompt for field type
3. **Last Resort**: Throw error if no fallback available

### API Failures

- Retry with exponential backoff
- Rate limit handling for Box API
- Graceful degradation for optional features

## File Structure

```
src/
├── ai/
│   ├── flows/
│   │   ├── agent-alpha-iteration.ts   # Core optimization loop
│   │   ├── agent-alpha-prepare.ts     # Preparation logic
│   │   ├── agent-alpha-process-field.ts
│   │   ├── generate-initial-prompt.ts # Manual generation
│   │   ├── metadata-extraction.ts     # Extraction helpers
│   │   └── batch-metadata-extraction.ts
│   └── prompts/
│       └── prompt-engineering.ts      # Heuristics & system prompts
├── lib/
│   ├── agent-alpha-config.ts          # Configuration
│   ├── agent-alpha-prompts.ts         # Prompt building helpers
│   ├── agent-alpha-types.ts           # TypeScript types
│   └── agent-alpha-sampling.ts        # Document sampling
└── services/
    └── box.ts                         # Box API integration
```

## Related Documentation

- [Prompt Generation Flow](./PROMPT_GENERATION_FLOW.md) - Detailed flow documentation
- [Box AI Reliability](../BOX_AI_RELIABILITY_IMPROVEMENTS.md) - API reliability features
- [Metrics Specification](../metrics-specification.md) - Accuracy calculation details
