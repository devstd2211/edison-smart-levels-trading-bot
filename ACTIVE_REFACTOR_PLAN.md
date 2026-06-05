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
- 2026-06-05: completed `packages/core/src/web/index.ts web runtime compatibility guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/core/core-entrypoint-runtime.ts configured runtime projection guardrail follow-up`.
- 2026-06-05: completed `packages/core/src/index.ts legacy runtime compatibility wrapper guardrail follow-up`.
- `packages/core/src/web/web-entrypoint-runtime.ts` now binds the concrete `WebServer` constructor once through `createWebServerStarter(...)`, so the public web barrel keeps the compatibility wrapper thin while lifecycle delegation stays on the lower runtime boundary.
- `packages/core/src/core/core-entrypoint-runtime.ts` now freezes `CORE_ENTRYPOINT_EXPORT_NAMES` and routes all config-aware helpers through one loader-bound helper shell instead of duplicating the `loadBotRuntimeConfig(loader?)` orchestration per export.
- `packages/core/src/legacy-entrypoint-runtime.ts` now owns `runLegacyCliEntrypointFromModule(...)`, so the root compatibility wrapper no longer wires main-module resolution itself.

## Latest Verification
- 2026-06-05: `npm test -- --runInBand packages/core/src/__tests__/web/web-entrypoint.functional.test.ts packages/core/src/__tests__/web/web-boundary.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts` (5 suites, 60 tests)
- 2026-06-05: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-05: `npm run build`

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts`, `packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts`, and `packages/core/src/factories/create-trading-bot-runtime.ts`.
- Continue down the runtime factory and runtime-contract queue before expanding further into the config entrypoint follow-up tasks.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
