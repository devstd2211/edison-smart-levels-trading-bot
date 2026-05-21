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
- 2026-05-21: completed five `vector-db` and config boundary refactor slices:
  - `root package vector-db script delegation to package-level entrypoints`
  - `packages/core vector-db standalone entrypoint extraction`
  - `packages/core/src/vector-db/cli.ts runtime path and command parsing separation`
  - `vector-db package-script and standalone boundary coverage refresh`
  - `packages/core/src/config.ts env/path/debug side-effect helper extraction`
- Root `vector-db*` scripts now delegate through `packages/core/package.json` instead of calling `packages/core/src/vector-db/cli.ts` directly, matching the same package-boundary rule already enforced for `collect-data` and `test-balance`.
- Added a thin `packages/core/src/vector-db.ts` standalone wrapper and reduced `packages/core/src/vector-db/cli.ts` to explicit runtime-path, command-parse, help, and dispatch helpers so the CLI no longer mixes process wiring with service/bootstrap details.
- Moved `config.ts` environment loading, config-path resolution, file reads, debug logging, and exchange env overrides into `config-loader.ts`, while preserving `getConfig()` behavior and the legacy `API_KEY` / `API_SECRET` fallback contract.

## Latest Verification
- 2026-05-21: `npm test -- --runInBand position-monitor`
- 2026-05-21: `npm test -- --runInBand position-monitor standalone-script-entrypoints package-script-boundary vector-db.entrypoint config-loader security-audit`
- 2026-05-21: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
