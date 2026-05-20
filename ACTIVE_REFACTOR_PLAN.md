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
- 2026-05-20: completed five web-server/test-harness/runtime follow-up slices:
  - `web-server websocket bootstrap/error helper convergence in remaining recovery paths`
  - `web-server api entrypoint runtime cleanup helper follow-up for duplicate stop/close logs`
  - `managed tracked-services context helper reuse in remaining builder/runtime boundary suites`
  - `web-server route read helper adoption in remaining status/config boundaries`
  - `core package web entrypoint README/example smoke follow-up`
- Converged websocket bootstrap/recovery around shared server creation and bind helpers, added a functional fallback-port assertion, and kept recovery-path logging explicit when the initial websocket port is occupied.
- Tightened `WebServer.close()` so runtime cleanup only runs when startup actually reached runtime services, moved the remaining status/config reads onto shared route-read helpers, reused a narrower tracked-services state helper in builder suites, and added an explicit `@edison/core/web` startup example to the README smoke boundary.

## Latest Verification
- 2026-05-20: `npm test -- --runInBand ws-server`
- 2026-05-20: `npm test -- --runInBand web-server bot.routes readme-entrypoint-boundary service-lifecycle-test.utils bot-service-state position-management.builder websocket-monitoring.builder runtime-service-adapters web-boundary web-entrypoint create-trading-bot-runtime`
- 2026-05-20: `npm test -- --runInBand position-monitor`
- 2026-05-20: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
