# Active Refactor Plan

This file is the active source of truth for current refactor work only.
Historical detail is archived elsewhere and should not be copied here.

## Refactor Mode
- Component-first refactor only.
- No standalone test-cleanup passes.
- For each component: refactor production code, immediately refactor its tests, and add a functional test if one is missing.

## Source Files
- Active workflow and current status: `ACTIVE_REFACTOR_PLAN.md`
- Component checklist: `REFACTOR_COMPONENT_CHECKLIST.md`
- Task catalog/backlog by area: `REFACTOR_TASKS.md`
- Frozen archive: `REFACTOR_PLAN_01.md`

## Open Streams
- [ ] Create and maintain a finite component checklist instead of open-ended test cleanup.
- [ ] Refactor components one by one in a behavior-preserving way.
- [ ] Keep test updates coupled to the component being refactored.
- [ ] Add missing functional coverage only for the component currently in scope.

## Current Focus
- [ ] Use `REFACTOR_COMPONENT_CHECKLIST.md` as the only queue for component-level refactor progress.
- [ ] Each completed slice must satisfy all three conditions:
  1. production component refactored
  2. related tests refactored/aligned
  3. functional test exists for that component, or a new one was added in the same slice

## Working Rules
1. Pick the next unchecked component from `REFACTOR_COMPONENT_CHECKLIST.md`.
2. Refactor the production component first.
3. Immediately refactor only that component's related tests.
4. If no functional test exists for that component, add one in the same slice.
5. Run targeted tests for the changed component area.
6. Run `npm run build`.
7. Update `REFACTOR_COMPONENT_CHECKLIST.md`:
   - mark the component complete when all conditions are met
   - move completed items into the history section so the active list shrinks over time
8. Update this file with only the latest completed slice and latest verification.
9. Do not run separate test-only cleanup campaigns.

## Latest Completed
- 2026-06-04: completed `packages/web-server/tests/config-management.service.test.ts web server config lifecycle guardrail follow-up`.
- 2026-06-04: completed `packages/web-server/tests/file-watcher.service.test.ts web server analytics watcher runtime guardrail follow-up`.
- 2026-06-04: completed `packages/core/src/__tests__/web/web-boundary.test.ts web server adapter contract guardrail follow-up`.
- `config-management.service.ts` now allocates unique timestamped backup and pre-restore paths so rapid same-timestamp writes preserve distinct lifecycle snapshots.
- `file-watcher.service.ts` now debounces journal and session changes independently so one runtime target cannot cancel the other target's pending update.
- `web-entrypoint-runtime.ts` now preserves `EventEmitter` boolean emit semantics, and `BotRuntimeEventBusLike` advertises that same contract at the web boundary.

## Latest Verification
- 2026-06-04: `npm --prefix packages/web-server run test -- --runInBand tests/config-management.service.test.ts tests/file-watcher.service.test.ts` (2 suites, 4 tests)
- 2026-06-04: `npm test -- --runInBand packages/core/src/__tests__/web/web-boundary.test.ts` (1 suite, 9 tests)
- 2026-06-04: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-04: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/tests/request-scoped-error-log.test.ts`, `packages/web-server/tests/swagger-contract-helpers.test.ts`, and `packages/web-server/src/swagger.config.ts`.
- Keep the next batch on the remaining web-server config/OpenAPI/runtime boundary stream before returning to the broader core entrypoint handoff follow-ups.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
