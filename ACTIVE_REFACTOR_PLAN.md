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
- 2026-05-17: completed five control/config follow-up slices:
  - `web-client control schema metadata convergence`
  - `web-server config validation/request parsing extraction`
  - `contracts config backup/history payload normalization`
  - `swagger internal schema registry alias cleanup`
  - `workspace package config boundary smoke expansion`
- Promoted control schema metadata and config defaults into shared runtime contracts, then switched the `Control` page to bootstrap schema metadata through the typed config API and render risk summary labels from that shared payload instead of hardcoded page-local copy.
- Extracted config-route payload parsing and runtime-port fallback resolution into focused route helpers, normalized backup/history payloads onto the same `ConfigBackupPayload` surface, and pointed `ConfigManagementService` plus the OpenAPI registry at the shared schema/default constants rather than maintaining separate server-local copies.
- Expanded functional and workspace smoke coverage so config schema metadata, history/backups aliases, typed cleanup defaults, and control-page schema consumption are all asserted through publishable package boundaries.

## Latest Verification
- 2026-05-17: `npm test -- --runInBand position-monitor`
- 2026-05-17: `npm test -- --runInBand package-script-boundary`
- 2026-05-17: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-17: `npm --prefix packages/web-client run test -- --runInBand control-config-bootstrap control-zero-value api.service`
- 2026-05-17: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
