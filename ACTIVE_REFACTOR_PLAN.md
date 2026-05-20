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
- 2026-05-20: completed five web-server/test-harness/runtime follow-up slices:
  - `web-server websocket connection lifecycle helper follow-up in remaining startup/error paths`
  - `web-server api entrypoint file-watcher runtime state helper follow-up`
  - `managed harness cleanup helper reuse in remaining web-boundary/runtime-factory contexts`
  - `web-server bridge read-model helper convergence in remaining http route boundaries`
  - `core package web runtime helper example wording follow-up`
- Hardened `WebServer.start()` so websocket/file-watcher runtime services roll back on API startup failure, converged file-watcher stop handling behind a dedicated runtime helper, and kept API port retry logging/close behavior explicit before retrying the listener.
- Reused the shared sync/async route-read helpers across the remaining data and analytics HTTP boundaries, moved the remaining web-boundary/runtime-factory tracked-service tests onto per-test managed contexts, and documented the explicit `createWebServerRuntime(...) -> startWebServer(...)` pair for programmatic web startup.

## Latest Verification
- 2026-05-20: `npm test -- --runInBand web-server data.routes ws-server bot-bridge`
- 2026-05-20: `npm test -- --runInBand web-boundary web-entrypoint create-trading-bot-runtime runtime-service-adapters readme-entrypoint-boundary`
- 2026-05-20: `npm test -- --runInBand position-monitor`
- 2026-05-20: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
