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
- Progress recorded in `REFACTOR_PLAN.md` session log.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> 3/3 suites PASS, 51/51 tests PASS.

## Next Step
- Continue iteration-2 on `packages/core/src/services/position-lifecycle.service.ts`: extract next behavior-safe block from post-open notification boundary (`notifyPositionOpened` resilience wrapper), then run the same targeted lifecycle suites and update `REFACTOR_PLAN.md`.
