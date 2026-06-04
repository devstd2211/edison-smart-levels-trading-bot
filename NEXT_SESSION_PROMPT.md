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
1. `packages/web-server/src/index.ts web server docs helper delegate boundary follow-up`
2. `packages/web-server/tests/web-server.functional.test.ts web server runtime docs and logging guardrail follow-up`
3. `packages/web-server/tests/ws-server.functional.test.ts websocket realtime delegation guardrail follow-up`

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
- 2026-06-04: completed `packages/web-server/src/errors/api-error-response.ts web server structured error contract boundary follow-up`.
- 2026-06-04: completed `packages/web-server/src/logging/request-scoped-error-log.ts web server request-scoped logging contract boundary follow-up`.
- 2026-06-04: completed `packages/web-server/src/swagger-contract-helpers.ts web server OpenAPI shared builder boundary follow-up`.
- `api-error-response.ts` now exports one shared structured error context so route responses and request-scoped logs share the same normalized status/detail/request-id ownership boundary.
- `request-scoped-error-log.ts` now funnels event-scoped websocket/file-watcher/config error payloads through one helper instead of repeating per-surface assembly.
- `swagger-contract-helpers.ts` now owns reusable success-with-example and multi-status error response builders, and `swagger.config.ts` has started consuming those shared contracts directly.

## Last Verification
- `npm --prefix packages/web-server run test -- --runInBand tests/api-error-response.test.ts tests/request-scoped-error-log.test.ts tests/swagger-contract-helpers.test.ts tests/request-logging.middleware.test.ts tests/error-handler.middleware.test.ts tests/ws-server.functional.test.ts tests/web-server.functional.test.ts`
- `npm test -- --runInBand position-monitor`
- `npm run build`
