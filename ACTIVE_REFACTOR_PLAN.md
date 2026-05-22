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
- 2026-05-22: completed the standalone helper/runtime audit slice across the active queue:
  - `packages/core/src/standalone-script-console.ts standalone banner/footer helper boundary audit`
  - `packages/core/src/collect-data.entrypoint.ts standalone data-collector runtime orchestration audit`
  - `packages/core/src/test-balance.entrypoint.ts standalone env/logger helper boundary audit`
  - `packages/core/src/vector-db/cli.ts vector-db command runtime dependency boundary audit`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts standalone script boundary guardrail follow-up`
- `packages/core/src/standalone-script-console.ts` now exposes pure banner/footer formatter helpers alongside the console writers, giving standalone scripts one stable formatting boundary instead of duplicating string assembly in callers.
- `packages/core/src/collect-data.entrypoint.ts` now owns both time-sync fallback resolution and startup-summary logging, so `collect-data.ts` delegates runtime orchestration details back into the helper module.
- `packages/core/src/test-balance.entrypoint.ts` now centralizes environment loading, logger creation, credential reads, and exchange-config assembly through `prepareTestBalanceRuntime`, while `packages/core/src/vector-db/cli.ts` now exposes explicit runtime creation and command-dispatch helpers instead of keeping that orchestration inline.
- Refreshed the standalone helper test coverage with a dedicated `standalone-script-console` suite and strengthened the package boundary guardrail so the standalone script wrappers assert the new helper exports and call sites.

## Latest Verification
- 2026-05-22: `npm test -- --runInBand position-monitor`
- 2026-05-22: `npm test -- --runInBand standalone-script-console collect-data.entrypoint test-balance.entrypoint vector-db.entrypoint package-script-boundary`
- 2026-05-22: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
