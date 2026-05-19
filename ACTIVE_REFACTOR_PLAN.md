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
- 2026-05-19: completed five bridge/lifecycle/test-harness/runtime follow-up slices:
  - `web-server bridge error event helper reuse in remaining bot-event emit paths`
  - `web-server websocket read-response failure helper convergence in bootstrap/request paths`
  - `lifecycle manager shutdown signal helper adoption in remaining shutdown-capable managers`
  - `tracked services harness async cleanup finalization helper convergence`
  - `core package programmatic API example guardrail follow-up`
- Routed forwarded bot errors plus `startBot()` / `stopBot()` failures through shared `BotBridgeService.createErrorMessage()` emission, then converged websocket status/position bootstrap and explicit request replies through one `sendReadResponse()` helper so typed `STATUS_READ_FAILED` / `POSITION_READ_FAILED` envelopes and outbound logging stay aligned.
- Replaced ad-hoc `GracefulShutdownManager` signal label/reason branching with shared signal metadata, converged managed test-context cleanup finalization across sync/async helpers, and expanded the README programmatic example with public `createConfiguredBotRuntime()` custom-loader usage backed by README boundary assertions.

## Latest Verification
- 2026-05-19: `npm test -- --runInBand position-monitor`
- 2026-05-19: `npm test -- --runInBand ws-server bot-bridge`
- 2026-05-19: `npm test -- --runInBand graceful-shutdown managed-test-context readme-entrypoint package-script-boundary`
- 2026-05-19: `npm test -- --runInBand web-server.functional`
- 2026-05-19: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
