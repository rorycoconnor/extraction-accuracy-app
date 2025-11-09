# Run Optimizer Implementation Checklist

Track progress against the implementation plan in `optimizer-prime-implementation.md`.

## PRD Alignment
- [ ] Update base PRD with clarified base-model targeting, freshness assumption, and transient theory notes

## UI Entry Points
- [ ] Add `Run Optimizer` button + props to `ControlBar`
- [ ] Wire optimizer state/handlers into `MainPageSimplified`
- [ ] Extend `ModalContainer` to mount the optimizer summary modal

## Optimizer Runner & State
- [ ] Add optimizer slice/actions to `AccuracyDataStore`
- [ ] Implement `useOptimizerRunner` hook (step orchestration, progress labels, toasts)

## Sampling & Diagnostics
- [ ] Build doc/field sampling utility + tests (`optimizer-sampling`)
- [ ] Implement structured extraction-based theory generation (shared Box AI helper + retries)

## Prompt Generation & Persistence
- [ ] Add prompt payload builder + parser helpers (`optimizer-prompts`)
- [ ] Integrate Gemini 2.5 Pro text-gen call via Box agent override (blank file context)
- [ ] Update prompt persistence helpers to support optimizer-sourced versions

## Results UX
- [ ] Create `OptimizerSummaryModal` component with document/field breakdowns
- [ ] Connect modal to optimizer run summary data + prompt studio CTA

## Testing & QA
- [ ] Unit tests: sampling logic, prompt payload building, store reducers
- [ ] Integration test / mocked hook flow covering success + failure paths
- [ ] Manual QA pass (UI gating, modal rendering, localStorage prompt updates)

## Telemetry & Logging
- [ ] Log optimizer lifecycle events + API failures
- [ ] Optional: add analytics hooks if available

## Documentation & Follow-Ups
- [ ] Keep this checklist updated per milestone
- [ ] Capture open questions/decisions in `optimizer-prime-implementation.md` as they’re resolved
