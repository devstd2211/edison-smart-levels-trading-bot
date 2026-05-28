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
- 2026-05-28: completed the 11-task CLI output row and startup phase helper slice.
- CLI startup lifecycle, mainnet warning, and web-server output rows are now materialized through named row helpers before logging.
- CLI output icon usage now has a narrowed `CliOutputIconKey` type and `CLI_OUTPUT_ICONS` lookup.
- CLI composition root now delegates bot runtime creation and embedded web startup through `createCliStartupPhaseRuntime(...)` and `startCliWebServerPhase(...)`.
- Package-script source smoke now follows the new grouped output row and startup phase helper boundary.

## Latest Verification
- 2026-05-28: `npm test -- --runInBand cli-runtime cli-entrypoint-runtime cli-entrypoint` (3 suites, 16 tests)
- 2026-05-28: `npm run build`
- 2026-05-28: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `README.md CLI grouped output row ownership wording follow-up`.
- Continue through the 14 active CLI runtime boundary tasks covering grouped output docs, startup failure/banner row helpers, config phase helper extraction, and docs guardrails.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
