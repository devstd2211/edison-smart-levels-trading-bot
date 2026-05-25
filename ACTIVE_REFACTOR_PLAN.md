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
- 2026-05-25: completed the standalone entrypoint runner convergence slice across the active queue:
  - `packages/core/src/legacy-entrypoint-runtime.ts legacy wrapper runner convergence follow-up`
  - `packages/core/src/standalone-entrypoint-runtime.ts shared entrypoint runner reuse follow-up`
  - `packages/core/src/cli/cli-entrypoint-runtime.ts cli startup presentation boundary follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts entrypoint export contract guardrail follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts entrypoint contract docs guardrail follow-up`
- `standalone-entrypoint-runtime.ts` now exposes one reusable runner contract with both the direct-execution predicate and execution helpers, so wrappers stop mixing factory usage with ad-hoc guard imports.
- `legacy-entrypoint-runtime.ts` and `cli/index.ts` now converge on that shared runner contract, while CLI startup/status/failure presentation moved behind dedicated helpers in `cli-entrypoint-runtime.ts` instead of staying inline in the orchestration path.
- `README.md` and the focused guardrail tests now describe the shared standalone-runner contract explicitly and align source assertions with the current config-route/runtime-discovery contract names.

## Latest Verification
- 2026-05-25: `npm --prefix packages/core test -- --runInBand standalone-entrypoint-runtime.functional cli-entrypoint-runtime.test cli-entrypoint.functional legacy-entrypoint.functional core-entrypoint.functional web-entrypoint.functional`
- 2026-05-25: `npm test -- --runInBand package-script-boundary readme-entrypoint-boundary`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.ts standalone workflow wrapper convergence follow-up`.
- Stay on the standalone-entrypoint stream: work through `collect-data.ts`, `test-balance.ts`, `vector-db.ts`, and the focused standalone-script/architecture guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
