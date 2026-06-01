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
- 2026-06-01: completed `packages/core/src/services/handlers/websocket.handler.ts websocket event handler runtime collaborator boundary follow-up`.
- 2026-06-01: completed `packages/core/src/services/handlers/position.handler.ts position event handler runtime collaborator boundary follow-up`.
- 2026-06-01: completed `packages/core/src/services/handlers/websocket-event-decoding.utils.ts websocket event decoding runtime boundary follow-up`.
- `websocket.handler.ts` and `position.handler.ts` now construct through explicit named dependency bundles instead of fragile positional collaborator arguments, while preserving existing runtime behavior.
- `websocket-event-decoding.utils.ts` now owns explicit TP fallback helpers for first-unhit level selection and TP exit-type mapping, and the handlers consume the shared decoding seam instead of duplicating fallback logic.
- Related tests now cover the new dependency-object seams and the decoded TP helper contract directly.

## Latest Verification
- 2026-06-01: `npm test -- --runInBand packages/core/src/__tests__/services/websocket-event-decoding.utils.test.ts packages/core/src/__tests__/services/websocket.handler.boundary.test.ts packages/core/src/__tests__/services/position.handler.boundary.test.ts packages/core/src/__tests__/event-handlers.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts` (6 suites, 64 tests)
- 2026-06-01: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-01: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/services/event-handlers.error-handling.test.ts orchestrator event handlers runtime error guardrail follow-up`.
- Keep the next batch on the initializer and websocket authentication stream after the event-handler error slice.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
