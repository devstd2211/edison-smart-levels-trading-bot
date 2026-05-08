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
- 2026-05-08: completed the cleanup batch for `PositionStateMachine state-read wording audit`, `Resilience CircuitBreaker state-read alias retirement`, `StrategyFactory snapshot read isolation audit`, `StrategyStateManager snapshot persistence isolation audit`, and `MTF snapshot consumer wording follow-up`.
- Added detached `PositionStateMachineService` snapshot reads via `getStateSnapshot()` and `getStateSnapshotsBySymbol()`, kept `getState()` as the domain-status read, and aligned the position-state-machine helpers/tests so observational reads now verify clone isolation instead of reading live cached objects.
- Retired the resilience circuit-breaker `getState()` read alias in favor of `getStateSnapshot()`, updated focused resilience coverage and coordinator assertions, and added a dedicated functional suite that verifies named breakers stay isolated through snapshot reads.
- Made multi-strategy snapshots explicit by adding `getStateSnapshot()` to `IsolatedStrategyContext`, switched `StrategyFactoryService` and `StrategyStateManagerService` to detached snapshot flows, added focused functional coverage for both services, and renamed the touched MTF entry validation locals so the trading-orchestrator consumer path now refers to snapshot validation instead of generic state reads.

## Latest Verification
- 2026-05-08: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.functional.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/resilience/resilience-coordinator.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.functional.test.ts packages/core/src/__tests__/services/strategy-factory.functional.test.ts packages/core/src/__tests__/services/strategy-state-manager.functional.test.ts packages/core/src/__tests__/services/strategy-orchestrator.functional.test.ts packages/core/src/__tests__/services/strategy-orchestrator-state.utils.test.ts packages/core/src/__tests__/phase-10-3b-orchestrator-implementation.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts`
- 2026-05-08: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-08: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
