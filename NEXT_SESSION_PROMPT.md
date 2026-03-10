# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and active status tracking: `ACTIVE_REFACTOR_PLAN.md` (single source of truth).
- Completed historical log: `REFACTOR_PLAN.md` (archived completed track).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `ACTIVE_REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".

## Working Order Per Session
1. Pick next target from `ACTIVE_REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `ACTIVE_REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-10)
- Completed compatibility-first typing batches 110-112 (behavior-preserving notification/exchange order boundary cleanup):
  - `interfaces/IMonitoring.ts`:
    - introduced shared `NotificationPayload` alias and narrowed `INotification.send()` metadata input from broad `unknown` to the shared notification payload record shape.
  - `interfaces/IExchange.ts`:
    - introduced shared `ExchangeOrderRecord` alias and replaced broad `unknown[]` in optional `getOrderHistory()` / `getActiveOrders()` contracts with the shared order-record array type.
  - `services/bybit/bybit-service.adapter.ts`, `services/binance/binance-service.adapter.ts`, and `services/binance/binance.service.ts`:
    - propagated the shared exchange order-record contract through adapter/service implementations without changing runtime behavior.
  - verification:
    - `npm test -- --runInBand packages/core/src/services/bybit/__tests__/bybit-service.adapter.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/analyzer-registry.error-handling.test.ts` -> PASS (3/3 suites, 96/96 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 107-109 (behavior-preserving indicator cache boundary cleanup):
  - `repositories/IRepositories.ts`:
    - introduced shared `IndicatorCacheValue` alias and replaced broad `unknown` in `IMarketDataRepository.cacheIndicator()` / `getIndicator()` with the shared cache payload contract.
  - `repositories/market-data.cache-repository.ts`:
    - aligned cached indicator storage/retrieval and private size-estimation helpers with the shared indicator cache payload alias.
  - `services/indicator-cache.service.ts`:
    - extracted `isValidKey()`, `isFiniteIndicatorValue()`, and `handleInvalidKey()` helpers for cache input validation and removed inline validation duplication.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/repositories/__tests__/market-data.cache-repository.test.ts` -> PASS (2/2 suites, 43/43 tests).
    - `npm test -- --runInBand packages/core/src/__tests__/backtest/cache-integration.test.ts` -> PASS (1/1 suite, 12/12 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 104-106 (behavior-preserving repository payload/helper cleanup):
  - `interfaces/IRepository.ts`:
    - introduced shared `RepositoryDataValue` alias and replaced broad `unknown` in generic `saveData()` / `getData()` persistence contracts.
  - `repositories/IRepositories.ts` and `repositories/journal.file-repository.ts`:
    - propagated the shared repository payload alias to `IJournalRepository` generic data methods and the in-memory `generalData` store.
    - extracted `isTradeInSession()` and `getSessionTrades()` helpers to remove duplicated session-trade filtering logic from session PnL/win-rate calculations.
  - verification:
    - `npm test -- --runInBand packages/core/src/repositories/__tests__/journal.file-repository.test.ts` -> PASS (1/1 suite, 18/18 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 101-103 (behavior-preserving logger/config/cache helper cleanup):
  - `services/logger/logger-core.utils.ts`:
    - introduced `isLogLevel()` helper and removed repeated enum compatibility casts in log-level validation/normalization.
  - `types/config/config-new.types.ts`:
    - introduced a local `isRecord()` helper and replaced the top-level `Record<string, unknown>` cast inside `isConfigNew()` with explicit object guards.
  - `repositories/market-data.cache-repository.ts`:
    - extracted local object/array helpers for indicator size estimation and removed the remaining inline broad object size check in the cache stats path.
  - verification:
    - `npm test -- --runInBand packages/core/src/repositories/__tests__/market-data.cache-repository.test.ts packages/core/src/__tests__/services/logger.service.error-handling.test.ts` -> PASS (2/2 suites, 51/51 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 100 (behavior-preserving volatility-spike shared config alignment):
  - `types/config/config-new.types.ts`:
    - added `VolatilitySpikeAnalyzerConfigNew` and wired `volatilitySpike` into the shared `AnalyzersConfigNew` aggregate contract.
  - `loaders/analyzer.loader.ts`:
    - removed the temporary local compatibility extension for `volatilitySpike` and now consumes the shared analyzer config contract directly.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/integration/strategy-integration.test.ts packages/core/src/__tests__/bot-initializer.test.ts` -> PASS (2/2 suites, 34/34 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 97-99 (behavior-preserving validator/error-helper cleanup):
  - `validators/position.validator.ts`:
    - extracted explicit `isFiniteNumber()`, `isRecord()`, and `hasValidStopLossPrice()` helpers and removed repeated inline validation casts/checks in Phase 9 position validation.
  - `utils/error-helper.ts`:
    - introduced a shared local `asRecord()` helper and replaced repeated object casts in error/context/code detection paths.
  - `utils/error.utils.ts`:
    - introduced a shared local `asRecord()` helper and removed repeated object casts in error message/stack/type extraction.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/validators/position.validator.test.ts` -> PASS (1/1 suite, 23/23 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 95-96 (behavior-preserving analyzer loader/config utility alignment):
  - `loaders/analyzer.loader.ts`:
    - replaced local broad analyzer config abstractions with shared `AnalyzersConfigNew`-based typing.
    - removed the generic `asConfig<T>()` bridge and passed stable analyzer config DTOs directly to typed analyzer constructors.
    - added a local compatibility extension for the existing `volatilitySpike` loader path because that runtime-supported analyzer is still absent from the shared aggregate `AnalyzersConfigNew` contract.
  - `utils/analyzer-config.utils.ts`:
    - replaced the broad analyzer config envelope cast with explicit record guards for nested parameter extraction.
    - preserved existing default fallback semantics for missing/malformed config sections.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/integration/strategy-integration.test.ts packages/core/src/__tests__/bot-initializer.test.ts` -> PASS (2/2 suites, 34/34 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 92-94 (behavior-preserving console dashboard + scaling boundary cleanup):
  - `services/console-dashboard/console-dashboard-state.utils.ts`:
    - introduced explicit `DashboardMetricSnapshot` and exported `DashboardEvent` DTOs for dashboard state initialization.
  - `services/console-dashboard.service.ts`:
    - aligned dashboard state with the utility DTOs and removed the constructor-time `createInitialDashboardState() as DashboardState` cast.
    - narrowed `safeLog()` / `safeWarn()` metadata from `unknown` to stable `string | Record<string, unknown>` and normalized `Error`/object payloads via `toLogMeta()`.
  - `services/position-scaling.service.ts`:
    - narrowed `safeLog()` metadata input from `unknown` to `Record<string, unknown>`.
    - replaced inline logger bridge casts with a dedicated record guard.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/position-scaling.test.ts` -> PASS (2/2 suites, 61/61 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 91 (behavior-preserving event-bus single-payload contract alignment):
  - `services/event-bus.ts`:
    - added explicit single-payload `on()` / `off()` / `emit()` wrappers around `EventEmitter` to align the public `BotEventBus` API with the runtime event flow already used across bot lifecycle consumers.
    - preserved `off(event)` compatibility by falling back to `removeAllListeners(event)` when no specific listener is provided.
    - introduced typed `EventBusErrorPayload` for the internal failure publication path without changing emitted runtime values.
  - `interfaces/IServices.ts`:
    - aligned `IPositionLifecycleService.on()` / `off()` from stale variadic listeners to single optional payload `(data?: unknown) => void`.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/event-bus.test.ts packages/core/src/__tests__/bot-event-emitter.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts` -> PASS (3/3 suites, 57/57 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 90 (behavior-preserving telegram interface alignment):
  - `interfaces/IServices.ts`:
    - aligned `ITelegramService` with the actual current public `TelegramService` API (`notifyBotStarted`, `notifyBotStopped`, `notifyPositionOpened`, `notifyPositionClosed`, `notifyError`, `sendAlert`).
    - removed stale interface-only methods that no longer match runtime implementation.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/telegram.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts` -> PASS (4/4 suites, 87/87 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 89 (behavior-preserving web event-bus adapter cleanup):
  - `types/bot-events.ts`:
    - aligned fallback `on()` / `off()` listener overloads to single optional payload `(data?: unknown)`.
  - `web/index.ts`:
    - aligned the local web-server bot adapter wrapper from variadic `on/off/emit` signatures to the same single-payload forwarding used by `BotRuntimeEventBusLike`.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/bot-event-emitter.test.ts` -> PASS (2/2 suites, 35/35 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 88 (behavior-preserving single-payload listener bridge cleanup):
  - `interfaces/ITradingBotServices.ts` and `interfaces/IBotServicesAdapterSource.ts`:
    - narrowed `positionMonitor.on()` listener contract from variadic args to single optional payload.
  - `interfaces/IWebSocketEventHandlerServices.ts` and `services/websocket-event-handler-manager.ts`:
    - aligned `publicWebSocket` listener bridges and tracked emitter/listener helper types to the same single-payload listener shape.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/orderbook-imbalance.service.test.ts packages/core/src/__tests__/services/orderbook-imbalance.error-handling.test.ts` -> PASS (4/4 suites, 78/78 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 87 (behavior-preserving websocket handler imbalance contract cleanup):
  - `interfaces/IWebSocketEventHandlerServices.ts`:
    - narrowed `orderbookImbalanceService.analyze()` return type from `unknown` to shared `ImbalanceAnalysis`.
  - `services/websocket-event-handler-manager.ts`:
    - removed the unused local imbalance-analysis assignment while preserving the existing call path.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/orderbook-imbalance.service.test.ts packages/core/src/__tests__/services/orderbook-imbalance.error-handling.test.ts` -> PASS (2/2 suites, 40/40 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 86 (behavior-preserving monitoring logger contract narrowing):
  - `interfaces/IMonitoring.ts`:
    - narrowed `ILogger.debug()` / `info()` / `warn()` metadata input from `unknown` to `Record<string, unknown>`.
    - left `ILogger.error()` broad for compatibility with mixed error payload call sites.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/event-sourcing/position-event-store.test.ts` -> PASS (1/1 suite, 11/11 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 83-85 (behavior-preserving web-api/journal/history boundary cleanup):
  - `interfaces/IWebApiServices.ts`:
    - narrowed `IWebApiLogger.error()` / `warn()` metadata input from `unknown` to `Record<string, unknown>`.
  - `services/trade-history.service.ts`:
    - removed redundant bridge cast at the CSV append boundary and used the existing structural `TradeRecord` contract directly.
  - `services/trading-journal.service.ts`:
    - introduced helper-based narrowing for `signal.marketData` plus nested `stochastic` / `bollingerBands` access.
    - replaced repeated inline `Record<string, unknown>` casts in trade-history append and CSV export flows.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/event-sourcing/position-event-store.test.ts` -> PASS (4/4 suites, 90/90 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 80-82 (behavior-preserving logger/context boundary narrowing):
  - `services/strategy-config-merger.service.ts` and `services/websocket-authentication.service.ts`:
    - narrowed constructor logger contracts and local `safeLog()` context input from `unknown` to `Record<string, unknown>`.
  - `services/resilience/retry-policy.service.ts`, `services/resilience/rate-limiter.service.ts`, `services/resilience/circuit-breaker.service.ts`, and `services/resilience/bulkhead.service.ts`:
    - narrowed `safeLog()` metadata boundaries from `unknown` to `Record<string, unknown>`.
    - replaced config log-site bridge casts with explicit object-spread metadata where needed for structural compatibility.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/resilience/retry-policy.test.ts packages/core/src/__tests__/services/resilience/rate-limiter.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/resilience/bulkhead.test.ts` -> PASS (7/7 suites, 162/162 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batches 76-78 (behavior-preserving):
  - `services/config-validator.service.ts`: replaced repeated nested-object casts in path traversal helpers with explicit child-value helpers.
  - `services/compound-interest-calculator.service.ts`: narrowed `safeLog()` metadata boundary from broad `unknown` to `Record<string, unknown>`.
  - `services/entry-confirmation.service.ts`, `services/position-lifecycle.service.ts`, and `services/position-lifecycle/position-lifecycle-confirmation.orchestrator.ts`:
    - introduced shared `PendingSignalData` alias.
    - replaced `signal as unknown as Record<string, unknown>` with explicit record conversion before storing pending confirmations.
    - narrowed confirmation bridge inputs while preserving runtime compatibility on confirmed signal return.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/compound-interest-calculator.service.test.ts packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts` -> PASS (7/7 suites, 166/166 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 75 (behavior-preserving event-emitter boundary narrowing):
  - aligned `packages/core/src/bot-event-emitter.ts` internal subscription payloads with shared runtime event contracts from `types/bot-events.ts`.
  - widened position lifecycle convenience method handler types to match actual supported runtime payload variants without changing emitted runtime values.
  - verification:
    - `npm test -- --runInBand packages/core/src/__tests__/bot-event-emitter.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts` -> PASS (2/2 suites, 35/35 tests).
    - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 74 (behavior-preserving web bridge event narrowing):
  - narrowed `packages/web-server/src/services/bot-bridge.service.ts` runtime bot event forwarding from generic string/unknown maps to explicit local event unions and payload variants.
  - preserved existing signal/position/error normalization behavior; this was a boundary typing cleanup only.
  - verification: `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Completed compatibility-first typing batch 73 (behavior-preserving event payload narrowing):
  - added shared runtime bot event contracts in `types/bot-events.ts`.
  - narrowed `core/index.ts` and `web/index.ts` bot/eventBus boundaries to typed runtime event contracts; aligned `WebBotAdapter.getCurrentPosition()` with `Position | null`.
  - updated `bot.ts` dashboard listeners, `services/trading-lifecycle.service.ts`, and `services/real-time-risk-monitor.service.ts` to consume typed `position-opened` / `position-closed` payload variants instead of raw `unknown`.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/bot-event-emitter.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.service.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts` -> PASS (5/5 suites, 111/111 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue `Core any cleanup (phase 3: src)` outside `services` in isolated batches:
  - production scan result: non-`services`/non-`types` and `services/*` runtime `any` is clear.
  - continue compatibility-first narrowing for selected `unknown` boundaries where stable domain shapes are known.
  - latest completed batches:
    - trade-history CSV/statistics boundary cleanup via shared `TradeHistoryCsvValue` / `TradeHistoryCsvRecord` plus local adapters in `trade-history.service.ts`.
    - helper/interface cleanup around notification error payloads, JSONL persistence payloads, indicator-cache array guards, and Binance active-order guards.
    - exchange/helper guard cleanup in `bybit-service.adapter.ts`, `exit-type-detector.service.ts`, and `ladder-exit-detector.service.ts`.
    - `position-sync.service.ts` helper cleanup for error extraction, close-side matching, and compatible `BybitOrder` guard narrowing.
    - `journal.file-repository.ts` helper cleanup for error extraction and shared trade-array access.
    - utility cleanup in `error-helper.ts`, `error.utils.ts`, and `analyzer-config.utils.ts` for repeated string-property / analyzer-section narrowing.
    - `exchange-factory.service.ts` helper cleanup for repeated error-message normalization in factory failure paths.
  - next candidates: remaining low-risk helper/repository boundaries and selected shared utility DTOs/interfaces still using broad `Record<string, unknown>` or `unknown`; strongest next target is another small repository/utility slice with repeated local narrowing logic, comparable in risk to the recent utils/repository helper cleanups.
- Keep behavior unchanged, run targeted tests per slice, log each batch in `ACTIVE_REFACTOR_PLAN.md`.
