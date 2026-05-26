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
- 2026-05-26: completed the next config-only loader contract slice across ten related tasks:
  - `packages/core/src/config/config-pipeline.ts ConfigPipelineLoader loader type alias extraction follow-up`
  - `packages/core/src/config/config-pipeline.ts default base-config loader helper extraction follow-up`
  - `packages/core/src/config/config-pipeline.ts startup vs pipeline-only validator split follow-up`
  - `packages/core/src/core/core-entrypoint-runtime.ts config-only loader seam wording parity follow-up`
  - `packages/core/src/core/core-entrypoint-runtime.ts configured action helper alias follow-up`
  - `packages/core/src/__tests__/config/config-pipeline.functional.test.ts config-only default no-validation guardrail follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts compatibility loader passthrough guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts config-only contract extraction smoke follow-up`
  - `README.md config/core split import example fix follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts config/core split import guardrail follow-up`
- `packages/core/src/config/config-pipeline.ts` now separates the base-config loader and validator function contracts from the composed `ConfigPipelineLoader`, and keeps the default validated path distinct from the config-only pipeline path.
- `packages/core/src/core/core-entrypoint-runtime.ts` now documents that `@edison/core/core` only threads the dedicated config-entrypoint loader contract instead of reintroducing another config barrel, while keeping the shared `loadBotRuntimeConfig(loader?)` seam intact.
- `README.md` and the updated guardrails now keep runtime helper imports on `@edison/core/core` and type-only loader imports on `@edison/core/config`, matching the actual export surface.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand config-pipeline.functional legacy-entrypoint.functional readme-entrypoint-boundary`
- 2026-05-26: `npm test -- --runInBand package-script-boundary`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/config/index.ts config-only loader contract alias wording follow-up`.
- Stay on the entrypoint-boundary stream: keep tightening the dedicated config surface and its core/doc guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
