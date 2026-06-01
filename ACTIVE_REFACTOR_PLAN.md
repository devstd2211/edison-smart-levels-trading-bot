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
- 2026-06-01: completed `packages/core/src/services/bot-initializer/bot-initializer-shutdown.utils.ts initializer runtime shutdown utility boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/services/bot-initializer-shutdown.utils.test.ts initializer runtime shutdown utility guardrail follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/helpers/websocket-authentication-test.utils.ts websocket authentication runtime fixture boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/bot-initializer.test.ts initializer runtime collaborator guardrail follow-up`.
- `bot-initializer-shutdown.utils.ts` now owns the shared skip-shutdown sequence runner, so the initializer shutdown path executes one ordered contract instead of scattering independent skip wrappers across the consumer.
- `bot-initializer-shutdown.utils.test.ts` and `bot-initializer.error-handling.test.ts` now lock the continue-on-failure shutdown sequence, including listener-cleanup failures that must not block later session and Telegram teardown steps.
- `websocket-authentication-test.utils.ts` now resolves harness defaults through a single shared state, so collaborators, logger defaults, and error-handler mode stay aligned across the initial service and every follow-up factory-created instance.
- `bot-initializer.test.ts` remains covered as the direct shutdown collaborator guardrail consumer for the merged initializer slice, while the broader targeted test pass confirms the refactor stayed behavior-preserving.

## Latest Verification
- 2026-06-01: `npm test -- --runInBand packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer-shutdown.utils.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts` (6 suites, 93 tests)
- 2026-06-01: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-01: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/bot-initializer/bot-initializer-periodic.utils.ts initializer runtime periodic utility boundary follow-up`.
- Keep the next batch on the initializer periodic/lifecycle and websocket manager fixture stream.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
