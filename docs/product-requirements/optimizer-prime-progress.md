# Run Optimizer Implementation Checklist

Track progress against the implementation plan in `optimizer-prime-implementation.md`.

## PRD Alignment
- [ ] Update base PRD with clarified base-model targeting, freshness assumption, and transient theory notes

## UI Entry Points
- [x] Add `Run Optimizer` button + props to `ControlBar`
- [x] Wire optimizer state/handlers into `MainPageSimplified`
- [x] Extend `ModalContainer` to mount the optimizer summary modal

## Optimizer Runner & State
- [x] Add optimizer slice/actions to `AccuracyDataStore`
- [x] Implement `useOptimizerRunner` hook (step orchestration, progress labels, toasts)

## Sampling & Diagnostics
- [x] Build doc/field sampling utility + tests (`optimizer-sampling`)
- [x] Implement structured extraction-based theory generation (shared Box AI helper + retries)

## Prompt Generation & Persistence
- [x] Add prompt payload builder + parser helpers (`optimizer-prompts`)
- [x] Integrate Gemini 2.5 Pro text-gen call via Box agent override (blank file context)
- [x] Update prompt persistence helpers to support optimizer-sourced versions

## Results UX
- [x] Create `OptimizerSummaryModal` component with document/field breakdowns
- [x] Connect modal to optimizer run summary data + prompt studio CTA

## Testing & QA
- [ ] Unit tests: sampling logic, prompt payload building, store reducers
- [ ] Integration test / mocked hook flow covering success + failure paths
- [ ] Manual QA pass (UI gating, modal rendering, localStorage prompt updates)

## Telemetry & Logging
- [x] Log optimizer lifecycle events + API failures
- [ ] Optional: add analytics hooks if available

## Documentation & Follow-Ups
- [ ] Keep this checklist updated per milestone
- [x] Capture open questions/decisions in `optimizer-prime-implementation.md` as they’re resolved

## Notes
- 2025-02-14: Expanded implementation doc with optimizer state contracts, step-by-step sequence diagram, diagnostics + prompt generation helpers, telemetry schema, and new open questions (cost per field, reusing sampled docs). Base PRD wording still needs an update to reflect clarified assumptions.
- 2025-02-15: Implemented optimizer slice, runner hook, sampling/diagnostics/prompt helpers, summary modal, and UI wiring. Cost visibility question resolved (cost not a concern). Added Vitest coverage for sampling utility, but local run fails due to missing optional Rollup binary in the toolchain (`npm run test -- src/lib/optimizer-sampling.test.ts`).
