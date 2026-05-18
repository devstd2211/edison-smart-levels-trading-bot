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
- 2026-05-18: completed five config validation/mutation request convergence slices:
  - `web-client control config save bootstrap refresh convergence`
  - `web-server config validation request parser convergence`
  - `contracts config validation/mutation request alias follow-up`
  - `swagger config validation request schema alias deduplication`
  - `workspace package config mutation request compatibility smoke follow-up`
- Reworked the control page save path so config saves optimistically converge local config and strategy summaries before the bootstrap refresh finishes, while stale backup action banners are cleared when the refreshed metadata arrives.
- Converged the shared config mutation request contract across `save`, `preview`, and `validate`: validation now reuses the same parser and compatibility behavior as the other mutation routes, contract types alias back to the shared mutation request payload, and empty object validation stays a typed payload instead of a route-local parser special case.
- Deduplicated the OpenAPI validation request schema to the shared mutation request alias and expanded functional/package smoke coverage so client bootstrap refresh, server request compatibility, and publishable contract output stay aligned.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm --prefix packages/contracts run build`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand config-editor.functional api.service`
- 2026-05-18: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand control-zero-value.functional config-editor.functional api.service`
- 2026-05-18: `npm test -- --runInBand package-script-boundary`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
