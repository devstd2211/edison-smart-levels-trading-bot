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
- 2026-05-21: completed five `TradingBot` constructor/interface tightening slices:
  - `TradingBot constructor typed config surface tightening for constructor-owned fields`
  - `TradingBot runtime event map critical-error contract tightening`
  - `TradingBot critical/dashboard listener storage typed callback tightening`
  - `TradingBot web API adapter lazy-construction boundary coverage`
  - `TradingBot dashboard malformed payload guard and balance fallback boundary coverage`
- Narrowed the `TradingBot`-owned config surface to an explicit `TradingBotConfig`, kept the constructor wiring compatible with the full `Config` required by `BotInitializer` and `WebSocketEventHandlerManager`, and removed the local dashboard shape cast from `packages/core/src/bot.ts`.
- Extended the runtime event contract with a typed `critical-error` event and reused the shared runtime listener type for `critical-error`, `position-opened`, and `position-closed` handlers.
- Added functional coverage for lazy web API adapter creation, malformed dashboard payload guards, config-derived balance fallback behavior, and the critical-error shutdown hook.

## Latest Verification
- 2026-05-21: `npm test -- --runInBand trading-bot.functional trading-bot.lifecycle trading-bot.web-api create-trading-bot-runtime`
- 2026-05-21: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
