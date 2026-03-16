# Active Refactor Plan

This file is the active source of truth for open refactor tasks only.
Completed history is intentionally removed from this file and kept in `REFACTOR_PLAN.md`.

## Open Tasks Migrated (2026-03-09)
- [ ] Move optional services behind feature toggles with explicit "capability" interfaces.
- [ ] Update tests to build only the required groups (no global container).
- [ ] Core any cleanup (phase 3: src).
- [ ] Update tests to use `createServices()` + explicit `start/stop`.

## Current Execution Focus
- [ ] Continue `Update tests to use createServices() + explicit start/stop` in lifecycle-adjacent suites.
- [ ] Continue `Update tests to build only the required groups (no global container)` in bot/lifecycle-focused tests.

## Immediate Next Candidates
- [ ] Extend explicit lifecycle teardown coverage beyond `bot-factory` / `trading-bot` suites into the next lifecycle-adjacent test slices.
- [ ] Continue replacing broad service-state construction in tests with the minimal required grouped services or tracked `createServices()` state.
- [ ] Continue the compact harness stream with the next untouched constructor-heavy unit/error-handling suites adjacent to the recently refreshed helpers.

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
- Main remaining stream is lifecycle/testability work around explicit `createServices()` state, teardown coverage, and minimal grouped service construction in tests.
- Compact service-by-service harness cleanup is still active, but most low-risk constructor-heavy suites have already been refreshed; prefer only adjacent untouched suites now.
- Exchange-adapter cleanup should stay deprioritized unless a testability slice directly exposes a safe follow-up.
