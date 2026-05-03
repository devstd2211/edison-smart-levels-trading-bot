# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Work component-first: refactor one production component, immediately align its tests, and add a functional test if missing.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Component queue/progress: `REFACTOR_COMPONENT_CHECKLIST.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Use `REFACTOR_COMPONENT_CHECKLIST.md` as the finite queue of components being refactored.
3. Never do standalone test-cleanup passes.
4. For each chosen component, refactor production code first, then refactor related tests in the same slice.
5. If the component has no functional test, add one in the same slice before marking it complete.
6. Move completed components into the history section of `REFACTOR_COMPONENT_CHECKLIST.md` so the active list shrinks over time.
7. Keep this file short: refresh only `Last Completed` and `Next Step`.
8. Keep user-facing replies short by default unless the user explicitly asks for more detail.
9. Do not maintain a running historical journal here.

## Working Order Per Session
1. Read `ACTIVE_REFACTOR_PLAN.md`.
2. Read `REFACTOR_COMPONENT_CHECKLIST.md`.
3. Pick the next unchecked component.
4. Refactor the production component.
5. Refactor that component's related tests.
6. Add a functional test if missing.
7. Run targeted tests for the changed area.
8. Run `npm run build`.
9. Update only the concise handoff below, the active plan, and the component checklist.

## Last Completed (2026-05-03)
- Completed the `TradingBot runtime dependency boundary` slice across five linked tasks.
- Replaced the `TradingBot` constructor's merged bundle dependency with an explicit runtime dependency contract that separates bot, initializer, and websocket-handler inputs while keeping each consumer on its own narrow grouped interface.
- Reworked the adapter/runtime factory path to build those separated dependencies directly, narrowed `createWebApiAdapter()` to the read-only web API contract, and aligned functional/lifecycle coverage to prove all runtime consumers still reuse the same grouped services.
- Verification:
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-services-adapter.functional.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/web/web-boundary.test.ts`
  - `npm run build`

## Next Step
- Refill `REFACTOR_COMPONENT_CHECKLIST.md` from `REFACTOR_TASKS.md` before editing code again; the next queue should continue the caller-migration stream after `TradingBot` rather than reopening grouped builder extraction.
- Prefer the next component to narrow `BotWebAPI`/web boundary consumers or another nearest caller of grouped services one interface at a time, keeping the slice local to read-only adapter paths.

## Additional Review Notes
- Do not over-engineer. The goal is not to make the bot perfect, only to ensure this patch is safe.
- Additionally verify that the bot still starts and can run one normal cycle without crashing.
- Verify weighted aggregation is used in the live entry path, but original signal/voting logic is not silently bypassed.
- Verify `aggregationContext.originalSignals` is not persisted into pending decisions, snapshots, journal, or trade metadata.
- Verify blind-zone logic does not accidentally block all valid trades when `signalCount` metadata is missing.
- Verify the degradation guard is not too aggressive:
  - it should block after real loss patterns
  - it must auto-expire
  - it must not permanently block trading
- `recentCloseState` and degradation state are in-memory and acceptable for current single-symbol / single-position mode. Do not redesign this into a multi-symbol state system now.
- Verify no API keys, secrets, or demo credentials are committed.
- Verify no temporary debug junk, `console.log` spam, TODO hacks, or test-only code remains.
- If tests fail, fix only the minimal issue required. Do not refactor unrelated code.
- Final goal: build passes, tests pass, startup smoke check passes, and the patch remains small and understandable.
