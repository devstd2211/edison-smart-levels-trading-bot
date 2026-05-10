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
- 2026-05-10: completed the cleanup batch for `FundingRateFilter cache/update log icon cleanup`, `MarketConditionAnalyzer regime log icon cleanup`, `MultiTimeframeTrend consensus log icon cleanup`, `PositionSync deep-sync log icon cleanup`, and `PositionExiting partial-close/breakeven log icon cleanup`.
- Normalized the touched `FundingRateFilterService`, `MarketConditionAnalyzerService`, `MultiTimeframeTrendService`, `PositionSyncService`, and `PositionExitingService` user-facing logs and alerts onto shared `ICONS` without changing decision, retry, sync, or exit semantics.
- Added missing functional coverage for `FundingRateFilterService`, `MarketConditionAnalyzerService`, `MultiTimeframeTrendService`, and `PositionSyncService`, and aligned the existing `PositionExitingService` suites to the iconized wording.

## Latest Verification
- 2026-05-10: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/funding-rate-filter.functional.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/market-condition-analyzer.functional.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.functional.test.ts packages/core/src/__tests__/services/position-sync.service.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/position-sync.functional.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts`
- 2026-05-10: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
