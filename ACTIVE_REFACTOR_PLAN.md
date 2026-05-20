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
- 2026-05-20: completed five managed tracked-services config-fixture/helper slices:
  - `managed tracked-services adapter helper granularity follow-up in runtime dependency adapter boundary suite`
  - `managed tracked-services config fixture reuse follow-up in core entrypoint functional boundary suite`
  - `managed tracked-services config fixture reuse follow-up in config-pipeline functional boundary suite`
  - `managed tracked-services bot-factory runtime config helper follow-up in bot-factory runtime test utils`
  - `managed tracked-services quiet logging fixture follow-up in trading-bot functional boundary suite`
- Split the old adapter helper surface by harness family: `runtime-service-adapters.functional` now uses a dedicated runtime-bundle helper, the existing initializer helper, and the existing bot helper instead of a single broad adapter-runtime wrapper.
- Added explicit config fixtures in `service-lifecycle-test.utils` for candle-enabled runtime paths, dashboard-enabled lifecycle paths, and legacy runtime-default normalization paths, then routed `bot-factory-runtime-test.utils`, `core-entrypoint.functional`, `config-pipeline.functional`, and the dashboard branch of `trading-bot.functional` onto those scenario-specific fixtures.
- Extended the lifecycle helper self-test to lock the new fixture semantics and the new runtime-bundle helper surface, while retiring the now-unused broad adapter-runtime export.

## Latest Verification
- 2026-05-20: `npm test -- --runInBand service-lifecycle-test.utils runtime-service-adapters core-entrypoint config-pipeline trading-bot.functional bot-factory legacy-entrypoint`
- 2026-05-20: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
