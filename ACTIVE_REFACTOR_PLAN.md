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
- 2026-05-30: completed `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts entrypoint barrel guardrail follow-up`.
- 2026-05-30: completed `packages/core/src/standalone-script-console.ts standalone script console boundary follow-up`.
- 2026-05-30: completed `packages/core/src/__tests__/core/standalone-script-console.test.ts standalone script console guardrail follow-up`.
- `standalone-script-console.ts` now owns the bounded standalone message-block presentation through `printStandaloneScriptMessageBlock(...)`, so highlighted console sections reuse the same divider format as banners instead of rebuilding it inline per workflow.
- The shared standalone console contract now narrows to log-only output ownership, while footer formatting stays behind the shared line printer instead of exported line-builder helpers.
- The package-script and standalone console guardrails now prove the standalone wrappers keep the zero-argument module-bound `if-main` handoff and that `test-balance.entrypoint.ts` routes highlighted balance output through the shared standalone presentation helper.

## Latest Verification
- 2026-05-30: `npm test -- --runInBand packages/core/src/__tests__/core/standalone-script-console.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts packages/core/src/__tests__/core/test-balance.entrypoint.test.ts` (3 suites, 27 tests)
- 2026-05-30: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-30: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.entrypoint.ts standalone collect-data wrapper boundary follow-up`.
- Keep the next batch on the standalone wrapper stream so collect-data, test-balance, and vector-db compatibility layers converge on the same shared presentation and direct-execution owners.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
