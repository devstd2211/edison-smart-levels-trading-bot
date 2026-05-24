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
- 2026-05-24: completed the web-server websocket/docs helper slice across the active queue:
  - `packages/web-server/src/websocket/ws-server.ts websocket request-validation log sink follow-up`
  - `packages/web-server/src/logging/request-scoped-error-log.ts request-scoped log payload boundary follow-up`
  - `packages/web-server/src/index.ts docs html runtime-discovery presentation follow-up`
  - `packages/web-server/tests/ws-server.functional.test.ts websocket request-validation log contract follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts docs html/runtime discovery guardrail follow-up`
- `request-scoped-error-log.ts` now exposes websocket-specific validation/read-failure log helpers, so `ws-server.ts` no longer rebuilds those payloads inline.
- `ws-server.ts` now routes both request-validation logs and read-failure logs through explicit helper boundaries while keeping websocket client envelopes unchanged.
- `index.ts` now exports the docs HTML builder, and `web-server.functional.test.ts` pins the runtime-discovery section, links, and endpoint references directly against that shared helper.

## Latest Verification
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand request-logging.middleware error-handler.middleware ws-server.functional web-server.functional`
- 2026-05-24: `npm test -- --runInBand position-monitor`
- 2026-05-24: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/websocket/ws-server.ts websocket server-event log boundary follow-up`.
- Keep the same rule: continue one production component at a time through the refreshed web-server logging/docs queue around `ws-server.ts`, `request-scoped-error-log.ts`, `index.ts`, and the focused websocket/docs guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
