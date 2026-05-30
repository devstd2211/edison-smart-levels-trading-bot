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
- 2026-05-30: completed `packages/core/src/web/web-entrypoint-runtime.ts web runtime composition boundary follow-up`.
- 2026-05-30: completed `packages/core/src/web/index.ts web runtime compatibility boundary follow-up`.
- 2026-05-30: completed `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts web runtime handoff guardrail follow-up`.
- `web-entrypoint-runtime.ts` now keeps the concrete `WebServerBotInstanceAdapter` internal to the runtime helper and publishes the narrower `WebServerBotPort` contract instead, so the explicit `{ botAdapter, webApiAdapter }` handoff no longer exposes adapter implementation ownership.
- `web/index.ts` stays a thin compatibility barrel while re-exporting the new `WebServerBotPort` type from the dedicated runtime helper instead of widening back to the concrete adapter class.
- The web entrypoint guardrails now prove the lower-level runtime source publishes the narrow bot port contract and keeps the concrete adapter class non-exported.

## Latest Verification
- 2026-05-30: `npm test -- --runInBand packages/core/src/__tests__/web/web-entrypoint.functional.test.ts packages/core/src/__tests__/web/web-boundary.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts` (3 suites, 26 tests)
- 2026-05-30: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-30: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/index.ts cli runtime compatibility boundary follow-up`.
- Keep the next batch on the CLI/standalone entrypoint stream so the remaining public wrappers converge on thin barrels over dedicated runtime owners.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
