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
- 2026-05-23: completed the next shared error-boundary cleanup slice across the active queue:
  - `packages/web-server/src/errors/api-error-response.ts shared status error response helper follow-up`
  - `packages/web-server/src/services/bot-bridge.service.ts action failure payload convergence follow-up`
  - `packages/web-server/src/websocket/ws-server.ts outbound error payload helper convergence follow-up`
  - `packages/web-server/tests/api-error-response.test.ts shared status error helper guardrail follow-up`
  - `packages/web-server/tests/ws-server.functional.test.ts websocket startup/read error payload guardrail follow-up`
- `api-error-response.ts` now builds HTTP status envelopes and websocket status-error payloads from one shared helper path, so `createStatusErrorResponse(...)` always applies the default suggestion fallback and websocket read failures can normalize thrown causes without rebuilding `ApiError` objects at each call site.
- `ws-server.ts` now routes request validation failures, startup/read failures, and unexpected handler exceptions through the shared websocket status helper instead of hand-assembling outbound error payloads in three separate branches.
- `bot-bridge.service.ts` now funnels start/stop action failures through the same websocket payload builder used for forwarded runtime errors while still suppressing noisy plain-`Error` stack details from client-facing action failure events.

## Latest Verification
- 2026-05-23: `npm --prefix packages/web-server test -- --runInBand api-error-response bot-bridge.service.functional ws-server.functional`
- 2026-05-23: `npm test -- --runInBand position-monitor`
- 2026-05-23: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/middleware/error-handler.middleware.ts status helper default-suggestion parity follow-up`.
- Keep the same rule: continue the web-server error-boundary convergence one production component at a time, then align the matching functional guardrails around `error-handler.middleware.ts`, `index.ts`, `config-route-contracts.ts`, `web-server.functional.test.ts`, and `config.routes.functional.test.ts` before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
