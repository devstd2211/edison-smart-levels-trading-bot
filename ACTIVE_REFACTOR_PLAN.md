# Active Refactor Plan

This file is the active source of truth for open refactor tasks only.
Completed history belongs in `REFACTOR_PLAN.md`, not here.

## Open Streams
- [ ] Move optional services behind feature toggles with explicit capability interfaces.
- [ ] Update tests to build only the required groups instead of a broad/global container.
- [ ] Core `any` cleanup in remaining `src` boundaries discovered during adjacent refactors.
- [ ] Continue updating tests to use explicit lifecycle control via `createServices()` + `start/stop`.

## Current Execution Focus
- [ ] Continue lifecycle/testability cleanup in services-adjacent suites that still create throwaway managed contexts or suite-local service instances outside helper-owned cleanup.
- [ ] Continue replacing broad service-state construction in tests with minimal grouped services or tracked helper-managed state.

## Immediate Next Candidates
- [ ] Finish the remaining helper-owned factory/cleanup follow-ups in error-handling suites that still instantiate temporary managed contexts inline.
- [ ] Continue explicit lifecycle teardown coverage beyond the refreshed bot-factory, trading-bot, and grouped lifecycle slices.
- [ ] Keep converting tests away from global container ownership toward minimal grouped service construction.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Record completed batch history in `REFACTOR_PLAN.md`; keep this file limited to active status and a short handoff.
6. Keep `NEXT_SESSION_PROMPT.md` short: `Last Completed` + `Next Step`.

## Active Notes
- Latest completed slice (2026-03-27): completed a token-reduction + lifecycle/testability follow-up for `ACTIVE_REFACTOR_PLAN.md`, `NEXT_SESSION_PROMPT.md`, `position-state-machine.error-handling`, `event-deduplication.error-handling`, `timeframe-weighting.error-handling`, `anomaly-detection.error-handling`, `websocket-authentication.error-handling`, `indicator-cache.error-handling`, and `position-state-machine-test.utils` by shrinking the active handoff back to open-work-only and routing the touched suites away from throwaway managed-context creation toward the primary suite-owned context or simple direct factories.
- Latest verification (2026-03-27): `npm test -- --runInBand packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/event-deduplication.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts` PASS; `npm run build` PASS.
- Current target batch: continue the same cleanup pattern in the remaining error-handling suites that still create temporary managed contexts or bound service instances outside the primary suite-owned cleanup path.

## Guardrails
- `types/*` cleanup is complete; reopen only if an adjacent service refactor requires a compatibility follow-up.
- Non-`services` / non-`types` phase-3 cleanup is complete for previously targeted boundaries; reopen only when an adjacent refactor exposes a mixed-boundary issue.
- Main remaining stream is lifecycle/testability work around explicit `createServices()` state, teardown ownership, and minimal grouped service construction in tests.
- Exchange-adapter cleanup stays deprioritized unless a current testability slice exposes a low-risk adjacent follow-up.
