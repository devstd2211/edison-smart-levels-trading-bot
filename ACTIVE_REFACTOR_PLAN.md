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
- 2026-05-29: completed `packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts runtime contract guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/helpers/service-lifecycle-test.utils.ts runtime harness factory boundary follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts runtime factory handoff guardrail follow-up`.
- Added `packages/core/src/interfaces/IRuntimeContracts.ts` as the canonical shared contract for `IBotRuntimeBundle`, `ITradingBotFactoryRuntime`, and `ITradingBotRuntime`, then re-exported those types through the interface index.
- `createTradingBotRuntime(...)` now materializes the public bot runtime through `createTradingBotRuntimeFromFactoryRuntime(...)`, so the factory handoff and bot handoff reuse one seam instead of rebuilding their shell independently.
- Lifecycle test harnesses now keep factory-runtime and bot-runtime ownership separate: the factory harness exposes only `{ runtimeSource, runtimeBundle }`, while bot-runtime and entrypoint guardrails consume the explicit bot/runtime pair.

## Latest Verification
- 2026-05-29: `npm test -- --runInBand packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts packages/core/src/__tests__/helpers/service-lifecycle-test.utils.test.ts packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/web/web-entrypoint.functional.test.ts` (7 suites, 49 tests)
- 2026-05-29: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-29: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/bot-factory.test.ts runtime bundle handoff guardrail follow-up`.
- Keep the next batch in the runtime handoff and entrypoint boundary stream, and merge the docs slice with the next adjacent runtime consumer if it proves too small on its own.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
