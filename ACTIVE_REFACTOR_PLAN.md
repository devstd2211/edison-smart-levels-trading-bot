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
- 2026-05-25: completed the standalone runtime workflow boundary slice across the active queue:
  - `packages/core/src/collect-data.entrypoint.ts standalone runtime workflow boundary follow-up`
  - `packages/core/src/test-balance.entrypoint.ts standalone runtime workflow boundary follow-up`
  - `packages/core/src/vector-db/cli.ts standalone CLI runtime boundary follow-up`
  - `packages/core/src/__tests__/core/vector-db.entrypoint.test.ts standalone CLI argv/runtime contract guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts standalone wrapper export contract guardrail follow-up`
- `collect-data.entrypoint.ts` now builds an explicit workflow runtime before startup so config loading, service construction, and recurring-task registration are separated into named runtime steps.
- `test-balance.entrypoint.ts` now resolves the standalone runtime context and Bybit dependency up front, then runs the connectivity checks through a dedicated execution helper instead of mixing setup and execution in one function body.
- `vector-db/cli.ts` now builds a command runtime before dispatch, letting help/unknown command handling stay outside service construction while executable commands still reuse the shared CLI executor path.
- Focused core tests and the package-script guardrail now pin the new runtime-helper exports so the standalone workflow boundary stays explicit.

## Latest Verification
- 2026-05-25: `npm --prefix packages/core test -- --runInBand collect-data.entrypoint test-balance.entrypoint vector-db.entrypoint standalone-script-entrypoints`
- 2026-05-25: `npm test -- --runInBand package-script-boundary --testNamePattern "core package entrypoints expose the shared runtime-config loader surface without source-path imports"`
- 2026-05-25: `npm test -- --runInBand position-monitor`
- 2026-05-25: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/collect-data.ts standalone workflow runtime wrapper adoption follow-up`.
- Stay on the standalone-entrypoint stream: align the public wrapper files and the shared functional guardrails with the new explicit runtime helpers before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
