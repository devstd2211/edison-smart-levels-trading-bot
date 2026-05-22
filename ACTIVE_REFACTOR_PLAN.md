# Active Refactor Plan

This file is the active source of truth for current refactor work only.
Historical detail is archived elsewhere and should not be copied here.

## Refactor Mode
- Component-first refactor only.
- No standalone test-cleanup passes.
- For each component: refactor production code, immediately refactor its tests, and add a functional test if one is missing.

## Source Files
- Active workflow and current status: `ACTIVE_REFACTOR_PLAN.md`
- Component checklist: `REFACTOR_COMPONENT_CHECKLIST.md`
- Task catalog/backlog by area: `REFACTOR_TASKS.md`
- Frozen archive: `REFACTOR_PLAN_01.md`

## Open Streams
- [ ] Create and maintain a finite component checklist instead of open-ended test cleanup.
- [ ] Refactor components one by one in a behavior-preserving way.
- [ ] Keep test updates coupled to the component being refactored.
- [ ] Add missing functional coverage only for the component currently in scope.

## Current Focus
- [ ] Use `REFACTOR_COMPONENT_CHECKLIST.md` as the only queue for component-level refactor progress.
- [ ] Each completed slice must satisfy all three conditions:
  1. production component refactored
  2. related tests refactored/aligned
  3. functional test exists for that component, or a new one was added in the same slice

## Working Rules
1. Pick the next unchecked component from `REFACTOR_COMPONENT_CHECKLIST.md`.
2. Refactor the production component first.
3. Immediately refactor only that component's related tests.
4. If no functional test exists for that component, add one in the same slice.
5. Run targeted tests for the changed component area.
6. Run `npm run build`.
7. Update `REFACTOR_COMPONENT_CHECKLIST.md`:
   - mark the component complete when all conditions are met
   - move completed items into the history section so the active list shrinks over time
8. Update this file with only the latest completed slice and latest verification.
9. Do not run separate test-only cleanup campaigns.

## Latest Completed
- 2026-05-22: completed the standalone wrapper follow-up slice across the active queue:
  - `packages/core/src/collect-data.ts standalone startup/shutdown workflow boundary follow-up`
  - `packages/core/src/test-balance.ts standalone runtime bootstrap/reporting follow-up`
  - `packages/core/src/vector-db.ts standalone CLI wrapper boundary follow-up`
  - `packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts standalone wrapper guardrail follow-up`
  - `packages/core/src/__tests__/core/standalone-script-console.test.ts standalone formatter guardrail follow-up`
- `packages/core/src/collect-data.entrypoint.ts` now owns the full standalone workflow entry sequence, including banner output, config loading, runtime startup, shutdown registration, and recurring-task scheduling, so `collect-data.ts` is reduced to a thin error-handling wrapper.
- `packages/core/src/test-balance.entrypoint.ts` now owns the full connectivity-check workflow, including runtime bootstrap failure handling, Bybit service creation, console reporting, and success/failure footers, so `test-balance.ts` is reduced to a single delegation point.
- `packages/core/src/vector-db.ts` now exposes an explicit `runVectorDbMain` wrapper over the shared CLI runner so the top-level standalone script is a pure argument-forwarding boundary.
- Refreshed the standalone guardrail coverage so the console helper suite verifies shared line-printing semantics and the wrapper functional suite asserts each `main()` delegates to the extracted helper/runtime boundary instead of rebuilding orchestration inline.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand standalone-script-console standalone-script-entrypoints collect-data.entrypoint test-balance.entrypoint vector-db.entrypoint package-script-boundary`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
