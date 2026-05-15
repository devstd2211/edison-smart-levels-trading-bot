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
- 2026-05-15: completed the cleanup slice for `PriceChart candle fetch thrown-error handoff recovery guard`, `PriceChart malformed candle payload logging audit`, `PriceChart marker history malformed response logging guard`, `PriceChart malformed marker entry logging audit`, and `PriceChart malformed marker exit payload logging audit`.
- Made `PriceChart` finish uncontrolled candle fetch failures consistently for both resolved and thrown errors, so the loading state clears and controlled-to-uncontrolled handoffs keep the last good snapshot instead of leaving stale handoff state behind.
- Added explicit malformed payload logging for fetched candle entries, malformed marker-history responses, invalid marker entries, and invalid marker exit payloads while still preserving every valid candle and entry marker that can be rendered safely.

## Latest Verification
- 2026-05-15: `npm run build`
- 2026-05-15: `npm --prefix packages/web-client run test -- --runInBand --runTestsByPath src/__tests__/components/price-chart.functional.test.tsx`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
