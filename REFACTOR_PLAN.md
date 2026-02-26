жд# Edison Refactor Plan (Global + Detailed Checklists)

## Global Phased Plan (High‑Level)
1. **Freeze Baseline**
   - Align on target architecture boundaries and success criteria.
   - Add lightweight health checks to detect regressions early.
2. **Define Contracts**
   - Extract public contracts (types/DTOs/ports) for cross‑module communication.
3. **Split Composition Roots**
   - Separate CLI entrypoint, core bot entrypoint, and web entrypoint.
4. **Refactor DI & Containers**
   - Replace service‑locator with scoped containers.
5. **Lifecycle & Testability**
   - Make start/stop explicit; remove side effects from constructors.
6. **Package Boundaries**
   - Introduce packages/workspaces and enforce build order.

---

## Complexity + Risk (Global)
- **Highest risk:** Package boundaries + build segmentation (touches build/deploy + runtime wiring)
- **Medium risk:** DI/container refactor (many dependency touch points)
- **Medium risk:** Lifecycle refactor (start/stop changes can alter timing/ordering)
- **Lower risk:** Composition root split (mostly wiring and entrypoints)

---

## 1) DI + Container Simplification

**Goal:** Remove the “God container” and make dependencies explicit and testable.

### Step‑by‑Step Checklist
- [ ] Inventory: Map all services currently built in `BotServices` with dependency graph.
- [ ] Define bounded service groups:
  - `MarketDataServices`
  - `ExecutionServices`
  - `RiskServices`
  - `MonitoringServices`
  - `WebApiServices`
- [ ] Create interfaces for each group (ports) in `src/interfaces`.
- [ ] Replace direct `BotServices` injection with narrow group interfaces in high‑level classes.
- [ ] Move optional services behind feature toggles with explicit “capability” interfaces.
- [ ] Replace `any` in `TradingBot` with concrete interfaces.
- [ ] Remove duplicate factories; pick a single factory as the DI composition root.
- [ ] Update tests to build only the required groups (no global container).

