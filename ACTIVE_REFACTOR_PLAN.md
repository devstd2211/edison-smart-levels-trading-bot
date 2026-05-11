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
- 2026-05-11: completed the cleanup batch for `TelegramService alert icon cleanup`, `TradingLifecycleManager transition log icon cleanup`, `PositionStateMachine transition mojibake cleanup`, `WhaleDetection direction mojibake cleanup`, and `ConsoleDashboard format progress-bar mojibake cleanup`.
- Normalized the touched `TelegramService`, `TradingLifecycleManager`, `PositionStateMachineService`, `WhaleDetectionService`, and `ConsoleDashboardService` onto shared `ICONS` or ASCII-safe transition/progress markers, keeping the refactor behavior-preserving while removing broken glyphs from user-facing text.
- Added missing functional coverage for `TelegramService`, `TradingLifecycleManager`, and `WhaleDetectionService`, then aligned the existing `PositionStateMachineService` and `ConsoleDashboardService` suites to the cleaned wording and progress formatting.

## Latest Verification
- 2026-05-11: `npm test -- --runInBand position-monitor`
- 2026-05-11: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/telegram.error-handling.test.ts packages/core/src/__tests__/services/telegram.functional.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.functional.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.functional.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/whale-detection.functional.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/console-dashboard.functional.test.ts packages/core/src/__tests__/services/console-dashboard-state.utils.test.ts`
- 2026-05-11: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
