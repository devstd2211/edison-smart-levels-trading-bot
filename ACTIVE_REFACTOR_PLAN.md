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
- 2026-05-24: completed the web-server file-watcher lifecycle/read logging slice across the active queue:
  - `packages/web-server/src/services/file-watcher.service.ts file-watcher lifecycle/read log boundary follow-up`
  - `packages/web-server/src/logging/request-scoped-error-log.ts file-watcher lifecycle/read payload helper follow-up`
  - `packages/web-server/src/index.ts sigterm/file-watcher lifecycle log payload convergence follow-up`
  - `packages/web-server/tests/web-server.functional.test.ts file-watcher lifecycle/sigterm log guardrail follow-up`
  - `packages/web-server/tests/ws-server.functional.test.ts websocket/file-watcher retry isolation guardrail follow-up`
- `request-scoped-error-log.ts` now exposes a dedicated file-watcher payload helper that normalizes lifecycle, read-update, and read-failure events through the same structured error boundary.
- `file-watcher.service.ts` now emits helper-backed watcher start/stop, read-update, and read-failure payloads instead of ad-hoc objects, while `index.ts` emits structured SIGTERM shutdown-requested payloads for the API runtime path.
- Functional coverage now pins file-watcher lifecycle/read payloads, SIGTERM shutdown logging, and websocket retry isolation so the shared logging helpers cannot silently drift across these boundaries.

## Latest Verification
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand web-server.functional`
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand ws-server.functional`
- 2026-05-24: `npm --prefix packages/web-server test -- --runInBand ws-server.functional web-server.functional`
- 2026-05-24: `npm test -- --runInBand position-monitor`
- 2026-05-24: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/services/config-management.service.ts config backup/restore log payload convergence follow-up`.
- Keep the same rule: continue one production component at a time through the refreshed structured-logging queue around `config-management.service.ts`, `request-scoped-error-log.ts`, `bot-bridge.service.ts`, and the focused web-server functional guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
