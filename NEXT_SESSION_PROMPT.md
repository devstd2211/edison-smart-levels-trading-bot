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
- `anomaly-detection.error-handling.test.ts`: removed local `as any` usages (typed constructor/input aliases, typed internal-method spy interface, logger boundary casts via `unknown`).
- `AnomalyDetectionService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `bot-metrics.error-handling.test.ts`: removed local `any` usages (`MockLogger` metadata as `unknown`, typed `TradeMetrics` overrides, typed `ErrorHandler.handle` mock config).
- `BotMetricsService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `real-time-risk-monitor.error-handling.test.ts`: removed local `as any` usages (typed lifecycle/logger/event-bus mock shapes, typed event payload narrowing).
- `RealTimeRiskMonitor`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `circuit-breaker.error-handling.test.ts`: removed local `as any` usages (logger boundary casts + typed array push fault-injection mock via `Reflect.apply`).
- `CircuitBreakerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `strategy-loader.error-handling.test.ts`: removed local `any` usages (typed metadata context narrowing, removed `readdir` array casts, typed ErrorHandler mock shape).
- `StrategyLoaderService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `candle-provider.error-handling.test.ts`: removed local `any` usages (typed mock factories via `CandleProvider` constructor aliases, typed warn-call narrowing, typed exchange `getCandles` params in mock implementations).
- `CandleProvider`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `order-execution-pipeline.error-handling.test.ts`: removed local `any` usages (typed `BybitService` mock function contracts, `executeAsync` async callback alignment, typed order-id extraction/log context).
- `OrderExecutionPipeline`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `position-scaling.test.ts`: removed local `as any` usages (constructor/parameter aliases, typed invalid-input casts via `unknown`, typed logger boundary casts).
- `PositionScalingService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `public-websocket.error-handling.test.ts`: removed local `any` usages and tightened constructor mock typing (`ExchangeConfig` completion; typed `LoggerService`/`TimeframeProvider`/`ErrorHandler` boundary casts via dedicated service vars).
- `PublicWebSocketService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `resilience/rate-limiter.test.ts`: removed local `as any` usages (typed 429 error extension, typed acquire-key alias for invalid-input case, logger boundary casts).
- `RateLimiterService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `strategy-manager.error-handling.test.ts`: removed local `as any` usages (typed `initialize` parameter aliases + `StrategyConfig` boundary casts for invalid-input scenarios).
- `StrategyManagerService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts` -> 121/121 PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/candle-provider.error-handling.test.ts` -> 20/20 PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/order-execution-pipeline.error-handling.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/public-websocket.error-handling.test.ts packages/core/src/__tests__/services/resilience/rate-limiter.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts` -> 121/121 PASS.

## Next Step
- Continue `__tests__/services/*` `any` cleanup with same rule (test refactor + related service candidate check + targeted verification + `REFACTOR_PLAN.md` update); next target candidate: `exchange-factory.service.test.ts`.
