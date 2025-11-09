# Product Requirements Document: Run Optimizer

**Status**: Draft  
**Created**: 2025-02-14  
**Author**: Codex (on behalf of Alex Leutenegger)  
**Stakeholders**: Product, Prompt Studio Eng, UX, QA, Box AI Platform

---

## 1. Overview

“Run Optimizer” adds a single-click workflow that evaluates the latest comparison results, diagnoses why fields failed, and generates improved prompt versions using Gemini 2.5 Pro (Box agent override). The button lives next to “Run Comparison” on the main accuracy workspace. The tool automates the manual prompt iteration loop that technical consultants perform today, keeping prompt versioning and overrides exactly where they already live.

### Objectives

1. **Eliminate manual prompt guesswork** by surfacing theories tied to specific documents and generating updated prompts per field.
2. **Guarantee we optimize against fresh data** by ensuring we only run on top of the most recent comparison results (running comparison automatically when needed).
3. **Provide transparent reasoning** by persisting per-document failure theories and the rationale behind each new prompt version.
4. **Stay within existing storage & UI paradigms** (no new persistence layers) while matching the familiar Run Comparison progress UX.

### Non-Goals

- Creating new databases or storage services (reuse existing prompt version storage/local persistence).
- Building customer-facing governance or approval workflows (internal-only feature for now).
- Changing how manual prompt overrides work; consultants can still edit/swap versions like today.

---

## 2. Persona & Problems

- **Primary Persona**: Box Technical Consultant / Prompt Engineer.
  - Already runs comparisons and hand-edits prompts field by field.
  - Pain: tracking which documents failed, why, and how to update prompts efficiently.
  - Need: automatic triage + suggested prompts without leaving the main accuracy view.

---

## 3. User Stories

1. **US-1 — Kick off optimizer safely**: As a consultant, I want to press “Run Optimizer” and know the system will only proceed when comparison results exist (auto-running comparison if needed) so my suggestions reflect the latest truth set.
2. **US-2 — Diagnose failures quickly**: As a consultant, I need the optimizer to sample real documents where a field failed so I can understand patterns behind misses without sifting through all files.
3. **US-3 — Generate better prompts per field**: As a consultant, I want the system to craft a new prompt version for each underperforming field using prior history and failure theories, so I have a head start before doing manual tweaks.
4. **US-4 — Understand rationale**: As a consultant, I want to see concise theories per document and per-field reasoning for the proposed prompts so I can trust or override them instantly.
5. **US-5 — Avoid double-runs**: As a user, I need the optimizer button to show progress, disable mid-run, and block concurrent executions, mirroring Run Comparison behavior.
6. **US-6 — Preserve manual control**: As a user, I must be able to discard or overwrite any suggested prompt via the existing prompt-management surface.

---

## 4. High-Level Flow

1. **Pre-check / Comparison sync**
   - On click, disable button and show X/N style progress text just like Run Comparison.
   - Query latest comparison results. If none or stale, call the existing comparison routine first (reuse identical UI+status events). Optimizer resumes only after the comparison completes successfully.
2. **Identify candidate fields**
   - Inspect comparison output; list fields with <100% accuracy.
   - If all fields hit 100%, stop, re-enable button, and toast “Optimizer skipped (all fields already correct).”
3. **Document sampling**
   - For each failing field, collect documents where the field was incorrect.
   - Build overlapping set: sample up to 3 docs per field but cap total unique docs at 6. Prefer docs that cover the most failing fields first.
4. **Per-document theory generation**
   - For each sampled document, call Box Metadata Structured Extraction API with custom field instructions (Gemini 2.5 Pro via agent override) to get short theories explaining why each field was wrong.
   - Constraint: theories must stay terse to support downstream 10k-char context window.
5. **Per-field prompt synthesis**
   - For every failing field:
     - Gather up to the last 3 prompt versions (current + two previous) from existing storage.
     - Collect all theories relevant to that field across sampled docs.
     - Invoke Box AI Generate Text API (blank file body, same channel used for LLM-as-judge) to produce:
       1. **New Prompt Text** (best next iteration).
       2. **Prompt Theory** (why this new prompt was chosen, referencing document theories).
   - Save new prompt as the next version using current versioning pipeline (no schema changes).
6. **Results surfacing**
   - After all fields finish, present a modal (same styling system as other modals) summarizing:
     - Selected documents and their theories per field.
     - Proposed prompt per field plus the “why we picked it” explanation from step 5.
   - Provide CTA: “Apply Suggestions” (default) or “Dismiss”. Applying keeps versions as-is (already saved), dismiss leaves them but closes modal. Manual edits still happen through existing prompt editor if needed.
7. **Completion**
   - Re-enable button, reset progress state, emit toast summarizing # fields updated and # docs analyzed.
   - Block re-run until current run finishes; if user tries while disabled, show tooltip “Optimizer running…”.

---

## 5. Detailed Functional Requirements

### 5.1 Button & UX
- Placement: immediately to the right of “Run Comparison” on main accuracy screen toolbar.
- States: default, hover, disabled, loading.
- Copy: `Run Optimizer`.
- Progress indicator: `Optimizing… (stepLabel X/Y)` reusing compare button component to ensure consistency.
- Disabled conditions:
  - Optimizer currently running.
  - Comparison currently running (share state store to avoid overlaps).
  - No documents uploaded/template selected (same guard as comparison button).

### 5.2 Comparison Enforcement
- API: reuse existing comparison service call with same auth + telemetry.
- Success path: pass summary into optimizer pipeline.
- Failure path: surface error toast, log, re-enable button without optimizer attempt.

