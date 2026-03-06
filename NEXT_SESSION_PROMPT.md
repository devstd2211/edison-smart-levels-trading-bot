# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and status tracking: `REFACTOR_PLAN.md` (single source of truth).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".

## Working Order Per Session
1. Pick next target from `REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-06)
- Iteration-2 decomposition started for `packages/core/src/services/position-lifecycle.service.ts`.
- Extracted sizing helpers to `packages/core/src/services/position-lifecycle/position-lifecycle-sizing.utils.ts`:
  - first TP price resolution
  - RR ratio calculation
  - final exposure calculation (`quantity`, `marginUsed`, `notionalValue`)
- Extracted open-position construction helper to `packages/core/src/services/position-lifecycle/position-lifecycle-open.utils.ts`:
  - exchange/journal id derivation
  - normalized `Position` assembly with SL/TP defaults
- Integrated helpers into `PositionLifecycleService.calculatePositionSize` with behavior preserved.
- Hardened repository-aware state access in safe paths:
  - duplicate-open guard now uses `readStoredPosition()`
  - `getOpenPositions()` now uses repository-aware read
  - `syncWithWebSocket()` intentionally remains on in-memory semantics to preserve degraded-mode behavior covered by tests
- Decomposed close-flow in `PositionLifecycleService.clearPosition()` into private steps:
  - `cancelConditionalOrdersAfterClose()`
  - `finalizePositionClear()`
  with the same side-effect order and targeted-suite parity.
- Decomposed WebSocket sync branching in `PositionLifecycleService`:
  - extracted `resolveWebSocketSyncedPosition(currentPosition, wsPosition)` for restore/update routing
  - kept `syncWithWebSocket()` behavior (in-memory restore/update semantics) intact for compatibility
  - normalized post-close cancellation debug log text to ASCII.
- Decomposed `openPosition()` analytics side-effects:
  - extracted `recordPositionOpenAnalytics(...)` for journal + session-stats recording
  - preserved strategy semantics (`RETRY` journal, `SKIP` session stats) and call order.
- Decomposed additional TP setup path in `openPosition()`:
  - extracted `configureAdditionalTakeProfits(signal, quantity)`
  - preserved non-critical retry/skip semantics and TP-indexed retry contexts.
- Decomposed pre-open preparation path in `openPosition()`:
  - extracted `prepareOpenExecutionContext(signal)` for hanging-order cleanup + SL context derivation
  - preserved pre-open sequence and existing logging behavior in orchestrator method.
- Decomposed atomic exchange-open boundary in `openPosition()`:
  - extracted `executeAtomicOpenPosition(...)` for side mapping, retry-wrapped open call, and order-id extraction
  - preserved retry context/callback behavior and first-TP order-id propagation.
- Decomposed post-open wiring in `openPosition()`:
  - extracted `wireOpenedPositionState(position, signal)` for persistence + event emission + TP manager init
  - preserved ordering before notification/analytics stage.
- Decomposed session-stats payload construction in analytics path:
  - extracted `createSessionTradeRecordForOpen(...)`
  - kept payload shape and record flow unchanged.
- Decomposed journal branch in analytics path:
  - extracted `recordTradeOpenWithResilience(...)`
  - kept retry context (`openPosition.recordTradeOpen`) and degraded-mode behavior.
- Decomposed session-stats execution branch in analytics path:
  - extracted `recordSessionTradeEntryWithResilience(sessionTrade, tradeId)`
  - kept `SKIP` strategy context (`openPosition.recordTradeEntry`) and existing logs.
- Decomposed post-open notification boundary:
  - extracted `notifyPositionOpenedWithResilience(position)`
  - kept `SKIP` strategy context and recover logging behavior.
- Decomposed open-success logging boundary:
  - extracted `logPositionOpenedSuccess(position, side)`
  - kept success log placement/fields unchanged.
- Decomposed close-path helper boundaries:
  - extracted `executeAtomicCloseOperation(onCloseInternal?)` from `performClose`
  - extracted `emitPositionClosedEvent(closedPosition)` from `finalizePositionClear`
  - preserved lock and close ordering semantics.
- Completed triple micro-slice in open logging:
  - extracted `logPositionSizingCompleted(...)`
  - extracted `logStopLossCalculated(...)`
  - extracted `logAtomicOpenRequest(...)`
  with unchanged open-path behavior.
- Completed triple micro-slice in WebSocket sync logging:
  - extracted `logWebSocketRestoreWithJournal(...)`
  - extracted `logWebSocketRestoreWithoutJournal(...)`
  - extracted `logWebSocketEntryPriceUpdate(...)`
  with unchanged restore/update behavior.
- Completed 4-slice batch in close-path logging:
  - extracted `logConditionalOrderCancelRetry(...)`
  - extracted `logConditionalOrderCancelFailure()`
  - extracted `logAtomicCloseNoPosition(...)`
  - extracted `logAtomicCloseStart/Success/Failure(...)`
  with unchanged lock/cancel behavior.
- Completed 3-slice batch in confirmation-path logging:
  - extracted `logPendingSignalConfirmed(...)`
  - extracted `logPendingLongRejected(...)`
  - extracted `logPendingShortRejected(...)`
  with unchanged confirmation/rejection decision behavior.
- Completed 4-slice batch in confirmation-path processing:
  - extracted `processPendingConfirmation(...)`
  - extracted `logPendingSignalRejected(...)`
  - extracted `formatPriceForLog(...)`
  - kept branching and returned-signal semantics unchanged.
- Completed 4-slice batch in sizing-path logging:
  - extracted `logCompoundSizingSuccess(...)`
  - extracted `logCompoundSizingFallback(...)`
  - extracted `logKellySizingSuccess(...)`
  - extracted `logKellySizingFallback(...)`
  with unchanged sizing/fallback behavior.
- Completed 4-slice batch in retry/cancel logging:
  - extracted `logPositionOpenRetry(...)`
  - extracted `logCurrentPriceRetry(...)`
  - extracted `logHangingOrderCancellationSkipped(...)`
  - extracted `logHangingOrderCancellationFailed(...)`
  and normalized related retry/cancel log strings to ASCII-safe text.
- Completed 5-slice batch in fallback/event logging:
  - extracted `logHangingOrderCancellationNonBlockingFailure(...)`
  - extracted `logCurrentPriceFallback(...)`
  - extracted `logPositionStoredInRepository(...)`
  - extracted `logPositionOpenedEventEmitted(...)`
  - extracted `logWebSocketRestoreJournalLookupFailure(...)`
  with unchanged behavior and call order.
- Completed 4-slice batch in open/configure/clear/notify logging:
  - extracted `logOpenPositionFailure(...)`
  - extracted `logAdditionalTakeProfitsStart(...)`
  - extracted `logAdditionalTakeProfitSet(...)`
  - extracted `logAdditionalTakeProfitSetNonCriticalFailure(...)`
  - extracted `logAdditionalTakeProfitSetFailure(...)`
  - extracted `logPositionClearedFromRepository(...)`
  - extracted `logTelegramNotificationSkipped(...)`
  with unchanged sequencing and resilience behavior.
- Completed 4-slice batch in analytics logging:
  - extracted `logJournalTradeOpenDegraded(...)`
  - extracted `logJournalTradeOpenFailure(...)`
  - extracted `logJournalTradeRecorded(...)`
  - extracted `logSessionStatsTradeRecorded(...)`
  - extracted `logSessionStatsTradeRecordFailure(...)`
  with unchanged journal/session-stats behavior.
- Completed 4-slice batch in atomic/snapshot logging:
  - extracted `logAtomicOpenResult(...)`
  - extracted `logAtomicCloseAlreadyInProgress(...)`
  - extracted `logPositionSnapshotDegraded(...)`
  - extracted `logPositionSnapshotFailure(...)`
  with unchanged lock and snapshot fallback behavior.
- Completed 5-slice batch in start/event logging and helper sectioning:
  - extracted `logConditionalOrderCancelStart(...)`
  - extracted `logHangingOrderCancellationStart(...)`
  - extracted `logPositionOpenedEventEmitting(...)`
  - moved `logAtomicOpenResult(...)` near open-flow logging helpers (structure-only)
  - moved `logAtomicCloseAlreadyInProgress(...)` near atomic-close logging helpers (structure-only)
  with unchanged behavior and call ordering.
- Completed 2-slice structure-only helper locality cleanup:
  - moved `logOpenPositionFailure(...)` next to `openPosition(...)`
  - moved `logPositionClearedFromRepository(...)` next to clear/finalize helpers
  with unchanged behavior.
- Completed 4-slice batch in journal-open analytics decomposition:
  - extracted `createTradeOpenPayload(...)`
  - extracted `recordTradeOpenWithRetry(...)`
  - extracted `logTradeOpenRetryResult(...)`
  - introduced `TradeOpenPayload` type for payload contract
  with unchanged retry/degraded semantics and logging behavior.
- Progress recorded in `REFACTOR_PLAN.md` session log.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> 3/3 suites PASS, 51/51 tests PASS.

## Next Step
- Continue iteration-2 on `packages/core/src/services/position-lifecycle.service.ts`: decompose `recordSessionTradeEntryWithResilience(...)` and remaining analytics branch helpers into smaller behavior-safe units, then run the same targeted lifecycle suites and update `REFACTOR_PLAN.md`.
