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
- 2026-05-25: completed the web-server route/rate-limit error-response slice across the active queue:
  - `packages/web-server/src/middleware/rate-limit.middleware.ts rate-limit response helper convergence follow-up`
  - `packages/web-server/src/routes/route-response.ts route error/request-id payload helper follow-up`
  - `packages/web-server/src/errors/api-error-response.ts structured route/rate-limit response helper follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts route/rate-limit helper guardrail follow-up`
  - `packages/web-server/tests/request-logging.middleware.test.ts rate-limit/http helper guardrail follow-up`
- `api-error-response.ts` now owns shared route-error and rate-limit response builders so structured HTTP failures no longer assemble retry metadata and fallback route envelopes through separate ad-hoc paths.
- `route-response.ts` now resolves `x-request-id` directly from the attached Express response request and threads that through both explicit status errors and normalized route exceptions, bringing route-level client payloads in line with the existing logging parity rule.
- `rate-limit.middleware.ts` now emits its 429 envelope through the shared helper path, while functional and middleware tests pin both request-id propagation and HTTP log payload normalization for the shared rate-limit response shape.

## Latest Verification
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand api-error-response`
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand request-logging.middleware`
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand web-server.functional`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/bot.routes.ts lifecycle route helper/request-id parity follow-up`.
- Keep the same rule: continue one production component at a time through the refreshed route boundary queue around `bot.routes.ts`, `config.routes.ts`, `analytics.routes.ts`, and the focused api-error-response/web-server guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
