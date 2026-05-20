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
- 2026-05-20: completed five managed tracked-services helper follow-up slices:
  - `managed tracked-services state helper reuse in bot-factory service boundary suite`
  - `managed tracked-services state helper reuse in bot-factory error-handling boundary suite`
  - `managed tracked-services context retention audit in create-services lifecycle boundary suite`
  - `managed tracked-services context retention audit in runtime-service-adapters functional boundary suite`
  - `managed tracked-services context retention audit in websocket-event-handler functional boundary suite`
- Narrowed the two BotFactory boundary suites onto `createManagedTrackedServicesState()` because they only need `trackedServices` plus `cleanup`.
- Added explicit retained-context helpers for lifecycle and adapter suites so the remaining full-context usage is intentional and typed around the exact harness factories each boundary consumes.
- Removed the file-level shared managed context from the websocket-event-handler functional boundary so each test now owns its own lifecycle-scoped harness and cleanup path.

## Latest Verification
- 2026-05-20: `npm test -- --runInBand bot-factory.service bot-factory.error-handling create-services.lifecycle runtime-service-adapters websocket-event-handler trading-bot.create-services`
- 2026-05-20: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
