# Edison
![logo.png](logo.png)

TypeScript monorepo for a Bybit-focused trading bot, web API, and web client.

## Status

- Use demo/testnet only.
- Root build is workspace-based and currently builds `packages/contracts`, `packages/web-server`, `packages/core`, and `packages/web-client`.
- Root test delegation is workspace-based too: use `npm run test:contracts`, `npm run test:web-server`, `npm run test:core`, `npm run test:web-client`, or the ordered aggregate `npm run test:packages`.
- The codebase is in an active refactor. Current refactor handoff lives in `ACTIVE_REFACTOR_PLAN.md` and `NEXT_SESSION_PROMPT.md`.

## Workspace Layout

```text
packages/
  contracts/   Shared DTOs and ports
  core/        Trading bot, services, CLI, tests
  web-server/  HTTP/WebSocket adapter boundary
  web-client/  Browser UI
docs/
  architecture/
  DEPLOYMENT_GUIDE.md
  DISASTER_RECOVERY.md
  OPERATIONAL_RUNBOOK.md
```

## Entrypoints

- `@edison/core/cli`: CLI startup, config loading, bot startup, embedded web server startup. Implementation lives in `packages/core/src/cli/index.ts`.
- The CLI entrypoint keeps its public surface on `main()`, `runCliMain()`, and `runCliMainIfMain()` so embedded callers and direct execution stay explicit.
- Both the dedicated CLI entrypoint and the legacy wrapper reuse the shared standalone runner contract in `packages/core/src/standalone-entrypoint-runtime.ts` so package imports stay side-effect free.
- That shared runner resolves the default main-module guard in one place, so wrapper call sites do not need to thread `require.main` manually.
- `@edison/core/core`: stable non-CLI programmatic bot creation via `createBot` / `createBotRuntime` / `startBot`, plus config-aware helpers `loadBotRuntimeConfig`, `createConfiguredBot`, `createConfiguredBotRuntime`, and `startConfiguredBot`. The public surface stays in `packages/core/src/core/index.ts`; config-aware helper orchestration lives in `packages/core/src/core/core-entrypoint-runtime.ts`, where the loader is injected through the public `loadBotRuntimeConfig(loader?)` seam.
- `@edison/core/config`: dedicated runtime-config loading helpers plus the publishable loader-contract aliases (`ConfigPipelineLoader`, `ConfigPipelineBaseConfigLoader`, and `ConfigPipelineConfigValidator`). The public surface stays in `packages/core/src/config/index.ts`.
- `@edison/core/web`: web-server adapter bootstrap around a bot instance. The public surface stays in `packages/core/src/web/index.ts`; bot/web-server adapter orchestration lives in `packages/core/src/web/web-entrypoint-runtime.ts`, where callers hand off an explicit `{ botAdapter, webApiAdapter }` pair.
- The CLI uses `createCliWebRuntimeHandoff(...)` to materialize that pair before calling the web starter, so CLI startup does not let the web server rediscover adapters from bot internals.
- Execution flow: CLI loads config, creates the bot runtime, materializes the web runtime pair through `createCliWebRuntimeHandoff(...)`, then hands that pair to `startWebServer(...)` before starting the bot lifecycle.
- `@edison/core`: legacy wrapper that re-exports the dedicated entrypoints and only starts the CLI when executed directly. Its root contract stays limited to backward-compatible bot factory/runtime helpers plus the CLI handoff. Prefer `@edison/core/core`, `@edison/core/cli`, or `@edison/core/web` for new code.
- Existing `@edison/core` consumers can keep that compatibility wrapper while migrating, but new examples should stay on the dedicated `@edison/core/core`, `@edison/core/cli`, and `@edison/core/web` surfaces.
- `@edison/contracts`: shared runtime and web API contracts, with focused subpaths on `@edison/contracts/web-api` and `@edison/contracts/runtime-api`.
- `trading-bot-web-server`: workspace web adapter package consumed by `@edison/core/web`.
- `trading-bot-web-client`: private workspace app package. Keep it on local workspace boundaries only; do not treat it as a published import surface.

## Programmatic API

Use `@edison/core/core` for non-CLI callers. That package surface intentionally keeps raw runtime creation helpers and config-aware loader helpers together so consumers do not need deep imports. The helpers split into two groups:

Use `@edison/core/config` when you only need runtime-config loading helpers or the publishable loader-contract aliases (`ConfigPipelineLoader`, `ConfigPipelineBaseConfigLoader`, and `ConfigPipelineConfigValidator`).

