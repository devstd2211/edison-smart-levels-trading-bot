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
- 2026-06-05: completed `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts runtime handoff docs guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts runtime handoff docs guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts legacy wrapper runtime barrel guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/legacy-entrypoint-runtime.ts legacy wrapper runtime export guardrail follow-up`.
- `packages/core/src/cli/index.ts` now states the CLI entrypoint runtime boundary directly, including the injectable `RunCliMainDependencies` handoff and shared standalone if-main guard wording.
- `ARCHITECTURE_QUICK_START.md` now documents the named `CoreEntrypointRuntime` and `TradingBotWebServerRuntime` handoff contracts alongside the explicit runtime-pair flow.
- `LEGACY_CORE_ENTRYPOINT_EXPORT_NAMES` and the object returned by `createLegacyEntrypointRunners(...)` are now frozen so the legacy wrapper shell cannot be widened by downstream mutation.

## Latest Verification
- 2026-06-05: `npm --prefix packages/core run test -- --runInBand src/__tests__/core/readme-entrypoint-boundary.functional.test.ts src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts src/__tests__/core/legacy-entrypoint.functional.test.ts` (3 suites, 20 tests)
- 2026-06-05: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-05: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/web/index.ts`, `packages/core/src/core/core-entrypoint-runtime.ts`, and `packages/core/src/index.ts`.
- Continue down the core entrypoint/runtime queue before expanding into the config entrypoint follow-up tasks.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
