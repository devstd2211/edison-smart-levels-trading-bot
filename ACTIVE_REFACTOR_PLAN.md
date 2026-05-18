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
- 2026-05-18: completed five server runtime config convergence slices:
  - `web-client control server runtime bootstrap convergence`
  - `web-server config server runtime response alias convergence`
  - `contracts server runtime config payload alias follow-up`
  - `swagger server runtime schema alias deduplication`
  - `workspace package server runtime alias smoke follow-up`
- Folded `/api/config/server` into the same typed control bootstrap flow as config, strategies, schema, and backup metadata, so the control page now renders runtime API/WebSocket endpoints from shared bootstrap state instead of keeping that payload off to the side.
- Converged the config server route around a publishable alias over the shared runtime payload, added a reusable endpoint payload shape plus runtime payload factory on the contracts surface, and routed the Express handler through the same helper instead of rebuilding the response inline.
- Deduplicated the OpenAPI runtime schema so the config route now points at a config-specific alias over the shared runtime schema, the endpoint shape is modeled once, and package/server/client smoke coverage verifies the alias chain remains publishable after build.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm --prefix packages/contracts run build`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand control-config-bootstrap api.service control-zero-value.functional`
- 2026-05-18: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-18: `npm test -- --runInBand package-script-boundary`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
