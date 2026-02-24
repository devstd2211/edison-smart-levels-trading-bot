# Refactor Task Breakdown

## A) DI + Containers
1. Create `docs/architecture/dependency-map.md` with all services from `src/services/bot-services.ts` and their dependencies.
2. Add grouped service interfaces in `src/interfaces`:
   - `IMarketDataServices`
   - `IExecutionServices`
   - `IRiskServices`
   - `IMonitoringServices`
3. Implement `MarketDataServices` container with only market data dependencies.
4. Implement `ExecutionServices` container with only execution dependencies.
5. Implement `RiskServices` container with only risk dependencies.
6. Implement `MonitoringServices` container with only monitoring dependencies.
7. Update `TradingBot` constructor to accept grouped interfaces instead of `BotServices`.
8. Update `BotWebAPI` to accept only required group interface(s).
9. Replace `any` fields in `src/bot.ts` with typed interfaces.
10. Add temporary adapter `BotServicesAdapter` if needed for incremental migration.
11. Remove or reduce `BotServices` once all callers migrated.

## B) Package Boundaries
1. Create `packages/contracts` and move shared DTOs/ports there.
2. Create `packages/core` and move core bot source under it.
3. Create `packages/web-server` and wire to `contracts`.
4. Create `packages/web-client` and wire to `contracts`.
5. Add workspace config in root `package.json`.
6. Add `tsconfig` references for packages.
7. Replace dynamic import of `web-server/dist` with typed package import.
8. Update build scripts to enforce order: `contracts -> core -> web-server -> web-client`.
9. Add per‑package build/test scripts.

## C) Lifecycle + Testability
1. Add `ILifecycle` interface with `start/stop`.
2. Create `LifecycleManager` orchestration.
3. Refactor services with timers/sockets to implement `ILifecycle`.
4. Make constructors side‑effect free in those services.
5. Update `BotInitializer` to use `LifecycleManager`.
6. Update `TradingBot.start()` to orchestrate lifecycle only.
7. Update tests to use `createServices()` + `start/stop`.

## D) Composition Roots
1. Create `src/cli/index.ts` with CLI UX and logging.
2. Create `src/core/index.ts` as minimal bot entrypoint.
3. Create `src/web/index.ts` for web server startup.
4. Add `ConfigPipeline` module for strategy merge and config validation.
5. Update README to new entrypoints.
6. Keep old `src/index.ts` as wrapper until migration complete.
