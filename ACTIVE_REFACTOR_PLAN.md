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
- 2026-05-22: completed five `vector-db` component boundary refactor slices:
  - `packages/core/src/vector-db/vector-db.service.ts init load-vs-create orchestration extraction`
  - `packages/core/src/vector-db/vector-db.service.ts persisted index create/load/reindex/export boundary extraction`
  - `packages/core/src/vector-db/vector-db.service.ts component functional runtime coverage`
  - `packages/core/src/vector-db/project-indexer.ts scan/analyze/index-build runtime dependency extraction`
  - `packages/core/src/vector-db/project-indexer.ts component functional runtime coverage`
- `VectorDatabaseService` now delegates persisted-index decisions and storage orchestration to `vector-db-service-index.ts`, and its constructor can accept explicit store/search/indexer/storage seams for component-level tests without changing the published runtime surface.
- `ProjectIndexer` now delegates glob discovery, file reads, batch analysis, and index assembly to `project-indexer-runtime.ts`, so the class itself is reduced to orchestration while the runtime seams are testable without module mocking.
- Added component-level functional coverage for both active `vector-db` components, so the queue now has direct behavior tests instead of helper-only assertions.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand vector-db.service.helpers project-indexer.helpers vector-db.service.functional project-indexer.functional vector-db.entrypoint`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
