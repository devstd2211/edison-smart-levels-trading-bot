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
- 2026-05-18: completed five config preview request convergence slices:
  - `web-client config editor preview refresh-state convergence`
  - `web-server config preview request contract convergence`
  - `contracts config preview/update request alias follow-up`
  - `swagger config preview request schema deduplication`
  - `workspace package config preview request boundary smoke expansion`
- Reworked the config editor save/refresh path so parent bootstrap refreshes no longer wipe the just-saved success state, stale diff panels are collapsed after save/reset, and array JSON payloads are rejected instead of being treated as config objects.
- Introduced a shared config mutation request contract on the client and server: preview and save now use the same request helper, the server parses the wrapped request shape while remaining compatible with legacy bare config payloads, and invalid array bodies now fail the preview boundary correctly.
- Deduplicated the OpenAPI request schemas around a shared mutation request schema, refreshed package boundary smoke coverage, and extended functional tests so client/server/config contract behavior stays aligned across save, preview, compatibility, and backup flows.

## Latest Verification
- 2026-05-18: `npm test -- --runInBand position-monitor`
- 2026-05-18: `npm --prefix packages/contracts run build`
- 2026-05-18: `npm --prefix packages/web-client run test -- --runInBand config-editor.functional api.service`
- 2026-05-18: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-18: `npm test -- --runInBand package-script-boundary`
- 2026-05-18: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
