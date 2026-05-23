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
- 2026-05-23: completed the next shared status-suggestion parity slice across the active queue:
  - `packages/web-server/src/middleware/error-handler.middleware.ts status helper default-suggestion parity follow-up`
  - `packages/web-server/src/index.ts static 404 shared status helper follow-up`
  - `packages/web-server/src/routes/config-route-contracts.ts config contract ApiError suggestion parity follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts static 404 structured suggestion guardrail follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts config contract structured error guardrail follow-up`
- `api-error-response.ts` now exposes a shared `createStatusApiError(...)` path and applies the same default suggestion fallback to thrown `ApiError` instances that `createStatusErrorResponse(...)` already used for direct HTTP status envelopes.
- `error-handler.middleware.ts` and `config-route-contracts.ts` now build their structured `ApiError` values through that shared helper, so status code, default error code, and default suggestion resolution stay aligned instead of drifting through hand-written constructors.
- `index.ts` now returns the SPA fallback 404 through the shared status helper without its previous route-only suggestion override, and `web-server.functional.test.ts` now covers both the missing-index fallback and config preview/restore contract failures under the same structured error contract.

## Latest Verification
- 2026-05-23: `npm --prefix packages/web-server test -- --runInBand web-server.functional api-error-response`
- 2026-05-23: `npm test -- --runInBand position-monitor`
- 2026-05-23: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/route-response.ts route helper status ApiError convergence follow-up`.
- Keep the same rule: continue the web-server shared error-helper convergence one production component at a time, then align the matching guardrails around `route-response.ts`, `api-error-response.ts`, `swagger.config.ts`, and the related functional/unit tests before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
