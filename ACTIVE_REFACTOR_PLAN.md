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
- 2026-05-09: completed the cleanup batch for `ExchangeFactory residual mojibake/log wording cleanup`, `RealTimeRiskMonitor cached-health icon/log cleanup`, `MicroWallDetector icon/log cleanup`, `GracefulShutdown error-handling test icon constant adoption`, and `StrategyOrchestrator phase-comment/doc wording cleanup`.
- Normalized the touched `ExchangeFactoryService`, `RealTimeRiskMonitorService`, and `MicroWallDetectorService` user-facing logs onto shared `ICONS`, replaced the remaining mojibake warning/success strings, and kept snapshot-vs-state wording unchanged where the mutable domain state is the real concept.
- Cleaned `StrategyOrchestratorService` phase comments and public method docs to remove mojibake arrows without changing behavior, aligned the graceful-shutdown fallback assertions to the shared warning icon contract, and kept the refactor coupled to the touched production components.
- Added missing functional coverage for `MicroWallDetectorService` and extended the exchange-factory and real-time-risk-monitor suites to assert the updated ICON-based log contracts directly.

## Latest Verification
- 2026-05-09: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/exchange-factory.service.test.ts packages/core/src/__tests__/services/exchange-factory.error-handling.test.ts packages/core/src/__tests__/services/exchange-factory.functional.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.service.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.functional.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.functional.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/strategy-orchestrator.functional.test.ts packages/core/src/__tests__/phase-10-3b-orchestrator-implementation.test.ts packages/core/src/__tests__/phase-10-multi-strategy.test.ts`
- 2026-05-09: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
