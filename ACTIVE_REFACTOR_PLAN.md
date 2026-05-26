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
- 2026-05-26: completed the next config-entrypoint loader-contract alias slice across ten related tasks:
  - `packages/core/src/config/index.ts config-only loader-contract alias barrel follow-up`
  - `packages/core/src/__tests__/config/config-entrypoint.functional.test.ts config-only loader-contract alias guardrail follow-up`
  - `ARCHITECTURE_QUICK_START.md config-only loader-contract alias wording follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts config-only loader-contract alias docs guardrail follow-up`
  - `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts composed loader-contract surface guardrail follow-up`
  - `README.md config/core loader-contract alias consumer guidance follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts config/core loader-contract alias guidance guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts config-only loader-contract alias smoke follow-up`
  - `packages/core/src/core/index.ts composed loader-contract ownership wording follow-up`
  - `packages/core/src/index.ts legacy config-loader compatibility wording follow-up`
- `packages/core/src/config/index.ts` now owns the full publishable loader-contract alias surface for `@edison/core/config`: `ConfigPipelineLoader`, `ConfigPipelineBaseConfigLoader`, and `ConfigPipelineConfigValidator`, while keeping those aliases type-only at runtime.
- `packages/core/src/core/index.ts` and `packages/core/src/index.ts` now frame `ConfigPipelineLoader` as the only convenience type re-export on the core and legacy entrypoints, leaving the lower-level loader-contract aliases on the dedicated config entrypoint.
- `README.md`, `ARCHITECTURE_QUICK_START.md`, and the updated guardrails now document the config/core split around those loader-contract aliases without widening the runtime export surface.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand config-entrypoint.functional core-entrypoint.functional readme-entrypoint-boundary architecture-entrypoint-boundary legacy-entrypoint.functional`
- 2026-05-26: `npm test -- --runInBand package-script-boundary`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/core/core-entrypoint-runtime.ts composed loader-contract ownership wording follow-up`.
- Stay on the entrypoint-boundary stream: keep tightening config/core/root loader-contract ownership wording and guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
