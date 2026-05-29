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
- 2026-05-29: completed `packages/core/src/__tests__/bot-factory.test.ts runtime bundle handoff guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/core/index.ts programmatic runtime handoff boundary follow-up`.
- 2026-05-29: completed `README.md and ARCHITECTURE_QUICK_START.md runtime boundary docs follow-up`.
- `BotFactory` now routes both `createRuntime(...)` and `createBotRuntimeBundle(...)` through one shared factory-runtime seam, so bundle assembly and public bot/runtime materialization start from the same ownership boundary.
- `@edison/core/core` now projects programmatic runtime creation onto the explicit `{ bot, webApiAdapter }` handoff, keeping the broader `runtimeSource` contract on the factory seam instead of the public programmatic entrypoint.
- README and architecture docs now describe that narrowed handoff explicitly, and the entrypoint guardrails verify the legacy wrapper preserves compatibility without re-exposing the factory runtime source.

## Latest Verification
- 2026-05-29: `npm test -- --runInBand packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts` (5 suites, 40 tests)
- 2026-05-29: `npm test -- --runInBand packages/core/src/__tests__/core/package-script-boundary.functional.test.ts` (1 suite, 12 tests)
- 2026-05-29: `npm test -- --runInBand position-monitor` (4 suites, 54 tests)
- 2026-05-29: `npm run build`

## Next Step
- Continue with the next active component from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/services/runtime-service-adapters.ts runtime dependency adapter boundary follow-up`.
- Keep the next batch in the runtime dependency and entrypoint compatibility stream, and merge adjacent runtime or websocket guardrails when a single slice is too small on its own.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
