# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability cleanup in `packages/core/src/__tests__/services/*` and adjacent production services when a small safe follow-up is clearly exposed.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in the same session or note a short pending item in `ACTIVE_REFACTOR_PLAN.md`.
5. Keep this file short: refresh only `Last Completed` and `Next Step`.
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.
7. Do not maintain a running historical journal here.

## Working Order Per Session
1. Read `ACTIVE_REFACTOR_PLAN.md`.
2. Pick the next unchecked item.
3. Use `REFACTOR_TASKS.md` only if decomposition is needed.
4. Execute minimal safe refactor.
5. Run targeted tests for the changed area.
6. Run `npm run build`.
7. Update only the concise handoff below and the active plan.

## Last Completed (2026-04-25)
- Completed the requested next lifecycle/testability narrowing slice across `advanced-order-state-machine`, `exchange-factory.service`, `exchange-factory.error-handling`, `candle-provider.repository-integration`, `market-condition-analyzer.error-handling`, `entry-confirmation.service`, `entry-confirmation.error-handling`, `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `health-check`, `limit-order-executor.service`, `limit-order-executor.error-handling`, `ml-feature-extractor.service`, `ml-feature-extractor.error-handling`, `position-monitor.service`, `position-pnl-calculator.service`, `position-pnl-calculator.error-handling`, `tick-delta-analyzer.service`, `tick-delta-analyzer.error-handling`, and `tf-alignment.error-handling`.
  - narrowed another 20-file batch of helper-managed suite state by replacing generic `ManagedContext`-style aliases with suite-specific names and hoisting remaining nested `ReturnType<typeof createManaged...>` declarations to file scope where they still lived inside `describe`.
  - kept the slice behavior-preserving; the immediate follow-up remains continuing the move away from leftover generic suite-state aliases, helper-accessor wrappers, and direct managed-context plumbing in adjacent service suites.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/exchange-factory.service.test.ts packages/core/src/__tests__/services/exchange-factory.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.repository-integration.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/ml-feature-extractor.service.test.ts packages/core/src/__tests__/services/ml-feature-extractor.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially other service-adjacent suites that still keep direct managed-context exports, repeated `ReturnType<typeof createManaged...>` expressions, helper-accessor wrappers, unnecessary suite-state casts, or wider-than-needed state aliases.
- Good nearby follow-ups after this batch: `analyzer-engine.error-handling-advanced`, `indicator-precalculation.error-handling`, `bot-metrics.error-handling`, `indicator-cache.error-handling`, `position-sync.service`, `position-sync.service.error-handling`, `trading-journal.service`, `trading-journal.error-handling`, `strategy-loader`, and the next adjacent suites still surfaced by `rg` in `packages/core/src/__tests__/services` with leftover helper-accessor wrappers or generic managed-context aliases.
