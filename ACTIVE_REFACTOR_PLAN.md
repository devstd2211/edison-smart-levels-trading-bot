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
- 2026-05-27: completed the CLI/web entrypoint runtime handoff slice across ten related tasks:
  - `packages/core/src/cli/index.ts CLI composition-root config handoff audit follow-up`
  - `packages/core/src/cli/cli-entrypoint-runtime.ts CLI startup config helper boundary follow-up`
  - `packages/core/src/cli/cli-entrypoint-runtime.ts CLI runtime factory handoff helper follow-up`
  - `packages/core/src/cli/cli-entrypoint-runtime.ts CLI web runtime handoff helper follow-up`
  - `packages/core/src/__tests__/cli/cli-entrypoint-runtime.test.ts CLI startup helper guardrail follow-up`
  - `packages/core/src/__tests__/cli/cli-entrypoint.functional.test.ts CLI config/runtime handoff functional guardrail follow-up`
  - `packages/core/src/web/index.ts web runtime-pair wording audit follow-up`
  - `packages/core/src/web/web-entrypoint-runtime.ts WebServer instance factory extraction follow-up`
  - `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts web runtime-pair constructor/start guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts CLI/web handoff source guardrail follow-up`
- `packages/core/src/cli/index.ts` now keeps startup config loading, bot runtime creation, and web runtime-pair creation behind named helper calls instead of open-coding those handoffs in the composition root.
- `packages/core/src/web/web-entrypoint-runtime.ts` now separates WebServer construction from startup through `createWebServerInstance(...)`, so tests can guard the adapter handoff before lifecycle start.
- `packages/core/src/web/index.ts` documents that the workspace WebServer receives an already-materialized runtime pair.

## Latest Verification
- 2026-05-27: `npm --prefix packages/core test -- --runInBand cli-entrypoint cli-entrypoint-runtime web-entrypoint.functional`
- 2026-05-27: `npm test -- --runInBand package-script-boundary`
- 2026-05-27: `npm test -- --runInBand position-monitor`
- 2026-05-27: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `README.md CLI/web runtime handoff wording follow-up`.
- Stay on the entrypoint-boundary stream: align docs guardrails and the remaining web-boundary helper coverage before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
