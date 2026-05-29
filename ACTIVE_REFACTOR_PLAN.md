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
- 2026-05-29: completed `packages/core/src/factories/create-runtime-bundle.ts runtime bundle assembly boundary follow-up`.
- 2026-05-29: completed `packages/core/src/bot-factory.ts runtime bundle handoff boundary follow-up`.
- 2026-05-29: completed `packages/core/src/factories/create-trading-bot-runtime.ts runtime factory boundary follow-up`.
- The runtime factory boundary now exposes a shared `createTradingBotFactoryRuntime(...)` handoff that assembles `runtimeSource` and `runtimeBundle` once for downstream consumers.
- `create-runtime-bundle.ts` now separates dependency assembly from final bundle materialization, and `BotFactory.createBotRuntimeBundle(...)` reuses the shared runtime factory handoff instead of manually rebuilding the same bundle shell.

## Latest Verification
- 2026-05-29: `npm test -- --runInBand runtime-service-adapters.functional.test.ts create-trading-bot-runtime.functional.test.ts bot-factory.test.ts` (3 suites, 17 tests)
- 2026-05-29: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-29: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/bot-initializer.ts initializer runtime lifecycle boundary follow-up`.
- Keep the next batch component-sized: each active item should be a real runtime/initializer/websocket boundary slice, not a single-line alias or naming-only task.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
