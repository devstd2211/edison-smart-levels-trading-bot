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
- 2026-05-17: completed five control/config restore-cleanup follow-up slices:
  - `web-client control restore/cleanup typed action UX`
  - `web-server config restore/cleanup request helper extraction`
  - `contracts config restore response contract follow-up`
  - `swagger config restore/cleanup schema deduplication`
  - `workspace package config restore boundary smoke expansion`
- Added typed restore plus cleanup actions to the `Control` config tab through shared bootstrap helpers, surfaced action status directly in the backup card, and kept the cleanup default in a web-client local constant so Vite does not take a runtime value dependency on the CommonJS contracts package.
- Expanded the shared runtime contracts so restore responses now carry restored-backup metadata plus the pre-restore snapshot path, cleanup responses now carry remaining and total backup counts, and `config.routes` delegates restore/cleanup request parsing through focused config-route helpers.
- Consolidated the restore/cleanup OpenAPI schemas around shared config action schema builders and expanded functional plus workspace smoke coverage so restore payloads, cleanup summaries, control-page actions, and publishable contract boundaries stay aligned end-to-end.

## Latest Verification
- 2026-05-17: `npm test -- --runInBand position-monitor`
- 2026-05-17: `npm --prefix packages/web-client run test -- --runInBand control-config-bootstrap control-zero-value api.service`
- 2026-05-17: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-17: `npm test -- --runInBand package-script-boundary`
- 2026-05-17: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
