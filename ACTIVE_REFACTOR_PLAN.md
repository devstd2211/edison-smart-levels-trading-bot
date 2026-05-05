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
- 2026-05-05: completed the `BotFactory public service-state exposure boundary`, `Contracts web DTO propagation boundary`, and `Web-server read-only adapter hardening boundary` slice.
- Added shared runtime/websocket DTO contracts in `packages/contracts` for `BotStatus`, `Signal`, `ApiResponse`, and `WebSocketPayloadMap`, then switched `web-server` and `web-client` to consume those contracts instead of keeping parallel local copies.
- Standardized the read-only `walls` payload on `WebApiWallsView` end-to-end so the server/client path no longer carries the legacy array-or-object fallback shape.
- Added `BotFactory.createRuntimeBundle()` so public composition-root callers can request narrowed runtime dependencies plus the read-only web API adapter without reaching for the broader service-state surface.
- Kept the legacy `createServices()` escape hatch for internal lifecycle-heavy tests while moving public-facing factory coverage onto the new narrowed bundle boundary.

## Latest Verification
- 2026-05-05: `npm test -- --runInBand position-monitor`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-factory.test.ts packages/web-server/tests/bot-bridge.service.functional.test.ts packages/web-server/tests/web-server.functional.test.ts packages/web-client/src/__tests__/services/api.service.test.ts`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-05: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
