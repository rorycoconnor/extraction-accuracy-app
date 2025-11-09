# Run Optimizer Implementation Plan

**Status**: Draft  
**Created**: 2025-02-14  
**Author**: Codex (implementation lead)  
**Scope**: Align “Run Optimizer” execution details with the current Next.js + Box AI stack

---

## Fit Check & Required PRD Adjustments

1. **Target model clarification** – Prompts in `AccuracyData` map to the single `baseModel` (`accuracyData.baseModel`) that drives extraction (`src/hooks/use-enhanced-comparison-runner.tsx:74`). The PRD should explicitly state that optimizer accuracy checks and prompt updates are evaluated against this base model; other comparison columns remain informational only.
2. **Freshness assumptions** – We only know whether a comparison exists by checking `accuracyData.results.length` and the latest run metadata in the unified store. There is no persisted “staleness” signal, so the PRD should note that “fresh” equals “latest locally stored run”; automatic re-run only happens when zero results exist or when the user explicitly requests it.
3. **Reason persistence** – Theories and “why we picked this prompt” strings will live in runtime state and the summary modal. They are not persisted alongside prompt versions (which currently store only `id`, `prompt`, `savedAt`, `metrics`). The PRD already hints at this under “collect theories in memory,” but we should add a short bullet under Known Limitations confirming that rationale is transient.

With those clarifications, the remainder of the PRD aligns with the existing architecture (local prompt storage, Box AI integrations, and UI patterns).

---

## Architecture Overview

- **UI entry point**: `ControlBar` (`src/components/control-bar.tsx:205-252`) gains a `Run Optimizer` button that mirrors the styling/disable logic of `Run Comparison`, plus a progress label (`Optimizing… (Sampling 2/5)`).
- **State owner**: Extend the unified accuracy store (`src/store/AccuracyDataStore.tsx`) with `optimizerState` (status enum, current step index, sampled docs, summaries) so both the toolbar button and modal can read the same source of truth.
- **Execution hook**: New hook `useOptimizerRunner` (parallel to `useEnhancedComparisonRunner`) orchestrates the pipeline on the client, delegating server-side AI calls to existing Box helpers.
- **Server actions**:
  - Failure theories reuse `extractStructuredMetadataWithBoxAI` (`src/services/box.ts:601`) with injected custom prompts per field.
  - Prompt synthesis reuses `boxApiFetch('/ai/text_gen', …)` with the Gemini 2.5 Pro override and the blank placeholder file utilities already built for LLM-as-judge (`src/ai/flows/llm-comparison.ts:1-120`).
- **Results UI**: New modal `OptimizerSummaryModal` renders after a run, listing sampled docs, field-level theories, prompt diffs, and CTA to open Prompt Studio.

---

## Detailed Implementation Plan

### 1. Preflight & Button Wiring

- Add `onRunOptimizer`, `isOptimizerRunning`, and `optimizerProgressLabel` props to `ControlBar`. Disable the button when:
  - A comparison is running (`isExtracting`/`isJudging`).
  - Optimizer is already running.
  - No `accuracyData` or no files selected (same guard as comparison button).
- Tooltip copy `Optimizer running…` matches PRD; use shared button component for consistent grayscale state.
- `MainPageSimplified` (`src/components/main-page-simplified.tsx:290-420`) wires the handler from the new hook.

### 2. Optimizer Runner Hook

Create `src/hooks/use-optimizer-runner.ts` with responsibilities:

```ts
export type OptimizerStep = 'comparison' | 'sampling' | 'diagnostics' | 'prompting' | 'review';

export const useOptimizerRunner = () => {
  const { state, dispatch } = useAccuracyDataStore();
  const { handleRunComparison } = useEnhancedComparisonRunner(selectedTemplate);
  const { toast } = useToast();

  const runOptimizer = async () => {
    // 1. Ensure latest comparison exists
    // 2. Identify failing fields
    // 3. Sample docs & build worklist
    // 4. Diagnose failures with metadata extract API
    // 5. Generate new prompts via text_gen
    // 6. Persist versions and open summary modal
  };

  return { runOptimizer, optimizerState };
};
```

Responsibilities per step:

