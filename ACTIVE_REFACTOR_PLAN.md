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
- 2026-05-31: completed `packages/core/src/__tests__/services/optional-services.builder.functional.test.ts optional runtime builder guardrail follow-up`.
- 2026-05-31: completed `packages/core/src/__tests__/services/monitoring-resilience.builder.functional.test.ts monitoring resilience runtime builder guardrail follow-up`.
- 2026-05-31: completed `packages/core/src/services/factories/builders/optional-services.builder.ts optional runtime builder boundary follow-up`.
- 2026-05-31: completed `packages/core/src/services/factories/builders/monitoring-resilience.builder.ts monitoring resilience runtime builder boundary follow-up`.
- `optional-services.builder.ts` now exposes explicit foundational, execution, and optional-monitoring phases with a narrowed builder-state contract instead of one full-state composition-root step.
- `monitoring-resilience.builder.ts` now separates monitoring-health setup from resilience setup, and both suites assert against raw builder-state ownership rather than finalized runtime-source casts.

## Latest Verification
- 2026-05-31: `npm test -- --runInBand packages/core/src/__tests__/services/optional-services.builder.functional.test.ts packages/core/src/__tests__/services/monitoring-resilience.builder.functional.test.ts` (2 suites, 11 tests)
- 2026-05-31: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-31: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/factories/bot-factory-options.ts runtime option contract boundary follow-up`.
- Keep the next batch on the runtime-builder dependency stream so the narrowed builder-state seams can continue converging across `bot-factory-options`, grouped builder inputs, and runtime-core ownership.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
