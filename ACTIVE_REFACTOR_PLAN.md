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
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager.service.test.ts websocket manager runtime collaborator guardrail follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts websocket manager runtime error guardrail follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager.functional.test.ts websocket manager runtime functional guardrail follow-up`.
- `websocket-manager.service.ts` now runs against a minimal manager socket contract, clears the active socket before disconnect cleanup, and ignores stale close callbacks from replaced sockets so reconnect lifecycle state cannot leak through a failed `close()`.
- `websocket-manager.service.test.ts` and `websocket-manager.error-handling.test.ts` now assert the disconnect lifecycle guardrail directly by proving the service becomes disconnected before `close()` runs and stays detached when cleanup throws under the SKIP recovery path.
- `websocket-manager.functional.test.ts` now proves an auth acknowledgement cannot resubscribe through a detached socket after disconnect cleanup fails, tying the runtime contract to observable behavior instead of only internal state.

## Latest Verification
- 2026-06-02: `npm test -- --runInBand packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/websocket-manager.functional.test.ts` (3 suites, 40 tests)
- 2026-06-02: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-02: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/websocket-manager/websocket-position-mapping.utils.ts websocket manager runtime state utility boundary follow-up`.
- Keep the next batch on the websocket manager state/reconnect builder boundary stream.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
