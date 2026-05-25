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
- 2026-05-25: completed the standalone workflow wrapper contract slice across the active queue:
  - `packages/core/src/collect-data.ts standalone workflow wrapper convergence follow-up`
  - `packages/core/src/test-balance.ts standalone workflow wrapper convergence follow-up`
  - `packages/core/src/vector-db.ts standalone CLI argv boundary follow-up`
  - `packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts standalone script runner contract guardrail follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts architecture quick-start entrypoint contract guardrail follow-up`
- `collect-data.ts`, `test-balance.ts`, and `vector-db.ts` now expose explicit standalone wrapper contracts with shared direct-execution guards instead of leaving the shared runner boundary implicit.
- `vector-db.ts` now reads CLI argv in one place before delegating to the extracted runtime helper, so the wrapper no longer duplicates `process.argv.slice(2)` concerns across multiple entry functions.
- `standalone-script-entrypoints.functional.test.ts` and `ARCHITECTURE_QUICK_START.md` now pin the standalone wrapper contract alongside the existing CLI/legacy/core/web entrypoint boundaries.

## Latest Verification
- 2026-05-25: `npm --prefix packages/core test -- --runInBand standalone-script-entrypoints.functional architecture-entrypoint-boundary vector-db.entrypoint.test`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.entrypoint.ts standalone runtime workflow boundary follow-up`.
- Stay on the standalone-entrypoint stream: work through the extracted collect-data/test-balance/vector-db runtime helpers and the focused package-script guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
