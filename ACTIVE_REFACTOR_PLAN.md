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
- 2026-06-01: completed `packages/core/src/services/bot-initializer/bot-initializer-periodic.utils.ts initializer runtime periodic utility boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/services/bot-initializer-periodic.utils.test.ts initializer runtime periodic utility guardrail follow-up`.
- 2026-06-01: completed `packages/core/src/services/bot-initializer/bot-initializer-lifecycle.utils.ts initializer runtime lifecycle utility boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/services/bot-initializer-lifecycle.utils.test.ts initializer runtime lifecycle utility guardrail follow-up`.
- `bot-initializer-periodic.utils.ts` now runs against a narrow collaborator projection with a live `getExchange()` handoff, so periodic maintenance no longer depends on the full initializer service bundle while still following exchange swaps after runtime handoff.
- `bot-initializer-periodic.utils.test.ts` now locks the live exchange-runtime contract alongside the existing cleanup and critical-error guardrails, which keeps periodic behavior tied to the runtime boundary instead of the container shape.
- `bot-initializer-lifecycle.utils.ts` now owns lifecycle collaborator projection, optional stage detection, and monitoring-server lookup, so `BotInitializer` no longer duplicates monitoring/resilience presence checks outside the lifecycle boundary.
- `bot-initializer-lifecycle.utils.test.ts` now verifies optional stage ownership and monitoring-server selection directly at the utility seam while the broader initializer tests stayed green across the consumer refactor.

## Latest Verification
- 2026-06-01: `npm test -- --runInBand packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer-periodic.utils.test.ts packages/core/src/__tests__/services/bot-initializer-lifecycle.utils.test.ts` (5 suites, 57 tests)
- 2026-06-01: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-01: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/helpers/websocket-manager-test.utils.ts websocket manager runtime fixture boundary follow-up`.
- Keep the next batch on the websocket manager connection/message and keep-alive boundary stream.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
