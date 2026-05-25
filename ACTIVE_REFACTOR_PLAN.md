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
- 2026-05-25: completed the web-server success/request-id parity slice across the active queue:
  - `packages/web-server/src/routes/data.routes.ts data route success/request-id parity follow-up`
  - `packages/web-server/src/routes/route-response.ts shared success envelope helper follow-up`
  - `packages/web-server/src/middleware/request-logging.middleware.ts success request-id log payload parity follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts data route success request-id guardrail follow-up`
  - `packages/web-server/tests/request-logging.middleware.test.ts success request-id helper guardrail follow-up`
- `route-response.ts` now builds success envelopes through a dedicated helper so success responses normalize `requestId` once and keep the same shape across route reads and mutations.
- `data.routes.ts` now routes symbol-based reads through a shared helper, trimming duplicate param validation while preserving the same success-envelope contract for orderbook, walls, and funding-rate endpoints.
- HTTP request logging now reads `requestId` from either the incoming header or a serialized success/error response body, so logs keep correlation parity even when the body is the only surviving source of the normalized id.

## Latest Verification
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand request-logging.middleware`
- 2026-05-25: `npm --prefix packages/web-server test -- --runInBand data.routes.functional web-server.functional`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/index.ts cli composition root extraction follow-up`.
- The active queue was auto-populated from `REFACTOR_TASKS.md` after the web-server slice completed; continue one component at a time through the composition-root batch around `packages/core/src/cli/index.ts`, `packages/core/src/core/index.ts`, `packages/core/src/web/index.ts`, `README.md`, and `packages/core/src/index.ts`.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
