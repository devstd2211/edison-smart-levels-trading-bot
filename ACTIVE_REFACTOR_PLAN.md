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
- 2026-05-10: completed the cleanup batch for `FractalSmcWeightingService icon/log cleanup`, `CompoundInterestCalculator config/log icon cleanup`, `EntryConfirmation signal log icon cleanup`, `DeltaAnalyzer signal log icon cleanup`, and `DataCollectorService subscription log icon cleanup`.
- Normalized the touched `FractalSmcWeightingService`, `CompoundInterestCalculatorService`, `EntryConfirmationManager`, `DeltaAnalyzerService`, and `DataCollectorService` user-facing logs onto shared `ICONS`, fixed the remaining mojibake in `FractalSmcWeightingService` and `EntryConfirmationManager`, and extracted `CompoundInterestCalculator` growth-step runtime constants without changing calculation flow.
- Added missing functional coverage for `FractalSmcWeightingService`, `CompoundInterestCalculatorService`, `EntryConfirmationManager`, and `DataCollectorService`, then aligned the existing `DeltaAnalyzerService` functional coverage to the iconized wording.

## Latest Verification
- 2026-05-10: `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.functional.test.ts packages/core/src/__tests__/services/compound-interest-calculator.service.test.ts packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/compound-interest-calculator.functional.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/entry-confirmation.functional.test.ts packages/core/src/__tests__/services/delta-analyzer.service.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.functional.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/data-collector.functional.test.ts`
- 2026-05-10: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
