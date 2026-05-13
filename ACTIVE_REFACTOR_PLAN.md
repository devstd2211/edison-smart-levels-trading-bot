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
- 2026-05-13: completed the cleanup batch for `LiveTicker fetched currentPrice zero-value update guard`, `OrderBook best bid zero-value fallback guard`, `OrderBook best ask zero-value fallback guard`, `Control maxPositionSize zero-value summary guard`, and `LogConsole signal confidence zero-value fallback guard`.
- Replaced the affected web-client truthiness fallbacks with explicit numeric boundary checks so LiveTicker no longer drops a legitimate `0` between WebSocket and store sync, OrderBook summary prices keep visible zero values, Control risk summary keeps a saved zero position size, and LogConsole treats signal confidence as a numeric boundary instead of a truthy value.
- Added focused functional coverage for the LiveTicker WebSocket-to-store zero-price path, OrderBook top-of-book zero summaries, Control risk-summary zero rendering, and LogConsole zero-confidence log formatting so the `0` vs `undefined` distinction stays locked in at those boundaries.

## Latest Verification
- 2026-05-13: `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/dashboard-copy.functional.test.tsx src/__tests__/pages/orderbook.test.tsx src/__tests__/pages/control-zero-value.functional.test.tsx src/__tests__/components/log-console.functional.test.tsx`
- 2026-05-13: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
