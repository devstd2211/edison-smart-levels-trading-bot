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
- 2026-05-21: completed five `root package main/start script legacy wrapper dependency audit` slices:
  - `shared standalone direct-execution runtime helper extraction`
  - `legacy wrapper direct-execution policy convergence onto the shared helper`
  - `root package collect-data script delegation away from packages/core/src`
  - `root package test:balance script delegation away from packages/core/src`
  - `collect-data/test-balance standalone entrypoint boundary coverage and config-path correction`
- Removed the remaining root-script dependence on `packages/core/src/*.ts` for the main standalone flows by adding package-level `collect-data` and `test:balance` scripts in `packages/core/package.json` and delegating the workspace root to them.
- Aligned `collect-data.ts` and `test-balance.ts` with the same explicit `main` plus `run...IfMain` contract as the legacy wrapper, and fixed `collect-data.ts` to load the real workspace `config.json` through the shared config loader instead of a non-existent `packages/core/config.json` path.

## Latest Verification
- 2026-05-21: `npm test -- --runInBand position-monitor`
- 2026-05-21: `npm test -- --runInBand package-script-boundary legacy-entrypoint standalone-entrypoint standalone-script-entrypoints`
- 2026-05-21: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