**Progress**
- [x] Dependencies mapped
- [x] Dependency map documented in docs/architecture/dependency-map.md
- [x] First migration slice proposed (WebApiServices/BotWebAPI read-only group)
- [ ] Tests not run yet after refactor batches (status unknown)
- [ ] Group containers created
- [x] MarketDataServices scaffolded
- [x] ExecutionServices scaffolded
- [x] MonitoringServices scaffolded
- [x] RiskServices scaffolded
- [x] Narrow interfaces used in web adapters (BotWebAPI)
- [x] Narrow interfaces used in event handlers (WebSocketEventHandlerManager, RealTimeWhaleDetector)
- [x] Narrow interfaces used in lifecycle (BotInitializer)
- [x] Narrow interfaces used in bot (TradingBot)
- [x] TradingBot services narrowed (no any in ITradingBotServices)
- [x] Narrow interfaces tightened (web/api/ws/initializer/whale)
- [x] First consumer migrated to grouped services (MonitoringServices in TradingBot)
- [x] WebSocketEventHandlerManager migrated to MarketDataServices
- [x] BotWebAPI migrated to MarketDataServices
- [x] BotInitializer migrated to MarketDataServices (candleProvider/publicWebSocket)
- [x] BotInitializer migrated to ExecutionServices (position monitor/manager)
- [x] TradingBot migrated to ExecutionServices
- [x] BotInitializer uses ExecutionServices contract (positionMonitor wired)
- [x] BotInitializer uses ExecutionServices for startPositionMonitor
- [x] WebSocketEventHandlerManager uses ExecutionServices for positionMonitor
- [x] WebSocketEventHandlerManager uses MarketDataServices for webSocketManager
- [x] TradingBot uses MonitoringServices for dashboard check
- [x] TradingBot constructor accepts service bundle (no BotServices type)
- [x] ITradingBotServices narrowed to actual TradingBot usage
- [x] WebApiServices container introduced and wired
- [x] Web API boundary interfaces narrowed (web-api types + IWebApiServicesContainer)
- [x] IWebApiServicesContainer bybitService narrowed to IWebApiExchange
- [x] IWebApiServicesContainer read-only returns (candles/orderbook/journal)
- [x] Read-only group contracts (core/market/execution/risk/monitoring/web-api)
- [x] Web API DTOs typed (BotWebAPI + TradingBot signatures)
- [x] Web API market data now candle-backed (no placeholders)
- [x] Web API market data uses indicator cache (RSI/EMA/ATR)
- [x] Web API indicator preferences configurable via config.webApi
- [x] Web API config example added (config.example.json)
- [x] Web API config added to config.json
- [x] Web API DTOs propagated to web-server/web-client (data API paths typed)
- [x] Web API data routes now fully async (no sync market data calls)
- [x] WebApiReadServices interface + container factory wired to BotWebAPI
- [x] WebApiReadServices verified complete (read-only adapter wired end-to-end)
- [x] WebApiServices creation moved to container factory
- [x] Web-server bridge uses WebApiReadServices adapter (BotWebAPI injected at boundary)
- [x] Web-server WebApiAdapter contract extracted for reuse
- [x] Web-server routes audited (all data routes go through BotBridgeService)
- [x] Build verified after web-server boundary changes
- [x] Web-server IBotInstance narrowed (read API moved to IWebApiAdapter)
- [x] Next low-risk slice proposed (Monitoring read-only adapters)
- [x] MonitoringReadServices interface + container factory added
- [x] TradingBot wired to MonitoringReadServices factory
- [x] MonitoringServices creation moved to container factory
- [x] MonitoringServer depends on read-only metric/health reader interfaces
- [x] Monitoring services interfaces reference read-only metric/health reader contracts
- [x] Monitoring reader interfaces moved to src/interfaces
- [x] Monitoring services interfaces decoupled from concrete metrics/health classes
- [x] BotServices metrics/health fields typed as read-only interfaces
- [x] IMonitoringServices now extends IMonitoringReadServices
- [x] ResilienceCoordinator depends on metrics recorder interface
- [x] PrometheusMetricsService/HealthCheckService implement reader/recorder interfaces
- [x] Core any cleanup batch 12: BotServices optional config sections typed
- [x] Core any cleanup batch 13: BotServices stubs removed (exchange/strategy orchestrator)
- [x] Build fixes: config/meta/filter types, web-client typing fixes, order history guards
- [x] WebSocket payloads typed in web-client (no `any` handlers)
- [x] StrategyStatus UI uses typed API responses (no `any`)
- [x] UI data paths cleaned of `any` (Analytics/PositionCard/PriceChart)
- [x] WebSocket payloads typed in web-server (typed WebSocketMessage map)
- [x] Bot-bridge WS payloads typed (real bot event shapes)
- [x] api.service any removed (post/put/patch payloads + handleError)
- [x] WS server error handling uses unknown (no any)
- [x] Bot-bridge signal/position mapping strict (no silent fallbacks)
- [x] Web-server any cleanup (phase 1: web-server/src)
- [x] Web-client any cleanup (phase 2: web-client/src)
- [ ] Core any cleanup (phase 3: src)
- [ ] Tests any cleanup (phase 4: __tests__)
- [x] Core any cleanup batch 1: action-handlers + bot dashboard event typing
- [x] Core any cleanup batch 2: config + bot-factory meta strategy handling
- [x] Core any cleanup batch 3: bot-web-api orderbook typing
- [x] Core any cleanup batch 4: filter orchestrator context typing
- [x] Core any cleanup batch 5: exit-event-handler typing
- [x] Core any cleanup batch 6: analyzer loader typing
- [x] Core any cleanup batch 7: IServices interface unknowns
- [x] Core any cleanup batch 8: WebSocket/TradingBot interfaces unknowns
- [x] Core any cleanup batch 9: IRepository/IExchange unknowns
- [x] Core any cleanup batch 10: IMonitoring unknowns
- [x] Core any cleanup batch 11: index entrypoint unknowns
- [x] Core any cleanup batch 12: websocket-event-handler-manager no any
- [x] Core any cleanup batch 13: websocket handler + auth logger types
- [x] Core any cleanup batch 14: safeLog logger typing (candle/tf/whale/ml)
- [x] Core any cleanup batch 15: safeLog meta/context typings (handlers/services)
- [x] Core any cleanup batch 16: strategy-config-merger logger typing
- [x] Core any cleanup batch 17: safeLog meta typed as Record for LoggerService
- [x] Core any cleanup batch 18: web entrypoint typed (src/web/index.ts)
- [x] Core any cleanup batch 19: analyzer logger types (new analyzers)
- [x] Core any cleanup batch 20: level/order-block analyzer any cleanup
- [x] Core any cleanup batch 21: volatility spike analyzer config typed
- [x] Core any cleanup batch 22: backtest worker/walk-forward/backtest-engine any cleanup
- [x] Core any cleanup batch 23: backtest sqlite providers + optimizer metrics typed
- [x] Core any cleanup batch 24: backtest risk gate + sqlite blob guards + worker message guard
- [x] Tests any cleanup batch 1: backtest walk-forward/worker-pool/parameter-optimizer tests
- [x] Tests any cleanup batch 2: bot-event-emitter, exit-decisions, anti-flip tests
- [x] Tests any cleanup batch 3: event-handlers, entry-decisions, cache-integration tests
- [x] Tests any cleanup batch 4: error-result + position validator tests
- [x] Tests any cleanup batch 5: smoke-tests + integration tests
- [x] Tests any cleanup batch 6: error-registry + base/domain error tests
- [x] Tests any cleanup batch 7: phase-10-3b/3c + exit/entry-exit orchestrator tests
- [x] Tests any cleanup batch 8: entry/exit/filter orchestrator error-handling tests
- [x] Tests any cleanup batch 9: indicators (volume/stochastic/rsi/ema/bollinger/atr)
- [x] BotServices.toObject reduced to grouped services
- [x] CoreServices container introduced and TradingBot wired
- [x] EventHandlerServices container introduced and wired
- [x] WebSocketEventHandlerManager uses EventHandlerServices
- [x] IBotServices exposes EventHandlerServices (legacy handlers retained)
- [x] BotServicesAdapter maps BotServices to TradingBotServiceBundle (BotFactory)
- [x] Entry point scaffolds created (cli/core/web)
- [x] Workspaces scaffolding added (packages/contracts, packages/core)
- [x] Types modularization started (domain folders + re-export)
- [x] Orderbook types moved to domain folder
- [x] Position types moved to domain folder
- [x] Event types moved to domain folder
- [x] Strategy types moved to domain folder
- [x] Signal types moved to domain folder
- [x] Live-trading types moved to domain folder
- [x] Config types moved to domain folder
- [x] Architecture types moved to domain folder
- [x] Indicator types moved to domain folder
- [x] Analyzer types moved to domain folder
- [x] Multi-strategy types moved to domain folder
- [x] Exit-strategy types moved to domain folder
- [x] Fractal-strategy types moved to domain folder
- [x] Advanced-order-flow types moved to domain folder
- [x] Anomaly-detection types moved to domain folder
- [x] Liquidity-heatmap types moved to domain folder
- [x] Pattern-recognition types moved to domain folder
- [x] Smart-order-placement types moved to domain folder
- [x] Position-state-machine types moved to domain folder
- [x] Strategy-processing types moved to domain folder
- [x] Circuit-breaker types moved to domain folder
- [x] ML-signal-validator types moved to domain folder
- [x] Strategy-config types moved to domain folder
- [x] Websocket event types moved to domain folder
- [x] Legacy types isolated behind src/types.ts re-exports
- [x] Removed top-level re-export type files from src/types
- [x] BotInitializer uses ExecutionServices for tradingOrchestrator
- [x] BotInitializer uses ExecutionServices for periodic position checks
- [x] BotInitializer uses MarketDataServices for webSocketManager
- [x] BotInitializer uses CoreServices (logger/timeService/eventBus/telegram)
- [x] BotInitializer uses MarketDataServices for bybitService
- [x] Step 1: Updated core/orchestrators/interfaces/providers/repositories/utils/backtest/indicators imports to domain types
- [x] Step 1: Remaining domain-import migrations (services/strategies/tests)
- [x] Step 1: Standardized imports to use legacy types in services/strategies/tests
- [x] Multi-strategy module exports now sourced from legacy re-exports
- [ ] Old `BotServices` removed or reduced to thin adapter

