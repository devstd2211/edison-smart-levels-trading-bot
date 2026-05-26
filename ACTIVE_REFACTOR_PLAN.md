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
- 2026-05-26: completed the README/entrypoint wording parity follow-up slice across the active queue:
  - `README.md standalone helper consumer guidance follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts standalone helper consumer guidance guardrail follow-up`
  - `packages/core/src/cli/index.ts standalone exported-guard helper wording follow-up`
  - `packages/core/src/index.ts legacy wrapper compatibility wording follow-up`
  - `packages/core/src/web/index.ts entrypoint helper wording parity follow-up`
- `README.md` now explains that the shared standalone runner owns default main-module resolution and that the `@edison/core/web` surface intentionally accepts an explicit runtime pair before startup.
- `readme-entrypoint-boundary.functional.test.ts` now reads workspace-root docs correctly from the package test cwd and pins both the README wording and the entrypoint source comments to the same helper-boundary contract.
- `cli/index.ts`, `index.ts`, and `web/index.ts` now describe their boundaries in the same terms as the public docs: explicit CLI/runtime orchestration, legacy compatibility wrapping, and explicit web runtime-pair handoff.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand readme-entrypoint-boundary`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/core/index.ts programmatic helper export-surface wording follow-up`.
- Stay on the programmatic/web entrypoint docs stream: align core/web helper wording and guardrails around explicit runtime-pair and config-loader surfaces before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
