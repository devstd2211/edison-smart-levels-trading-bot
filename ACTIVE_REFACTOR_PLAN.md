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
- 2026-05-26: completed the config-loader seam / compatibility-wrapper boundary wording slice across ten related tasks:
  - `packages/core/src/core/core-entrypoint-runtime.ts config-loader seam wording follow-up`
  - `packages/core/src/config/index.ts public loader-surface wording follow-up`
  - `packages/core/src/legacy-entrypoint-runtime.ts compatibility wrapper export-surface wording follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts compatibility-wrapper loader-seam wording guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts core/web export-list parity smoke follow-up`
  - `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts configured helper loader-seam guardrail follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts wrapper/core export-separation guardrail follow-up`
  - `packages/core/src/__tests__/web/web-boundary.test.ts explicit runtime-pair constructor guardrail follow-up`
  - `packages/core/src/web/index.ts runtime-pair starter wording parity follow-up`
  - `README.md legacy-root vs programmatic helper example split follow-up`
- `packages/core/src/core/core-entrypoint-runtime.ts` now states the shared `loadBotRuntimeConfig(loader?)` seam explicitly, and `packages/core/src/config/index.ts` now frames the publishable ConfigPipeline loader/runtime helpers as one public barrel.
- `packages/core/src/legacy-entrypoint-runtime.ts` and `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts` now pin the legacy root as a compatibility wrapper whose export surface stays limited to runtime helpers plus the CLI handoff, without widening into `@edison/core/web`.
- `packages/core/src/web/index.ts`, `README.md`, `ARCHITECTURE_QUICK_START.md`, and the related guardrail tests now use the same wording for the two-step runtime-pair flow: build the pair first, then pass it to `startWebServer(runtime, ports)`.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand architecture-entrypoint-boundary core-entrypoint legacy-entrypoint readme-entrypoint-boundary web-boundary`
- 2026-05-26: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports|workspace packages expose stable export maps instead of source-path entrypoints|root workspace scripts delegate build and test flows through package-level entrypoints in dependency order"`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/index.ts legacy wrapper compatibility wording parity follow-up`.
- Stay on the entrypoint-boundary stream: finish the remaining root-wrapper/doc/test parity around the compatibility wrapper and public helper examples before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
