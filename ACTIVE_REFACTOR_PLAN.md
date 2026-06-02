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
- 2026-06-02: completed `packages/web-server/src/routes/bot.routes.ts web server route runtime adapter boundary follow-up`.
- 2026-06-02: completed `packages/web-server/tests/bot.routes.functional.test.ts web server route runtime adapter functional guardrail follow-up`.
- 2026-06-02: completed `packages/web-server/src/routes/data.routes.ts web server data route runtime adapter boundary follow-up`.
- 2026-06-02: completed `packages/web-server/tests/data.routes.functional.test.ts web server data route runtime adapter functional guardrail follow-up`.
- `bot.routes.ts` now treats start/stop bridge results as adapter input, converts them into stable `ApiMessageResponse` payloads, and centralizes 400 lifecycle failures as typed route errors before Express handlers emit envelopes.
- `bot.routes.functional.test.ts` now proves the bot route adapter rejects malformed lifecycle results into the shared structured error envelope while preserving the existing status-read and mutation response helpers.
- `data.routes.ts` now pushes balance, recent-signal, candle, and position-history payload shaping into `createDataRouteReadApi()` and routes symbol validation through a shared typed error seam instead of mixing response assembly into Express handlers.
- `data.routes.functional.test.ts` now proves the narrowed route adapter returns stable payload contracts directly and that HTTP balance/candle/history reads reuse those route payload shapers end to end.

## Latest Verification
- 2026-06-02: `npm test -- --runInBand packages/web-server/tests/bot.routes.functional.test.ts packages/web-server/tests/data.routes.functional.test.ts` (2 suites, 8 tests)
- 2026-06-02: `npm test -- --runInBand packages/web-server/tests/bot-bridge.service.functional.test.ts packages/web-server/tests/bot-bridge.service.test.ts packages/web-server/tests/bot.routes.functional.test.ts packages/web-server/tests/data.routes.functional.test.ts` (4 suites, 20 tests)
- 2026-06-02: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-02: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/config.routes.ts web server config route runtime adapter boundary follow-up`.
- Keep the next batch on the web-server route/runtime adapter and composition boundary stream before returning to the remaining runtime handoff docs tests.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
