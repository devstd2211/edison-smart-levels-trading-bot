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
- 2026-06-01: completed `packages/core/src/__tests__/helpers/bot-initializer-test.utils.ts initializer runtime fixture boundary follow-up`.
- 2026-06-01: completed `packages/core/src/services/bot-initializer/bot-initializer-retry.utils.ts initializer runtime retry utility boundary follow-up`.
- 2026-06-01: completed `packages/core/src/__tests__/services/bot-initializer-retry.utils.test.ts initializer runtime retry utility guardrail follow-up`.
- `bot-initializer-test.utils.ts` now resolves mutable test context state through a single builder path and exposes managed-context fields through live getters, so `rebuild()` no longer leaves callers holding stale service, config, error-handler, or initializer snapshots.
- `bot-initializer-retry.utils.ts` now honors `RetryConfig.customBackoff` while keeping the same retry loop and delay cap behavior, which narrows the retry contract to the shared error-handler configuration surface instead of maintaining a forked interpretation.
- `bot-initializer-retry.utils.test.ts` now locks both capped exponential delays and custom-backoff behavior, so future retry-boundary changes have direct guardrails instead of only success-path coverage.

## Latest Verification
- 2026-06-01: `npm test -- --runInBand packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer-retry.utils.test.ts packages/core/src/__tests__/helpers/bot-initializer-test.utils.test.ts` (5 suites, 50 tests)
- 2026-06-01: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-01: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/bot-initializer/bot-initializer-shutdown.utils.ts initializer runtime shutdown utility boundary follow-up`.
- Keep the next batch on the initializer shutdown and websocket-auth fixture stream.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