| Helper | Config source | Starts lifecycle | Typical use |
| --- | --- | --- | --- |
| `createBot(config)` | caller provides validated config | no | tests, embedding, custom lifecycle control |
| `createBotRuntime(config)` | caller provides validated config | no | access to both `bot` and runtime adapters |
| `startBot(config)` | caller provides validated config | yes | one-shot startup from already prepared config |
| `loadBotRuntimeConfig()` | ConfigPipeline | no | load merged and validated runtime config only |
| `createConfiguredBot()` | ConfigPipeline | no | simple programmatic bot creation |
| `createConfiguredBotRuntime()` | ConfigPipeline | no | programmatic runtime bundle creation without auto-start |
| `startConfiguredBot()` | ConfigPipeline | yes | one-shot startup with built-in config loading |

`createBot` and `createBotRuntime` expect config that has already gone through the ConfigPipeline. If you want the package to load and validate config for you, use the `Configured` helpers or call `loadBotRuntimeConfig()` first. `loadBotRuntimeConfig(loader?)` is the shared public config-loader seam for those config-aware helper paths; the runtime helper layer accepts that loader as an injected dependency instead of importing ConfigPipeline internals.

For new programmatic consumers, import these helpers from `@edison/core/core` so your call site reflects the stable non-CLI surface directly. The legacy `@edison/core` root still re-exports them for compatibility, but new code should treat that root as a wrapper, not the primary integration point.
`ConfigPipelineLoader` stays available from `@edison/core/core` as a type-only convenience re-export, but the dedicated config-only surface and the full loader-contract aliases live on `@edison/core/config`.
Treat `@edison/core` as a compatibility wrapper for existing consumers, and keep new programmatic examples on `@edison/core/core`.
Keep compatibility imports from `@edison/core` limited to existing callers that have not migrated to the dedicated entrypoints yet.

Programmatic examples:

```ts
import {
  createBot,
  createBotRuntime,
  createConfiguredBotRuntime,
  loadBotRuntimeConfig,
  startConfiguredBot,
} from '@edison/core/core';

const config = await loadBotRuntimeConfig();
const bot = await createBot(config);

const runtime = await createBotRuntime(config);
await runtime.bot.start();

const runtimeWithCustomLoader = await createConfiguredBotRuntime({
  loadBaseConfig: () => ({ ...config }),
  validate: (nextConfig) => nextConfig,
});
await runtimeWithCustomLoader.bot.start();

const startedBot = await startConfiguredBot();
```

`createConfiguredBotRuntime()` still leaves lifecycle control with the caller, just like `createBotRuntime()`, and returns the bot together with its runtime adapters without auto-starting lifecycle. Only `startBot()` and `startConfiguredBot()` auto-start the bot.

Avoid deep imports such as `@edison/core/config/config-pipeline` or `packages/core/src/config/config-pipeline` in consumers. The public programmatic contract should stay on the package entrypoint surface.
If you need custom config loading in tests or embedded runtimes, keep the runtime helper on `@edison/core/core` and type the loader from `@edison/core/config` instead of importing ConfigPipeline internals:

```ts
import { createConfiguredBotRuntime, type ConfigPipelineLoader } from '@edison/core/core';
import { type ConfigPipelineBaseConfigLoader, type ConfigPipelineConfigValidator } from '@edison/core/config';

const loadBaseConfig: ConfigPipelineBaseConfigLoader = () => ({ ...configFromFixture });
const validate: ConfigPipelineConfigValidator = (config) => config;

const loader: ConfigPipelineLoader = {
  loadBaseConfig,
  validate,
};

const runtime = await createConfiguredBotRuntime(loader);
```

Use focused contracts subpaths in consumers. Prefer `@edison/contracts/web-api` or `@edison/contracts/runtime-api` over the broad `@edison/contracts` barrel, and never reach into `packages/contracts/src`.

For programmatic web-server startup, keep the runtime pair explicit: build `{ botAdapter, webApiAdapter }` with `createWebServerRuntime(bot, webApiAdapter)` and then pass that pair into `startWebServer(runtime, ports)`. That keeps the web-server-facing control surface and the read-only web API adapter visible at the boundary instead of rediscovering adapters through bot internals.
The `@edison/core/web` surface stays intentionally narrow: build the runtime pair first, then hand that pair to the starter without rediscovering adapters through bot internals.
Internally, `createWebServerInstance(runtime, ports, WebServerCtor)` receives only the already-materialized pair and port config; `startWebServerRuntime(...)` is the layer that starts lifecycle.
That split keeps `createWebServerInstance(...)` construction-only and makes `startWebServerRuntime(...)` the only lower-level helper that starts the workspace WebServer lifecycle.

