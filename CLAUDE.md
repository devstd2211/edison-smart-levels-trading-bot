# Claude Code Session Guide

Lightweight project context for future coding sessions.

## Current Status

- Build is expected to go through the workspace root via `npm run build`.
- Main active stream is refactoring service test suites for lifecycle ownership, teardown clarity, and narrower fixture state.
- Package architecture is current and should be treated as the source of truth.

## Where To Look First

- `README.md`: current developer-facing overview and commands.
- `ARCHITECTURE_QUICK_START.md`: current package and runtime architecture.
- `ACTIVE_REFACTOR_PLAN.md`: active refactor status.
- `NEXT_SESSION_PROMPT.md`: short handoff for the next session.
- `REFACTOR_TASKS.md`: task catalog for decomposing refactor work.

## Package Map

```text
packages/contracts   Shared contracts
packages/core        Trading runtime and tests
packages/web-server  API and WebSocket adapter
packages/web-client  Browser UI
```

## Important Runtime Areas

- `packages/core/src/services`: runtime services.
- `packages/core/src/repositories`: repository and cache implementations.
- `packages/core/src/analyzers`: market analysis units.
- `packages/core/src/orchestrators`: decision coordination.
- `packages/core/src/__tests__/services`: largest current refactor surface.

## Phase 9 / Live Trading

Phase 9 Live Trading is already part of the codebase and remains relevant.

Primary Phase 9 services:

- `packages/core/src/services/trading-lifecycle.service.ts`
- `packages/core/src/services/real-time-risk-monitor.service.ts`
- `packages/core/src/services/order-execution-pipeline.service.ts`
- `packages/core/src/services/performance-analytics.service.ts`
- `packages/core/src/services/graceful-shutdown.service.ts`

Keep the strings `Phase 9` and `Live Trading` in this file because there are legacy tests that still validate those markers.

## Commands

```bash
npm run build
npm test
npm run dev
npm run dev:web
```

Useful targeted workflows:

```bash
npm test -- --runInBand
npm test -- position-monitor
npm run backtest-v5
```

## Documentation Policy

Keep:

- current architecture docs,
- operational docs,
- package usage docs,
- active refactor tracking files.

Delete:

- phase progress logs,
- stale migration snapshots,
- one-off optimization reports,
- release marker leftovers,
- docs that point to missing files.
