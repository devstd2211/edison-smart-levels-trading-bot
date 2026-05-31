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
- 2026-05-31: completed `packages/core/src/services/factories/builders/position-monitor-service.builder.ts position monitor runtime builder dependency boundary follow-up`.
- 2026-05-31: completed `packages/core/src/services/factories/builders/position-monitoring-support.builder.ts position monitor support runtime builder dependency boundary follow-up`.
- 2026-05-31: completed `packages/core/src/services/factories/builders/orchestrator-event-handlers.builder.ts orchestrator event handlers runtime builder dependency follow-up`.
- `position-monitor-service.builder.ts` now creates the monitor through explicit config and service-dependency helpers instead of wiring constructor arguments inline from mutable builder state.
- `position-monitoring-support.builder.ts` now separates support-service inputs from runtime service creation so exit detection, PnL calculation, and sync ownership stay explicit.
- `orchestrator-event-handlers.builder.ts` now builds position and websocket handlers through narrowed event-handler dependency helpers instead of pulling every collaborator directly from state in the initializer.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/services/position-monitor-service.builder.functional.test.ts packages/core/src/__tests__/services/position-monitoring-support.builder.functional.test.ts packages/core/src/__tests__/services/orchestrator-event-handlers.builder.functional.test.ts packages/core/src/__tests__/services/websocket-monitoring.builder.functional.test.ts packages/core/src/__tests__/services/orchestrator-handlers.builder.functional.test.ts` (5 suites, 10 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (6 suites, 57 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/websocket-manager.service.ts websocket manager runtime collaborator boundary follow-up`.
- Keep the next batch on the websocket-manager and public-websocket collaborator stream before returning to entrypoint and web guardrails.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
