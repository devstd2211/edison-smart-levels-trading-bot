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
- 2026-05-17: completed five config save/validate follow-up slices:
  - `web-client config editor save/validate typed status UX`
  - `web-server config write/validate response helper extraction`
  - `contracts config update/validation response contract follow-up`
  - `swagger config update/validation schema deduplication`
  - `workspace package config mutation boundary smoke expansion`
- Reworked `ConfigEditor` around typed validation and save status instead of page-local string checks: JSON syntax issues stay local, server validation issues flow through the shared contract, save now reuses the validation pass before writing, and the editor surfaces structured issue counts plus backup-path save status.
- Expanded the shared runtime contracts so config update responses now carry the validation payload, validation responses now expose typed issue objects plus summary counts, and `config.routes` delegates both write and validate response shaping through focused config-route helpers.
- Deduplicated the OpenAPI update/validation schemas around shared validation issue/summary builders and added client, server, and workspace smoke coverage so publishable contract types, route helpers, and the config editor stay aligned end-to-end.

## Latest Verification
- 2026-05-17: `npm test -- --runInBand position-monitor`
- 2026-05-17: `npm --prefix packages/web-client run test -- --runInBand config-editor.functional api.service control-zero-value`
- 2026-05-17: `npm --prefix packages/web-server run test -- --runInBand web-server.functional`
- 2026-05-17: `npm test -- --runInBand package-script-boundary`
- 2026-05-17: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
