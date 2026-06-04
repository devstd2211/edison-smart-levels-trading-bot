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
- 2026-06-04: completed `packages/web-server/src/routes/config-route-contracts.ts web server runtime port contract guardrail follow-up`.
- 2026-06-04: completed `packages/web-server/tests/route-response.test.ts web server shared route response guardrail follow-up`.
- 2026-06-04: completed `packages/web-server/tests/bot-bridge.service.test.ts web server runtime adapter read fallback guardrail follow-up`.
- `config-route-contracts.ts` now validates runtime port values before building the shared config payload, so invalid injected ports fall back to canonical defaults instead of leaking `0`/`NaN` transport values.
- `route-response.ts` now normalizes `x-request-id` at the shared route context boundary, so success and structured error envelopes consume the same narrowed request-id contract.
- `bot-bridge.service.ts` now treats non-finite balance reads as fallback scenarios, preserving the normalized status payload and bridge-read error path instead of emitting `NaN`.

## Latest Verification
- 2026-06-04: `npm --prefix packages/web-server run test -- --runInBand tests/route-response.test.ts tests/bot-bridge.service.test.ts tests/web-server.functional.test.ts` (3 suites, 64 tests)
- 2026-06-04: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-04: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/web-server/src/routes/config.routes.ts`, `packages/web-server/tests/bot.routes.functional.test.ts`, and `packages/core/src/web/web-entrypoint-runtime.ts`.
- Finish the remaining web-server config/runtime transport handoff before continuing down the core runtime entrypoint queue.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
