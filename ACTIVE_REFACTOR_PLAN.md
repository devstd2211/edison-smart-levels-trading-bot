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
- 2026-05-09: completed the cleanup batch for `StrategyOrchestrator snapshot method adoption follow-up`, `StrategyContext snapshot alias retirement`, `PositionStateMachine full-state alias retirement`, `ResilienceCoordinator circuit snapshot wording follow-up`, and `TradingOrchestrator MTF snapshot log/icon cleanup`.
- Retired the multi-strategy `getSnapshot()` context alias, aligned the `IsolatedStrategyContext` contract and functional helpers around `getStateSnapshot()`, and renamed the orchestrator-level backup entrypoint to `snapshotAllStrategies()` so the public API matches the explicit snapshot semantics already used by `StrategyStateManagerService`.
- Removed the unused `PositionStateMachineService` full-state compatibility aliases from the interface and implementation, kept `getState()` only for the mutable domain enum read, and kept focused position-state-machine coverage on detached snapshot reads and detached per-symbol snapshot collections.
- Renamed the touched resilience coordinator assertion to snapshot wording, normalized the touched multi-strategy, position-state-machine, and trading-orchestrator user-facing logs onto shared `ICONS`, and kept the MTF entry path explicitly centered on snapshot validation/frozen-entry snapshot logging.

## Latest Verification
- 2026-05-09: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/strategy-orchestrator.functional.test.ts packages/core/src/__tests__/services/strategy-orchestrator-state.utils.test.ts packages/core/src/__tests__/phase-10-3b-orchestrator-implementation.test.ts packages/core/src/__tests__/services/strategy-state-manager.functional.test.ts packages/core/src/__tests__/services/resilience/resilience-coordinator.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.functional.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/trading-orchestrator.functional.test.ts packages/core/src/__tests__/services/trading-orchestrator.error-handling.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts`
- 2026-05-09: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-09: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
