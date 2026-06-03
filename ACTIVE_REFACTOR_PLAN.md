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
- 2026-06-03: completed `packages/web-server/tests/web-server.functional.test.ts web server route adapter composition guardrail follow-up`.
- 2026-06-03: completed `packages/web-server/src/websocket/ws-server.ts websocket bridge runtime adapter boundary follow-up`.
- 2026-06-03: completed `packages/web-server/tests/ws-server.functional.test.ts websocket bridge runtime adapter functional guardrail follow-up`.
- `ws-server.ts` now consumes an explicit `WebSocketBridgeApi` instead of the concrete `BotBridgeService`, so websocket reads and `bot-event` subscriptions cross one narrowed runtime adapter seam.
- `index.ts` now composes route dependencies and websocket delegates through `createWebServerRuntimeDependencies(...)`, keeping runtime wiring in one place before `WebServer` starts sockets and file-watchers.
- `web-server.functional.test.ts` now guards that the web-server runtime bundle carries both explicit route dependencies and the shared websocket delegate surface.
- `ws-server.functional.test.ts` now proves the websocket bridge adapter preserves status reads, position reads, and `bot-event` unsubscribe behavior independent of the concrete bridge class.

## Latest Verification
- 2026-06-03: `npm test -- --runInBand packages/web-server/tests/web-server.functional.test.ts` (1 suite, 53 tests)
- 2026-06-03: `npm test -- --runInBand packages/web-server/tests/ws-server.functional.test.ts` (1 suite, 21 tests)
- 2026-06-03: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-03: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/analytics.routes.ts analytics route runtime adapter boundary follow-up`.
- Keep the next batch on the web-server runtime/error boundary stream before returning to the remaining docs guardrail items.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
