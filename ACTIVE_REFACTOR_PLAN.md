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
- 2026-05-22: completed five entrypoint boundary refactor slices across the dedicated `core`/`web` surfaces and their documentation:
  - `packages/core/src/core/index.ts minimal bot runtime entrypoint boundary audit`
  - `packages/core/src/core/core-entrypoint-runtime.ts configured-runtime helper extraction`
  - `packages/core/src/web/index.ts web server startup boundary audit`
  - `packages/core/src/web/web-entrypoint-runtime.ts bot/web adapter orchestration extraction`
  - `README.md entrypoint migration documentation audit`
- `packages/core/src/core/index.ts` is now a thin public surface over `core-entrypoint-runtime.ts`; config-loading orchestration and start semantics live in helper functions instead of being inlined in the entrypoint module.
- `packages/core/src/web/index.ts` is now a thin public surface over `web-entrypoint-runtime.ts`; bot adapter wiring, position mapping, and `WebServer` bootstrap orchestration were moved out of the export surface without changing the published API.
- Boundary coverage now asserts the helper imports directly, and web boundary tests cover the runtime-position to web-contract mapping path so the extracted helper behavior stays locked down.
- `README.md` now documents the thin-entrypoint/helper split for both `@edison/core/core` and `@edison/core/web`, keeping the public entrypoint guidance aligned with the new composition-root layout.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand core-entrypoint web-boundary web-entrypoint readme-entrypoint package-script-boundary`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
