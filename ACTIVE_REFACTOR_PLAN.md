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
- 2026-06-03: completed `packages/web-server/src/routes/analytics.routes.ts analytics route runtime adapter boundary follow-up`.
- 2026-06-03: completed `packages/web-server/src/routes/route-response.ts web server shared route response runtime boundary follow-up`.
- 2026-06-03: completed `packages/web-server/src/routes/analytics.constants.ts analytics route runtime constants boundary follow-up`.
- `analytics.routes.ts` now consumes an explicit route dependency bundle split into `journal`, `sessions`, `strategy`, and `curves`, so the HTTP layer no longer depends on one flat file-watcher-shaped read surface.
- `analytics.constants.ts` now owns analytics route paging, recent-window, and fallback-message constants instead of leaving route magic numbers and fallback strings inline.
- `route-response.ts` now builds an explicit route response context before writing success or error envelopes, keeping request-id normalization and shared route execution behavior on one runtime seam.
- `route-response.test.ts` now guards the shared response helper directly, while `web-server.functional.test.ts` proves the analytics route bundle stays on the narrowed delegates.

## Latest Verification
- 2026-06-03: `npm test -- --runInBand packages/web-server/tests/route-response.test.ts` (1 suite, 4 tests)
- 2026-06-03: `npm test -- --runInBand packages/web-server/tests/web-server.functional.test.ts` (1 suite, 53 tests)
- 2026-06-03: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-03: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/swagger.config.ts web server OpenAPI contract surface boundary follow-up`.
- Keep the next batch on the web-server runtime/error boundary stream before returning to the remaining core docs guardrail items.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
