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
- 2026-05-18: completed five runtime endpoint discovery convergence slices:
  - `web-client api service runtime base-url fallback convergence`
  - `web-client websocket runtime endpoint discovery convergence`
  - `web-client app startup runtime preload convergence`
  - `web-server swagger server URL/runtime example convergence`
  - `workspace package runtime endpoint fallback smoke follow-up`
- Unified web-client runtime discovery around one cache-first resolver so the default REST base URL, WebSocket endpoint lookup, and pre-render startup preload now share the same candidate order instead of hardcoding separate `4002`, `4000`, and per-service fallback paths.
- Kept browser fallback behavior compatible with the existing publish boundary by trying same-origin or runtime-default `/api` first, retrying the legacy `4002` config endpoint only when runtime discovery fails, and letting the default API client re-read cached runtime endpoints instead of freezing its base URL at module load.
- Converged Swagger/OpenAPI runtime examples on the same default runtime payload and expanded client/server/package smoke coverage to lock in cached endpoint reuse, fallback retry order, startup preload wiring, and the browser-safe contracts boundary.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand api.service websocket.service server-runtime-config control-config-bootstrap app-config.functional`
- 2026-05-18: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-18: `npm test -- --runInBand package-script-boundary`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
