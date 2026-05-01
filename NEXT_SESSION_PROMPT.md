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
- Completed the `OrderExecutionDetectorService` component slice.
- Refactored the service to route execution-type detection, state transitions, numeric parsing, result shaping, and debug context through `packages/core/src/services/order-execution-detector/order-execution-detector-state.utils.ts`.
- Added focused helper coverage and new functional coverage for the TP -> TP -> trailing-stop -> entry flow, and aligned the existing unit/error-handling suites with the helper-oriented structure.
- Verification:
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/order-execution-detector-state.utils.test.ts packages/core/src/__tests__/services/order-execution-detector.functional.test.ts packages/core/src/__tests__/services/order-execution-detector.service.test.ts packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts`
  - `npm run build`

## Next Step
- Refill `REFACTOR_COMPONENT_CHECKLIST.md` from the remaining backlog before starting the next component slice.
- Do not start the next slice until the new component is added to the finite checklist with production, test, and functional coverage expectations.
