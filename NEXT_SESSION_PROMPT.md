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
- Completed core `any` cleanup batches 65-72 (behavior-preserving):
  - `types/strategy-processing/types.ts`: `StrategyProcessingResult.result` changed `any` -> `unknown`.
  - `types/architecture/types.ts`: `metadata` payload maps and `IEventEmitter` event payload/listener signatures changed `any` -> `unknown`.
  - `types/config/config.types.ts`: analyzer params and disabled-section index signatures changed `any` -> `unknown`.
  - `types/live-trading/types.ts`: risk/event payload maps and perf-analytics trade arrays changed `any` -> `unknown`.
  - `types/multi-strategy/types.ts`: strategy snapshot/event/config-merge payload boundaries changed `any` -> `unknown`.
  - `types/config/config-new.types.ts`: replaced `const c = config as any` with `Record<string, unknown>` in `isConfigNew`.
  - `types/legacy.ts`: replaced remaining runtime `any` boundaries with `unknown` (analyzer/default/config payload fields), preserving mixed-shape compatibility for `analyzers`.
  - `repositories/__tests__/journal.file-repository.test.ts`: replaced test mock cast `as any` with `as unknown as LoggerService`.
  - `services/bybit/__tests__/bybit-service.adapter.test.ts`: replaced `mockBybitService: any`/`mockLogger: any` and setup `as any` with explicit typed mocks.
  - compatibility-first unknown narrowing:
    - `types/live-trading/types.ts`: added `PerformanceAnalyticsTradeInput`; narrowed `IPerformanceAnalytics` trade-array methods from `unknown[]` to explicit input shape.
    - `services/performance-analytics.service.ts`: aligned method/helper signatures to shared `PerformanceAnalyticsTradeInput`.
    - `types/legacy.ts`: re-exported `PerformanceAnalyticsTradeInput`.
    - `types/multi-strategy/types.ts`: narrowed `StrategyMetadata.configOverrides` to `Partial<ConfigNew>`, `StrategyStateSnapshot.positions/journal` to `Record<string, unknown>[]`, and aligned `riskMonitorState` + `StrategyEvent.data` on shared `StrategySnapshotRecord`.
  - compile-compatibility guard updates:
    - `action-handlers/activate-trailing.handler.ts`: typed `currentPrice` extraction from metadata.
    - `action-handlers/close-percent.handler.ts`: typed `currentPrice` extraction from metadata.
- Verification:
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts` -> PASS (2/2 suites, 73/73 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/phase-10-multi-strategy.test.ts packages/core/src/__tests__/phase-9-live-trading.integration.test.ts packages/core/src/__tests__/services/performance-analytics.service.test.ts` -> PASS (3/3 suites, 151/151 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts` -> PASS (2/2 suites, 38/38 tests).
  - `rg -n "\\bany\\b"` across target `types/*` files -> only comment/doc matches.
  - `npm test -- --runInBand packages/core/src/repositories/__tests__/journal.file-repository.test.ts` -> PASS (1/1 suite, 18/18 tests).
  - `npm test -- --runInBand packages/core/src/services/bybit/__tests__/bybit-service.adapter.test.ts` -> PASS (1/1 suite, 47/47 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/performance-analytics.service.test.ts packages/core/src/__tests__/services/performance-analytics.error-handling.test.ts` -> PASS (2/2 suites, 68/68 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/phase-10-multi-strategy.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts` -> PASS (2/2 suites, 97/97 tests).
  - `rg -n "as any" packages/core/src --glob '!packages/core/src/services/**' --glob '!packages/core/src/types/**' --glob '!packages/core/src/**/*.ARCHIVED.ts'` -> no matches.
  - `rg -n "(:\\s*any\\b|as any\\b|<any>|any\\[\\]|Record<string,\\s*any>)" packages/core/src/services packages/core/src/__tests__/services --glob '!**/*.ARCHIVED.ts'` -> no matches.

## Next Step
- Continue `Core any cleanup (phase 3: src)` outside `services` in isolated batches:
  - production scan result: non-`services`/non-`types` and `services/*` runtime `any` is clear.
  - continue compatibility-first narrowing for selected `unknown` boundaries where stable domain shapes are known (next candidates: non-multi-strategy payload boundaries and selective event payload contracts).
- Keep behavior unchanged, run targeted tests per slice, log each batch in `ACTIVE_REFACTOR_PLAN.md`.
