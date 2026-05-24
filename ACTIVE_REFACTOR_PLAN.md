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
- 2026-05-24: completed the structured error helper/logging slice across the active queue:
  - `packages/web-server/src/errors/api-error-response.ts websocket/http structured error helper follow-up`
  - `packages/web-server/tests/api-error-response.test.ts structured error helper guardrail follow-up`
  - `packages/web-server/tests/request-logging.middleware.test.ts structured log parity guardrail follow-up`
  - `packages/web-server/src/middleware/error-handler.middleware.ts structured error log/request-id parity follow-up`
  - `packages/web-server/src/swagger.config.ts structured error example/log parity follow-up`
- `api-error-response.ts` now treats structured error envelopes, including serialized JSON bodies, as first-class inputs for detail/log normalization and exports the canonical error examples consumed by docs/tests.
- `request-logging.middleware.ts` now recovers `requestId`, code, message, details, and suggestion from serialized structured error bodies instead of losing parity when Express sends a JSON string.
- `error-handler.middleware.ts` now logs from the same normalized structured response it returns to clients, so status/code/message/details/suggestion/request-id stay aligned across response bodies and server logs.

## Latest Verification
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand web-server.functional api-error-response request-logging.middleware error-handler.middleware`
- 2026-05-24: `npm test -- --runInBand position-monitor`
- 2026-05-24: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/index.ts request-logging/openapi wiring follow-up`.
- Keep the same rule: continue one production component at a time through the refreshed web-server runtime/docs queue around `index.ts`, `ws-server.ts`, `web-server.functional.test.ts`, and `ws-server.functional.test.ts`, then widen scope only after the queue is empty again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
