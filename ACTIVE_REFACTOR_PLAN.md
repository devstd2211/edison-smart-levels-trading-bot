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
- 2026-05-14: completed the cleanup batch for `Analytics filter panel state rehydration guard`, `Analytics journal fetch stale-response overwrite guard`, `PriceChart prop-controlled loading state guard`, `PriceChart marker history stale-response overwrite guard`, and `PriceChart chart instance recreation churn cleanup`.
- Reworked `Analytics` around derived filtering so fetched journal data is filtered against the latest active filter instead of a stale closure, and synchronized `FilterPanel` local inputs from the parent filter state so programmatic resets and rehydration paths stay consistent.
- Reworked `PriceChart` around split chart lifecycle/update effects so the chart instance is created once, controlled candles disable loading immediately, and marker history now follows last-request-wins semantics instead of briefly applying stale reload responses.

## Latest Verification
- 2026-05-14: `npm test -- --runInBand position-monitor`
- 2026-05-14: `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/price-chart.functional.test.tsx`
- 2026-05-14: `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/analytics.functional.test.tsx`
- 2026-05-14: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
