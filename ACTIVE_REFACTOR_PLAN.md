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
- 2026-05-23: completed the next websocket/http error-parity slice across the active queue:
  - `packages/web-server/src/websocket/ws-server.ts websocket status payload helper convergence follow-up`
  - `packages/web-server/src/middleware/request-logging.middleware.ts structured error log payload parity follow-up`
  - `packages/web-server/src/index.ts docs/static fallback shared error helper follow-up`
  - `packages/web-server/tests/ws-server.functional.test.ts websocket status payload helper guardrail follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts docs/static error example parity guardrail follow-up`
- `api-error-response.ts` now recognizes structured error bodies even after Express serializes them, and websocket status helpers no longer leak generated `ApiError` stacks or replace route-level fallback messages with raw thrown `message` fields.
- `ws-server.ts` now routes request-validation and read failures through the same status-detail normalization path, so explicit websocket errors preserve stable fallback semantics even when upstream failures expose only `status` metadata.
- `request-logging.middleware.ts` now extracts request id, code, message, details, and suggestion from structured HTTP error responses, while `index.ts` now sends the SPA fallback 404 through the same helper path with request-id parity.

## Latest Verification
- 2026-05-23: `npm --prefix packages/web-server test -- --runInBand request-logging.middleware api-error-response ws-server.functional web-server.functional`
- 2026-05-23: `npm test -- --runInBand position-monitor`
- 2026-05-23: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/errors/api-error-response.ts websocket/http structured error helper follow-up`.
- Keep the same rule: continue the web-server structured error convergence one production component at a time, then align the matching guardrails around `api-error-response.ts`, `request-logging.middleware.test.ts`, `error-handler.middleware.ts`, `swagger.config.ts`, and their focused tests before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
