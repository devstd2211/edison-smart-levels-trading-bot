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
- 2026-05-27: completed the 15-task CLI/web runtime handoff parity slice.
- `packages/core/src/cli/cli-entrypoint-runtime.ts` now documents `createCliWebRuntimeHandoff(...)` as runtime-pair materialization without lifecycle start.
- `packages/core/src/cli/index.ts`, `packages/core/src/web/index.ts`, and `packages/core/src/web/web-entrypoint-runtime.ts` now align wording around CLI handoff order and web construction/start split.
- `README.md` and `ARCHITECTURE_QUICK_START.md` now include the execution/runtime flow: config load, core runtime creation, `createCliWebRuntimeHandoff(...)`, `startWebServer(...)`, then bot lifecycle start.
- Related CLI, web, docs, package-script, and legacy wrapper guardrails now assert call order, construction-only behavior, source wording, and cwd-stable docs lookup.

## Latest Verification
- 2026-05-27: `npm test -- --runInBand cli-entrypoint-runtime cli-entrypoint web-entrypoint web-boundary readme-entrypoint-boundary architecture-entrypoint-boundary legacy-entrypoint package-script-boundary`
- 2026-05-27: `npm test -- --runInBand position-monitor`
- 2026-05-27: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/cli-entrypoint-runtime.ts CLI startup output boundary wording follow-up`.
- Stay on the entrypoint-boundary stream: the next session queue has 15 active tasks covering CLI startup output, web startup degradation order, web position mapping, public export wording, docs guardrails, and legacy wrapper export-surface parity.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
