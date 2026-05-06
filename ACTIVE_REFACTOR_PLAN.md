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
- 2026-05-06: completed the `Web-server API response contract cleanup` slice.
- Added a shared `route-response` boundary for `packages/web-server` so bot/data/analytics/config routes now emit the same typed `ApiResponse<T>` envelope instead of hand-rolling partial variants.
- Promoted common web response payloads such as action messages, balance, recent signals, config validation, strategy summaries, and runtime server config into `@edison/contracts`, then aligned the web client API service to consume those shared payload contracts.
- Normalized query and path parsing for web-server read routes, including capped limits and consistent required-param handling, so route-level behavior stays explicit instead of depending on ad hoc `parseInt` and nullable path checks.
- Extended the web-server functional boundary to assert timestamped lifecycle responses and capped recent-signal reads, which locks the refactored response contract to observable behavior.

## Latest Verification
- 2026-05-06: `npm test -- --runInBand position-monitor`
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/web-server/tests/web-server.functional.test.ts packages/web-server/tests/bot-bridge.service.test.ts packages/web-server/tests/bot-bridge.service.functional.test.ts packages/core/src/__tests__/web/web-boundary.test.ts packages/core/src/__tests__/trading-bot.web-api.functional.test.ts packages/web-client/src/__tests__/services/api.service.test.ts`
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-06: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
