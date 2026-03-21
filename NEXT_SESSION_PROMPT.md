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
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.

## Working Order Per Session
1. Pick next target from `ACTIVE_REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `ACTIVE_REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-21)
- Completed a three-slice websocket helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/websocket-authentication-test.utils.ts` with a shared standard-service path and canonical valid credentials defaults, then routed `websocket-authentication.service.test.ts` through those helpers instead of ad-hoc `harness.createService()` and short inline auth fixtures.
  - routed `packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts` through the shared credentials builders instead of repeated inline key/secret literals and repeated local valid-credential bootstrap.
  - extended `packages/core/src/__tests__/helpers/public-websocket-test.utils.ts` with a shared standard-service path and routed `public-websocket.error-handling.test.ts` through it instead of repeated `createStandardPublicWebSocketService(...)` blocks.
  - reviewed `services/websocket-authentication.service.ts` and `services/public-websocket.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/websocket-authentication.service.test.ts` -> PASS (1/1 suite, 12/12 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts` -> PASS (1/1 suite, 31/31 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/public-websocket.error-handling.test.ts` -> PASS (1/1 suite, 24/24 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next adjacent partially-normalized lifecycle/stateful slice around neighboring websocket/observability suites such as `websocket-authentication` follow-ups, `event-deduplication`, `orderbook-manager`, or other helper-light bootstrap near the refreshed public-websocket cluster.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