### Complexity + Risk
- **Complexity:** High
- **Risk:** Medium (widespread constructor changes)
- **Mitigation:** Migrate in slices; keep adapter to old container temporarily.

---

## 2) Package Boundaries + Build Segmentation

**Goal:** Establish strict build boundaries and typed contracts between core and web layers.

### Step‑by‑Step Checklist
- [ ] Create `packages/contracts` for shared types/DTOs/ports.
- [ ] Move web‑facing DTOs and API contracts to `packages/contracts`.
- [ ] Add workspaces (npm) and `tsconfig` references.
- [ ] Split into packages:
  - `packages/core` (bot engine)
  - `packages/web-server`
  - `packages/web-client`
  - `packages/contracts`
- [ ] Replace dynamic import of `web-server/dist` with typed package import.
- [ ] Enforce build order in scripts: `contracts -> core -> web-server -> web-client`.
- [ ] CI: build each package independently.

**Progress**
- [ ] Contracts package created
- [ ] Workspaces configured
- [ ] Dynamic import removed
- [ ] Build order enforced

### Complexity + Risk
- **Complexity:** High
- **Risk:** High (build + runtime path changes)
- **Mitigation:** Use parallel build pipeline and smoke tests per package.

---

## 3) Lifecycle + Testability

**Goal:** Make lifecycle explicit and remove side effects from constructors.

