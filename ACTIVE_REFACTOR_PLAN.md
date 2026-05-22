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
- 2026-05-22: completed the web API boundary follow-up slice across the active queue:
  - `packages/core/src/bot.ts TradingBot web API dependency boundary follow-up`
  - `packages/core/src/api/bot-web-api.ts BotWebAPI required dependency surface follow-up`
  - `packages/core/src/api/create-web-api-adapter.ts read-only web API adapter boundary follow-up`
  - `packages/web-server/src/services/bot-bridge.service.ts web-server bridge read-only adapter follow-up`
  - `docs/architecture/dependency-map.md web API/runtime dependency map refresh`
- `TradingBot` now receives a prebuilt `webApiAdapter` and a narrow `balanceReader`, so the bot no longer lazily constructs `BotWebAPI` or carries the broader web API service bag just to read balances.
- `BotWebAPI` and `createWebApiAdapter` now use `IWebApiReadServices` as the canonical dependency surface, while runtime bundle assembly creates the adapter once and shares it across bot/runtime consumers.
- `BotBridgeService` now consumes the shared `IWebApiAdapter` contract directly instead of maintaining a parallel local picker type for the same read-only API.
- Refreshed boundary coverage so runtime adapter tests assert the narrowed `balanceReader` + `webApiAdapter` contract and the web/server suites keep verifying read-only adapter behavior end to end.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand trading-bot.web-api create-trading-bot-runtime runtime-service-adapters bot-factory legacy-entrypoint bot-web-api`
- 2026-05-22: `npm --prefix packages/web-server test -- --runInBand bot-bridge.service`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
