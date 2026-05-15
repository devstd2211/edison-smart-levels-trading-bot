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
- 2026-05-15: completed five `BotServicesAdapter incremental migration audit` slices:
  - `shared execution-service projection extraction`
  - `shared market-data projection extraction`
  - `initializer exchange runtime shell isolation`
  - `initializer resilience shell omission when absent`
  - `tracked initializer harness convergence`
- Consolidated runtime-source projections in `runtime-service-adapters.ts` so `TradingBot`, `BotInitializer`, and `WebSocketEventHandler` all materialize fresh narrow adapter shells instead of mixing explicit projections with pass-through grouped objects.
- Kept `BotInitializer` exchange mutation local to its adapter shell, made optional resilience dependencies disappear when missing, and aligned tracked test shutdown/harness creation on one initializer-construction path.
- Added functional coverage for fresh adapter shells, local `exchangeRuntime` mutation, and absent resilience services while preserving existing lifecycle and factory behavior.

## Latest Verification
- 2026-05-15: `npm run build`
- 2026-05-15: `npm test -- --runInBand runtime-service-adapters`
- 2026-05-15: `npm test -- --runInBand trading-bot.create-services.lifecycle`
- 2026-05-15: `npm test -- --runInBand bot-factory.service`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
