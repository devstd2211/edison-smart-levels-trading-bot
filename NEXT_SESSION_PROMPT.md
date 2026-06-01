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
1. `packages/core/src/services/bot-initializer/bot-initializer-periodic.utils.ts initializer runtime periodic utility boundary follow-up`
2. `packages/core/src/__tests__/services/bot-initializer-periodic.utils.test.ts initializer runtime periodic utility guardrail follow-up`
3. `packages/core/src/services/bot-initializer/bot-initializer-lifecycle.utils.ts initializer runtime lifecycle utility boundary follow-up`

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
- 2026-06-01: completed `packages/core/src/services/bot-initializer/bot-initializer-shutdown.utils.ts initializer runtime shutdown utility boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/services/bot-initializer-shutdown.utils.test.ts initializer runtime shutdown utility guardrail follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/helpers/websocket-authentication-test.utils.ts websocket authentication runtime fixture boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/bot-initializer.test.ts initializer runtime collaborator guardrail follow-up`.
- `bot-initializer-shutdown.utils.ts` now provides the shared ordered skip-shutdown runner, so `BotInitializer.shutdown()` no longer duplicates per-step SKIP wrappers across lifecycle, listener cleanup, session, and Telegram teardown.
- `bot-initializer-shutdown.utils.test.ts` plus `bot-initializer.error-handling.test.ts` now lock the continue-on-failure shutdown contract, including listener-cleanup failures that must not block later teardown steps.
- `websocket-authentication-test.utils.ts` now preserves harness collaborator defaults across additional factory-created services, which keeps deterministic auth-payload fixtures aligned with the initial managed service.
- `bot-initializer.test.ts` stayed green across the merged initializer guardrail slice while the broader targeted pass confirmed the refactor remained behavior-preserving.

## Last Verification
- `npm test -- --runInBand packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer-shutdown.utils.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts`
- `npm test -- --runInBand position-monitor`
- `npm run build`
