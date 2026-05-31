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
- 2026-05-31: completed `packages/core/src/services/public-websocket.service.ts public websocket runtime collaborator boundary follow-up`.
- 2026-05-31: completed `packages/core/src/__tests__/services/public-websocket.functional.test.ts public websocket runtime collaborator guardrail follow-up`.
- 2026-05-31: completed `packages/core/src/__tests__/services/public-websocket.error-handling.test.ts public websocket runtime error guardrail follow-up`.
- `public-websocket.service.ts` now funnels subscription and ping payloads through a single open-socket transport helper and clears the socket eagerly during disconnect cleanup.
- `public-websocket.functional.test.ts` now proves failed subscription sends do not retain stale subscribed topics on the service state.
- `public-websocket.error-handling.test.ts` now covers graceful degradation for subscription/ping send failures and verifies disconnect cleanup still leaves the service disconnected after a close error.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/services/public-websocket.functional.test.ts packages/core/src/__tests__/services/public-websocket.error-handling.test.ts packages/core/src/__tests__/services/public-websocket-state.utils.test.ts` (3 suites, 19 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (6 suites, 57 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/position-monitor.service.ts position monitor runtime collaborator boundary follow-up`.
- Keep the next batch on the position-monitor stream before returning to websocket handler, initializer, and websocket-authentication follow-ups.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
