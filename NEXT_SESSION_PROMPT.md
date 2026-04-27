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

## Last Completed (2026-04-27)
- Completed the requested next lifecycle/testability narrowing slice across `wall-tracker.service`, `wall-tracker.error-handling`, `tf-alignment.service`, `tf-alignment.error-handling`, `weight-matrix-calculator.service`, `weight-matrix-calculator.error-handling`, `whale-detector.service`, `whale-detection.error-handling`, `whale-wall-tp.service`, `whale-wall-tp.error-handling`, `websocket-keep-alive.service`, `websocket-event-handler.error-handling`, `volatility-regime.service`, `volatility-regime.error-handling`, `virtual-balance.error-handling`, `trading-lifecycle.error-handling`, `time.service`, `timeframe-weighting.error-handling`, `trade-history.error-handling`, and `position-monitor.service`.
  - narrowed a 20-task batch by replacing suite-local managed-context aliases with direct `ReturnType<typeof createManaged...>` field picks, removing temporary managed scenario/config wrappers where a helper factory could stay explicit in `beforeEach`, and trimming local runtime ownership to the exact fields each suite uses.
  - reviewed adjacent production surfaces around wall tracking, TF alignment, weight-matrix scoring, whale detection/TP adjustment, websocket keep-alive/event handling, volatility regime classification, virtual balance persistence, trading lifecycle timeouts, time sync, timeframe weighting, trade history persistence, and position monitoring; no small safe production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/whale-wall-tp.service.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/volatility-regime.error-handling.test.ts packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/time.service.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep helper-accessor wrappers, broader-than-needed managed runtime aliases, or remaining local setup/binder indirection adjacent to this cluster.
- Good nearby follow-ups after this batch: `position-monitor.error-handling`, `orderbook-manager.service`, `orderbook-manager.service.error-handling`, `orderbook-imbalance.service`, `orderbook-imbalance.error-handling`, `pnl-calculator.service`, `pnl-calculator.error-handling`, and any adjacent lifecycle-oriented suites still keeping exported managed test aliases.
