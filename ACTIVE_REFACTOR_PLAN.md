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
- 2026-05-14: completed the cleanup batch for `PositionCard unrealizedPnL zero-direction copy guard`, `BalanceCard unrealizedPnL zero-direction copy guard`, `LogConsole realized pnl zero-direction copy guard`, `Analytics totalPnL zero-direction color guard`, and `EquityCurve sample-data placeholder determinism cleanup`.
- Reworked the affected dashboard and analytics views so explicit `0` PnL values now render as neutral states instead of falling through profit styling/copy, and the fallback `EquityCurve` sample data is now deterministic instead of being generated from `Math.random()`.
- Added functional coverage for the neutral `PositionCard`, `BalanceCard`, `LogConsole`, and `Analytics` zero-PnL states, plus deterministic fallback coverage for `EquityCurve`.

## Latest Verification
- 2026-05-14: `npm run build`
- 2026-05-14: `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/dashboard-copy.functional.test.tsx src/__tests__/components/log-console.functional.test.tsx src/__tests__/components/analytics.functional.test.tsx src/__tests__/components/equity-curve.functional.test.tsx`
- 2026-05-14: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
