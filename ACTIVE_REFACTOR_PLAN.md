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
- 2026-05-22: completed five boundary refactor slices across `vector-db` and the CLI composition root:
  - `packages/core/src/vector-db/sqlite-vector-store.ts sqlite persistence/query boundary audit`
  - `packages/core/src/vector-db/semantic-search.service.ts ranking/filter boundary audit`
  - `packages/core/src/vector-db/advanced-search.service.ts advanced query orchestration boundary audit`
  - `packages/core/src/vector-db/index.ts package export boundary audit`
  - `packages/core/src/cli/index.ts composition root startup boundary audit`
- `SQLiteVectorStore` now delegates schema/query/cache/document mapping helpers to `sqlite-vector-store-helpers.ts`; cache TTL now uses consistent millisecond storage semantics, regex-like user queries are escaped during keyword scoring, and SQLite statements are finalized before close.
- `SemanticSearchService` now delegates cache-key/strategy/scoring/context behavior to `semantic-search-helpers.ts`, so keyword, filtered, and hybrid searches no longer collide in the shared cache.
- `AdvancedSearchService` now delegates multi-query merge, regex matching, and similarity helpers to `advanced-search-helpers.ts`; `searchAll` now behaves like an actual AND search and global regex searches no longer leak `lastIndex` across documents.
- `packages/core/src/vector-db/index.ts` now re-exports leaf modules directly instead of routing the package barrel through `vector-db.service.ts`, keeping the public surface stable while narrowing the dependency boundary.
- `packages/core/src/cli/index.ts` now loads `.env` at runtime instead of module import time and delegates startup/title/logging helpers to `cli-entrypoint-runtime.ts`, so the composition root is testable through injected dependencies without module mocking.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand cli-entrypoint cli-runtime cli-shutdown sqlite-vector-store advanced-search semantic-search vector-db.index vector-db.entrypoint project-indexer.helpers project-indexer.functional vector-db.service.helpers vector-db.service.functional`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
