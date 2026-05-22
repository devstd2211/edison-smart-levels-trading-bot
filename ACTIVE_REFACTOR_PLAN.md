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
- 2026-05-22: completed the config/analytics contract hardening slice across the active queue:
  - `packages/web-server/src/routes/config-route-contracts.ts config request parsing boundary follow-up`
  - `packages/web-server/src/services/config-management.service.ts config route service contract narrowing follow-up`
  - `packages/web-server/src/services/file-watcher.service.ts analytics route service contract narrowing follow-up`
  - `packages/web-server/src/swagger.config.ts config and analytics route contract surface follow-up`
  - `packages/web-server/src/middleware/error-handler.middleware.ts route envelope parity follow-up`
- `config-route-contracts.ts` now owns the explicit `ConfigRouteApi`/runtime-port boundary plus the route-api delegate factory, so config request parsing and route surface shaping live in one contract module instead of being split between helpers and routes.
- `config-management.service.ts` now rejects non-object config roots and formats restore validation issues into readable `path: message` failures, which keeps bad config payloads from leaking through as successful reads or opaque `[object Object]` restore errors.
- `file-watcher.service.ts` now exposes an explicit analytics read contract, uses a canonical `compareSessions(...)` method, and fails fast on malformed journal/session file shapes instead of silently returning incompatible payloads to analytics routes.
- `swagger.config.ts` now separates config-route and analytics-route response helpers so the OpenAPI layer mirrors the explicit boundary split introduced in the route/service contracts.
- `error-handler.middleware.ts` now normalizes multi-value `x-request-id` headers before logging/responding, keeping the structured error envelope aligned with the shared API response shape.

## Latest Verification
- 2026-05-22: `npm --prefix packages/web-server test -- --runInBand web-server.functional`
- 2026-05-22: `npm --prefix packages/web-server test -- --runInBand ws-server.functional`
- 2026-05-22: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/config.routes.ts config mutation error-path simplification follow-up`.
- Keep the same rule: tighten one production boundary at a time, then align its related functional coverage before widening back out into websocket and shared error-envelope surfaces.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
