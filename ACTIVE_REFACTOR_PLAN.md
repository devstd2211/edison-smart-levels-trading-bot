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
- 2026-05-23: completed the shared web-server boundary cleanup slice across the active queue:
  - `packages/web-server/src/routes/config.routes.ts config mutation error-path simplification follow-up`
  - `packages/web-server/src/routes/analytics.routes.ts analytics derived-read helper extraction follow-up`
  - `packages/web-server/src/websocket/ws-server.ts watcher read contract boundary follow-up`
  - `packages/web-server/src/errors/api-error-response.ts structured error normalization follow-up`
  - `packages/web-server/tests/ws-server.functional.test.ts websocket watcher/error envelope guardrail follow-up`
- `config-route-contracts.ts` now rejects invalid `{ config: ... }` wrappers instead of silently treating the outer request body as config, and `config.routes.ts` now routes config mutation/validation/restore parsing through shared `ApiError`-backed helpers instead of bespoke local `try/catch` paths.
- `analytics.routes.ts` now depends on explicit derived-read delegates for `getPnlHistory()` and `getEquityCurve()`, so the route layer no longer assembles journal-derived chart payloads inline.
- `file-watcher.service.ts`, `ws-server.ts`, and `index.ts` now share an explicit realtime watcher delegate boundary for websocket subscriptions instead of passing the full watcher implementation into the websocket layer.
- `api-error-response.ts` and `route-response.ts` now preserve structured `details`, `suggestion`, and `status` metadata from non-`ApiError` failures, keeping route-level envelopes aligned with middleware-level normalization.

## Latest Verification
- 2026-05-23: `npm --prefix packages/web-server test -- --runInBand web-server.functional ws-server.functional api-error-response`
- 2026-05-23: `npm test -- --runInBand position-monitor`
- 2026-05-23: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/route-response.ts shared structured route error metadata follow-up`.
- Keep the same rule: tighten one production boundary at a time, then align its related guardrail coverage before widening back out into route composition and watcher service surfaces.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
