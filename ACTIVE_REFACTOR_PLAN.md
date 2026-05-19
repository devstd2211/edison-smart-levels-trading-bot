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
- 2026-05-19: completed five config/bridge/lifecycle follow-up slices:
  - `web-api config loader/runtime parity follow-up`
  - `web-server bridge read fallback logging convergence`
  - `web-server bridge adapter subset contract audit`
  - `lifecycle manager stage registration helper follow-up`
  - `tracked services cleanup harness reuse follow-up`
- Unified runtime config normalization behind a shared defaults helper so `getConfig()` and `loadRuntimeConfig()` now apply the same `dataSubscriptions` and `webApi` defaults, including custom loader paths used by composition-root tests.
- Narrowed `BotBridgeService` to its read-only adapter subset all the way through the fallback path, replaced ad-hoc fallback logging with one converged bridge message shape, and added coverage for adapter-throw fallback behavior.
- Added batched lifecycle registration support, moved bot-initializer lifecycle wiring to descriptor-driven registration, and reused the tracked initializer harness for cleanup so test teardown follows the same shutdown path as production lifecycle orchestration.

## Latest Verification
- 2026-05-19: `npm test -- --runInBand position-monitor`
- 2026-05-19: `npm test -- --runInBand config-pipeline web-api-config bot-bridge lifecycle-manager bot-initializer-lifecycle create-services.lifecycle trading-bot.create-services.lifecycle`
- 2026-05-19: `npm test -- --runInBand web-server.functional`
- 2026-05-19: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
