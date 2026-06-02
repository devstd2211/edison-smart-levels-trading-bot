# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

Work directly on local `main`. Do not create worktrees. If the current branch is not
`main`, switch back to `main` before editing.

## Goal
- Continue behavior-preserving refactor in one batch of three large component slices.
- Do not run build or tests at session start.
- Do not spend time reading historical plan files.
- Use this file as the working instruction. Only open other planning docs when this file
  explicitly says to update them or when the active queue needs more tasks.

## Current Batch
Start with these three active queue items:
1. `packages/core/src/services/factories/builders/websocket-manager-service.builder.constants.ts websocket manager runtime builder constants boundary follow-up`
2. `packages/core/src/__tests__/services/websocket-manager-service.builder.functional.test.ts websocket manager runtime builder constants guardrail follow-up`
3. `packages/core/src/services/websocket-manager.service.ts websocket manager runtime reconnect lifecycle boundary follow-up`

If one of these turns out to be too small, merge it with the next adjacent runtime,
initializer, or websocket boundary item from `REFACTOR_COMPONENT_CHECKLIST.md` and keep
the batch at three large component slices.

## Refactor Rules
1. For each slice, inspect only the relevant production file, direct consumers, and related functional/guardrail tests.
2. Refactor production code first, then align the related tests in the same slice.
3. Add a functional test only if the component lacks functional coverage.
4. Do not do naming-only work. A completed slice must narrow a contract, clarify ownership, reduce duplication, make lifecycle safer, or tie tests more directly to behavior.
5. Avoid regex/bulk replacement except as a small mechanical step after understanding the code path.
6. When touching user-facing logs/messages, replace inline emoji with shared `ICONS` from `packages/core/src/cli/cli-runtime.ts`.
7. When touching fallback constants or magic numbers, classify them:
   - static/runtime constant: extract to a constants file
   - strategy/tuning value: move into config

## Queue Rules
- Keep `REFACTOR_COMPONENT_CHECKLIST.md` as the finite active queue.
- Before editing, check only the Active Components section. If it has fewer than 15 large tasks, top it up to 15.
- Prefer adding tasks from the current runtime/initializer/websocket boundary stream. Use `REFACTOR_TASKS.md` only if the next boundary tasks are unclear.
- Completed slices must be moved from Active Components to Completed History with `prod: yes | tests: yes | func: yes`.
- Do not add microtasks, one-line aliases, or naming-only entries.

## Verification And Commit
After all three slices are complete:
1. Run targeted tests for the changed areas.
2. Run the smoke test: `npm test -- --runInBand position-monitor`.
3. Run `npm run build`.
4. Update:
   - `ACTIVE_REFACTOR_PLAN.md` with only the latest completed batch and latest verification.
   - `REFACTOR_COMPONENT_CHECKLIST.md` with completed items moved to history and active queue topped up to 15.
   - `docs/architecture/dependency-map.md` only if canonical runtime contract names changed or more than five adapter interfaces were added.
   - `NEXT_SESSION_PROMPT.md` with the next three concrete active queue items.
5. Commit the batch after tests, smoke, build, and docs updates pass.

## Last Completed
- 2026-06-02: completed `packages/core/src/services/websocket-manager/websocket-position-mapping.utils.ts websocket manager runtime state utility boundary follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager-state.utils.test.ts websocket manager runtime state guardrail follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/helpers/websocket-manager-test.utils.test.ts websocket manager runtime fixture guardrail follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager.service.test.ts websocket manager runtime collaborator guardrail follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts websocket manager runtime error guardrail follow-up`.
- 2026-06-02: completed `packages/core/src/__tests__/services/websocket-manager.functional.test.ts websocket manager runtime functional guardrail follow-up`.
- `websocket-position-mapping.utils.ts` now reads canonical websocket/runtime contracts directly, routes all numeric parsing through one finite-number helper, and owns the entry-price fallback plus default stop-loss snapshot in a single state boundary.
- `websocket-manager-state.utils.test.ts` now proves blank or invalid websocket price fields cannot leak `NaN` into runtime position state and that mapped timestamps stay consistent across the emitted snapshot.
- `websocket-manager-test.utils.test.ts` now proves managed harness factories keep standard and forced-testnet config boundaries separate even when overrides attempt to cross them.
- `websocket-manager.service.ts` now uses a minimal manager socket contract, detaches the active socket before disconnect cleanup, and ignores stale close callbacks from replaced sockets.
- `websocket-manager.service.test.ts` and `websocket-manager.error-handling.test.ts` now prove that disconnect transitions to a detached state before `close()` runs and remains detached when cleanup throws.
- `websocket-manager.functional.test.ts` now proves an auth acknowledgement cannot resubscribe through a detached socket after a failed disconnect cleanup.

## Last Verification
- `npm test -- --runInBand packages/core/src/__tests__/services/websocket-manager-state.utils.test.ts packages/core/src/__tests__/helpers/websocket-manager-test.utils.test.ts packages/core/src/__tests__/services/websocket-manager.functional.test.ts`
- `npm test -- --runInBand position-monitor`
- `npm run build`
