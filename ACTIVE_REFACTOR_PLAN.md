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
- 2026-05-31: completed `packages/core/src/vector-db/cli.ts standalone vector-db runtime helper boundary follow-up`.
- 2026-05-31: completed `packages/core/src/__tests__/core/vector-db.entrypoint.test.ts standalone vector-db wrapper guardrail follow-up`.
- 2026-05-31: completed `packages/core/src/vector-db/vector-db-runtime-paths.ts standalone vector-db runtime paths boundary follow-up`.
- `vector-db/cli.ts` no longer owns a duplicate runtime-path contract or local path assembly; it now imports the shared `VectorDbRuntimePaths` type and `resolveVectorDbRuntimePaths(...)` helper from `vector-db-runtime-paths.ts`.
- The vector-db entrypoint and package-boundary guardrails now prove the CLI/runtime helper surface stays thin and that path resolution ownership remains on the dedicated runtime-path module instead of drifting back into the CLI wrapper.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/core/vector-db.entrypoint.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts packages/core/src/__tests__/vector-db/vector-db.service.helpers.test.ts` (3 suites, 29 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/vector-db/vector-db.service.helpers.test.ts standalone vector-db runtime paths guardrail follow-up`.
- Keep the next batch on the vector-db runtime storage/index stream so the remaining persisted-index helpers converge on the same dedicated runtime ownership split.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