### Step‑by‑Step Checklist
- [ ] Introduce `LifecycleManager` with `start()` and `stop()` methods.
- [ ] Ensure services that open sockets/timers implement `start/stop`.
- [ ] Move side‑effects out of constructors into `start`.
- [ ] Create lightweight `createServices()` factory that is side‑effect free.
- [ ] Refactor `TradingBot.start()` to only orchestrate lifecycle, not initialize dependencies.
- [ ] Refactor `BotInitializer` into a `Bootstrapper` that wires lifecycle steps.
- [ ] Update tests to use `createServices()` + explicit `start/stop`.

**Progress**
- [ ] LifecycleManager added
- [ ] Side effects removed from constructors
- [ ] Explicit start/stop across services
- [ ] Tests updated

### Complexity + Risk
- **Complexity:** Medium
- **Risk:** Medium (timing/order changes)
- **Mitigation:** Add startup sequencing tests and runtime smoke checks.

---

## 4) Composition Root + Entry Points

**Goal:** Separate CLI, core, and web entrypoints to clarify responsibility.

### Step‑by‑Step Checklist
- [ ] Move CLI UX and logging to `src/cli/index.ts`.
- [ ] Keep `src/index.ts` as minimal “core bot” entrypoint.
- [ ] Create `src/web/index.ts` for web server startup.
- [ ] Move strategy config merge into `ConfigPipeline` module.
- [ ] Ensure entrypoints depend on contracts and factory only, not on business logic internals.
- [ ] Update README to point to new entrypoints.

**Progress**
- [ ] CLI entrypoint separated
- [ ] Core entrypoint simplified
- [ ] Web entrypoint created
- [ ] ConfigPipeline implemented

### Complexity + Risk
- **Complexity:** Medium
- **Risk:** Low‑Medium (wiring changes)
- **Mitigation:** Keep existing entrypoint temporarily as a thin wrapper.

---

## Issue‑Ready Task Lists (By Area)

### A) DI + Containers
1. Create dependency map doc for `BotServices` (list all services + dependencies).
2. Add interfaces for grouped services in `src/interfaces`.
3. Introduce `MarketDataServices` container.
4. Introduce `ExecutionServices` container.
5. Introduce `RiskServices` container.
6. Introduce `MonitoringServices` container.
7. Update `TradingBot` constructor to accept grouped interfaces.
8. Remove direct `BotServices` usage from web adapters.
9. Replace `any` fields in `TradingBot` with typed interfaces.
10. Add compatibility adapter: `BotServicesAdapter` (optional, temporary).
11. Delete or thin `BotServices` once all callers migrated.

### B) Package Boundaries
1. Create `packages/contracts` and move shared DTOs/ports there.
2. Create `packages/core` and move core bot source under it.
3. Create `packages/web-server` and wire to `contracts`.
4. Create `packages/web-client` and wire to `contracts` for data shapes.
5. Add workspace config in root `package.json`.
6. Add `tsconfig` references for packages.
7. Replace dynamic import of `web-server/dist` with typed package import.
8. Update build scripts to enforce order.
9. Add per‑package build/test scripts.

### C) Lifecycle + Testability
1. Add `ILifecycle` interface with `start/stop`.
2. Create `LifecycleManager` orchestration.
3. Refactor services with timers/sockets to implement `ILifecycle`.
4. Make constructors side‑effect free in those services.
5. Update `BotInitializer` to use `LifecycleManager`.
6. Update `TradingBot.start()` to orchestrate lifecycle only.
7. Update tests to use `createServices()` + `start/stop`.

### D) Composition Roots
1. Create `src/cli/index.ts` with CLI UX and logging.
2. Create `src/core/index.ts` as minimal bot entrypoint.
3. Create `src/web/index.ts` for web server startup.
4. Add `ConfigPipeline` module for strategy merge and config validation.
5. Update README to new entrypoints.
6. Keep old `src/index.ts` as wrapper until migration complete.
