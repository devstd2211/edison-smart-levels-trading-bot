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
- 2026-05-20: completed five managed tracked-services helper-surface slices:
  - `managed tracked-services helper granularity follow-up in create-services lifecycle boundary suite`
  - `managed tracked-services helper granularity follow-up in websocket-event-handler functional boundary suite`
  - `managed tracked-services adapter-runtime retention audit in runtime-service-adapters functional boundary suite`
  - `managed tracked-services context retention audit in lifecycle helper self-test`
  - `managed tracked-services helper export-surface audit in service-lifecycle-test utils`
- Added `createManagedTrackedServicesInitializerRuntime()` for suites that only need `createInitializerHarness()` plus `cleanup()`, instead of the broader lifecycle helper surface.
- Converted the `create-services.lifecycle` and `websocket-event-handler` boundary suites to the initializer-only helper, and narrowed the runtime-service-adapters suite to destructure only the adapter runtime members it actually exercises.
- Stopped exporting the full managed tracked-services context from `service-lifecycle-test.utils`, and aligned the helper self-test to assert the remaining public helper surfaces directly.

## Latest Verification
- 2026-05-20: `npm test -- --runInBand service-lifecycle-test.utils create-services.lifecycle websocket-event-handler runtime-service-adapters trading-bot.create-services.lifecycle create-trading-bot-runtime web-entrypoint`
- 2026-05-20: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
