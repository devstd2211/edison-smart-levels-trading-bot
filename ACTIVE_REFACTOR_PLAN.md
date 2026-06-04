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
- 2026-06-04: completed `packages/web-server/src/routes/config.routes.ts web server config route transport boundary follow-up`.
- 2026-06-04: completed `packages/web-server/tests/bot.routes.functional.test.ts web server bot route runtime boundary follow-up`.
- 2026-06-04: completed `packages/core/src/web/web-entrypoint-runtime.ts web runtime composition guardrail follow-up`.
- `config.routes.ts` no longer loads `.env` at import time; runtime config discovery now defers that side effect until the `/api/config/server` payload is actually resolved.
- `bot.routes.ts` now treats lifecycle controls as sync-or-async route delegates, so start/stop transport mapping stays stable even when the bridge implementation becomes asynchronous.
- `web-entrypoint-runtime.ts` now tracks adapter-owned event-bus subscriptions and clears only those listeners, preventing leaked runtime bus handlers when the web adapter removes listeners.

## Latest Verification
- 2026-06-04: `npm --prefix packages/web-server run test -- --runInBand tests/web-server.functional.test.ts tests/config.routes.test.ts tests/bot.routes.functional.test.ts` (3 suites, 61 tests)
- 2026-06-04: `npm --prefix packages/core run test -- --runInBand src/__tests__/web/web-boundary.test.ts src/__tests__/web/web-entrypoint.functional.test.ts` (2 suites, 16 tests)
- 2026-06-04: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-04: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts`, `packages/core/src/core/index.ts`, and `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts`.
- Continue down the core entrypoint/runtime queue before expanding into the config entrypoint follow-up tasks.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
