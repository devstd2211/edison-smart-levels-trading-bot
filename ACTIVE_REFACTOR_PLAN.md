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
- 2026-05-10: completed the cleanup batch for `TradingJournal residual mojibake/log cleanup`, `TradeHistory CSV icon/log cleanup`, `WebSocketEventHandlerManager icon/log cleanup`, `VolumeProfile icon/log cleanup`, and `CoreInfrastructureBuilder console log icon cleanup`.
- Normalized the touched `TradingJournalService`, `TradeHistoryService`, `WebSocketEventHandlerManager`, `VolumeProfileService`, and `core-infrastructure.builder` user-facing logs onto shared `ICONS`, removed the remaining mojibake/error glyph fallout in those paths, and kept the changes behavior-preserving.
- Replaced the builder's analyzer bullet output with ASCII-safe formatting, kept the production/test coupling for each touched component, and avoided broad regex-only rewrites by updating concrete log call sites and related helpers directly.
- Added missing functional coverage for `TradeHistoryService`, including the explicit lifecycle start boundary and dynamic CSV schema persistence on appended custom fields.

## Latest Verification
- 2026-05-10: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts packages/core/src/__tests__/services/trading-journal.functional.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/services/trade-history.functional.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/grouped-services.builder.functional.test.ts packages/core/src/__tests__/services/optional-services.builder.functional.test.ts packages/core/src/__tests__/services/position-management.builder.functional.test.ts packages/core/src/__tests__/services/monitoring-resilience.builder.functional.test.ts packages/core/src/__tests__/services/orchestrator-handlers.builder.functional.test.ts packages/core/src/__tests__/services/risk-manager.builder.functional.test.ts packages/core/src/__tests__/services/websocket-monitoring.builder.functional.test.ts`
- 2026-05-10: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
