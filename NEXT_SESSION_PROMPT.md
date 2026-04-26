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
- Completed the requested next lifecycle/testability narrowing slice across `ladder-exit-detector.service.error-handling`, `multi-timeframe-trend.error-handling`, `pattern-recognition.error-handling`, `position-scaling`, `prometheus-metrics`, `reality-check.error-handling`, `risk-calculator.error-handling`, `smart-order-placement.error-handling`, `smart-order-execution`, `strategy-loader`, `strategy-loader.error-handling`, `strategy-config-merger.error-handling`, `strategy-manager.error-handling`, `swing-point-detector.error-handling`, `tf-alignment`, `tf-alignment.error-handling`, `timeframe-weighting.error-handling`, `trading-lifecycle.error-handling`, `whale-detector.service`, and `whale-wall-tp.error-handling`.
  - narrowed another 20-suite batch of managed test state by replacing remaining suite-local `ReturnType<typeof createManaged...>` aliases and temporary wrapper state with helper-exported `Managed*Context` contracts.
  - kept the slice behavior-preserving; no adjacent production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts` -> PASS (20 suites / 576 tests).
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially other service-adjacent suites that still keep helper-accessor wrappers, `const managedContext` pass-through locals, unnecessary suite-state casts, or broader-than-needed managed runtime aliases.
- Good nearby follow-ups after this batch: `real-time-risk-monitor.cache-invalidation`, `position-sync.service.error-handling`, `tick-delta-analyzer.error-handling`, `prometheus-metrics` helper-accessor leftovers, `smart-order-placement.error-handling` remaining local fixture wrapper aliases, `strategy-loader` adjacent async context wrappers, and the next adjacent suites still surfaced by `rg` in `packages/core/src/__tests__/services`.
