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
- 2026-05-11: completed the cleanup batch for `SessionStatsService residual emoji/log cleanup`, `WhaleWallTp adjusted-range arrow wording cleanup`, `TradingOrchestrator residual mojibake comment cleanup`, `ExitDecisions state-transition arrow wording cleanup`, and `AdvancedOrderStateMachine invalid-transition arrow wording cleanup`.
- Normalized the touched `SessionStatsService`, `WhaleWallTPService`, `TradingOrchestrator`, `evaluateExit`, and `AdvancedOrderStateMachineService` onto shared `ICONS` or ASCII-safe `->` transition wording, keeping the refactor behavior-preserving while removing broken glyphs and Unicode arrows from user-facing telemetry.
- Added missing functional coverage for `SessionStatsService`, `WhaleWallTPService`, and `evaluateExit`, then aligned the existing `AdvancedOrderStateMachineService` suites to the ASCII-safe transition wording while keeping the existing `TradingOrchestrator` functional coverage green.

## Latest Verification
- 2026-05-11: `npm test -- --runInBand position-monitor`
- 2026-05-11: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/session-stats.service.test.ts packages/core/src/__tests__/services/session-stats.error-handling.test.ts packages/core/src/__tests__/services/session-stats.functional.test.ts packages/core/src/__tests__/whale-wall-tp.service.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.functional.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.functional.test.ts packages/core/src/__tests__/decision-engine/exit-decisions.test.ts packages/core/src/__tests__/decision-engine/exit-decisions.functional.test.ts packages/core/src/__tests__/services/trading-orchestrator.functional.test.ts packages/core/src/__tests__/services/trading-orchestrator.error-handling.test.ts`
- 2026-05-11: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
