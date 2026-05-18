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
- 2026-05-18: completed five config/lifecycle boundary follow-up slices:
  - `config example webApi defaults propagation`
  - `web-server read-only adapter route-surface audit`
  - `lifecycle manager start-stop harness follow-up`
  - `tracked services constructor side-effect audit follow-up`
  - `config pipeline wrapper boundary follow-up`
- Tightened `webApi` config normalization so only supported indicator-preference keys survive, array defaults are cloned instead of shared by reference, and `config.example.json` is now verified against the same runtime defaults.
- Narrowed the web-server bridge to the read-only adapter surface it actually consumes, added explicit route-surface coverage so bot control routes never touch read-model adapters and data routes never trigger lifecycle actions, and extended tracked runtime/lifecycle harness tests to lock in constructor-side-effect boundaries.
- Consolidated `ConfigPipeline` wrappers behind the same loader path and expanded lifecycle-manager coverage for reverse-stop order plus `throwOnError` behavior.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm test -- --runInBand config-pipeline web-api-config lifecycle-manager trading-bot.create-services.lifecycle create-trading-bot-runtime web-server.functional`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
