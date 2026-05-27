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
- 2026-05-27: completed the next entrypoint loader-contract ownership slice across ten related tasks:
  - `packages/core/src/core/core-entrypoint-runtime.ts composed loader-contract ownership wording follow-up`
  - `packages/core/src/legacy-entrypoint-runtime.ts composed loader-contract compatibility wording follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts dedicated config alias ownership guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts dedicated config alias ownership smoke follow-up`
  - `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts composed loader-contract ownership guardrail follow-up`
  - `README.md injected config-loader seam consumer wording follow-up`
  - `ARCHITECTURE_QUICK_START.md injected config-loader seam architecture wording follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts injected config-loader seam docs guardrail follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts injected config-loader seam docs guardrail follow-up`
  - `packages/core/src/__tests__/config/config-entrypoint.functional.test.ts dedicated config alias ownership source guardrail follow-up`
- `packages/core/src/core/core-entrypoint-runtime.ts` now exposes the configured-helper action contract explicitly and keeps config loading injected through `loadBotRuntimeConfig(loader?)` instead of coupling the helper runtime to ConfigPipeline internals.
- `packages/core/src/legacy-entrypoint-runtime.ts` now builds the legacy compatibility export list through a named core marker constant before appending only the CLI handoff.
- `README.md`, `ARCHITECTURE_QUICK_START.md`, and the related guardrails now document the injected loader seam and the dedicated config alias ownership split.

## Latest Verification
- 2026-05-27: `npm --prefix packages/core test -- --runInBand config-entrypoint.functional core-entrypoint.functional legacy-entrypoint.functional readme-entrypoint-boundary architecture-entrypoint-boundary`
- 2026-05-27: `npm test -- --runInBand package-script-boundary`
- 2026-05-27: `npm test -- --runInBand position-monitor`
- 2026-05-27: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/cli/index.ts CLI composition-root config handoff audit follow-up`.
- Stay on the entrypoint-boundary stream: audit the CLI and web composition-root helper boundaries before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
