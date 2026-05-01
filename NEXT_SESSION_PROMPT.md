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

## Last Completed (2026-05-01)
- Completed the `WebServer` component slice.
- Made `WebServer` startup explicit with `start()` while keeping `startWebServer()` as the auto-start wrapper, and tightened server-owned HTTP shutdown/runtime port tracking.
- Corrected `/api/config/server` to expose actual runtime API/WebSocket ports through the `WebServer` boundary and unref'd the rate-limit cleanup timer so tests and shutdown do not hang.
- Added direct `WebServer` functional coverage for health, OpenAPI docs, runtime port reporting, and read-only market/orderbook routes.
- Verification:
  - `npm test -- --runInBand --detectOpenHandles --runTestsByPath packages/web-server/tests/web-server.functional.test.ts packages/web-server/tests/bot-bridge.service.test.ts packages/web-server/tests/bot-bridge.service.functional.test.ts`
  - `npm run build`

## Next Step
- Pick the next unchecked component from `REFACTOR_COMPONENT_CHECKLIST.md`, with `BotServices adapter boundary` now the remaining active slice to finish narrowing the wider grouped service dependency surface.
- Keep the next slice coupled: production refactor first, then related tests, then add functional coverage if the chosen component still lacks it.
