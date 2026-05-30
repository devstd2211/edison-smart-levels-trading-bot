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
- 2026-05-30: completed `packages/core/src/standalone-entrypoint-runtime.ts shared standalone runner boundary follow-up`.
- 2026-05-30: completed `packages/core/src/__tests__/core/standalone-entrypoint-runtime.functional.test.ts standalone runtime entrypoint guardrail follow-up`.
- 2026-05-30: completed `packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts standalone script wrapper guardrail follow-up`.
- `standalone-entrypoint-runtime.ts` now owns the module-bound direct-execution seam through `createStandaloneEntrypointModuleRunners(...)`, so standalone wrappers can bind `currentModule` and the shared `require.main` resolver once instead of rebuilding that guard state inline.
- The collect-data, test-balance, and vector-db wrappers now keep their public helper signatures while routing default `if-main` execution through the shared module-bound runtime helper.
- The standalone runtime and wrapper guardrails now prove the shared helper captures `currentModule` once, preserves override entrypoints, and keeps wrapper imports from reassembling direct-execution ownership.

## Latest Verification
- 2026-05-30: `npm test -- --runInBand packages/core/src/__tests__/core/standalone-entrypoint-runtime.functional.test.ts packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts` (2 suites, 15 tests)
- 2026-05-30: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-30: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts entrypoint barrel guardrail follow-up`.
- Keep the next batch on the standalone/package-script stream so the remaining console and wrapper guardrails converge on the same shared direct-execution owner.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