### 5.3 Sampling Logic
- Input: comparison result set with per-field accuracy and doc-level pass/fail metadata.
- Algorithm:
  1. Build list of `(field, docId)` pairs where field failed.
  2. Greedy selection to maximize overlapping coverage while respecting limits:
     - Repeatedly pick doc covering largest count of remaining failing fields until either 6 docs chosen or all failures covered.
     - For each field, ensure at most 3 unique docs assigned; if doc pool <3, use what exists.
- Output: mapping of docId → list of failing fields, plus per-field doc subsets.

### 5.4 Theory Generation (Step 2b)
- Service: Box Metadata Structured Extraction API with **custom field instructions** channel.
- Payload per document includes:
  - Document reference (same as comparison pipeline uses).
  - Field list requiring theories.
  - Instruction template emphasizing brevity (<= ~200 chars per field) to fit 10k downstream context.
- Response persisted in-memory (runtime store) only; no new DB writes.

### 5.5 Prompt Synthesis (Step 2d)
- For each field flagged:
  - Gather data:
    - Up to 3 previous prompt versions (latest first) from existing prompt version store/local storage (same retrieval as manual prompt history UI).
    - Theories per sampled document for that field.
  - Compose ICL prompt for Box AI Generate Text (Gemini 2.5 Pro, blank file input) instructing model to output JSON with `newPrompt` and `promptTheory`.
  - Enforce 10k char budget (truncate older prompt versions if needed, max 3 versions already limits size).
- Parsing & Validation:
  - Validate JSON response; fallback to plain text parsing if necessary with guard clauses.
  - If call fails or response invalid, mark field as “Needs manual attention” and do not create new version (still list in modal with error note).
- Saving:
  - Create new prompt version entry via existing versioning helper (same as manual “Save new version”).
  - Mark metadata linking new version to optimizer run (e.g., tag `source=optimizer` if metadata field exists; if not, include in version notes text but still within existing storage).

### 5.6 Results Modal (Step 3)
- Triggered once optimizer completes (even if some fields errored).
- Sections:
  1. **Run Summary**: # fields optimized, # docs analyzed, timestamp.
  2. **Document Theories**: accordion per document showing short bullet per failing field.
  3. **Field Updates**: for each field, show new prompt version text, reason, and list of document theories referenced. Include status pill (success/error/skipped).
- Actions:
  - `Close` (default).
  - `Open Prompt Editor` CTA linking to existing manual override surface filtered to that field.

### 5.7 Telemetry & Logging
- Emit analytics for:
  - Optimizer run started/completed/failed.
  - Comparison auto-run triggered.
  - # docs sampled, # fields optimized, # API failures.
- Useful for cost tracking and diagnosing Gemini usage.

---

## 6. Technical Requirements

- **Language/Stack**: Reuse current frontend/services stack (Next.js, Box SDK bindings).
- **AI Calls**: Always specify Gemini 2.5 Pro via Box agent override; match parameters used by “LLM as Judge” to stay compliant with governance.
- **State Management**: Extend whichever store/slice (likely Zustand) powers comparison state to include optimizer progress and disable flags.
- **Concurrency**: Single-run at a time. If process crashes mid-run, button re-enabled on next load; no partial-resume requirement (documented in Known Limitations).
- **Storage**: Continue using existing prompt version store/local storage. No schema changes; just append new versions with metadata flag.
- **Error Handling**:
  - If comparison run fails → exit early.
  - If sampling yields zero docs (edge case) → skip optimization, show toast.
  - If AI call fails for a field → log, surface in modal, do not save prompt.

---

## 7. UX Copy & States

| State | Copy | Notes |
| --- | --- | --- |
| Idle button | `Run Optimizer` | Same size as comparison button |
| Hover tooltip when disabled because running | `Optimizer running…` | Prevents double-run |
| Progress label | `Optimizing… (step X/Y)` | Steps: `Comparison`, `Sampling`, `Diagnostics`, `Prompting`, `Review` |
| Toast success | `Optimizer updated {fieldCount} field(s) using {docCount} document(s).` | |
| Toast skip | `Optimizer skipped: all fields already 100% accurate.` | |
| Toast error | `Optimizer failed during {stage}. Check console for details.` | |

Modal text examples included in UX spec file (to be produced separately if needed).

---

## 8. Metrics & Success Criteria

- ≥70% of optimizer runs produce at least one new prompt version (proxy for usefulness).
- Consultants report ≥30% reduction in manual prompt edits per batch (qualitative follow-up).
- No increase in comparison runtime errors (monitor after launch).
- AI cost: <= 6 document theory calls + per-field prompt synthesis calls per run (bounded by sampling rules).

---

## 9. Rollout & Experimentation

- Feature flag for internal users only (same gating as other in-flight prompt studio work).
- Dogfood with technical consultants for 2–3 weeks before broader enablement.
- Collect feedback via #prompt-studio Slack channel and instrument telemetry dashboards.

---

## 10. Open Questions / Follow-Ups

1. Do we need to capture optimizer run history (timestamp, docs, prompts) anywhere beyond existing version notes? (Currently no new storage; may need lightweight JSON log later.)
2. Should we allow cancelling a run mid-way (especially if AI calls are slow)?
3. Do we want to auto-open the prompt editor for each updated field, or is the modal summary sufficient?
4. How should we handle template changes mid-run (fields removed/renamed)?
5. Should we provide a cost estimate per run in the UI?

---

## 11. Known Limitations

- No resume for interrupted runs; user must re-run from scratch.
- Theories stored in-memory only; if page refresh occurs before modal, reasoning is lost (unless we persist to existing store—future enhancement).
- Optimizer assumes comparison ground truth hasn’t changed between comparison rerun and prompting; rapid data churn may require manual re-check.

