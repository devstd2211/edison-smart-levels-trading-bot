# Architecture Quick Start

Current high-level architecture for the Edison workspace.

## Scope

This document replaces the older phase/session dump. It is intentionally short and only describes the current structure that matters for navigation and maintenance.

## Packages

```text
packages/contracts
packages/core
packages/web-server
packages/web-client
```

### `packages/contracts`

- Shared DTOs and boundary contracts.
- Intended to be dependency-safe for both server and client consumers.

### `packages/core`

- Trading domain and runtime assembly.
- Core services, repositories, analyzers, orchestrators, CLI entrypoint, and tests.
- Owns bot lifecycle and Phase 9 Live Trading engine services.

### `packages/web-server`

- API and WebSocket adapter layer.
- Consumes contracts and exposes read-oriented runtime access through adapters instead of broad direct service access.

### `packages/web-client`

- Browser UI.
- Talks to the web-server boundary rather than importing core runtime internals.
- Private workspace package only. It should consume publishable contracts surfaces, not expose its own package API.

## Core Entry Paths

```text
@edison/core       Legacy wrapper (compatibility only)
@edison/core/cli   CLI startup
@edison/core/core  Programmatic bot creation
@edison/core/web   Web adapter bootstrap
@edison/contracts  Shared contract surface
@edison/contracts/web-api      Web-facing DTOs
@edison/contracts/runtime-api  Runtime/API envelopes and events
```

### Entrypoint helper split

- `@edison/core` stays on `packages/core/src/index.ts` as a compatibility wrapper only.
- The legacy wrapper delegates direct-execution guarding to `packages/core/src/legacy-entrypoint-runtime.ts`, which in turn reuses the shared standalone guard from `packages/core/src/standalone-entrypoint-runtime.ts`.
- `@edison/core/cli` stays on `packages/core/src/cli/index.ts` and owns config loading plus process startup.
- `@edison/core/core` stays on `packages/core/src/core/index.ts`; config-aware runtime orchestration lives in `packages/core/src/core/core-entrypoint-runtime.ts`.
- `@edison/core/web` stays on `packages/core/src/web/index.ts`; bot/web-server orchestration lives in `packages/core/src/web/web-entrypoint-runtime.ts`.
- Standalone workflow wrappers such as `packages/core/src/collect-data.ts`, `packages/core/src/test-balance.ts`, and `packages/core/src/vector-db.ts` also reuse `packages/core/src/standalone-entrypoint-runtime.ts` so imports stay side-effect free and direct execution remains explicit.
- The shared standalone runner resolves `require.main` in one place through `resolveStandaloneEntrypointMainModule()`, so wrapper call sites can rely on the default main-module guard instead of threading `require.main` manually.
- Standalone workflow presentation lives in `packages/core/src/standalone-script-console.ts`, which keeps banner/footer formatting separate from workflow orchestration.
- New consumers should prefer `@edison/core/core`, `@edison/core/cli`, or `@edison/core/web` over the legacy root wrapper.

### Runtime flow

1. CLI loads env and validated config.
2. Core creates the bot runtime.
3. CLI starts the bot lifecycle.
4. Web adapter is started around the bot instance when enabled.

Programmatic flow stays separate from the CLI path:

1. Callers import bot creation helpers from `@edison/core/core`.
2. Config-aware helpers can load validated runtime config without going through the legacy root wrapper.
3. Web embedding uses the explicit `createWebServerRuntime(bot, webApiAdapter)` and `startWebServer(runtime, ports)` pair from `@edison/core/web`, where the runtime handoff already contains the web-server bot adapter plus the shared read-only web API adapter.

## Core Layers

Inside `packages/core/src` the codebase is organized around a few stable slices:

- `services/`: long-lived runtime services and lifecycle coordination.
- `repositories/`: persistence and cache abstractions.
- `analyzers/`: market-signal analysis units.
- `orchestrators/`: coordination logic across analyzers and services.
- `providers/`: external-feed and derived-data providers.
- `interfaces/`: public ports used by factories and adapters.
- `config/`: configuration loading and validation.
- `__tests__/`: service-heavy test suites, currently under ongoing refactor.

## Bot Assembly

Bot assembly is dependency-injected and package-aware:

1. Config is loaded in core.
2. Service factories assemble runtime state.
3. `createBot` returns a bot-like runtime surface.
4. The web layer consumes a narrow adapter surface.

Boundary rule:

- Consumers should prefer `@edison/contracts/web-api` and `@edison/contracts/runtime-api` over the broad `@edison/contracts` barrel.
- Consumers should never import from `packages/contracts/src` or other source-file paths across workspace packages.

Supporting docs:

- [docs/architecture/dependency-map.md](./docs/architecture/dependency-map.md)
- [docs/architecture/web-api-boundaries.md](./docs/architecture/web-api-boundaries.md)

## Phase 9 Live Trading Engine

Phase 9 Live Trading Engine remains part of the runtime architecture and is implemented in `packages/core`.

Key services include:

- `trading-lifecycle.service.ts`
- `real-time-risk-monitor.service.ts`
- `order-execution-pipeline.service.ts`
- `performance-analytics.service.ts`
- `graceful-shutdown.service.ts`

The old architecture doc treated Phase 9 as a milestone log. The current view treats it as an existing subsystem inside core.

## Current Refactor Context

The active work is not a package migration anymore. It is mostly lifecycle/testability cleanup in large service test suites.

Use these files instead of adding more progress logs here:

- `ACTIVE_REFACTOR_PLAN.md`
- `NEXT_SESSION_PROMPT.md`
- `REFACTOR_TASKS.md`
- `REFACTOR_PLAN.md` for archived historical notes

## Keep / Delete Rule

Keep architecture docs that describe current boundaries, entrypoints, or operational behavior.

Delete documents that are only:

- phase-by-phase historical transcripts,
- one-off optimization reports,
- stale release snapshots,
- or references to files that no longer exist.
