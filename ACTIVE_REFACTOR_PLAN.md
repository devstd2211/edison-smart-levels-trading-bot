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
- 2026-05-06: completed the `BotInitializer grouped dependency reduction` slice.
- Replaced the ad-hoc initializer bundle mutation path with explicit runtime holders: `exchangeRuntime` now owns the active exchange instance used after factory startup, and `btcMarketState` now owns the shared BTC candle store.
- Updated `BotInitializer` and the periodic maintenance helper to read through the active exchange runtime instead of assuming the original grouped `bybitService` reference remains authoritative after startup.
- Removed touched inline log emoji from `bot-initializer-periodic.utils.ts` in favor of shared `ICONS`, and extracted the trend-analysis warm-up delay into a named constant.
- Extended adapter and functional coverage so the initializer contract now proves both the factory-created exchange handoff and the shared BTC candle state wiring.

## Latest Verification
- 2026-05-06: `npm test -- --runInBand position-monitor`
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-services-adapter.functional.test.ts packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/bot-initializer-periodic.utils.test.ts packages/core/src/__tests__/services/bot-initializer-lifecycle.utils.test.ts packages/core/src/__tests__/services/bot-initializer-error.utils.test.ts packages/core/src/__tests__/services/bot-initializer-retry.utils.test.ts packages/core/src/__tests__/services/bot-initializer-shutdown.utils.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts`
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-06: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
