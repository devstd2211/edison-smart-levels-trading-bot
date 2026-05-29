# Dependency Map

**Purpose:** Visual reference for runtime dependency boundaries and adapter contracts.

**Maintenance:** Update when adding 5+ new interfaces or completing 10+ components, or when canonical runtime contract names change.

---

## Core Service Groups

```text
Legacy wide runtime source (being phased out)
|
+-- IMarketDataServices
|   +-- candleProvider
|   +-- orderbookManager
|   +-- publicWebSocket
|   +-- webSocketManager
|   +-- bybitService
|   +-- indicatorCache
|   +-- indicatorPreCalc
|
+-- IExecutionServices
|   +-- positionManager
|   +-- positionMonitor
|   +-- tradingOrchestrator
|   +-- orderStateMachine
|   +-- positionExitingService
|   +-- realTimeRiskMonitor
|   +-- optional execution helpers
|
+-- IMonitoringServices
|   +-- metrics
|   +-- dashboard
|   +-- monitoringServer?
|   +-- metricsService?
|   +-- healthCheckService?
|
+-- IRiskServices
    +-- riskManager
    +-- realTimeRiskMonitor
    +-- realityCheck
```

---

## Adapter Boundaries

### WebSocket Event Handler

```text
IWebSocketEventHandlerServices
+-- executionServices: Pick<IExecutionServices,
|     'positionManager' | 'positionMonitor' | 'tradingOrchestrator'>
+-- marketDataServices: Pick<IMarketDataServices,
      'candleProvider' | 'orderbookManager' | 'publicWebSocket' | 'webSocketManager'>
```

Removed from this boundary: `bybitService`, `positionExitingService`, `orderStateMachine`.

### Web API Read Boundary

```text
IWebApiReadServices
+-- logger
+-- candleProvider
+-- orderbookManager
+-- indicatorCache
+-- journal
+-- bybitService (read methods only)
+-- indicatorPreferences
+-- wallTrackerService?
```

Pattern: the Web API gets one canonical read-only service bag, and `createWebApiAdapter(...)` materializes a shared `IWebApiAdapter` instance for bot/runtime/web-server consumers.

Canonical selectors:
- Container-level mapper: `selectWebApiReadServices(source)`
- Clone helper: `createWebApiReadServices(deps)`
- Adapter factory: `createWebApiAdapter(readServices)`

### Trading Bot Runtime

```text
ITradingBotRuntimeDependencies
+-- tradingBotServices: ITradingBotServices
+-- lifecycleDependencies: ITradingBotLifecycleDependencies
|   +-- initializerServices: IBotInitializerServices
|   +-- eventHandlerServices: IWebSocketEventHandlerServices
+-- readAdapters: ITradingBotReadAdapters
    +-- balanceReader: Pick<IExchangeAccount, 'getBalance'>
    +-- webApiAdapter: IWebApiAdapter
```

Pattern: grouped runtime services stay internal to the factory layer; `TradingBot` now receives explicit collaborator shells so lifecycle-owned services and read-only adapters do not leak as flat top-level fields.

Canonical runtime bundle helper:
- `createBotRuntimeBundle(runtimeSource)` -> `BotRuntimeBundle`
- `createTradingBotRuntimeDependencyParts(runtimeSource)` selects lifecycle/read shells from the full runtime source.
- `createTradingBotRuntimeDependenciesFromParts(parts)` materializes the final runtime dependency bundle without exposing `webApiReadServices`.

### Bot Factory Runtime

```text
IBotRuntimeSource
+-- executionServices: IExecutionServices
+-- marketDataServices: IMarketDataServices
+-- eventHandlerServices: IEventHandlerServices
+-- monitoringServices: IMonitoringServices
+-- riskServices: IRiskServices
```

Pattern: explicit grouped sources for factory assembly.

### Grouped Service Container Assembly

