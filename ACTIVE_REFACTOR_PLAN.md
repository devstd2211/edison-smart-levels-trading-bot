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
- 2026-05-21: completed five managed tracked-services runtime config fixture reuse follow-up slices:
  - `managed tracked-services runtime config fixture reuse follow-up in websocket-monitoring builder functional boundary suite`
  - `managed tracked-services runtime config fixture reuse follow-up in risk-manager builder functional boundary suite`
  - `managed tracked-services runtime config fixture reuse follow-up in position-management builder functional boundary suite`
  - `managed tracked-services runtime config fixture reuse follow-up in orchestrator-handlers builder functional boundary suite`
  - `managed tracked-services runtime config fixture reuse follow-up in optional-services builder functional boundary suite`
- Added explicit bot-factory runtime fixture builders in `bot-factory-runtime-test.utils` for the remaining builder-boundary runtime families instead of reusing one candle-enabled default everywhere.
- Routed the five builder functional suites onto those scenario fixtures so they no longer mutate `createBotFactoryRuntimeTestConfig()` inline and each suite now declares the runtime knobs it actually depends on: monitoring, risk-monitoring, BTC/orchestrator wiring, or optional-service enablement.
- Kept the optional-services fixture values aligned with the boundary assertions instead of borrowing broader service-helper defaults, so the shared fixture narrows the runtime family without changing the semantics each suite is locking.

## Latest Verification
- 2026-05-21: `npm test -- --runInBand websocket-monitoring.builder risk-manager.builder position-management.builder orchestrator-handlers.builder optional-services.builder`
- 2026-05-21: `npm test -- --runInBand position-monitor`
- 2026-05-21: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
