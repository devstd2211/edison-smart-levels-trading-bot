# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and status tracking: `REFACTOR_PLAN.md` (single source of truth).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".

## Working Order Per Session
1. Pick next target from `REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-08)
- Continued core `any` cleanup with behavior-preserving typing hardening (batches 35-41):
  - `strategy-manager.service.ts`:
    - typed `initialize(...)` overloads + runtime guard implementation (no `any`).
    - `mergedConfigGeneric`/`getMergedConfig()` kept as `ConfigNew | Config`.
  - `indicator-registry.service.ts`:
    - removed `any` from logger metadata and THROW validation branches.
    - replaced fallback `({} as any)` with typed `defaultErrorLogger`.
  - `tf-alignment.service.ts`:
    - typed alignment-input indicator object in validation path (no `indicators: any`).
    - replaced timeframe weight validator `tf: any` with `unknown` + guard helper.
  - `market-condition-analyzer.service.ts`:
    - typed safe logger metadata (`Record<string, unknown>`).
    - removed validation `as any` branches via `handleThrowValidation(...)` helper.
  - `indicator-cache.service.ts`:
    - replaced fallback `({} as any)` ErrorHandler wiring with typed `defaultErrorLogger`.
    - typed safe logger metadata and removed remaining `as any` in invalid-key path.
  - `ml-signal-validator.service.ts`:
    - typed safe logger metadata (`safeLog(..., meta?: Record<string, unknown>)`).
  - `liquidity-heatmap.service.ts`:
    - typed safe logger metadata (`safeLog(..., meta?: Record<string, unknown>)`).
- Updated `REFACTOR_PLAN.md` with batch 35-41 entries, follow-up details, and verification results.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts` -> PASS (1/1 suite, 24/24 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/indicator-registry.error-handling.test.ts` -> PASS (1/1 suite, 25/25 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts` -> PASS (2/2 suites, 46/46 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts` -> PASS (1/1 suite, 25/25 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts` -> PASS (1/1 suite, 25/25 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/ml-signal-validator.error-handling.test.ts` -> PASS (1/1 suite, 45/45 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/liquidity-heatmap.error-handling.test.ts` -> PASS (1/1 suite, 43/43 tests).

## Next Step
- Continue `Core any cleanup (phase 3: src)` on remaining high-impact candidates with dense `any` usage:
  - move to heavier candidates in isolated batches:
    - `indicator-precalculation.service.ts`
    - `event-bus.ts`
    - `performance-analytics.service.ts`
- Execute in small behavior-preserving slices, run targeted suites for changed area, and record each slice in `REFACTOR_PLAN.md`.
