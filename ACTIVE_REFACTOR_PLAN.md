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
- 2026-06-03: completed `packages/web-server/src/swagger.config.ts web server OpenAPI contract surface boundary follow-up`.
- 2026-06-03: completed `packages/web-server/src/runtime-discovery-guidance.ts web server runtime discovery guidance boundary follow-up`.
- 2026-06-03: completed `packages/web-server/src/middleware/request-logging.middleware.ts web server runtime logging boundary follow-up`.
- `runtime-discovery-guidance.ts` now owns the runtime discovery paragraphs, OpenAPI description assembly, server description copy, and shared docs HTML section so the docs and OpenAPI layers consume one runtime-copy boundary.
- `request-logging.middleware.ts` now resolves logging config once and delegates finish/error lifecycle logging through focused helpers while still emitting the same shared HTTP log payloads.
- `swagger.config.ts` now relies on `swagger-contract-helpers.ts` for shared schema, request-body, and envelope builders so the file stays focused on the exported OpenAPI contract surface.
- `request-logging.middleware.test.ts` now guards config normalization directly, and `web-server.functional.test.ts` continues to prove the runtime discovery and OpenAPI surfaces stay behaviorally stable.

## Latest Verification
- 2026-06-03: `npm test -- --runInBand packages/web-server/tests/request-logging.middleware.test.ts` (1 suite, 8 tests)
- 2026-06-03: `npm test -- --runInBand packages/web-server/tests/web-server.functional.test.ts` (1 suite, 53 tests)
- 2026-06-03: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-03: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/services/config-management.service.ts web server config lifecycle boundary follow-up`.
- Keep the next batch on the web-server runtime/error boundary stream before returning to the remaining core docs guardrail items.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
