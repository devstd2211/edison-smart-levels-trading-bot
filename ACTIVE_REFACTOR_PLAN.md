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
- 2026-05-25: completed the composition-root entrypoint contract slice across the active queue:
  - `packages/core/src/cli/index.ts cli composition root extraction follow-up`
  - `packages/core/src/core/index.ts minimal bot entrypoint composition root follow-up`
  - `packages/core/src/web/index.ts web server startup composition root follow-up`
  - `README.md entrypoint documentation alignment follow-up`
  - `packages/core/src/index.ts legacy wrapper composition-root follow-up`
- `cli/index.ts` now uses the shared standalone-entrypoint runner path for direct execution and exports an explicit CLI entrypoint contract instead of keeping the if-main branch inline.
- `core/index.ts` now exposes a focused programmatic entrypoint contract and routes all config-aware helpers through one shared runtime-config loader path instead of repeating the same wrapper logic three times.
- `web/index.ts`, `index.ts`, and `README.md` now pin the dedicated entrypoint surfaces and the legacy-wrapper handoff more explicitly, with tests guarding the public contract rather than implementation leakage.

## Latest Verification
- 2026-05-25: `npm --prefix packages/core test -- --runInBand cli-entrypoint.functional core-entrypoint.functional web-entrypoint.functional legacy-entrypoint.functional`
- 2026-05-25: `npm test -- --runInBand readme-entrypoint-boundary --testNamePattern "documents the dedicated CLI entrypoint|documents the config-aware programmatic helpers"`
- 2026-05-25: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports"`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/legacy-entrypoint-runtime.ts legacy wrapper runner convergence follow-up`.
- The active queue was refreshed around the same composition-root stream after the dedicated entrypoint slice completed; continue one component at a time through `legacy-entrypoint-runtime.ts`, `standalone-entrypoint-runtime.ts`, `cli-entrypoint-runtime.ts`, and the focused package-script/README guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
