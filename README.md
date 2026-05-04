# Edison
![logo.png](logo.png)

TypeScript monorepo for a Bybit-focused trading bot, web API, and web client.

## Status

- Use demo/testnet only.
- Root build is workspace-based and currently builds `packages/contracts`, `packages/web-server`, `packages/core`, and `packages/web-client`.
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

- `packages/core/src/cli/index.ts`: CLI startup, config loading, bot startup, embedded web server startup.
- `packages/core/src/core/index.ts`: programmatic bot creation via `createBot` / `startBot`.
- `packages/core/src/web/index.ts`: web-server adapter bootstrap around a bot instance.
- `packages/core/src/index.ts`: legacy wrapper that re-exports CLI/core and only starts the CLI when executed directly.

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

This starts the dedicated CLI entrypoint at `packages/core/src/cli/index.ts`. The CLI loads config, creates the bot, and starts the embedded API/WS server.

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
npm run lint
npm run dev
npm run dev:web
npm run backtest-v5
npm run analyze-journal
npm run download-data XRPUSDT 2025-01-01 2025-01-31
```

## Architecture Summary

The current architecture is package-oriented:

- `packages/core` owns trading domain logic, services, repositories, analyzers, orchestrators, and CLI behavior.
- `packages/web-server` exposes a narrow adapter boundary for API and WebSocket access.
- `packages/web-client` consumes the web boundary.
- `packages/contracts` holds shared contracts between runtime boundaries.

At runtime the bot is assembled through service factories and adapters:

1. Config is loaded and validated in core.
2. `createBot` builds the runtime.
3. The CLI starts bot lifecycle and optionally the web adapter.
4. The web layer talks through adapter interfaces instead of reaching directly into internals.

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
