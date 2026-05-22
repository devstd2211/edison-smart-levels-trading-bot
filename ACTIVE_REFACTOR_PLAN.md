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
- 2026-05-22: completed the route/runtime handoff follow-up slice across the active queue:
  - `packages/web-server/src/routes/data.routes.ts read-only route delegation follow-up`
  - `packages/web-server/src/routes/bot.routes.ts control-vs-read boundary follow-up`
  - `packages/core/src/web/web-entrypoint-runtime.ts web runtime adapter handoff follow-up`
  - `packages/core/src/__tests__/web/web-boundary.test.ts route/runtime adapter guardrail follow-up`
  - `docs/architecture/dependency-map.md route boundary refresh`
- `data.routes.ts` and `bot.routes.ts` now publish explicit route-local dependency contracts (`DataRouteReadApi` and `BotRouteApi`) plus delegate materializers, so route factories no longer rely on the full `BotBridgeService` surface.
- `packages/web-server/src/index.ts` now wires those explicit delegates at the composition root, keeping the control/read split visible where Express routes are assembled.
- `createWebServerRuntime(bot, webApiAdapter)` now materializes the `WebServerBotInstanceAdapter` before startup handoff, so `startWebServerRuntime(...)` receives the already-adapted bot boundary instead of performing hidden adapter construction.
- Refreshed core/web guardrails to assert the explicit `botAdapter` handoff and direct runtime ctor injection path without depending on a package-level `WebServer` mock.

## Latest Verification
- 2026-05-22: `npm --prefix packages/web-server test -- --runInBand bot.routes data.routes bot-bridge.service`
- 2026-05-22: `npm test -- --runInBand web-boundary web-entrypoint cli-entrypoint`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
