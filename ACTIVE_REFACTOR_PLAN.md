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
- 2026-05-28: completed `packages/core/src/interfaces/IRuntimeSources.ts runtime source contract consolidation follow-up`.
- 2026-05-28: completed `packages/core/src/interfaces/ITradingBotServices.ts trading bot service contract consolidation follow-up`.
- 2026-05-28: completed `packages/core/src/interfaces/IBotInitializerServices.ts initializer service contract consolidation follow-up`.
- Canonical narrow runtime slices now live in the consumer-facing interface files, and `IRuntimeSources.ts` reuses them instead of repeating inline `Pick` contracts.
- The initializer runtime contract now makes exchange, market-data, execution, session, and resilience ownership explicit while preserving adapter compatibility with the broader runtime source state.
- Functional/source guardrails now pin the shared runtime contract layer, and related runtime-source tests now read exchange ownership from the top-level runtime source contract.

## Latest Verification
- 2026-05-28: `npm test -- --runInBand runtime-contracts.functional.test.ts runtime-service-adapters.functional.test.ts bot-initializer.test.ts services/bot-initializer.functional.test.ts bot-factory.test.ts services/bot-factory.service.test.ts services/bot-factory.error-handling.test.ts` (7 suites, 97 tests)
- 2026-05-28: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-28: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/interfaces/IWebSocketEventHandlerServices.ts websocket handler contract consolidation follow-up`.
- Keep the next batch component-sized: each active item should be a real runtime/initializer/websocket boundary slice, not a single-line alias or naming-only task.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
