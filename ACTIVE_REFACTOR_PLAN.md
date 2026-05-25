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
- 2026-05-25: completed the standalone helper boundary follow-up slice across the active queue:
  - `packages/core/src/collect-data.entrypoint.ts standalone wrapper-facing runtime options follow-up`
  - `packages/core/src/test-balance.entrypoint.ts standalone wrapper-facing credential/runtime follow-up`
  - `packages/core/src/vector-db/cli.ts standalone command-runtime dispatch follow-up`
  - `packages/core/src/__tests__/core/collect-data.entrypoint.test.ts standalone startup-step runtime guardrail follow-up`
  - `packages/core/src/__tests__/core/test-balance.entrypoint.test.ts standalone runtime execution-step guardrail follow-up`
- `collect-data.entrypoint.ts` now returns the recurring-task cleanup function from the explicit startup step, so wrapper-facing startup code can own the recurring-task lifecycle instead of treating it as a hidden side effect.
- `test-balance.entrypoint.ts` now distinguishes missing-credentials setup failures from unrelated runtime setup errors, which keeps credential guidance narrow and lets other startup failures surface honestly.
- `vector-db/cli.ts` now resolves the shared runtime dependencies for `console` and `process` in one place before command-runtime creation and dispatch, reducing duplication across the standalone command path.
- `collect-data.entrypoint.test.ts` and `test-balance.entrypoint.test.ts` now pin the cleanup-return contract and the setup-failure classification boundary directly.

## Latest Verification
- 2026-05-25: `npm --prefix packages/core test -- --runInBand collect-data.entrypoint test-balance.entrypoint vector-db.entrypoint`
- 2026-05-25: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports"`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.ts standalone startup cleanup adoption follow-up`.
- Stay on the standalone-entrypoint stream: align the public wrappers and the remaining functional guardrails with the latest helper cleanup and failure-classification contracts before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
