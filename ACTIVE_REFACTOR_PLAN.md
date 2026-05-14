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
- 2026-05-14: completed the cleanup batch for `EquityCurve totalReturn zero-direction percentage sign guard`, `BalanceCard pnlPercent zero-value width guard`, `BalanceCard pnlPercent zero-direction sign guard`, `LiveTicker priceChangePercent zero-value width guard`, and `AdvancedAnalytics drawdown zero-maxDrawdown width guard`.
- Extracted shared web-client metric direction/ratio helpers so neutral `0` values no longer depend on ad hoc `> 0` checks or inline width arithmetic.
- Reworked `EquityCurve`, `BalanceCard`, `LiveTicker`, and `AdvancedAnalytics` to preserve neutral zero display state for signs, colors, and progress geometry without leaking fallback positive widths.

## Latest Verification
- 2026-05-14: `npm run build`
- 2026-05-14: `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/equity-curve.functional.test.tsx src/__tests__/components/dashboard-copy.functional.test.tsx src/__tests__/components/advanced-analytics.functional.test.tsx src/__tests__/utils/metric-direction.test.ts`
- 2026-05-14: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
