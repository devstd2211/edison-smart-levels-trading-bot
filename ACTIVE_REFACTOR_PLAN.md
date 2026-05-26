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
- 2026-05-26: completed the standalone resolver/footer guardrail follow-up slice across the active queue:
  - `packages/core/src/__tests__/core/standalone-entrypoint-runtime.functional.test.ts standalone main-module resolver guardrail follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts legacy default-main resolver guardrail follow-up`
  - `packages/core/src/__tests__/core/standalone-script-console.test.ts standalone footer-line presentation guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts standalone resolver/footer export guardrail follow-up`
  - `ARCHITECTURE_QUICK_START.md standalone helper documentation wording follow-up`
- `standalone-entrypoint-runtime.ts` now treats `mainModule` as optional on the shared guard helper, so wrapper call sites can rely on the shared default resolver instead of threading `require.main` manually.
- `index.ts`, `cli/index.ts`, `collect-data.ts`, `test-balance.ts`, and `vector-db.ts` now call their `run*IfMain()` helpers through the shared default-main contract instead of passing `require.main` explicitly at each entrypoint boundary.
- The standalone console guardrails now pin footer rendering to `createStandaloneFooterLine()` and `createStandaloneFooterLines()` rather than duplicating the trailing-newline presentation inline.
- The package-boundary and architecture guardrails now pin the new default-resolver wording so entrypoint/docs drift is caught at the source boundary.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand standalone-entrypoint-runtime.functional legacy-entrypoint.functional standalone-script-console architecture-entrypoint-boundary`
- 2026-05-26: `npm test -- --runInBand package-script-boundary`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `README.md standalone helper consumer guidance follow-up`.
- Stay on the entrypoint/docs stream: align consumer-facing docs and remaining wrapper wording with the shared default-main helper surface before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