1. **Comparison gate** – If `accuracyData.results.length === 0`, invoke `handleRunComparison()` and wait for success (wrap with toast + error handling). No additional freshness heuristic beyond “results exist.”
2. **Failing field detection** – Use `accuracyData.averages[fieldKey][baseModel].accuracy`. Fields with `accuracy < 1` or missing metrics enter the work queue. If queue empty, emit skip toast.
3. **Sampling** – Build `(fieldKey, fileId)` pairs where `comparisonResults[fileId][fieldKey][baseModel].isMatch === false`. Implement greedy overlap: repeatedly pick doc covering most remaining fields until doc count reaches 6, while capping per-field doc list at 3.
4. **Diagnostics** – For each sampled doc:
   - Build `BoxAIField[]` instructions referencing the incorrect values plus ground truth to elicit a short theory (`<=200 chars`).
   - Call `extractStructuredMetadataWithBoxAI({ fileId, fields: instructions, model: 'google__gemini_2_5_pro' })`.
   - Store `theoryMap[fieldKey][fileId]` in memory.
5. **Prompting** – For each failing field:
   - Pull up to three latest prompt versions from `field.promptHistory`; include active prompt text for context.
   - Assemble payload: prompt history, condensed theory snippets, doc metadata, and guard instructions (“respond with JSON { newPrompt: string, promptTheory: string }”).
   - Fetch blank placeholder ID via `getBlankPlaceholderFileId()` to satisfy the Box text API’s `items` requirement (no real file context needed per PRD).
   - Call `/ai/text_gen` with `ai_agent_text_gen.basic_gen.model = 'google__gemini_2_5_pro'`.
   - Parse JSON, validate length, and pass to persistence layer.
6. **Persistence & summary** – Use `handleUpdatePrompt` or a slimmer helper to append a new `PromptVersion` (`source: 'optimizer'` tag optional) and set it active. Collect success/error metadata for the modal. Open the modal via local state; also toast with counts.

### 3. Data Structures

- Extend `PromptVersion` type with optional `source?: 'manual' | 'optimizer'` and `notes?: string` if we want to surface rationale later (optional, but useful). All storage remains local via `saveFieldPrompt` in `src/lib/prompt-storage.ts:40-110`.
- Define runtime-only types:

```ts
type FieldFailure = {
  fieldKey: string;
  docIds: string[];
  groundTruth: string;
  extractedByDoc: Record<string, string>;
};

type OptimizerRunSummary = {
  sampledDocs: string[];
  documentTheories: Record<string, Record<string, string>>; // docId -> fieldKey -> theory
  fieldUpdates: Record<string, { newPrompt?: string; promptTheory?: string; error?: string }>;
};
```

Store `OptimizerRunSummary` inside the new store slice so the modal can render after asynchronous steps complete.

### 4. Failure Sampling Algorithm

