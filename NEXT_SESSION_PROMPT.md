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
1. ✅ Read `ACTIVE_REFACTOR_PLAN.md` for context.
2. ✅ Read `REFACTOR_COMPONENT_CHECKLIST.md` to check queue status.
3. ✅ **If checklist is empty:** Auto-populate 3-5 components from `REFACTOR_TASKS.md` section A) DI + Containers (prioritize interfaces/containers over implementations).
4. ✅ Verify `npm run build` passes before starting.
5. ✅ Verify `npm test -- --runInBand position-monitor` (smoke test) passes in < 30s.
6. ✅ Check if `docs/architecture/dependency-map.md` exists; if missing and >20 components completed, create it.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Use `REFACTOR_COMPONENT_CHECKLIST.md` as the finite queue of components being refactored.
3. **Auto-populate checklist:** If active queue is empty, promote 3-5 next components from `REFACTOR_TASKS.md` automatically (no user confirmation needed).
4. Never do standalone test-cleanup passes.
5. For each chosen component, refactor production code first, then refactor related tests in the same slice.
6. If the component has no functional test, add one in the same slice before marking it complete.
7. Move completed components into the history section of `REFACTOR_COMPONENT_CHECKLIST.md` so the active list shrinks over time.
8. Keep this file short: refresh only `Last Completed` and `Next Step`.
9. Keep user-facing replies short by default unless the user explicitly asks for more detail.
10. Do not maintain a running historical journal here.

## Working Order Per Session
1. **Run Session Start Checklist** (see above).
2. Pick the next unchecked component from active queue.
3. Refactor the production component (target: < 150 lines changed).
4. Refactor that component's related tests.
5. Add a functional test if missing.
6. **Run TARGETED tests only** (not full suite):
   - `npm test -- --runInBand --runTestsByPath <relevant-test-files>`
   - Full suite (7k+ tests) should only run in CI, not locally.
7. Run `npm run build`.
8. Update only the concise handoff below, the active plan, and the component checklist.
9. **If >5 new adapter interfaces created in session:** Update `docs/architecture/dependency-map.md` to prevent adapter proliferation.

## Productivity Targets (100/100 Score)
- **Speed:** 1-3 components per session (aim for 2).
- **Size:** < 150 lines changed per component (avg 70-100 is ideal).
- **Tests:** Targeted runs < 30s; avoid full suite runs.
- **Commits:** 1 commit per component (atomic, behavior-preserving).
- **Documentation:** Update dependency map every 10 components or when adding 5+ new interfaces.
- **Checklist:** Never start with empty queue; auto-populate immediately.

## Quick Win Detection
- **Prefer these tasks first** (high value, low effort):
  - Extracting grouped service inputs/builders (< 100 lines, clear boundaries).
  - Narrowing adapter contracts (Pick<T, K> type aliases, < 50 lines).
  - Adding missing functional tests to already-refactored components.
- **Defer these tasks** (complex, high risk):
  - Multi-file orchestrator rewrites.
  - Behavioral changes to core trading logic.
  - Large-scale package migrations.

## Last Completed (2026-05-03)
- Completed the `WebSocketEventHandler runtime boundary narrowing` slice across five linked tasks.
- Split the manager-facing runtime contract into explicit market-data and execution subsets so the adapter no longer passes unused `bybitService`, `positionExitingService`, or `orderStateMachine` references into `WebSocketEventHandlerManager`.
- Added dedicated functional coverage that registers real grouped listeners through the narrowed runtime adapter and verifies cleanup detaches them correctly.
- Verification:
  - `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-services-adapter.functional.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts`
  - `npm run build`

## Next Step
- Refill `REFACTOR_COMPONENT_CHECKLIST.md` from `REFACTOR_TASKS.md` before editing code again.
- Prefer the next component to narrow the remaining mutable initializer touchpoints around exchange/BTC runtime state, or promote the next DI boundary from section `A)` where grouped callers still depend on wide grouped-service contracts.

## Session End Checklist (Run BEFORE commit)
1. ✅ **Targeted tests pass** (< 30s runtime preferred).
2. ✅ **Build passes:** `npm run build`.
3. ✅ **Smoke test passes:** Bot starts and runs one cycle without crashes.
4. ✅ **Updated docs:**
   - `ACTIVE_REFACTOR_PLAN.md` refreshed with latest slice.
   - `REFACTOR_COMPONENT_CHECKLIST.md` component marked complete and moved to history.
   - `docs/architecture/dependency-map.md` updated if 5+ new interfaces added.
5. ✅ **Commit hygiene:**
   - Atomic commit (one component per commit).
   - Clear message: `refactor(core): <component-name> <what-narrowed>`.
   - No API keys, secrets, or credentials.
   - No `console.log` spam, TODO hacks, or commented-out code.
6. ✅ **Auto-populate next batch** if checklist is now empty.

## Additional Review Notes

### Safety & Behavior Preservation
- Do not over-engineer. The goal is not to make the bot perfect, only to ensure this patch is safe.
- Verify weighted aggregation is used in the live entry path, but original signal/voting logic is not silently bypassed.
- Verify `aggregationContext.originalSignals` is not persisted into pending decisions, snapshots, journal, or trade metadata.
- Verify blind-zone logic does not accidentally block all valid trades when `signalCount` metadata is missing.
- Verify the degradation guard is not too aggressive:
  - it should block after real loss patterns
  - it must auto-expire
  - it must not permanently block trading
- `recentCloseState` and degradation state are in-memory and acceptable for current single-symbol / single-position mode. Do not redesign this into a multi-symbol state system now.

### Adapter Proliferation Prevention
- **Before creating new adapter interface:** Check if existing interface can be reused or extended.
- **Naming convention:** `I<Component><Purpose>Services` (e.g., `IWebSocketEventHandlerExecutionServices`).
- **Size limit:** Keep adapter interfaces < 10 methods; split if larger.
- **Update dependency map** when adding 5+ new interfaces to visualize relationships.

### Test Optimization
- **NEVER run full suite locally** (7k+ tests = slow feedback loop).
- **Use targeted runs:**
  ```bash
  npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/<component>.test.ts
  ```
- **Functional tests should be < 100 lines** and test one clear boundary.
- **Prefer integration tests over unit tests** for adapter boundaries.

### Code Quality Gates
- If tests fail, fix only the minimal issue required. Do not refactor unrelated code.
- Keep patches small: < 150 lines changed per component (avg 70-100 ideal).
- Final goal: build passes, tests pass, startup smoke check passes, and the patch remains small and understandable.
