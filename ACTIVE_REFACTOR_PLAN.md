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
  - `web-api runtime default logging deduplication in base config loader`
  - `web-server bridge status-change fallback parity follow-up`
  - `lifecycle manager listener cleanup descriptor extraction`
  - `tracked services harness startup noise suppression follow-up`
  - `config/runtime loader export boundary smoke follow-up`
- Added shared `loadOptionalRuntimeConfig()` so config-aware entrypoints use one explicit optional-loader path instead of repeating default-loader branching, then extended boundary coverage around the config exports that consume it.
- Extracted generic listener-cleanup descriptor materialization into `LifecycleManager`, reused it from bot-initializer cleanup wiring, and kept tracked lifecycle harness defaults quiet by lowering the shared helper config log level to `error`.
- Centralized `BotBridgeService` status snapshot assembly so direct status reads and forwarded `BOT_STATUS_CHANGE` events now share the same fallback-backed balance/status shape and verification.

## Latest Verification
- 2026-05-19: `npm test -- --runInBand config-pipeline core-entrypoint legacy-entrypoint lifecycle-manager bot-initializer-lifecycle service-lifecycle-test bot-bridge`
- 2026-05-19: `npm test -- --runInBand web-server.functional`
- 2026-05-19: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
