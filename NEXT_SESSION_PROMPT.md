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

## Last Completed (2026-03-04)
- `action-queue.error-handling.test.ts`: removed local `any` usages (`signal: {} as any`, `(a as any).metadata`, `const action: any`).
- `ActionQueueService`: extracted enqueue defaults logic into `ensureActionDefaults(...)` (behavior-preserving service decomposition).
- `virtual-balance.error-handling.test.ts`: removed local `as any` mock logger cast (typed `LoggerService` mock).
- `VirtualBalanceService`: extracted all-time-extremes update logic into `updateAllTimeExtremes()` (behavior-preserving service decomposition).
- `pnl-calculator.error-handling.test.ts`: removed local `as any` mock logger cast (typed `LoggerService` mock).
- `PnLCalculatorService`: reviewed as related service candidate; no safe decomposition needed in this pass.
- `delta-analyzer.service.test.ts`: removed `type: 'ENTRY' as any` in signal mock by using `SignalType.LEVEL_BASED`.
- `DeltaAnalyzerService`: extracted repeated neutral-result creation into `createNeutralAnalysis()` (behavior-preserving service decomposition).
- `entry-confirmation.error-handling.test.ts`: removed local `signalData: null as any` cast (typed via `unknown` cast).
- `EntryConfirmationManager`: extracted pending-id construction into `buildPendingId(...)` (behavior-preserving service decomposition).
- `event-deduplication.error-handling.test.ts`: removed private-field access cast with `as any` (typed helper for `processedEvents` map access).
- `EventDeduplicationService`: extracted event-key generation into `buildEventKey(...)` (behavior-preserving service decomposition).
- `wall-tracker.error-handling.test.ts`: removed local `as any` logger cast (typed logger via `new LoggerService('ERROR', './logs', false)`).
- `WallTrackerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `bybit.repository-integration.test.ts`: removed private-method `service as any` spy (`getRestClient`) in cache-hit case; kept repository cache assertions.
- `BybitService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass (partial-class split already in place).
- `orderbook-manager.service.test.ts`: removed private-field `as any` cast via typed helper for `lastSnapshotTime`.
- `OrderbookManagerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `ladder-tp-manager.service.test.ts`: removed local `as any` in mock exchange builder (`createMockBybitService`).
- `LadderTpManagerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `limit-order-executor.service.test.ts`: removed local `as any` in Bybit service mock initialization (`as unknown as BybitService`).
- `LimitOrderExecutorService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `funding-rate-filter.error-handling.test.ts`: removed localized `as any` from `ErrorHandler.executeAsync` spy.
- `FundingRateFilterService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `ladder-tp-manager.error-handling.test.ts`: removed local `as any` in mock exchange builder.
- `LadderTpManagerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `multi-strategy.cache.test.ts`: replaced `any[]` with typed orchestrator array (`Array<ReturnType<typeof createMockOrchestrator>>`).
- `StrategyOrchestratorCacheService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `position-state-machine.error-handling.test.ts`: removed `return undefined as any` in fs append mock.
- `PositionStateMachineService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass (high-risk persistence path deferred).
- `prometheus-metrics.test.ts`: removed local `as any` logger cast via typed `LoggerService` + method spies.
- `PrometheusMetricsService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `resilience/resilience-coordinator.test.ts`: removed local `as any` logger cast via typed `LoggerService` + method spies.
- `ResilienceCoordinator`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `signal-processing.timeframe-conflict.test.ts`: removed localized `undefined as any` cast (typed via `unknown` cast to `TrendAnalysis`).
- Related service note: no production `signal-processing.service.ts` exists under `packages/core/src/services` in current tree; this suite validates local helper logic only.
- `structure-aware-exit.service.test.ts`: removed local `as any` logger cast via typed `LoggerService` + method spies.
- `StructureAwareExitService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `health-check.test.ts`: removed local `as any` usages via typed logger and `jest.spyOn(process, 'memoryUsage')`.
- `HealthCheckService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `time.service.test.ts`: removed remaining local `any` usage (typed mock exchange + typed logger with spies).
- `TimeService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `limit-order-executor.error-handling.test.ts`: removed remaining local `as any` usages (typed Bybit mock init + typed `fillPrice` assertion).
- `LimitOrderExecutorService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `data-collector.error-handling.test.ts`: removed remaining local `any` usage (`...args: unknown[]`, typed database mock + helper cast for writer constructor).
- `DataCollectorService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `telegram.error-handling.test.ts`: removed remaining local `as any` casts in position fixtures (typed as `Position`).
- `TelegramService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `websocket-manager.service.test.ts`: removed private-method `(wsManager as any).isDuplicateEvent` access via typed reflective helper.
- `WebSocketManagerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `websocket-authentication.error-handling.test.ts`: removed local `any` usages (`mockLogger: any`, `null as any`, `partialLogger as any`) with typed auth/error loggers and `unknown` casts.
- `WebSocketAuthenticationService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `advanced-order-state-machine.test.ts`: removed remaining local `as any` casts (mock logger init + invalid-state/error assertions).
- `AdvancedOrderStateMachineService`: reviewed as related service candidate; decomposition deferred to dedicated slice due high-risk state/rollback/timeout flow.
- `weight-matrix-calculator.error-handling.test.ts`: removed local `any` usages via typed `LoggerService` + `jest.spyOn` and `unknown` invalid-input casts.
- `WeightMatrixCalculatorService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- Verification:
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/action-queue.error-handling.test.ts` -> 26/26 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts` -> 35/35 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/pnl-calculator.error-handling.test.ts` -> 20/20 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/delta-analyzer.service.test.ts` -> 28/28 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts` -> 17/17 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/event-deduplication.error-handling.test.ts` -> 20/20 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts` -> 23/23 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/bybit.repository-integration.test.ts` -> 24/24 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/orderbook-manager.service.test.ts` -> 15/15 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts` -> 28/28 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/limit-order-executor.service.test.ts` -> 19/19 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts` -> 16/16 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts` -> 31/31 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/multi-strategy.cache.test.ts` -> 24/24 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts` -> 18/18 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/prometheus-metrics.test.ts` -> 34/34 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/resilience/resilience-coordinator.test.ts` -> 24/24 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/signal-processing.timeframe-conflict.test.ts` -> 21/21 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/structure-aware-exit.service.test.ts` -> 19/19 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/health-check.test.ts` -> 24/24 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/time.service.test.ts` -> 34/34 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts` -> 22/22 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/data-collector.error-handling.test.ts` -> 17/17 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/telegram.error-handling.test.ts` -> 29/29 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts` -> 106/106 PASS.

## Next Step
- Continue `__tests__/services/*` `any` cleanup with same rule: test refactor + related service candidate check + targeted verification + `REFACTOR_PLAN.md` update.
