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
- 2026-05-26: completed the standalone wrapper adoption slice across the active queue:
  - `packages/core/src/collect-data.ts standalone startup cleanup adoption follow-up`
  - `packages/core/src/test-balance.ts standalone setup-failure classification adoption follow-up`
  - `packages/core/src/vector-db.ts standalone runtime dependency resolver adoption follow-up`
  - `packages/core/src/__tests__/core/vector-db.entrypoint.test.ts standalone command-runtime dispatch guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts standalone helper lifecycle guardrail follow-up`
- `collect-data.ts` now delegates directly to `runCollectDataWorkflow()`, so the wrapper consumes the shared startup/cleanup workflow instead of reconstructing runtime startup inline.
- `test-balance.ts` now delegates to `runTestBalanceWorkflow()`, leaving missing-credentials classification inside the shared helper instead of reimplementing it in the wrapper.
- `vector-db.ts` now delegates argv handling to `runVectorDbCli()` through `runVectorDbMain()`, so the wrapper reuses the shared runtime dependency resolution and command dispatch path.
- `standalone-script-entrypoints.functional.test.ts`, `vector-db.entrypoint.test.ts`, and `package-script-boundary.functional.test.ts` now pin the wrapper-to-helper delegation contract directly.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand collect-data.entrypoint test-balance.entrypoint vector-db.entrypoint standalone-script-entrypoints.functional`
- 2026-05-26: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports"`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/standalone-entrypoint-runtime.ts standalone runner return-type boundary follow-up`.
- Stay on the standalone-entrypoint stream: tighten the shared runner and documentation guardrails around the new helper-first wrapper delegation before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
