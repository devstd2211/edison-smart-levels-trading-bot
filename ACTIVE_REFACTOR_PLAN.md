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
- 2026-05-20: completed five web-server/test-harness/runtime follow-up slices:
  - `web-server websocket close/wait helper convergence in remaining functional harness paths`
  - `web-server api entrypoint runtime close-state helper follow-up`
  - `managed harness cleanup helper reuse in remaining public-websocket/monitoring-server contexts`
  - `web-server bridge lifecycle route response helper convergence`
  - `core package configured/runtime helper example wording follow-up`
- Converged the remaining `ws-server` functional setup/teardown through shared harness helpers, and widened the web-server runtime clear-helper so shutdown handler state now resets through the same nullable-target path as API and websocket runtime references.
- Reused the shared managed cleanup primitives in the remaining `public-websocket` and `monitoring-server` helper contexts, moved HTTP status/position reads onto bridge read APIs while collapsing bot lifecycle success/error route shaping behind one helper, and tightened README wording so `createConfiguredBotRuntime()` is documented as returning the bot plus runtime adapters without auto-starting lifecycle.

## Latest Verification
- 2026-05-20: `npm test -- --runInBand ws-server data.routes bot.routes web-server`
- 2026-05-20: `npm test -- --runInBand public-websocket monitoring-server readme-entrypoint-boundary web-entrypoint-boundary web-boundary`
- 2026-05-20: `npm test -- --runInBand position-monitor`
- 2026-05-20: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
