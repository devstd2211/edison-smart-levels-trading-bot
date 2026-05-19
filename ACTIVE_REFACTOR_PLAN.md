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
- 2026-05-19: completed five web-server/test-harness/runtime follow-up slices:
  - `web-server websocket request-validation error helper convergence in parse/dispatch paths`
  - `web-server api entrypoint SIGTERM shutdown helper extraction`
  - `managed harness cleanup helper reuse in remaining lifecycle/delta/indicator/bybit managed contexts`
  - `web-server bridge signal event helper reuse in remaining bot-event emit paths`
  - `core package programmatic API return-shape guardrail follow-up`
- Converged websocket invalid JSON, invalid structure, and unknown-type request failures through one validation error helper, extracted package-local SIGTERM registration/unregistration helpers in the API entrypoint, and reused one managed harness tracker across delta/indicator/bybit/position-lifecycle helper contexts instead of repeating tracked-harness plumbing.
- Replaced ad-hoc signal websocket message assembly in `BotBridgeService` with shared signal message builders plus batched emit reuse, and tightened the core programmatic guardrails so `createConfiguredBotRuntime()` stays documented and tested as the non-starting helper that returns the full runtime bundle shape.

## Latest Verification
- 2026-05-19: `npm test -- --runInBand ws-server bot-bridge`
- 2026-05-19: `npm test -- --runInBand managed-test-context core-entrypoint readme-entrypoint package-script-boundary`
- 2026-05-19: `npm test -- --runInBand delta-analyzer indicator-precalculation bybit-repository-integration position-lifecycle`
- 2026-05-19: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
