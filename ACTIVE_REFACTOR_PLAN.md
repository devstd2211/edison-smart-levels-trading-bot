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
- 2026-05-05: completed the `LifecycleManager orchestration boundary` and `TradingBot lifecycle-only start/stop boundary` slice.
- Upgraded `LifecycleManager` from a flat stop-only list into a named, staged lifecycle registry, so `BotInitializer` now starts execution, monitoring, resilience, WebSocket, and position-monitor services through one orchestration boundary instead of bespoke `service.start()` calls.
- Declared the BotInitializer lifecycle topology in `bot-initializer-lifecycle.utils.ts`, keeping startup ids/stages close to the wiring and preserving reverse-order shutdown through the same registry.
- Reduced `TradingBot.start()/stop()` to lifecycle coordination plus bot-specific hooks by moving runtime startup/shutdown side effects behind `BotInitializer.bootstrap()/shutdown()` hooks.
- Added focused lifecycle coverage for the registry ordering and aligned the initializer/trading-bot delegation tests with the new hook-based lifecycle flow.

## Latest Verification
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/lifecycle-manager.service.test.ts packages/core/src/__tests__/services/bot-initializer-lifecycle.utils.test.ts packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-05: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
