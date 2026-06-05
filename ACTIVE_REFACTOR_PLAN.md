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
- 2026-06-05: completed `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts web runtime construction lifecycle guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/core/index.ts programmatic runtime entrypoint guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts programmatic runtime handoff guardrail follow-up`.
- `createWebServerRuntime(...)` now returns a frozen runtime pair so the web handoff cannot be rewritten between construction and lifecycle start.
- `core/index.ts` now owns the named `CoreEntrypointRuntime` type-only contract, keeping the programmatic bot-plus-web-adapter seam explicit on the public core entrypoint.
- `createBotRuntime(...)` and `createConfiguredBotRuntime(...)` now project frozen `{ bot, webApiAdapter }` handoffs, narrowing the runtime seam without exposing the broader factory runtime source.

## Latest Verification
- 2026-06-05: `npm --prefix packages/core run test -- --runInBand src/__tests__/web/web-entrypoint.functional.test.ts src/__tests__/core/core-entrypoint.functional.test.ts src/__tests__/cli/cli-entrypoint.functional.test.ts src/__tests__/core/legacy-entrypoint.functional.test.ts` (4 suites, 41 tests)
- 2026-06-05: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-05: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts`, `packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts`, and `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts`.
- Continue down the core entrypoint/runtime docs-and-wrapper queue before expanding into the config entrypoint follow-up tasks.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
