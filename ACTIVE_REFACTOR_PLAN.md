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
- 2026-05-27: completed the CLI/web runtime handoff docs and WebServer construction guardrail slice across five related tasks:
  - `README.md CLI/web runtime handoff wording follow-up`
  - `ARCHITECTURE_QUICK_START.md CLI/web runtime handoff wording follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts CLI/web runtime handoff docs guardrail follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts CLI/web runtime handoff docs guardrail follow-up`
  - `packages/core/src/__tests__/web/web-boundary.test.ts createWebServerInstance runtime-pair guardrail follow-up`
- `README.md` and `ARCHITECTURE_QUICK_START.md` now state that CLI startup materializes the explicit web runtime pair through `createCliWebRuntimeHandoff(...)` before handing it to the web starter.
- The docs now describe the internal construction/lifecycle split: `createWebServerInstance(...)` constructs from the already-materialized pair, while `startWebServerRuntime(...)` owns startup.
- `packages/core/src/__tests__/web/web-boundary.test.ts` now guards that `createWebServerInstance(...)` constructs the workspace WebServer without starting lifecycle.

## Latest Verification
- 2026-05-27: `npm --prefix packages/core test -- --runInBand readme-entrypoint-boundary architecture-entrypoint-boundary web-boundary`
- 2026-05-27: `npm test -- --runInBand position-monitor`
- 2026-05-27: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/cli-entrypoint-runtime.ts CLI web runtime handoff helper wording follow-up`.
- Stay on the entrypoint-boundary stream: the next session queue has 15 active tasks covering CLI helper handoff, web construction/start split, docs guardrails, package-script smoke, and legacy wrapper parity.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
