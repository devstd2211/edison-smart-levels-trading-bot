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

## Last Completed (2026-03-04)
- `action-queue.error-handling.test.ts`: removed local `any` usages (`signal: {} as any`, `(a as any).metadata`, `const action: any`).
- `ActionQueueService`: extracted enqueue defaults logic into `ensureActionDefaults(...)` (behavior-preserving service decomposition).
- `virtual-balance.error-handling.test.ts`: removed local `as any` mock logger cast (typed `LoggerService` mock).
- `VirtualBalanceService`: extracted all-time-extremes update logic into `updateAllTimeExtremes()` (behavior-preserving service decomposition).
- `pnl-calculator.error-handling.test.ts`: removed local `as any` mock logger cast (typed `LoggerService` mock).
- `PnLCalculatorService`: reviewed as related service candidate; no safe decomposition needed in this pass.
- `delta-analyzer.service.test.ts`: removed `type: 'ENTRY' as any` in signal mock by using `SignalType.LEVEL_BASED`.
- `DeltaAnalyzerService`: extracted repeated neutral-result creation into `createNeutralAnalysis()` (behavior-preserving service decomposition).
- `entry-confirmation.error-handling.test.ts`: removed local `signalData: null as any` cast (typed via `unknown` cast).
- `EntryConfirmationManager`: extracted pending-id construction into `buildPendingId(...)` (behavior-preserving service decomposition).
- `event-deduplication.error-handling.test.ts`: removed private-field access cast with `as any` (typed helper for `processedEvents` map access).
- `EventDeduplicationService`: extracted event-key generation into `buildEventKey(...)` (behavior-preserving service decomposition).
- Verification:
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/action-queue.error-handling.test.ts` -> 26/26 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts` -> 35/35 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/pnl-calculator.error-handling.test.ts` -> 20/20 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/delta-analyzer.service.test.ts` -> 28/28 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts` -> 17/17 PASS.
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/event-deduplication.error-handling.test.ts` -> 20/20 PASS.

## Next Step
- Continue `__tests__/services/*` `any` cleanup with same rule: test refactor + related service candidate check + targeted verification + `REFACTOR_PLAN.md` update.