```ts
import { createConfiguredBotRuntime } from '@edison/core/core';
import { createWebServerRuntime, startWebServer } from '@edison/core/web';

const runtime = await createConfiguredBotRuntime();
const webServer = await startWebServer(
  createWebServerRuntime(runtime.bot, runtime.webApiAdapter),
  { apiPort: 4000, wsPort: 4001 },
);
```

## Quick Start

### Requirements

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env
cp config.example.json config.json
```

Set Bybit demo or testnet credentials in `.env` and adjust `config.json` for symbol, leverage, risk, and strategy selection.

### Run

```bash
npm run dev
```

This starts the dedicated CLI entrypoint exposed as `@edison/core/cli`. The implementation loads config, creates the bot, and starts the embedded API/WS server.

Default runtime ports:

- Web client: `http://localhost:3000`
- API: `http://localhost:4000`
- WebSocket: `ws://localhost:4001`

If you want the standalone browser UI dev server as well:

```bash
npm run dev:web
```

## Common Commands

```bash
npm run build
npm test
npm run test:packages
npm run lint
npm run dev
npm run dev:web
npm run backtest-v5
npm run analyze-journal
npm run download-data XRPUSDT 2025-01-01 2025-01-31
```

## Workspace Build And Test Graph

- `npm run build` builds workspace packages in dependency order: `contracts -> web-server -> core -> web-client`.
- `npm run test:contracts` typechecks the shared contracts package without emitting build artifacts.
- `npm run test:packages` runs the package-level verification chain in the same workspace order used by the root build/test boundary.

## Architecture Summary

The current architecture is package-oriented:

- `packages/core` owns trading domain logic, services, repositories, analyzers, orchestrators, and CLI behavior.
- `packages/web-server` exposes a narrow adapter boundary for API and WebSocket access.
- `packages/web-client` consumes the web boundary.
- `packages/contracts` holds shared contracts between runtime boundaries.

At runtime the bot is assembled through service factories and adapters:

1. Config is loaded and validated in core.
2. Programmatic callers either pass a pre-processed config to `createBot` / `createBotRuntime` / `startBot`, or use the config-aware helpers exported from `@edison/core/core`.
3. `createBotRuntime` returns the bot plus runtime adapters without auto-starting lifecycle, while `startBot` and `startConfiguredBot` are the only helpers here that start the bot for you.
4. `loadBotRuntimeConfig(loader?)` is the public config-loader seam injected into the config-aware programmatic helpers, so callers can stay on the entrypoint surface even when they need a custom loader.
5. The CLI materializes the web runtime pair through `createCliWebRuntimeHandoff(...)` and passes it to `startWebServer(...)` before starting bot lifecycle when the embedded web adapter is enabled.
6. The web layer talks through adapter interfaces instead of reaching directly into internals.

See [ARCHITECTURE_QUICK_START.md](./ARCHITECTURE_QUICK_START.md) and [docs/architecture/web-api-boundaries.md](./docs/architecture/web-api-boundaries.md) for the current structure.

## Documentation Kept Current

- `ARCHITECTURE_QUICK_START.md`: current high-level architecture and package boundaries.
- `docs/architecture/dependency-map.md`: service/dependency map for the bot builder.
- `docs/architecture/web-api-boundaries.md`: web boundary rules.
- `docs/DEPLOYMENT_GUIDE.md`: deployment steps.
- `docs/DISASTER_RECOVERY.md`: recovery procedures.
- `docs/OPERATIONAL_RUNBOOK.md`: operations guide.
- `CONTRIBUTING.md`: contribution rules.
- `DISCLAIMER.md`: risk disclaimer.

## Refactor Tracking

- Active plan: `ACTIVE_REFACTOR_PLAN.md`
- Current handoff: `NEXT_SESSION_PROMPT.md`
- Task catalog: `REFACTOR_TASKS.md`
- Historical archive: `REFACTOR_PLAN.md`

## README Audit

This README was refreshed on 2026-04-11 because the previous version was stale:

- it referenced missing files such as `MIGRATION_PLAN.md` and generic `SPEC.md` files,
- it mixed historical phase logs with current usage guidance,
- it overstated or hardcoded legacy project status that no longer matches the current workspace layout.

## Risk

This repository is for educational and experimental trading-system work. Do not treat it as financial advice. Do not use it on real-money accounts unless you explicitly accept the risk profile described in [DISCLAIMER.md](./DISCLAIMER.md).
