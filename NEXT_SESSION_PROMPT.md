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
- Completed the requested next lifecycle/testability narrowing slice across `bot-metrics.error-handling`, `fractal-smc-weighting.error-handling`, `micro-wall-detector.error-handling`, `order-execution-detector.error-handling`, `phase-10-integration`, `position-sync.service.error-handling`, `resilience/circuit-breaker`, `retest-entry.error-handling`, `risk-calculator.error-handling`, `smart-order-placement.error-handling`, `structure-aware-exit.error-handling`, `swing-point-detector.error-handling`, `tf-alignment.error-handling`, `tick-delta-analyzer.error-handling`, `timeframe-weighting.error-handling`, and `weight-matrix-calculator.error-handling`.
  - narrowed a 20-task batch in that cluster by removing temporary managed-context handoff locals, dropping suite-local fixture accessor/binder wrappers, and collapsing redundant harness destructuring onto helper-owned contracts.
  - kept the slice behavior-preserving; no adjacent production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts` -> PASS (16 suites / 417 tests).
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep helper-accessor wrappers, broader-than-needed managed runtime aliases, or remaining local setup/binder indirection outside this cluster.
- Good nearby follow-ups after this batch: adjacent `packages/core/src/__tests__/services` suites that still expose helper-wrapper setup instead of direct helper-owned context, plus any remaining direct exported `Managed*Context` usage that can be narrowed without touching production behavior.
