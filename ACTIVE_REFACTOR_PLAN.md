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
- 2026-05-09: completed the cleanup batch for `StrategyCircuitBreaker getState alias retirement`, `DynamicConfigManager multi-strategy icon/log cleanup`, `StrategyFactory residual snapshot/log wording cleanup`, `StrategyOrchestrator phase-10 creation log wording cleanup`, and `GracefulShutdown strategy recovery icon wording cleanup`.
- Removed the deprecated `StrategyCircuitBreakerService.getState()` compatibility alias, kept detached `getStateSnapshot()` reads as the public API, and converted the phase-11 suite to use explicit mutable test internals only where transition simulation still needs live breaker state.
- Normalized the touched `DynamicConfigManagerService`, `StrategyFactoryService`, `StrategyOrchestratorService`, and `GracefulShutdownManager` user-facing logs onto stable wording and shared `ICONS`, replacing the remaining mojibake retry/recovery messages and tightening snapshot-vs-state wording where the flow is observational.
- Added missing functional coverage for `DynamicConfigManagerService` and `GracefulShutdownManager`, and extended factory/orchestrator coverage to assert the new snapshot/log contracts directly.

## Latest Verification
- 2026-05-09: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/phase-11-circuit-breaker.test.ts packages/core/src/__tests__/services/strategy-circuit-breaker.functional.test.ts packages/core/src/__tests__/phase-10-multi-strategy.test.ts packages/core/src/__tests__/phase-10-3b-orchestrator-implementation.test.ts packages/core/src/__tests__/services/strategy-factory.functional.test.ts packages/core/src/__tests__/services/dynamic-config-manager.functional.test.ts packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.functional.test.ts packages/core/src/__tests__/services/strategy-orchestrator.functional.test.ts`
- 2026-05-09: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/smoke-tests/initialization.smoke.test.ts`
- 2026-05-09: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
