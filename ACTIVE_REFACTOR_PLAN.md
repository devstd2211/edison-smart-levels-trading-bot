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
- 2026-05-25: completed the web-server route success/request-id parity slice across the active queue:
  - `packages/web-server/src/routes/bot.routes.ts lifecycle route helper/request-id parity follow-up`
  - `packages/web-server/src/routes/config.routes.ts config route helper/request-id parity follow-up`
  - `packages/web-server/src/routes/analytics.routes.ts analytics route helper/request-id parity follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts route request-id parity guardrail follow-up`
  - `packages/web-server/tests/api-error-response.test.ts route/rate-limit helper export guardrail follow-up`
- `route-response.ts` now emits success envelopes with normalized `requestId` values from the attached Express request so successful bot/config/analytics responses follow the same correlation contract as the already-normalized error paths.
- `bot.routes.ts` now runs lifecycle handlers through a shared execution helper instead of duplicating start/stop try-catch branches, while `config.routes.ts` and `analytics.routes.ts` each localize their pre-delegate validation in focused helper functions.
- Functional and unit guardrails now pin request-id parity for successful lifecycle/config/analytics responses, for validation failures handled before delegate execution, and for route helper exports that normalize `error`-only payloads without dropping the first request-id value.

## Latest Verification
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand api-error-response`
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand web-server.functional`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/data.routes.ts data route success/request-id parity follow-up`.
- Keep the same rule: continue one production component at a time through the refreshed route boundary queue around `data.routes.ts`, `route-response.ts`, `request-logging.middleware.ts`, and the focused middleware/web-server guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
