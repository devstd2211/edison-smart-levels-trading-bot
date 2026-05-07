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
- 2026-05-07: completed the cleanup batch for `BotFactory runtime-source compatibility alias retirement`, `AntiFlip state snapshot wording cleanup`, `Orderbook imbalance service-state wording cleanup`, `Virtual balance state snapshot wording cleanup`, and `Circuit-breaker state snapshot wording audit`.
- Retired the residual `createBotFactoryServiceState` and tracked runtime-services compatibility aliases, keeping `createBotFactoryRuntimeSource` and the tracked runtime-source helpers as the only remaining BotFactory naming surface.
- Renamed the observational AntiFlip and VirtualBalance read APIs to `getStateSnapshot`, renamed OrderbookImbalance config observation to `getConfigSnapshot`, and aligned the focused service tests with the narrowed snapshot wording.
- Replaced touched legacy literal emoji log prefixes in AntiFlip, VirtualBalance, and the legacy CircuitBreaker with shared `ICONS`, adding `ICONS.money` so the shared CLI icon registry can cover balance gain logs without fallback literals.

## Latest Verification
- 2026-05-07: `npm test -- --runInBand position-monitor`
- 2026-05-07: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/anti-flip.service.test.ts packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/orderbook-imbalance.service.test.ts packages/core/src/__tests__/services/orderbook-imbalance.functional.test.ts packages/core/src/__tests__/services/orderbook-imbalance.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts packages/core/src/__tests__/cli/cli-runtime.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/bot-factory.test.ts`
- 2026-05-07: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-07: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
