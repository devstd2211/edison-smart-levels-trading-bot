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
- 2026-06-01: completed the `event-handlers.error-handling` slice together with `event-handlers.test.ts` and `helpers/event-handlers-test.utils.ts`.
- 2026-06-01: completed the `bot-initializer.error-handling` slice by routing the initializer through grouped live collaborators and extending functional guardrails around exchange handoff.
- 2026-06-01: completed the `websocket-authentication.service.ts` slice together with the related collaborator and error-handling guardrail suites.
- `websocket-authentication.service.ts` now accepts explicit auth collaborators for time and signature generation, so crypto-failure and deterministic-payload behavior are exercised through a narrow runtime seam instead of module-mocking after import.
- `bot-initializer.ts` now reads grouped collaborators rather than scattering direct access across the full initializer service bundle, while preserving live exchange-factory/runtime handoff semantics.
- Event-handler boundary tests now build from shared full-contract mock factories, so the common fixture owns the runtime mock surface that both guardrail suites actually exercise.

## Latest Verification
- 2026-06-01: `npm test -- --runInBand packages/core/src/__tests__/event-handlers.test.ts packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer-error.utils.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts` (7 suites, 129 tests)
- 2026-06-01: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-01: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/bot-initializer/bot-initializer-error.utils.ts initializer runtime error utility boundary follow-up`.
- Keep the next batch on the initializer and event-handler container/fixture stream.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
