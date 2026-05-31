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
- 2026-05-31: completed `packages/core/src/collect-data.ts standalone collect-data compatibility wrapper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/test-balance.ts standalone test-balance compatibility wrapper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/vector-db.ts standalone vector-db compatibility wrapper boundary follow-up`.
- `standalone-entrypoint-runtime.ts` now exposes `createStandaloneEntrypointWrapperRunners(...)`, so compatibility wrappers keep the same public `main` and `if-main` helper surface without locally branching between module-bound and generic runner owners.
- The collect-data, test-balance, and vector-db compatibility wrappers now delegate both explicit entrypoint execution and default direct-execution guards through one shared module-aware contract instead of reassembling `currentModule === module` branching inline.
- The standalone runtime, standalone wrapper, and package boundary guardrails now prove that shared helper preserves override entrypoints, keeps default `require.main` resolution inside the runtime seam, and keeps the compatibility wrappers side-effect free on import.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/core/standalone-entrypoint-runtime.functional.test.ts packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts packages/core/src/__tests__/core/collect-data.entrypoint.test.ts packages/core/src/__tests__/core/test-balance.entrypoint.test.ts` (5 suites, 50 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.entrypoint.ts standalone collect-data wrapper boundary follow-up`.
- Keep the next batch on the standalone wrapper/runtime stream so the remaining collect-data and test-balance entrypoint helpers converge on the same wrapper-owned direct-execution contract as the compatibility scripts.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
