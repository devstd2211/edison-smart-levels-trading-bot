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
- 2026-05-16: completed five package-boundary convergence slices:
  - `web-server commonjs runtime alignment`
  - `web-server package export surface declaration`
  - `core web-server dist alias retirement`
  - `web-server package-local test runner adoption`
  - `core/root package test entry convergence`
- Switched `packages/web-server` to a CommonJS build that matches the current `@edison/core` consumer, declared its package-root export surface explicitly, and removed `@edison/core`'s compile-time fallback to `../web-server/dist`.
- Added package-local Jest entrypoints for `packages/web-server` and `packages/core`, then rewired root `test:web-server` and `test:core` scripts to run real package tests instead of proxying through build-only or root-only commands.
- Preserved the existing web boundary behavior while making build and targeted test verification exercise the workspace package boundary directly.

## Latest Verification
- 2026-05-16: `npm --prefix packages/web-server run test -- --runInBand`
- 2026-05-16: `npm --prefix packages/core run test -- --runInBand web-boundary`
- 2026-05-16: `npm run test:web-server`
- 2026-05-16: `npm run test:core -- web-boundary`
- 2026-05-16: `npm test -- --runInBand position-monitor`
- 2026-05-16: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