```text
buildBotServiceState(config)
+-- initializeGroupedServices(state, config)
    +-- createGroupedServicesDeps(state, config)
    |   +-- createMarketDataServicesDeps(state)
    |   +-- createExecutionServicesDeps(state)
    |   +-- createMonitoringServicesDeps(state)
    |   +-- createRiskServicesDeps(state)
    |   +-- createWebApiServicesDeps(state, config)
    |   +-- createCoreServicesDeps(state)
    |   +-- createEventHandlerServicesDeps(state)
    +-- createGroupedServices(deps)
        +-- MarketDataServices
        +-- ExecutionServices
        +-- MonitoringServices
        +-- RiskServices
```

Pattern: each domain container receives an explicit `I<Domain>ServiceContainerDeps`
input contract and returns the grouped service interface. The composition root
does not inline individual domain dependency selection.

### Web Server Bot Instance Adapter

```text
WebServerBotInstanceAdapter
+-- maps core Position -> web-server Position DTO
+-- proxies on/off/emit to BotRuntimeEventBusLike
+-- preserves stop() as fire-and-forget for IBotInstance
```

Pattern: runtime adapter replaces the previous double-cast boundary, and `createWebServerRuntime(bot, webApiAdapter)` now hands that adapter to the web package explicitly before startup.

### Web Server Route Boundaries

```text
BotRouteApi
+-- getStatus
+-- startBot
+-- stopBot

DataRouteReadApi
+-- getPosition
+-- getBalance
+-- getMarketData
+-- getRecentSignals
+-- getCandles
+-- getPositionHistory
+-- getOrderBook
+-- getWalls
+-- getFundingRate
+-- getVolumeProfile
```

Pattern: route factories receive explicit control/read delegates instead of the full `BotBridgeService`.

---

## Adapter Registry

| Component | Adapter Interface or Type | Status |
|-----------|---------------------------|--------|
| WebSocketEventHandler | `IWebSocketEventHandlerServices` | done |
| WebApiRead | `IWebApiReadServices` | done |
| WebApiAdapter | `IWebApiAdapter` | done |
| TradingBot Runtime | `ITradingBotRuntimeDependencies` | done |
| BotFactory Runtime | `IBotRuntimeSource` | done |
| Runtime Dependency Adapters | `runtime-service-adapters.ts` | done |
| Grouped Service Inputs | `createGroupedServicesDeps(...)` | done |
| Grouped Domain Containers | `I<Domain>ServiceContainerDeps` | done |
| Web Server Bot Instance | `WebServerBotInstanceAdapter` | done |
| Web Server Routes | `BotRouteApi` / `DataRouteReadApi` | done |

---

## Refactor Progress

- Completed components: 157
- Active queue: 15
- Latest completed: `ITradingBotRuntimeDependencies grouped lifecycle/read adapter follow-up`
- Next target area: runtime source ownership and programmatic handoff follow-ups around BotFactory and core entrypoints

---

## Naming Conventions

1. Grouped services: `I<Domain>Services`
2. Adapter subsets: `I<Component><Domain>Services`
3. Runtime bundles: `I<Component>RuntimeDependencies`
4. Nested collaborator shells: `I<Component><Purpose>`
5. Runtime adapter modules: `runtime-<domain>-adapters.ts`
6. Mutable builder state: `buildBotServiceState` / `buildBotFactoryServiceState`
7. Runtime bundle helpers: `createBotRuntimeBundle`
8. Shared read adapters: `create<Domain>Adapter(readServices)`

---

## Anti-Patterns to Avoid

- Do not pass the full legacy runtime source into components that only need a few dependencies.
- Do not create a new adapter interface for every small variation if an existing contract can be reused.
- Do not stack adapters deeply.
- Do not include services in an adapter that the consumer never calls.

Prefer narrow `Pick<T, K>` contracts and explicit runtime mappers.

---

**Last Updated:** 2026-05-29
**Auto-generated by:** ITradingBotRuntimeDependencies grouped lifecycle/read adapter follow-up
