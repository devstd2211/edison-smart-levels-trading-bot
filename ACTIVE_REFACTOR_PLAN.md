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
- 2026-05-31: completed `packages/core/src/services/factories/builders/orchestrator-handlers.builder.ts orchestrator handlers runtime builder boundary follow-up`.
- 2026-05-31: completed `packages/core/src/services/factories/builders/risk-manager-service.builder.ts risk-manager runtime builder boundary follow-up`.
- 2026-05-31: completed `packages/core/src/services/factories/builders/core-infrastructure.builder.ts core infrastructure runtime builder dependency boundary follow-up`.
- `orchestrator-handlers.builder.ts` now builds around an explicit handler config slice and a narrowed event/BTC-link seam, removing the duplicate orchestrator BTC store wiring while keeping handler construction behavior intact.
- `risk-manager-service.builder.ts` now owns an explicit dependency slice for logger plus error-handler handoff, so the builder no longer reaches through the full mutable bot state to construct `RiskManager`.
- `core-infrastructure.builder.ts` now normalizes dashboard, logging, analyzer, strategy-meta, and indicator inputs through a dedicated infrastructure config slice, and the new functional suite covers both direct initialization and factory-path wiring.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/services/orchestrator-handlers.builder.functional.test.ts packages/core/src/__tests__/services/risk-manager.builder.functional.test.ts packages/core/src/__tests__/services/core-infrastructure.builder.functional.test.ts` (3 suites, 8 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/factories/builders/exchange-services.builder.ts exchange runtime builder dependency boundary follow-up`.
- Keep the next batch on the runtime builder and websocket-support stream so exchange, journal-market-data, and websocket-manager seams converge before circling back to the remaining entrypoint guardrails.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
