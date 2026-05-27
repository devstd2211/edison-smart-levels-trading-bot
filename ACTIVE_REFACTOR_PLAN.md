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
- 2026-05-27: completed the 15-task CLI/web startup degradation and export-surface wording slice.
- CLI startup output now names embedded Web Server runtime handoff and reports embedded web startup degradation before bot lifecycle start.
- CLI functional guardrails assert web starter failure is logged/warned before `bot.start()` and shutdown is registered with no web server instance.
- Web runtime/source guardrails now document adapter-only position mapping and keep `@edison/core/web` focused on runtime-pair construction plus lifecycle start.
- Legacy root wrapper wording and guardrails now keep root compatibility limited to core helpers plus the legacy CLI handoff, with web startup helpers staying on `@edison/core/web`.
- README and architecture docs now include embedded web startup degradation behavior in the CLI runtime order.

## Latest Verification
- 2026-05-27: `npm test -- --runInBand cli-entrypoint-runtime cli-entrypoint web-entrypoint web-boundary readme-entrypoint-boundary architecture-entrypoint-boundary legacy-entrypoint package-script-boundary` (8 suites, 52 tests)
- 2026-05-27: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-27: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/cli-runtime.ts CLI port default constants boundary follow-up`.
- Stay on the CLI runtime boundary stream: the next session queue has 15 active tasks covering CLI port defaults, exchange-mode output helpers, active-strategy priority, CLI dependency-injection wording, docs guardrails, and package-script source smoke.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
