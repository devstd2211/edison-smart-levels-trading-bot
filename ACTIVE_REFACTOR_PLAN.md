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
- 2026-06-04: completed `packages/web-server/src/services/config-management.service.ts web server config lifecycle boundary follow-up`.
- 2026-06-04: completed `packages/web-server/src/services/file-watcher.service.ts web server analytics watcher runtime boundary follow-up`.
- 2026-06-04: completed `packages/web-server/src/middleware/error-handler.middleware.ts web server structured error middleware boundary follow-up`.
- `config-management.service.ts` now captures one config snapshot per write lifecycle so preview/validation and backup creation stay aligned, and it shares timestamped config-path helpers across write and restore flows.
- `file-watcher.service.ts` now resolves debounced change handlers from the configured watcher target names instead of hard-coded filenames, so custom journal/session paths use the same realtime boundary safely.
- `error-handler.middleware.ts` now yields to downstream Express error handling after `headersSent` while preserving the same structured error log and response path when the middleware still owns the response.
- `config-management.service.test.ts`, `file-watcher.service.test.ts`, `error-handler.middleware.test.ts`, `web-server.functional.test.ts`, and `ws-server.functional.test.ts` now guard the new lifecycle and ownership boundaries directly.

## Latest Verification
- 2026-06-04: `npm --prefix packages/web-server run test -- --runInBand tests/web-server.functional.test.ts tests/ws-server.functional.test.ts tests/error-handler.middleware.test.ts tests/config-management.service.test.ts tests/file-watcher.service.test.ts` (5 suites, 80 tests)
- 2026-06-04: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-04: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with the structured error and shared logging stream in `packages/web-server`.
- Keep the next batch on the web-server runtime/error/OpenAPI boundary before returning to the remaining core docs guardrail items.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
