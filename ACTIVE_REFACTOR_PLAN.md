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
- 2026-05-07: completed the naming cleanup batch for `BotFactory public contract wording convergence`, `Runtime bundle compatibility alias retirement`, `Web API read selector compatibility alias retirement`, `Runtime dependency source type naming convergence`, and `Legacy BotServices wording retirement in tests/docs`.
- Standardized the public BotFactory/runtime wording on `BotFactory.createBotRuntimeBundle()` and removed the old `createRuntimeBundle()` / `TradingBotRuntimeBundle` compatibility aliases now that focused runtime coverage already proves the narrower bundle contract.
- Removed the compatibility selector aliases around `selectWebApiReadServices()` and `createBotStateWebApiReadServices()`, then aligned factory/runtime tests to call the canonical mapper names directly.
- Renamed the runtime source type barrel to `IRuntimeSources` and converged the exported source names on `IBotRuntimeSource`, `IBotFactoryRuntimeSource`, `ITradingBotRuntimeSource`, `IBotInitializerRuntimeSource`, and `IWebSocketEventHandlerRuntimeSource`, while also retiring leftover `BotServices` wording from focused tests/docs in this slice.

## Latest Verification
- 2026-05-07: `npm test -- --runInBand position-monitor`
- 2026-05-07: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/bot-services-adapter.functional.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/grouped-services.builder.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts`
- 2026-05-07: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-07: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
