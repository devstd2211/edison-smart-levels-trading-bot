# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability cleanup in `packages/core/src/__tests__/services/*` and adjacent production services when a small safe follow-up is clearly exposed.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in the same session or note a short pending item in `ACTIVE_REFACTOR_PLAN.md`.
5. Keep this file short: refresh only `Last Completed` and `Next Step`.
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.
7. Do not maintain a running historical journal here.

## Working Order Per Session
1. Read `ACTIVE_REFACTOR_PLAN.md`.
2. Pick the next unchecked item.
3. Use `REFACTOR_TASKS.md` only if decomposition is needed.
4. Execute minimal safe refactor.
5. Run targeted tests for the changed area.
6. Run `npm run build`.
7. Update only the concise handoff below and the active plan.

## Last Completed (2026-04-26)
- Completed the requested next lifecycle/testability narrowing slice across `analyzer-registration-fixes`, `bybit.repository-integration`, `position-exiting.service`, `position-sync.service.error-handling`, `prometheus-metrics`, `real-time-risk-monitor.cache-invalidation`, `resilience/circuit-breaker`, `risk-calculator.error-handling`, `smart-order-placement.error-handling`, `strategy-loader`, `strategy-manager.error-handling`, `structure-aware-exit.service`, `structure-aware-exit.error-handling`, `swing-point-detector.error-handling`, `tf-alignment.service`, `tf-alignment.error-handling`, `tick-delta-analyzer.error-handling`, `timeframe-weighting.error-handling`, `trading-lifecycle.error-handling`, and `whale-detection.error-handling`.
  - narrowed another 20-suite batch of managed test setup by removing temporary `managedContext` / `suiteState` pass-through locals and swapping remaining suite-local `ReturnType<typeof createManaged...>` aliases to helper-exported managed contracts where available.
  - kept the slice behavior-preserving; no adjacent production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/structure-aware-exit.service.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts` -> PASS (20 suites / 520 tests).
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep helper-accessor wrappers, local `managedErrorHandler` handoff variables, binder helper wrappers, or broader-than-needed managed runtime aliases.
- Good nearby follow-ups after this batch: `retest-entry.error-handling`, the remaining `managedErrorHandler` cleanup in `position-sync.service.error-handling` / `risk-calculator.error-handling` / `tf-alignment.error-handling` / `tick-delta-analyzer.error-handling` / `timeframe-weighting.error-handling`, plus the next adjacent suites in `packages/core/src/__tests__/services` that still expose wrapper binders instead of direct helper-owned setup.
