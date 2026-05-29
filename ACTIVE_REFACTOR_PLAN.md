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
- 2026-05-29: completed `packages/core/src/services/bot-initializer.ts initializer runtime lifecycle boundary follow-up`.
- 2026-05-29: completed `packages/core/src/services/websocket-event-handler-manager.ts websocket handler manager boundary follow-up`.
- 2026-05-29: completed `packages/core/src/bot.ts trading bot lifecycle collaborator boundary follow-up`.
- `BotInitializer` now starts optional monitoring/resilience lifecycle stages only when the narrowed runtime shell actually exposes lifecycle services, which avoids empty-stage startup work and keeps optional ownership local to the adapter boundary.
- `WebSocketEventHandlerManager.registerAllHandlers()` no longer requires a `TradingBot` collaborator, and `TradingBot` now registers runtime handlers through a zero-argument lifecycle seam instead of leaking itself into the websocket manager boundary.

## Latest Verification
- 2026-05-29: `npm test -- --runInBand runtime-service-adapters.functional.test.ts trading-bot.lifecycle.test.ts websocket-event-handler.functional.test.ts bot-initializer.functional.test.ts` (4 suites, 19 tests)
- 2026-05-29: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-29: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/interfaces/ITradingBotRuntimeDependencies.ts runtime dependency bundle contract follow-up`.
- Keep the next batch in the runtime/initializer/websocket boundary stream and merge adjacent guardrail files when one item is too small on its own.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
