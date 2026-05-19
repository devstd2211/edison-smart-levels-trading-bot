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
  - `web-api runtime default helper adoption in remaining config entrypoints`
  - `web-server bridge balance/status fallback logging convergence`
  - `lifecycle manager registration descriptor reuse beyond bot initializer`
  - `tracked services harness lifecycle noise suppression follow-up`
  - `config/runtime normalization helper boundary smoke follow-up`
- Switched core/CLI config-aware entrypoints over to the validated runtime loader path when no custom loader is supplied, so default runtime config loading now goes through one explicit helper instead of open-coded `loadRuntimeConfig()` calls.
- Converged `BotBridgeService` balance fallback handling behind one helper, preserved normalized position snapshots inside status fallbacks, and kept the same fallback log shape for both `/status` and direct balance reads.
- Promoted lifecycle registration descriptor materialization into `LifecycleManager`, reused it from bot-initializer lifecycle wiring, muted tracked-service cleanup logger noise inside the managed harness, and expanded boundary smoke coverage around config-loader exports and cleanup helpers.

## Latest Verification
- 2026-05-19: `npm test -- --runInBand position-monitor config-pipeline web-api-config core-entrypoint legacy-entrypoint bot-bridge lifecycle-manager bot-initializer-lifecycle service-lifecycle-test create-services.lifecycle trading-bot.create-services.lifecycle web-server.functional`
- 2026-05-19: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
