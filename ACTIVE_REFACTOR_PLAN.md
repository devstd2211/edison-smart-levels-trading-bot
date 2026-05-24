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
- 2026-05-24: completed the web-server HTTP/error-handler logging slice across the active queue:
  - `packages/web-server/src/middleware/request-logging.middleware.ts http request/error log payload helper follow-up`
  - `packages/web-server/src/logging/request-scoped-error-log.ts http/error-handler payload helper follow-up`
  - `packages/web-server/src/middleware/error-handler.middleware.ts shared error-handler log payload follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts http/error-handler log guardrail follow-up`
  - `packages/web-server/tests/ws-server.functional.test.ts websocket/http log isolation guardrail follow-up`
- `request-scoped-error-log.ts` now exports shared HTTP request log, HTTP response-error log, and error-handler log payload builders so middleware logging uses the same normalization path instead of ad-hoc payload assembly.
- `request-logging.middleware.ts` now delegates request/response log shaping to shared helpers, while `error-handler.middleware.ts` reuses the shared error-handler payload builder instead of owning a parallel implementation.
- Unit and functional coverage now pin helper output directly, verify successful HTTP responses do not invent error metadata, and guard that websocket validation/failure logs stay isolated from HTTP log labels while HTTP structured error metadata remains stable.

## Latest Verification
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand request-logging.middleware error-handler.middleware`
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand web-server.functional`
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand ws-server.functional`
- 2026-05-24: `npm test -- --runInBand position-monitor`
- 2026-05-24: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/middleware/rate-limit.middleware.ts rate-limit response helper convergence follow-up`.
- Keep the same rule: continue one production component at a time through the refreshed boundary queue around `rate-limit.middleware.ts`, `route-response.ts`, `api-error-response.ts`, and the focused middleware/web-server guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
