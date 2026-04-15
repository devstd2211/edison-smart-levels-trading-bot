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

## Last Completed (2026-04-15)
- Completed a lifecycle/testability and suite-state reduction follow-up for `anti-flip.error-handling`, `bybit.error-handling`, `candle-aggregator.error-handling`, `candle-provider.error-handling`, `config-validator.service`, `config-validator.error-handling`, `console-dashboard.error-handling`, `create-services.lifecycle`, `trading-journal.service`, and `volume-profile.error-handling`.
  - narrowed suite-owned runtime/factory bindings via local `Pick` aliases, hoisted repeated `Parameters<>`/cleanup aliases, and removed unnecessary managed-context casts while keeping the slice test-only and behavior-preserving.
  - reviewed adjacent service surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand --silent packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/bybit.error-handling.test.ts packages/core/src/__tests__/services/candle-aggregator.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next remaining suites that still keep direct exported `Managed*Context` types, repeated `ReturnType<typeof createManaged...>` expressions, binder wrappers, fixture-accessor wrappers, or temporary managed-context locals, especially nearby remaining service/error-handling suites surfaced by `rg` after this slice such as `compound-interest-calculator.service`, `compound-interest-calculator.error-handling`, `candle-provider.repository-integration`, `circuit-breaker.service`, `circuit-breaker.error-handling`, `bot-metrics.error-handling`, `bot-initializer.error-handling`, `bybit.repository-integration`, `time.service`, and `websocket-keep-alive.service`.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
