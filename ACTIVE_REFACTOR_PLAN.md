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
- 2026-06-02: completed `packages/core/src/services/factories/builders/websocket-manager-service.builder.ts websocket manager runtime reconnect builder boundary follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager-service.builder.functional.test.ts websocket manager runtime reconnect builder guardrail follow-up`.
- 2026-06-02: completed `packages/web-server/src/services/bot-bridge.service.ts web server runtime adapter contract follow-up`.
- 2026-06-02: completed `packages/web-server/tests/bot-bridge.service.test.ts web server runtime adapter guardrail follow-up`.
- 2026-06-02: completed `packages/web-server/tests/bot-bridge.service.functional.test.ts web server runtime adapter functional guardrail follow-up`.
- `websocket-manager-service.builder.ts` now mirrors the neighboring builder pattern with an extracted `createWebSocketManagerService()` seam, and its runtime-service factory consumes only the narrowed logger/error-handler dependency contract that `initializeWebSocketManager()` already prepares.
- `websocket-manager-service.builder.functional.test.ts` now proves config shaping, dependency extraction, runtime collaborator creation, and final websocket manager construction all stay outside the composition-root body.
- `bot-bridge.service.ts` now treats `IWebApiAdapter` responses as untrusted runtime input and normalizes malformed market-data, order-book, walls, funding-rate, and volume-profile reads back into stable web contracts before routes or websocket consumers can observe them.
- `bot-bridge.service.test.ts` and `bot-bridge.service.functional.test.ts` now prove balance fallback logging stays converged while partial adapter payloads cannot leak missing numeric fields or invalid arrays through the bridge boundary.

## Latest Verification
- 2026-06-02: `npm test -- --runInBand packages/core/src/__tests__/services/websocket-manager-service.builder.functional.test.ts` (1 suite, 4 tests)
- 2026-06-02: `npm test -- --runInBand packages/web-server/tests/bot-bridge.service.functional.test.ts packages/web-server/tests/bot-bridge.service.test.ts packages/web-server/tests/bot.routes.functional.test.ts packages/web-server/tests/data.routes.functional.test.ts` (4 suites, 16 tests)
- 2026-06-02: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-02: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/bot.routes.ts web server route runtime adapter boundary follow-up`.
- Keep the next batch on the web-server route/runtime adapter boundary stream before returning to the remaining runtime handoff docs tests.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
