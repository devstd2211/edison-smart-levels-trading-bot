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
- 2026-05-06: completed the `Web-client config/runtime API contract cleanup` slice.
- Promoted shared config DTOs into `@edison/contracts` for the config, risk, schema, backup, and history flows so the web client and web server now share explicit payload contracts instead of passing generic `Record<string, unknown>` across the API boundary.
- Tightened `ConfigManagementService`, `config.routes`, and `ConfigApi` around those contracts, including typed responses for `/config`, `/config/schema`, `/config/history`, `/config/backups`, and `/config/risk`.
- Reworked the client bootstrap and control-side config consumers so `App` now reads the real server config shape (`exchange.symbol`, `timeframes.primary.interval`, `riskManagement.stopLossPercent`) instead of stale ad hoc fields, and the config editor/risk UI now validate and submit typed payloads.
- Fixed the risk-update boundary to keep legacy `risk` and active `riskManagement` shapes aligned for overlapping fields, avoiding a type-only cleanup that still wrote to the wrong config branch at runtime.

## Latest Verification
- 2026-05-06: `npm test -- --runInBand position-monitor`
- 2026-05-06: `npm test -- --runInBand --runTestsByPath packages/web-server/tests/web-server.functional.test.ts packages/web-client/src/__tests__/services/api.service.test.ts packages/web-client/src/__tests__/services/websocket.service.test.ts`
- 2026-05-06: `npm run build`

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
