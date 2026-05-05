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
- 2026-05-05: completed the `BotServices final reduction boundary`, `Web API config defaults boundary`, and `Web-client data API contract cleanup boundary` slice.
- Replaced the ambiguous internal `createServices()` helper with `createServiceState()`, introduced the explicit `IBotServiceStateSource` name for the full internal service-state surface, and removed the unused public `BotFactory.createServices()` escape hatch so the root factory stays on the narrowed runtime bundle boundary.
- Added `packages/core/src/config/web-api-config.ts` and normalized `webApi.indicatorPreferences` during config loading and grouped-service assembly, so `BotWebAPI` and the read-only service containers consume one consistent defaulted config shape instead of each carrying local fallback arrays.
- Removed the last `WebApiWallsView` array fallback from `packages/web-server/src/services/bot-bridge.service.ts`, keeping the server strictly on the object-shaped read-only contract.
- Typed the remaining `web-client` data/config API payload helpers (`getBalance`, `getRecentSignals`, `getConfig`, `saveConfig`, `validateConfig`, `getConfigSchema`, `getConfigHistory`, `updateRiskSettings`) and aligned the contract tests with those concrete payload shapes.

## Latest Verification
- 2026-05-05: `npm test -- --runInBand position-monitor`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/grouped-services.builder.functional.test.ts packages/core/src/__tests__/api/bot-web-api.test.ts`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/web-server/tests/bot-bridge.service.functional.test.ts packages/web-server/tests/web-server.functional.test.ts packages/web-client/src/__tests__/services/api.service.test.ts`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-05: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
