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
- 2026-06-27: completed `packages/core/src/__tests__/config/config-pipeline.functional.test.ts config pipeline loader guardrail follow-up`.
- 2026-06-27: completed `packages/core/src/__tests__/runtime-service-adapters.functional.test.ts runtime service adapter projection guardrail follow-up`.
- 2026-06-27: completed `packages/core/src/config/config-pipeline-summary.ts config pipeline summary boundary follow-up`.
- `config-pipeline.functional.test.ts`: added `loadOptionalRuntimeConfig applies runtime defaults on the unified loader path` test using legacy pre-defaults config to explicitly guardrail the pure-function pipeline path.
- `runtime-service-adapters.functional.test.ts`: added `createTradingBotRuntimeDependenciesFromParts is an identity projection` test asserting `runtimeDependencies === runtimeParts`.
- `config-pipeline-summary.ts`: removed `StrategyIndicatorSummarySource` union type; `buildStrategyIndicatorSummaryLines` now takes `Record<string, StrategyIndicatorConfig>`; removed unsafe `as StrategyIndicatorConfig` cast; `StrategyIndicatorConfig` exported; call site in `config-pipeline.ts` updated.
- 2026-06-27: completed `packages/core/src/config/config-pipeline.ts config pipeline loader boundary follow-up`.
- 2026-06-27: completed `packages/core/src/config/runtime-config-defaults.ts runtime config defaults projection follow-up`.
- 2026-06-27: completed `packages/core/src/services/runtime-service-adapters.ts runtime service adapter bundle projection follow-up`.
- `config-pipeline.ts`: `loadOptionalRuntimeConfig` no longer branches on `loadValidatedConfig`; all paths go through `loadRuntimeConfig(loader ?? defaultConfigPipelineLoader)`.
- `runtime-config-defaults.ts`: `applyRuntimeConfigDefaults` is now a pure projection (non-mutating spread return); `config.ts` updated to capture the return value instead of relying on side effects.
- `runtime-service-adapters.ts`: `ITradingBotRuntimeDependencyParts` now uses direct type references (`ITradingBotLifecycleDependencies`, `ITradingBotReadAdapters`) instead of pick-indexing; `createTradingBotRuntimeDependenciesFromParts` simplified to a direct pass since the types are structurally identical.
- 2026-06-05: completed `packages/core/src/factories/create-runtime-bundle.ts runtime read adapter bundle projection follow-up`.
- 2026-06-05: completed `packages/core/src/interfaces/index.ts runtime contract barrel projection follow-up`.
- 2026-06-05: completed `packages/core/src/config/index.ts config pipeline entrypoint boundary follow-up`.
- 2026-06-05: completed merged adjacent slice `packages/core/src/__tests__/runtime-service-adapters.functional.test.ts runtime service adapter projection guardrail follow-up`.
- 2026-06-05: completed merged adjacent slice `packages/core/src/__tests__/config/config-entrypoint.functional.test.ts config pipeline entrypoint guardrail follow-up`.
- `packages/core/src/factories/create-runtime-bundle.ts` now projects the public read API from `ITradingBotReadAdapters`, so the runtime bundle no longer needs the wider `runtimeDependencies` shell just to expose `webApiAdapter`.
- `packages/core/src/interfaces/runtime-contracts.ts` now owns the grouped runtime contract re-exports, and `packages/core/src/interfaces/index.ts` delegates that runtime-facing surface through one dedicated barrel.
- `packages/core/src/config/config-loader-contracts.ts` now owns the public config loader types, while `packages/core/src/config/index.ts` stays focused on runtime-config entrypoints and re-exports those contracts type-only.

## Latest Verification
- 2026-06-27: `npm test -- --runInBand config-pipeline.functional config-pipeline-summary runtime-service-adapters.functional` (3 suites, 21 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- Earlier 2026-06-27: `npm test -- --runInBand packages/core/src/__tests__/config/config-pipeline.functional.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts` (2 suites, 16 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- 2026-06-05: `npm test -- --runInBand packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/config/config-entrypoint.functional.test.ts packages/core/src/__tests__/config/config-pipeline.functional.test.ts` (7 suites, 55 tests)

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `packages/core/src/config/config-pipeline.ts`, `packages/core/src/config/runtime-config-defaults.ts`, and `packages/core/src/services/runtime-service-adapters.ts`.
- Continue down the config pipeline and runtime adapter queue before widening into lower config-loader and validation follow-up tasks.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
