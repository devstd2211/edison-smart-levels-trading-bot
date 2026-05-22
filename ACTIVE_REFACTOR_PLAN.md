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
- 2026-05-22: completed the shared standalone-script direct-execution guard slice across the active queue:
  - `packages/core/src/standalone-entrypoint-runtime.ts shared direct-execution guard helper audit`
  - `packages/core/src/collect-data.ts standalone script helper convergence follow-up`
  - `packages/core/src/test-balance.ts standalone script helper convergence follow-up`
  - `packages/core/src/vector-db.ts standalone script helper convergence follow-up`
  - `packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts shared standalone script guardrail audit`
- `packages/core/src/standalone-entrypoint-runtime.ts` now exports `createStandaloneEntrypointRunners`, so standalone scripts share one default runner/direct-execution guard factory instead of each re-declaring the same wrapper pair.
- `packages/core/src/collect-data.ts`, `packages/core/src/test-balance.ts`, and `packages/core/src/vector-db.ts` now bind their exported `run*Entrypoint` and `run*EntrypointIfMain` helpers through the shared factory and call the direct-execution guard without the previous extra runner indirection.
- Refreshed the standalone boundary tests so the runtime suite covers the shared factory contract and the script guardrail suite asserts that each standalone entrypoint module is wired through the shared runner factory instead of ad hoc wrappers.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand collect-data.entrypoint test-balance.entrypoint vector-db.entrypoint package-script-boundary standalone-entrypoint-runtime standalone-script-entrypoints`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
