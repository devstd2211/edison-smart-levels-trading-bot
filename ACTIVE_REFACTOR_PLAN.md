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
- 2026-05-18: completed five config backup/history collection convergence slices:
  - `web-client control backup action bootstrap refresh convergence`
  - `web-server config backup/history response alias convergence`
  - `contracts config backup/history collection alias follow-up`
  - `swagger config backup/history schema alias deduplication`
  - `workspace package config backup/history alias smoke follow-up`
- Reworked the control page backup actions so restore and cleanup now converge through the same full bootstrap refresh path as config save instead of patching backup state locally, which keeps config, strategy summaries, schema metadata, and backup inventory in sync after every backup action.
- Converged the shared backup/history contract around a single publishable collection alias: the server now returns the collection directly from the config service for `/backups`, preserves `/history` as an alias over the same payload, and the contracts surface exposes the alias chain explicitly for publishable consumers.
- Deduplicated the OpenAPI backup/history schemas to a single base collection schema with alias components and expanded functional/package smoke coverage so the route payloads, schema aliases, and built contract output stay aligned.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm --prefix packages/contracts run build`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand control-zero-value.functional control-config-bootstrap`
- 2026-05-18: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-18: `npm test -- --runInBand package-script-boundary`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