- Inputs: `accuracyData.results` and `comparisonResults` metadata.
- Build `failMatrix[fieldKey][fileId] = comparisonMeta` for the base model.
- Run greedy selection:
  1. Count coverage per doc (# of fields still needing sampling that failed on that doc).
  2. Pick doc with max coverage, add to `selectedDocs`, remove its covered fields from remaining coverage counts.
  3. Repeat until `selectedDocs.length === 6` or all fields satisfied.
  4. Within each field, slice assigned doc list to max 3.
- Expose helper `selectDocsForOptimizer` under `src/lib/optimizer-sampling.ts` with unit tests.

### 5. Diagnostics via Structured Extraction

- Build field instructions per failing field for the sampled document:

```ts
const instruction = `The last comparison showed "${modelValue}" but ground truth is "${groundTruth}". Describe in <=200 chars why the model could miss this for ${fieldName}.`;
```

- Call `extractStructuredMetadataWithBoxAI` once per document (not per field) by sending all instructions together; map the returned `answer[fieldKey]` to fields.
- Retry rules: on HTTP 5xx, retry up to 2 times with 500 ms backoff. On failure, record error and continue so other docs still process.

### 6. Prompt Generation via Text Gen

- Compose prompt template referencing:
  - Field description (name, type, current prompt goal).
  - Up to three previous prompt versions (ordered newest → oldest) separated by delimiters.
  - Theories grouped by document ID.
  - Guardrails: “Return JSON with keys `newPrompt` and `promptTheory`. Keep each under 1500 characters.”
- Request body example:

```json
{
  "prompt": "SYSTEM: You improve Box extraction prompts...",
  "items": [{ "id": "<blank-file-id>", "type": "file" }],
  "ai_agent": {
    "type": "ai_agent_text_gen",
    "basic_gen": { "model": "google__gemini_2_5_pro" }
  }
}
```

- Parse response, validate JSON, strip whitespace, and guard against hallucinated keys. On failure, append `error` to summary so modal can show “Needs manual attention.”

### 7. Version Persistence & Manual Overrides

- Reuse `handleUpdatePrompt` logic from `src/hooks/use-data-handlers.tsx:140-210`, but skip toast spam by adding a non-UI helper (e.g., `applyPromptUpdate(fieldKey, newPrompt, { source: 'optimizer', note: promptTheory })`).
- After `setAccuracyData`, call `saveAccuracyData` and `saveFieldPrompt` to keep localStorage and JSON backups in sync (`src/lib/prompt-storage.ts:70-110`).
- The modal presents “Open Prompt Studio” deep links; clicking fires existing `setSelectedFieldForPromptStudio`.

### 8. Summary Modal

- Create `src/components/optimizer-summary-modal.tsx` using the same `Dialog` primitives as `ModalContainer` (`src/components/modal-container.tsx:30-120`).
- Props: `isOpen`, `onClose`, `summary`, `accuracyData`, `shownColumns` (for context). Sections:
  1. Run stats (# fields, # docs, runtime).
  2. Document accordion (doc name, theories per field).
  3. Field cards (old prompt snippet vs new prompt, reason, status pill, CTA to open Prompt Studio).
- Wire into `ModalContainer` so state lives centrally.

### 9. Telemetry & Logging

- Emit structured logs via `logger.info`/`logger.error` inside the hook for: run start, comparison auto-run triggered, docs sampled, AI call failures, prompts saved.
- Analytics events (if available) can reuse the existing telemetry mechanism (none today; logging suffices for this milestone).

### 10. Error Handling & Retries

- Comparison step inherits `handleRunComparison` errors/toasts.
- Sampling with <1 doc: surface toast “No failing docs found; optimizer skipped.”
- Diagnostics/prompting: continue processing other fields even if one fails. Modal lists failures.
- Wrap Box API calls with `try/catch` and categorize errors to surface in modal + console.

### 11. Testing Strategy

1. **Unit tests**
   - Greedy sampler (`src/lib/optimizer-sampling.test.ts`) covering overlap and cap logic.
   - Prompt payload builder to ensure truncated history and theory counts.
2. **Integration tests** (Vitest + mocked fetch): ensure the hook sequences steps, respects skip conditions, and writes prompt versions.
3. **Manual QA**
   - Button gating with/without results.
   - Runs where some fields already 100% (skip path).
   - AI failure path (modal shows error, prompts unchanged).
   - Confirmation that localStorage prompt history updates.

---

## File / Module Change List

| Type | Path | Description |
| --- | --- | --- |
| **New** | `src/hooks/use-optimizer-runner.ts` | Orchestrates optimizer pipeline and exposes progress state. |
| **New** | `src/lib/optimizer-sampling.ts` + tests | Doc selection + helper utilities. |
| **New** | `src/lib/optimizer-prompts.ts` | Prompt payload builders, theory templates, JSON parsers. |
| **New** | `src/components/optimizer-summary-modal.tsx` | Result presentation UI. |
| **Update** | `src/store/AccuracyDataStore.tsx` | Add optimizer slice (status, progress, summary) and actions. |
| **Update** | `src/components/control-bar.tsx` | Render button, wire props, show progress label. |
| **Update** | `src/components/main-page-simplified.tsx` | Consume hook, manage modal open state, pass handlers to `ModalContainer`. |
| **Update** | `src/components/modal-container.tsx` | Include new modal component + props. |
| **Update** | `src/hooks/use-data-handlers.tsx` | Expose reusable prompt-update helper (no extra toasts) and optional source metadata. |
| **Update** | `src/lib/types.ts` + `src/lib/prompt-storage.ts` | Optional fields for optimizer metadata if we choose to persist `source`/`notes`. |
| **Update** | `src/services/box.ts` | Utility to run text-gen with blank file (or reuse existing helper). |

---

## Open Questions & Follow-Ups

1. Should optimizer runs capture a lightweight history (timestamp + affected fields) for future auditing? That would require extending local storage but stays within “no new DB.”
2. Do we need a cancel button if text-gen calls exceed expected runtime? (Not in scope now.)
3. Cost visibility: if required later, we can log Box API usage counts per run.
4. Should theories surface anywhere else (e.g., inline next to prompts) after modal close? Currently they are transient per requirements.

---

## Next Steps

1. Align on PRD wording updates (target model clarification, freshness assumption, transient theories).
2. Implement the new hook + store slice, then land UI wiring (control bar + modal).
3. Layer in server-side diagnostics/prompt-generation helpers and accompanying tests.
4. Run end-to-end QA with mocked Box APIs before pointing at real Gemini 2.5 Pro.

