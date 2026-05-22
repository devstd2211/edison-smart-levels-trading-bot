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
- 2026-05-22: completed the next legacy-entrypoint/documentation boundary slice across the remaining active queue:
  - `ARCHITECTURE_QUICK_START.md entrypoint helper boundary documentation audit`
  - `packages/core/src/index.ts legacy wrapper helper convergence audit`
  - `packages/core/src/legacy-entrypoint-runtime.ts standalone wrapper guardrail audit`
- `ARCHITECTURE_QUICK_START.md` now documents the dedicated `@edison/core`, `@edison/core/cli`, `@edison/core/core`, and `@edison/core/web` surfaces together with the helper modules that hold direct-execution and runtime orchestration logic.
- `packages/core/src/index.ts` is now a thinner compatibility facade: it re-exports `runLegacyCliEntrypoint` directly from `legacy-entrypoint-runtime.ts` and relies on the runtime helper's default CLI dependency for direct execution instead of wrapping it locally.
- `packages/core/src/legacy-entrypoint-runtime.ts` now makes the compatibility export contract more explicit by separating the runtime helper export names from the full legacy root surface, while preserving the published root entrypoint API.
- Added dedicated architecture boundary coverage so entrypoint/helper documentation drift is caught by a focused functional suite instead of only by broader package/documentation tests.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand architecture-entrypoint legacy-entrypoint package-script-boundary readme-entrypoint standalone-entrypoint-runtime phase-9-live-trading`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
