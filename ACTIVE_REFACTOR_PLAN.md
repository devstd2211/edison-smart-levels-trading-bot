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
- 2026-06-04: completed `packages/web-server/src/errors/api-error-response.ts web server structured error contract boundary follow-up`.
- 2026-06-04: completed `packages/web-server/src/logging/request-scoped-error-log.ts web server request-scoped logging contract boundary follow-up`.
- 2026-06-04: completed `packages/web-server/src/swagger-contract-helpers.ts web server OpenAPI shared builder boundary follow-up`.
- `api-error-response.ts` now exports one shared structured error context so route responses and request-scoped logs consume the same normalized status/detail/request-id contract.
- `request-scoped-error-log.ts` now builds event-scoped error payloads through a single helper, so websocket, file-watcher, and config lifecycle logs share one ownership boundary for normalized error metadata.
- `swagger-contract-helpers.ts` now owns reusable success-with-example and multi-status error response builders, reducing duplicated OpenAPI response assembly inside `swagger.config.ts`.
- `api-error-response.test.ts`, `request-scoped-error-log.test.ts`, `swagger-contract-helpers.test.ts`, `request-logging.middleware.test.ts`, `error-handler.middleware.test.ts`, `web-server.functional.test.ts`, and `ws-server.functional.test.ts` now guard the shared context and helper contracts directly.

## Latest Verification
- 2026-06-04: `npm --prefix packages/web-server run test -- --runInBand tests/api-error-response.test.ts tests/request-scoped-error-log.test.ts tests/swagger-contract-helpers.test.ts tests/request-logging.middleware.test.ts tests/error-handler.middleware.test.ts tests/ws-server.functional.test.ts tests/web-server.functional.test.ts` (7 suites, 109 tests)
- 2026-06-04: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-04: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/index.ts` and its paired runtime/docs guardrails before returning to the remaining core web/docs boundary tests.
- Keep the next batch on the web-server docs/runtime/realtime boundary and only then resume the remaining core entrypoint guardrail stream.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
