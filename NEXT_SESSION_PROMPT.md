# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Branch Rules
- Always work directly in local `main`.
- Do not create or use worktrees.
- If the current branch is not `main`, switch or merge back into `main` before continuing refactor work.

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

## Last Completed (2026-05-26)
- Completed ten config-loader seam / compatibility-wrapper boundary follow-up tasks:
  - `packages/core/src/core/core-entrypoint-runtime.ts config-loader seam wording follow-up`
  - `packages/core/src/config/index.ts public loader-surface wording follow-up`
  - `packages/core/src/legacy-entrypoint-runtime.ts compatibility wrapper export-surface wording follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts compatibility-wrapper loader-seam wording guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts core/web export-list parity smoke follow-up`
  - `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts configured helper loader-seam guardrail follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts wrapper/core export-separation guardrail follow-up`
  - `packages/core/src/__tests__/web/web-boundary.test.ts explicit runtime-pair constructor guardrail follow-up`
  - `packages/core/src/web/index.ts runtime-pair starter wording parity follow-up`
  - `README.md legacy-root vs programmatic helper example split follow-up`
- Tightened the entrypoint boundary wording:
  - `core-entrypoint-runtime.ts` now calls out `loadBotRuntimeConfig(loader?)` as the shared public config-loader seam for configured helpers, and `config/index.ts` now frames the publishable ConfigPipeline loader/runtime helpers as one public barrel.
  - `legacy-entrypoint-runtime.ts` and its guardrails now pin the legacy root as a compatibility wrapper whose export surface stops at runtime helpers plus the CLI handoff instead of widening into the web entrypoint surface.
  - `web/index.ts`, `README.md`, and `ARCHITECTURE_QUICK_START.md` now use the same two-step runtime-pair wording: build the pair first, then pass it to `startWebServer(runtime, ports)`.
- Verification:
  - `npm --prefix packages/core test -- --runInBand architecture-entrypoint-boundary core-entrypoint legacy-entrypoint readme-entrypoint-boundary web-boundary`
  - `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports|workspace packages expose stable export maps instead of source-path entrypoints|root workspace scripts delegate build and test flows through package-level entrypoints in dependency order"`
  - `npm test -- --runInBand position-monitor`
  - `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/index.ts legacy wrapper compatibility wording parity follow-up`.
- Keep the same boundary rule and work through these next queued tasks one component at a time before widening scope again:
  - `packages/core/src/index.ts legacy wrapper compatibility wording parity follow-up`
  - `ARCHITECTURE_QUICK_START.md compatibility-wrapper example wording parity follow-up`
  - `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts runtime-pair starter wording parity guardrail follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts compatibility-wrapper example split guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts public config barrel wording smoke follow-up`

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
