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
- 2026-05-26: completed the compatibility-wrapper / public-helper parity slice across ten related tasks:
  - `packages/core/src/index.ts legacy wrapper compatibility wording parity follow-up`
  - `packages/core/src/index.ts root loader-type re-export parity follow-up`
  - `packages/core/src/legacy-entrypoint-runtime.ts legacy/core export-list derivation parity follow-up`
  - `ARCHITECTURE_QUICK_START.md compatibility-wrapper example wording parity follow-up`
  - `README.md compatibility-wrapper migration/example split follow-up`
  - `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts runtime-pair starter wording parity guardrail follow-up`
  - `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts compatibility-wrapper example split guardrail follow-up`
  - `packages/core/src/__tests__/core/package-script-boundary.functional.test.ts public config barrel wording smoke follow-up`
  - `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts legacy/core export-list alignment guardrail follow-up`
  - `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts compatibility-wrapper migration-note guardrail follow-up`
- `packages/core/src/index.ts` now frames `@edison/core` as a compatibility wrapper that re-exports the stable non-CLI helper surface from `@edison/core/core`, while keeping only the CLI handoff plus direct-execution guard at the root boundary.
- `packages/core/src/legacy-entrypoint-runtime.ts` now derives the legacy runtime export list from `CORE_ENTRYPOINT_EXPORT_NAMES` instead of maintaining a second hardcoded helper list, so the wrapper and dedicated core entrypoint cannot silently drift apart.
- `README.md`, `ARCHITECTURE_QUICK_START.md`, and the related guardrails now separate migration guidance from primary examples: existing callers may keep `@edison/core`, but new examples stay on `@edison/core/core`, `@edison/core/cli`, and `@edison/core/web`.

## Latest Verification
- 2026-05-26: `npm --prefix packages/core test -- --runInBand legacy-entrypoint readme-entrypoint-boundary architecture-entrypoint-boundary web-entrypoint`
- 2026-05-26: `npm test -- --runInBand package-script-boundary`
- 2026-05-26: `npm test -- --runInBand position-monitor`
- 2026-05-26: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/core/index.ts ConfigPipelineLoader type-barrel wording parity follow-up`.
- Stay on the entrypoint-boundary stream: tighten the dedicated core/config barrel wording around type-only loader exports before widening scope again.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
