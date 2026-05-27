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
- 2026-05-27: completed the 15-task CLI runtime boundary constants/table slice.
- CLI startup endpoint output and mainnet warning countdown text now live behind exported CLI constants, with web-client dev-server port/command classified as a separate static CLI guidance constant.
- CLI exchange-mode labels now use an exported label table, and active-strategy priority/fallback labels are exported for guardrails.
- CLI composition-root dependency bindings now use explicit `cli*` names before being handed to the startup/runtime helpers.
- README, architecture docs, CLI functional guardrails, and package-script source smoke now document the default-port/env override plus the web-client guidance constant boundary.

## Latest Verification
- 2026-05-27: `npm test -- --runInBand cli-runtime cli-entrypoint-runtime cli-entrypoint readme-entrypoint-boundary architecture-entrypoint-boundary package-script-boundary` (6 suites, 31 tests)
- 2026-05-27: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-27: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/cli-entrypoint-runtime.ts CLI configuration summary output constants follow-up`.
- Stay on the CLI runtime boundary stream: the next session queue has 15 active tasks covering configuration/test-mode/fatal-startup output constants, port parser naming, dependency normalization, docs guardrails, and package-script source smoke.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
