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

## Last Completed (2026-04-29)
- Completed the next lifecycle/testability narrowing slice across `strategy-loader.*`, `smart-order-placement.error-handling.test`, `position-scaling.test`, `position-state-machine.*`, `pattern-recognition.error-handling.test`, `risk-calculator.error-handling.test`, `smart-order-execution.test`, the full `position-exiting.*` cluster, and the remaining `position-lifecycle.*` repository/safety/error-handling suites, plus the supporting helper exports in the related `*-test.utils` files.
  - narrowed this slice by replacing the remaining suite-local `ReturnType<typeof createManaged...>` aliases and direct managed-context field picks with exported helper suite/error/runtime state contracts, and by exporting the missing helper-owned state types/factories needed by those clusters.
  - reviewed adjacent production surfaces around `strategy-loader.service`, `smart-order-placement.service`, `position-scaling.service`, `position-state-machine.service`, `pattern-recognition.service`, `risk-calculator.service`, `smart-order-execution.service`, `position-exiting.service`, and `position-lifecycle.service`; no small safe production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts` -> PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts` -> PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Treat the old `ReturnType<typeof createManaged...>` candidate list as closed: the direct `rg` scan for that pattern in `packages/core/src/__tests__/services` is now empty.
- If more lifecycle/testability cleanup is needed, re-scan for broader leftovers only: direct exported `Managed*Context` ownership, duplicated inline harness option objects, helper-owned accessor wrappers, or adjacent `any` cleanup that is exposed by those suites.
- Prefer a fresh, smaller candidate batch rather than reopening the now-cleared `strategy-loader` / `smart-order-placement` / `position-scaling` / `position-state-machine` / `position-exiting` / `position-lifecycle` clusters unless a new concrete regression is found.
