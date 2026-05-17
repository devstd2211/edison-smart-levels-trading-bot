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
- 2026-05-17: completed five control/config-boundary slices:
  - `web-client control config bootstrap consolidation`
  - `web-server strategy toggle persistence service extraction`
  - `contracts runtime config payload shape tightening`
  - `swagger config payload alias reuse cleanup`
  - `workspace package control boundary smoke coverage`
- Moved `Control` page bootstrap, strategy fallback mapping, and local config mutation helpers into a shared typed `control-config-bootstrap` service, and synchronized `ConfigEditor` plus `RiskSettings` local state to async prop updates so the loaded config becomes the single UI source of truth.
- Shifted strategy toggle, risk patch, and config history behavior onto `ConfigManagementService`, which now owns those read/write flows, reuses backup-producing config writes for partial mutations, and returns typed history/response payloads; the shared contracts and OpenAPI registry were tightened to reuse explicit config aliases instead of page-local or string-literal schema names.
- Expanded functional and package-boundary coverage so `Control` bootstrap fallback behavior, config-route backup history, and workspace smoke tests all assert the shared contract boundary instead of page-local config seeds.

## Latest Verification
- 2026-05-17: `npm test -- --runInBand position-monitor`
- 2026-05-17: `npm test -- --runInBand package-script-boundary`
- 2026-05-17: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-17: `npm --prefix packages/web-client run test -- --runInBand control-config-bootstrap control-zero-value app-config api.service`
- 2026-05-17: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
