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
- 2026-05-25: completed the standalone wrapper runtime-adoption slice across the active queue:
  - `packages/core/src/collect-data.ts standalone workflow runtime wrapper adoption follow-up`
  - `packages/core/src/test-balance.ts standalone workflow runtime wrapper adoption follow-up`
  - `packages/core/src/vector-db.ts standalone CLI runtime wrapper adoption follow-up`
  - `packages/core/src/__tests__/core/standalone-script-entrypoints.functional.test.ts standalone runtime wrapper export guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts standalone runtime helper guardrail follow-up`
- `collect-data.ts` now creates the extracted workflow runtime explicitly before invoking startup, so the public wrapper mirrors the new helper boundary instead of falling back to the older aggregate workflow call.
- `test-balance.ts` now creates the extracted runtime and runs the explicit connectivity step helper while preserving the missing-credentials exit path expected by the standalone script contract.
- `vector-db.ts` now converts argv into an explicit command runtime before dispatch, and the wrapper test surface now pins that runtime-factory plus command-handler boundary.
- `standalone-script-entrypoints.functional.test.ts`, `vector-db.entrypoint.test.ts`, and the package-script guardrail now lock the wrapper files to those runtime-step helper contracts.

## Latest Verification
- 2026-05-25: `npm --prefix packages/core test -- --runInBand standalone-script-entrypoints vector-db.entrypoint`
- 2026-05-25: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports"`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.entrypoint.ts standalone wrapper-facing runtime options follow-up`.
- Stay on the standalone-entrypoint stream: tighten the wrapper-facing helper contracts and their focused guardrails before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
