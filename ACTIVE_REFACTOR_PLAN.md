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
- 2026-05-18: completed five runtime discovery hardening slices:
  - `web-client runtime resolver same-origin candidate hardening`
  - `web-client websocket reconnect runtime bootstrap reuse`
  - `web-client startup runtime preload error-state convergence`
  - `web-server docs html runtime discovery wording convergence`
  - `workspace package browser runtime resolver smoke follow-up`
- Hardened the shared web-client runtime resolver so browser callers prefer same-origin `/api` even on implicit default ports, fall back to `4000` only when no browser origin is usable, and keep the legacy `4002` compatibility probe last in the candidate list.
- Reused the resolved WebSocket bootstrap URL across reconnect attempts, preserved explicit constructor URLs instead of silently overriding them with runtime discovery, and made startup preload cache fallback runtime endpoints so the rest of the client reads one consistent runtime state after discovery failures.
- Updated the `/api/docs` landing page wording to point at `/api/config/server`, describe the current-origin-first discovery flow, and expanded web-client/web-server/package tests to lock in the new same-origin-first resolver contract.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand server-runtime-config api.service websocket.service app-config.functional`
- 2026-05-18: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-18: `npm test -- --runInBand package-script-boundary`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
