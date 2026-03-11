# Active Refactor Plan

This file is the active source of truth for open refactor tasks only.
Completed history is intentionally removed from this file and kept in `REFACTOR_PLAN.md`.

## Open Tasks Migrated (2026-03-09)
- [ ] Move optional services behind feature toggles with explicit "capability" interfaces.
- [ ] Update tests to build only the required groups (no global container).
- [ ] Core any cleanup (phase 3: src).
- [ ] Update tests to use `createServices()` + explicit `start/stop`.

## Current Execution Focus
- [ ] Continue `Core any cleanup (phase 3: src)` in `services/*` + related tests with compatibility-first typing.
- [ ] Continue `Core any cleanup (phase 3: src)` outside `services` in isolated batches where remaining boundaries are still mixed.

## Immediate Next Candidates
- [ ] Scan remaining `packages/core/src/services/*` for the final isolated inline error-normalization leftovers.
- [ ] If no meaningful leftovers remain, close phase-3 service cleanup and move to the remaining testability items.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Record only active status here; keep completed batch history in `REFACTOR_PLAN.md`.
6. Keep `NEXT_SESSION_PROMPT.md` short: `Last Completed` + `Next Step`.

## Active Notes
- `types/*` cleanup is complete; do not reopen unless a service refactor requires a compatibility follow-up.
- Non-`services`/non-`types` phase-3 cleanup is complete for the previously targeted boundaries; only reopen when new mixed boundaries are discovered during adjacent work.
- Main remaining stream is compact service-by-service cleanup with dedicated test coverage.
- `handlers/websocket.handler.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining fallback/recovery/logging error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `handlers/position.handler.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining monitoring/fallback error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `data-collector/database-writer.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining batch/final-write error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `console-dashboard.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining dashboard state/update error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `multi-strategy/strategy-orchestrator.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining candle-routing/orchestrator-creation error-message extraction with shared `getErrorMessage()` and re-running the multi-strategy suite plus full `npm run build`.
- `event-deduplication.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining degraded-cleanup warning error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `ladder-tp-manager.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining partial-close / breakeven / trailing error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `limit-order-executor.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining placement / timeout / cancel / fallback error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `position-state-machine.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining corrupted-state / corrupted-history recovery message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `funding-rate-filter.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining cache-write error-message extraction with shared `getErrorMessage()` and re-running targeted error-handling tests plus full `npm run build`.
- `multi-strategy/strategy-state-manager.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining strategy-switch failure message extraction with shared `getErrorMessage()` and re-running the multi-strategy suite plus full `npm run build`.
- `ml-signal-validator.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining inline error-message extraction with shared `getErrorMessage()` and re-running its targeted error-handling suite plus full `npm run build`.
- `lifecycle-manager.service.ts`, `graceful-shutdown.service.ts`, and `event-bus.ts` were cleared from the active candidate list on 2026-03-11 after replacing their remaining inline error-message extraction with shared helpers and re-running targeted tests/build.
