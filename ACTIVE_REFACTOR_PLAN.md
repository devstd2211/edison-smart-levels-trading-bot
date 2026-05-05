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
- 2026-05-05: completed the `BotServices legacy state reduction boundary`, `ConfigPipeline composition-root extraction`, and `Legacy core entrypoint wrapper boundary` slice.
- Stopped routing the broad service state through `BotFactory.create()` by moving successful runtime logging into `create-trading-bot-runtime` and letting the public factory path return only the constructed `TradingBot`.
- Added `loadRuntimeConfig()` as the composition-root helper that owns config load + strategy merge + validation, then switched the CLI entrypoint to that boundary instead of orchestrating pipeline steps itself.
- Refreshed `config-pipeline` strategy logs to use shared `ICONS` instead of embedded emoji strings while keeping the same operator-facing summary output.
- Made `packages/core/src/index.ts` an even thinner legacy wrapper by exposing an explicit `runLegacyCliEntrypoint()` delegation point and added focused functional coverage for both the wrapper and the runtime config pipeline.

## Latest Verification
- 2026-05-05: `npm test -- --runInBand position-monitor`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts packages/core/src/__tests__/config/config-pipeline.functional.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/bot-services-adapter.functional.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts`
- 2026-05-05: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-05: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
