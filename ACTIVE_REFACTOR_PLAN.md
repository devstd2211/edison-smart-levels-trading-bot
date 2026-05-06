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
- 2026-05-06: completed the `OpenAPI route coverage expansion` slice.
- Expanded `packages/web-server/src/swagger.config.ts` to cover the remaining real route surface instead of only the earlier subset: the spec now documents the market-depth endpoints (`/api/data/orderbook/{symbol}`, `/walls/{symbol}`, `/funding-rate/{symbol}`, `/volume-profile/{symbol}`), the config mutation endpoints (`/api/config/strategies/{id}`, `/api/config/risk`, `/api/config/cleanup`), and the missing read endpoints (`/api/config/schema`, `/api/config/history`, `/api/analytics/journal/last24h`).
- Added the missing component schemas, request bodies, and response references for those routes, and corrected the docs landing page so its quick reference points at the current analytics stats path.
- Tightened functional coverage in `packages/web-server/tests/web-server.functional.test.ts` so the generated OpenAPI document is asserted against those new paths and schemas, while the runtime tests now exercise the newly documented config/data/analytics boundaries directly.

## Latest Verification
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/web-server/tests/web-server.functional.test.ts`
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-06: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
