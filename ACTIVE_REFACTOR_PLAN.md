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
- 2026-05-31: completed `packages/core/src/collect-data.entrypoint.ts standalone collect-data wrapper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/collect-data-entrypoint-runtime.ts standalone collect-data runtime helper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/test-balance.entrypoint.ts standalone test-balance wrapper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/test-balance-entrypoint-runtime.ts standalone test-balance runtime helper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/__tests__/core/collect-data.entrypoint.test.ts standalone collect-data wrapper guardrail follow-up`.
- 2026-05-31: completed `packages/core/src/__tests__/core/test-balance.entrypoint.test.ts standalone test-balance wrapper guardrail follow-up`.
- `collect-data.entrypoint.ts` and `test-balance.entrypoint.ts` are now thin compatibility barrels over dedicated runtime helper modules, so standalone workflow orchestration no longer lives on the public helper import path.
- The new `collect-data-entrypoint-runtime.ts` and `test-balance-entrypoint-runtime.ts` now own the concrete config/env loading, service construction, and workflow execution seams behind those stable entrypoint exports.
- The collect-data, test-balance, and package-boundary guardrails now prove the thin barrels keep their stable helper surface while the runtime files retain the actual orchestration imports.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/core/collect-data.entrypoint.test.ts packages/core/src/__tests__/core/test-balance.entrypoint.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts` (3 suites, 36 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/vector-db/cli.ts standalone vector-db runtime helper boundary follow-up`.
- Keep the next batch on the standalone/vector-db runtime stream so the remaining vector-db entrypoint and runtime-path helpers converge on the same thin-barrel runtime ownership split.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
