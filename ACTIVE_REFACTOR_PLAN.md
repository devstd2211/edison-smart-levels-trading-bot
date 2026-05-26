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
- 2026-05-26: completed the programmatic/web entrypoint contract wording slice across ten related tasks:
  - `packages/core/src/core/index.ts programmatic helper export-surface wording follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts programmatic runtime-pair guidance guardrail follow-up`
  - `packages/core/src/web/web-entrypoint-runtime.ts explicit runtime-pair helper wording follow-up`
  - `ARCHITECTURE_QUICK_START.md programmatic helper/runtime-pair wording parity follow-up`
  - `README.md programmatic loader/runtime-pair example wording follow-up`
  - `packages/core/src/web/index.ts explicit runtime-pair starter wording follow-up`
  - `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts explicit runtime-pair export-name guardrail follow-up`
  - `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts programmatic helper export-name guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts programmatic/web entrypoint wording smoke follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts legacy root export-surface guardrail follow-up`
- `packages/core/src/core/index.ts` now frames `@edison/core/core` as the stable non-CLI helper surface and makes the shared config-loader seam explicit for the config-aware helpers.
- `packages/core/src/web/index.ts` and `packages/core/src/web/web-entrypoint-runtime.ts` now describe the same explicit `{ botAdapter, webApiAdapter }` handoff that the docs already expect.
- `README.md`, `ARCHITECTURE_QUICK_START.md`, and the related functional tests now pin the same boundary language around `loadBotRuntimeConfig(loader?)`, the stable programmatic helper surface, and the explicit runtime-pair handoff for `@edison/core/web`.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand readme-entrypoint-boundary architecture-entrypoint-boundary core-entrypoint legacy-entrypoint web-entrypoint`
- 2026-05-26: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports"`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/core/core-entrypoint-runtime.ts config-loader seam wording follow-up`.
- Stay on the programmatic/web entrypoint boundary stream: align helper-seam wording, legacy-wrapper export separation, and web runtime-pair guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
