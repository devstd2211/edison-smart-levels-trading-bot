# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Work component-first: refactor one production component, immediately align its tests, and add a functional test if missing.
- Target: 1-3 components per session with < 150 lines changed per component.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Component queue/progress: `REFACTOR_COMPONENT_CHECKLIST.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Dependency visualization: `docs/architecture/dependency-map.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Session Start Checklist (Run BEFORE any code changes)
1. [x] Read `ACTIVE_REFACTOR_PLAN.md` for context.
2. [x] Read `REFACTOR_COMPONENT_CHECKLIST.md` to check queue status.
3. [x] If checklist is empty, auto-populate 3-5 components from `REFACTOR_TASKS.md`.
4. [x] Verify `npm run build` passes before starting.
5. [x] Verify `npm test -- --runInBand position-monitor` passes in < 30s.
6. [x] Check if `docs/architecture/dependency-map.md` exists; if missing and >20 components completed, create it.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Use `REFACTOR_COMPONENT_CHECKLIST.md` as the finite queue of components being refactored.
3. Auto-populate the checklist if the active queue becomes empty.
4. Never do standalone test-cleanup passes.
5. For each chosen component, refactor production code first, then refactor related tests in the same slice.
6. If the component has no functional test, add one in the same slice before marking it complete.
7. Move completed components into the history section of `REFACTOR_COMPONENT_CHECKLIST.md` so the active list shrinks over time.
8. Keep this file short: refresh only `Last Completed` and `Next Step`.
9. Keep user-facing replies short by default unless the user explicitly asks for more detail.
10. Do not maintain a running historical journal here.
11. When touching a file during refactor, replace inline emoji in user-facing logs/messages with shared `ICONS` from `packages/core/src/cli/cli-runtime.ts` instead of keeping literal emoji strings.
12. When you encounter fallback constants or magic numbers, identify what kind they are before leaving them in place:
   - static/runtime constant: extract it into an existing or new constants file
   - strategy/tuning value: move it into config instead of hardcoding it

## Working Order Per Session
1. Run the session start checklist.
2. Pick the next unchecked component from the active queue.
3. Refactor the production component.
4. Refactor the related tests.
5. Add a functional test if missing.
6. Run targeted tests only.
7. Run `npm run build`.
8. Update the handoff, the active plan, and the component checklist.
9. If more than 5 new adapter interfaces were created, update `docs/architecture/dependency-map.md`.

## Last Completed (2026-05-08)
- Completed the snapshot-read cleanup slice for `PositionStateMachine state-read wording audit`, `Resilience CircuitBreaker state-read alias retirement`, `StrategyFactory snapshot read isolation audit`, `StrategyStateManager snapshot persistence isolation audit`, and `MTF snapshot consumer wording follow-up`.
- Added detached `PositionStateMachineService.getStateSnapshot()` and `getStateSnapshotsBySymbol()` reads, retired the resilience breaker `getState()` alias in favor of `getStateSnapshot()`, and kept `getState()` only where the domain concept is the mutable position status itself.
- Made `IsolatedStrategyContext` snapshot reads explicit with `getStateSnapshot()`, routed `StrategyFactoryService` and `StrategyStateManagerService` through detached snapshot clones, added missing functional suites for position-state-machine, resilience circuit breaker, strategy factory, and strategy state manager, and aligned the touched MTF trading-orchestrator consumer path to snapshot-validation wording.
- Verification:
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.functional.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/resilience/resilience-coordinator.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.functional.test.ts packages/core/src/__tests__/services/strategy-factory.functional.test.ts packages/core/src/__tests__/services/strategy-state-manager.functional.test.ts packages/core/src/__tests__/services/strategy-orchestrator.functional.test.ts packages/core/src/__tests__/services/strategy-orchestrator-state.utils.test.ts packages/core/src/__tests__/phase-10-3b-orchestrator-implementation.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts`
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
  - `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start the next finite cleanup batch with `StrategyOrchestrator snapshot method adoption follow-up`.
- Then continue with `StrategyContext snapshot alias retirement`, `PositionStateMachine full-state alias retirement`, `ResilienceCoordinator circuit snapshot wording follow-up`, and `TradingOrchestrator MTF snapshot log/icon cleanup`.
- Keep the same rule for wording splits: use snapshot wording only where the API is observational, preserve `state` where the mutable machine/domain state is the real concept, and prefer shared `ICONS` over inline emoji in any touched user-facing logs.

## Session End Checklist (Run BEFORE commit)
1. [x] Targeted tests pass.
2. [x] Build passes.
3. [x] Smoke test passes.
4. [x] Updated docs:
   - `ACTIVE_REFACTOR_PLAN.md` refreshed with the latest slice.
   - `REFACTOR_COMPONENT_CHECKLIST.md` updated.
   - `docs/architecture/dependency-map.md` updated if needed.
5. [x] Commit hygiene:
   - atomic commit
   - clear message
   - no secrets
   - no hacks or commented-out code
6. [x] Auto-populate the next batch if the checklist is empty.
