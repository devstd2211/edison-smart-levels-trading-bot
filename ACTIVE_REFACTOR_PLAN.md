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
- 2026-06-04: completed `packages/web-server/tests/request-logging.middleware.test.ts web server runtime logging guardrail follow-up`.
- 2026-06-04: completed `packages/web-server/tests/error-handler.middleware.test.ts web server structured error middleware guardrail follow-up`.
- 2026-06-04: completed `packages/web-server/tests/api-error-response.test.ts web server structured error contract guardrail follow-up`.
- `request-logging.middleware.ts` now builds finish/error log labels and payloads through explicit shared result helpers instead of recomputing runtime logging state inline.
- `error-handler.middleware.ts` now derives status code, structured response body, and log payload from one shared middleware result helper so response/log parity stays on one code path.
- `api-error-response.ts` now exposes one shared structured error response builder that route and middleware consumers can reuse without duplicating context-to-response assembly.

## Latest Verification
- 2026-06-04: `npm --prefix packages/web-server run test -- --runInBand tests/request-logging.middleware.test.ts tests/error-handler.middleware.test.ts tests/api-error-response.test.ts` (3 suites, 34 tests)
- 2026-06-04: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-04: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/tests/config-management.service.test.ts`, `packages/web-server/tests/file-watcher.service.test.ts`, and `packages/core/src/__tests__/web/web-boundary.test.ts`.
- Keep the next batch on the remaining config/runtime web-server boundary stream before resuming the broader core entrypoint handoff follow-ups.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
