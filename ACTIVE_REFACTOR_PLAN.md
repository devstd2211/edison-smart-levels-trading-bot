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
- 2026-05-23: completed the next web-server boundary cleanup slice across the active queue:
  - `packages/web-server/src/middleware/rate-limit.middleware.ts shared request-id resolver adoption follow-up`
  - `packages/web-server/src/routes/route-response.ts shared http/websocket error detail helper follow-up`
  - `packages/web-server/src/index.ts startup/openapi error response helper convergence follow-up`
  - `packages/web-server/tests/bot-bridge.service.functional.test.ts structured forwarded error guardrail follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts OpenAPI default error example guardrail follow-up`
- `api-error-response.ts` now exposes `createStatusErrorResponse(...)` and treats structured `{ error: string }` objects as first-class message sources, so route errors, startup errors, and rate-limit envelopes normalize through the same helper path as websocket payloads.
- `rate-limit.middleware.ts`, `route-response.ts`, and `index.ts` now converge on the shared HTTP error helper, including multi-value `x-request-id` resolution in the rate-limit path and the same structured message fallback for route delegates and API startup failures.
- `bot-bridge.service.ts` now preserves structured action-failure details without leaking stack noise for plain `Error` instances, and the functional suites lock in both the runtime envelope shape and the OpenAPI/example parity expectations.

## Latest Verification
- 2026-05-23: `npm --prefix packages/web-server test -- --runInBand web-server.functional bot-bridge.service.functional api-error-response`
- 2026-05-23: `npm test -- --runInBand position-monitor`
- 2026-05-23: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/errors/api-error-response.ts shared status error response helper follow-up`.
- Keep the same rule: continue the shared error-boundary convergence one production component at a time, then align the matching websocket or functional guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
