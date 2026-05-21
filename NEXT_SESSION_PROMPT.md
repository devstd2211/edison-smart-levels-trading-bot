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

## Last Completed (2026-05-21)
- Completed five managed tracked-services explicit naming/helper tasks:
  - `managed tracked-services runtime config fixture explicit naming follow-up in create-trading-bot-runtime factory boundary suite`
  - `managed tracked-services legacy entrypoint runtime fixture explicit naming follow-up in legacy entrypoint functional boundary suite`
  - `managed tracked-services shared lifecycle runtime fixture alias retirement follow-up in service-lifecycle helper self-test`
  - `managed tracked-services tracked factory harness default fixture explicit naming follow-up in service-lifecycle helper runtime factory`
  - `managed tracked-services runtime factory harness naming follow-up in web and trading-bot runtime-factory boundary suites`
- Renamed the remaining generic tracked-runtime fixtures to explicit runtime-family names so factory/runtime, legacy-wrapper, and loader-level suites now state whether they depend on runtime-default, candle-enabled, or pre-runtime-default config shapes.
- Renamed the managed runtime-factory harness surface to `createManagedTrackedServicesRuntimeFactory()` and `createRuntimeFactoryHarness()`, then aligned the create-trading-bot-runtime, web-entrypoint, trading-bot lifecycle, config-pipeline, core-entrypoint, CLI, and BotFactory boundary suites to those explicit helper contracts.
- Verification:
  - `npm test -- --runInBand create-trading-bot-runtime legacy-entrypoint service-lifecycle-test.utils bot-factory-runtime-test.utils bot-factory.error-handling core-entrypoint cli-runtime trading-bot.create-services.lifecycle web-entrypoint config-pipeline bot-factory`
  - `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `managed tracked-services runtime-default fixture explicit naming follow-up in bot-factory service boundary suite`.
- Keep the same boundary rule: refactor one production component at a time, align its tests immediately, continue narrowing tracked helper/config fixtures to the exact runtime family under test, and retire the last generic runtime-default helper names in boundary suites before moving to a new helper family.

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
