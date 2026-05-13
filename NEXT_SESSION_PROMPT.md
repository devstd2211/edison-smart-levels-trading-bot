# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Work component-first: refactor one production component, immediately align its tests, and add a functional test if missing.
- Target: 1-3 components per session with < 150 lines changed per component.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Component queue/progress: `REFACTOR_COMPONENT_CHECKLIST.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Dependency visualization: `docs/architecture/dependency-map.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Session Start Checklist (Run BEFORE any code changes)
1. [x] Read `ACTIVE_REFACTOR_PLAN.md` for context.
2. [x] Read `REFACTOR_COMPONENT_CHECKLIST.md` to check queue status.
3. [x] If checklist is empty, auto-populate 3-5 components from `REFACTOR_TASKS.md`.
4. [x] Verify `npm run build` passes before starting.
5. [x] Verify `npm test -- --runInBand position-monitor` passes in < 30s.
6. [x] Check if `docs/architecture/dependency-map.md` exists; if missing and >20 components completed, create it.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Use `REFACTOR_COMPONENT_CHECKLIST.md` as the finite queue of components being refactored.
3. Auto-populate the checklist if the active queue becomes empty.
4. Never do standalone test-cleanup passes.
5. For each chosen component, refactor production code first, then refactor related tests in the same slice.
6. If the component has no functional test, add one in the same slice before marking it complete.
7. Move completed components into the history section of `REFACTOR_COMPONENT_CHECKLIST.md` so the active list shrinks over time.
8. Keep this file short: refresh only `Last Completed` and `Next Step`.
9. Keep user-facing replies short by default unless the user explicitly asks for more detail.
10. Do not maintain a running historical journal here.
11. When touching a file during refactor, replace inline emoji in user-facing logs/messages with shared `ICONS` from `packages/core/src/cli/cli-runtime.ts` instead of keeping literal emoji strings.
12. When you encounter fallback constants or magic numbers, identify what kind they are before leaving them in place:
   - static/runtime constant: extract it into an existing or new constants file
   - strategy/tuning value: move it into config instead of hardcoding it

## Working Order Per Session
1. Run the session start checklist.
2. Pick the next unchecked component from the active queue.
3. Refactor the production component.
4. Refactor the related tests.
5. Add a functional test if missing.
6. Run targeted tests only.
7. Run `npm run build`.
8. Update the handoff, the active plan, and the component checklist.
9. If more than 5 new adapter interfaces were created, update `docs/architecture/dependency-map.md`.

## Last Completed (2026-05-13)
- Completed the cleanup slice for `PriceChart position pnl zero-value label guard`, `PriceChart candle volume zero-value tooltip guard`, `LogConsole entry price zero-value event guard`, `LogConsole realized pnl zero-value close-event guard`, and `AdvancedAnalytics closedAt sort zero-value guard`.
- Replaced the affected `PriceChart` and `LogConsole` truthiness fallbacks with explicit numeric reads so flat `0` PnL marker labels, explicit `0` candle volumes, zero entry prices, and zero realized-PnL close events stay visible instead of collapsing into fallback branches.
- Fixed `AdvancedAnalytics` closed-trade timestamp handling so `closedAt = 0` remains in chronological drawdown, monthly-return, and hourly-win-rate calculations instead of being filtered out as falsy.
- Added focused functional coverage for the new `PriceChart` boundaries, the `LogConsole` zero-value event logs, and `AdvancedAnalytics` epoch-timestamp sequencing so those `0` vs `undefined` distinctions stay locked in.
- Verification:
  - `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/price-chart.functional.test.tsx src/__tests__/components/log-console.functional.test.tsx src/__tests__/components/advanced-analytics.functional.test.tsx`
  - `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start the next finite cleanup batch with `PriceChart candle timestamp zero-value filter guard`.
- Then continue with `PriceChart candle open zero-value filter guard`, `PriceChart candle close zero-value filter guard`, `PriceChart entryTime zero-value marker guard`, and `PriceChart exitTime zero-value marker guard`.
- Keep the same rule for boundary fixes: preserve legitimate zero values when chart data or marker timestamps still fall back via truthiness checks, and add or re-run functional coverage in the same slice so each numeric boundary stays locked in.

## Session End Checklist (Run BEFORE commit)
1. [x] Targeted tests pass.
2. [x] Build passes.
3. [x] Smoke test passes.
4. [x] Updated docs:
   - `ACTIVE_REFACTOR_PLAN.md` refreshed with the latest slice.
   - `REFACTOR_COMPONENT_CHECKLIST.md` updated.
   - `docs/architecture/dependency-map.md` updated if needed.
5. [x] Commit hygiene:
   - atomic commit
   - clear message
   - no secrets
   - no hacks or commented-out code
6. [x] Auto-populate the next batch if the checklist is empty.
