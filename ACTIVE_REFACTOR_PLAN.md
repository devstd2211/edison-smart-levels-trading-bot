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
- 2026-05-23: completed the next route/status helper convergence slice across the active queue:
  - `packages/web-server/src/routes/route-response.ts route helper status ApiError convergence follow-up`
  - `packages/web-server/src/errors/api-error-response.ts websocket/http status helper deduplication follow-up`
  - `packages/web-server/src/swagger.config.ts structured error default-suggestion example parity follow-up`
  - `packages/web-server/tests/api-error-response.test.ts status ApiError helper edge-case guardrail follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts route helper default-suggestion parity guardrail follow-up`
- `api-error-response.ts` now exposes shared `createStatusErrorDetail(...)` and `createErrorResponseFromDetail(...)` builders, so HTTP status responses, route-normalized failures, and OpenAPI examples all materialize the same structured error shape through one path.
- `route-response.ts` now builds route failures through `createErrorDetail(...)` instead of manually stitching `status/code/details/suggestion`, which also fixes the previous bug where `fallbackMessage` was ignored whenever the thrown value had no `message` or `error` field.
- `swagger.config.ts` now derives its default structured error example from the shared status/detail helper instead of a hand-written literal, and the matching unit/functional tests now cover both fixed-example parity and route fallback behavior for status-only delegate failures.

## Latest Verification
- 2026-05-23: `npm --prefix packages/web-server test -- --runInBand api-error-response web-server.functional`
- 2026-05-23: `npm test -- --runInBand position-monitor`
- 2026-05-23: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/websocket/ws-server.ts websocket status payload helper convergence follow-up`.
- Keep the same rule: continue the web-server structured error convergence one production component at a time, then align the matching guardrails around `ws-server.ts`, `request-logging.middleware.ts`, `index.ts`, and the related websocket/OpenAPI functional tests before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
