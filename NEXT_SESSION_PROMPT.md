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

## Last Completed (2026-03-09)
- Completed core `any` cleanup batches 61-64 (behavior-preserving):
  - `services/structure-aware-exit.service.ts`: removed fallback `structureType: 'UNKNOWN' as any`.
  - `services/multi-strategy/strategy-state-manager.service.ts`: `Record<string, any>` -> `Record<string, unknown>` in log metadata.
  - `services/multi-strategy/strategy-registry.service.ts`: `Record<string, any>` -> `Record<string, unknown>` in log metadata.
  - `services/multi-strategy/strategy-factory.service.ts`: `Record<string, any>` -> `Record<string, unknown>` in log metadata.
  - `validators/position.validator.ts`: `isInvalidNumber(value: any)` -> `unknown`.
  - `utils/analyzer-config.utils.ts`: all extractor inputs `config: any` -> `config: unknown` with guarded envelope helper.
  - `event-sourcing/position-state-projection.service.ts`: removed `side: positionSide as any` by explicit `PositionSide` mapping.
  - `vector-db/vector-db.service.ts`: typed `getStats()` return.
  - `vector-db/sqlite-vector-store.ts`: removed remaining `any` SQL/callback/cache boundaries with typed row interfaces and cache payloads.
  - `repositories/IRepositories.ts`: indicator cache interface boundaries `any` -> `unknown`.
  - `repositories/market-data.cache-repository.ts`: cached indicator value/method boundaries `any` -> `unknown`.
  - `repositories/journal.file-repository.ts`: generic data-map and data persistence boundaries `any` -> `unknown`.
  - compile-compatibility fixes applied with no behavior change:
    - `services/bybit/bybit-positions.partial.ts` (typed `submitOrder` payload + static field placement).
    - `services/realtime-whale-detector.ts` (optional boolean fallback).
    - `__tests__/services/graceful-shutdown.service.test.ts` (typed access for `unknown` event data).
    - `services/indicator-cache.service.ts` (finite-number guard for `unknown` repository read path).
- Updated `REFACTOR_PLAN.md` with batch 61-64 details and verification.
- Created `ACTIVE_REFACTOR_PLAN.md` and migrated open tasks there.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/phase-10-multi-strategy.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/structure-aware-exit.service.test.ts` -> PASS (3/3 suites, 130/130 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/validators/position.validator.test.ts packages/core/src/__tests__/event-sourcing/position-state-projection.test.ts packages/core/src/__tests__/event-sourcing/position-event-sourcing.integration.test.ts` -> PASS (3/3 suites, 42/42 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`) after batch 63 and again after batch 64.

## Next Step
- Continue `Core any cleanup (phase 3: src)` outside `services` in isolated batches:
  - `types/*` (`strategy-processing`, `architecture`, `config`, `live-trading`, `multi-strategy`, `legacy`) with compatibility-first typing.
- Keep behavior unchanged, run targeted tests per slice, log each batch in `ACTIVE_REFACTOR_PLAN.md`.
