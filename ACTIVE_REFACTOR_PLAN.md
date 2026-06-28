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
- 2026-06-28: completed `packages/core/src/services/config-validator.service.ts config validator service boundary follow-up`.
- 2026-06-28: completed `packages/core/src/services/strategy-config-merger.service.ts strategy config merger service boundary follow-up`.
- 2026-06-28: completed `packages/core/src/services/index.ts services barrel boundary follow-up`.
- `config-validator.service.ts`: removed `hasPath`/`getPath` JSDoc, all five `throwXxxError` Phase 8.9.31 docblocks, `// Logging is non-critical for config validation.` inline comment; cleaned Phase-marker docblocks from both test files; created `config-validator.functional.test.ts` (validateAtStartup pass/fail, validateAll CRUD errors, printEnabledAnalyzers no-throw, export boundary).
- `strategy-config-merger.service.ts`: removed Phase 8.9.77 file docblock; removed JSDoc from safeLog/mergeConfigs/mergeIndicators/mergeFilters/mergeRiskManagement/getConfigValue/getChangeReport; removed all THROW/GRACEFUL_DEGRADE/numbered-step inline comments; kept `// Replace entire TP array` (WHY) and `// Skip arrays - we can't easily compare them` (WHY); cleaned Phase docblock from `error-handling.test.ts`; created `strategy-config-merger.functional.test.ts` (mergeConfigs preserve/override/TP-replace/null-throws, getChangeReport zero-changes/reports-changes, export boundary).
- `services/index.ts`: removed file docblock, all inline comments, Phase 5 and Phase 14.2 section comments.
- 2026-06-28: completed `packages/core/src/__tests__/services/performance-analytics.functional.test.ts performance analytics service guardrail follow-up`.
- 2026-06-28: completed `packages/core/src/services/strategy-loader.service.ts strategy loader service boundary follow-up`.
- 2026-06-28: completed `packages/core/src/__tests__/services/strategy-loader.functional.test.ts strategy loader service guardrail follow-up`.
- `performance-analytics.functional.test.ts`: created — calculateWinRate/calculateProfitFactor pure math, getMetrics() empty-journal, getStatistics() initial state, clearCache() no-throw, export boundary.
- `strategy-loader.service.ts`: removed file docblock, AVAILABLE_ANALYZERS group comments, field comment, all method JSDoc, all inline WHAT/Phase comments; fixed pre-existing bug — added `positionSizing` and `trailingStop` to `validateRiskManagementOverrides` valid fields so `atr-minimal.strategy.json` loads cleanly.
- `strategy-loader.functional.test.ts`: created — `getAvailableAnalyzers()` sorted/non-empty, `loadStrategy()` throws StrategyLoadError on missing file, loads valid file, `loadAllStrategies()` empty-dir and skip-invalid behaviors, export boundary.
- 2026-06-28: completed `packages/core/src/services/order-execution-pipeline.service.ts order execution pipeline service boundary follow-up`.
- 2026-06-28: completed `packages/core/src/__tests__/services/order-execution-pipeline.functional.test.ts order execution pipeline service guardrail follow-up`.
- 2026-06-28: completed `packages/core/src/services/performance-analytics.service.ts performance analytics service boundary follow-up`.
- `order-execution-pipeline.service.ts`: removed Phase 9 file docblock, class Responsibilities/Architecture docblock, Phase 8.3/15.2 inline markers, all method-level JSDoc, and WHAT-explaining inline comments throughout.
- `order-execution-pipeline.functional.test.ts`: created new — `getMetrics()` initial state, `resetMetrics()` zeroing, `calculateSlippage()` pure math, `validateSlippage()` boundary, export boundary.
- `performance-analytics.service.ts`: removed Phase 9 file docblock, class docblock, all Phase 8.9.36/13.1a markers on fields/constructor/methods, all method-level JSDoc, and WHAT-explaining inline comments; `/* Silent */` → `{}`.
- 2026-06-28: completed `packages/core/src/services/trading-lifecycle.service.ts trading lifecycle service boundary follow-up`.
- 2026-06-28: completed `packages/core/src/__tests__/services/trading-lifecycle.functional.test.ts trading lifecycle service guardrail follow-up`.
- 2026-06-28: completed `packages/core/src/services/graceful-shutdown.service.ts graceful shutdown service boundary follow-up`.
- `trading-lifecycle.service.ts`: removed Phase 9 file docblock and class Responsibilities/Architecture docblock; removed all inline WHAT-explaining comments and method-level JSDoc from public methods.
- `trading-lifecycle.functional.test.ts` + `error-handling.test.ts`: removed "Phase 8.9.38" marker; added `stop()` unsubscribe guardrail, double-stop no-op test, and export boundary describe.
- `graceful-shutdown.service.ts`: removed Phase 9 file docblock; deleted dead methods `calculateUnrealizedPnL` and `calculateUnrealizedPnLPercent` (unused) and their `PersistedPositionState` import.
- `graceful-shutdown.service.test.ts` + `error-handling.test.ts`: removed Phase 9.1 and Phase 8.4 docblocks/markers; added `isShutdownInProgress()` functional guardrail and export boundary to `graceful-shutdown.functional.test.ts`.
- 2026-06-27: completed `packages/core/src/config.ts root config assembly boundary follow-up`.
- 2026-06-27: completed `packages/core/src/config/risk-management.validate.ts risk management validation boundary follow-up`.
- 2026-06-27: completed `packages/core/src/__tests__/config/orchestration-config.test.ts config type guardrail follow-up`.
- `config.ts`: removed stale file-level docblock; narrowed validator call to pass `config.riskManagement` directly.
- `risk-management.validate.ts`: input narrowed from `Config` to `RiskManagementConfig`; validation bounds extracted to `BOUNDS` constant; new functional test created with 14 tests covering missing fields, out-of-range values, and NaN.
- `orchestration-config.test.ts`: stale "Phase 4.10:" markers removed from all describe labels and file header; test name typo fixed ("overboughtThreshold > oversoldThreshold"); export boundary describe block added.
- 2026-06-27: completed `packages/core/src/config/config-pipeline.constants.ts config pipeline constants boundary follow-up`.
- 2026-06-27: completed `packages/core/src/__tests__/config/config-loader.test.ts config loader boundary guardrail follow-up`.
- 2026-06-27: completed `packages/core/src/config-loader.ts config file loader boundary follow-up`.
- `config-pipeline.constants.ts`: new guardrail test created (`config-pipeline.constants.test.ts`) — 4 tests assert each constant's display-formatting value.
- `config-loader.test.ts`: added 6 new tests — `logConfigLoadDebug` path logging and defaults warning, `logConfigDefaultsApplied` conditional logging, `applyConfigEnvironmentOverrides` legacy-key fallback path and no-env-vars unchanged path.
- `config-loader.ts`: removed feature-specific debug lines (`scalpingLadderTp`, `entryConfig.divergenceDetector`) from `logConfigLoadDebug` — loader no longer references specific config field shapes; `_config` parameter retained for signature consistency.
- 2026-06-27: completed `packages/core/src/__tests__/config/config-pipeline-summary.test.ts config pipeline summary guardrail follow-up`.
- 2026-06-27: completed `packages/core/src/config/web-api-config.ts web api config projection boundary follow-up`.
- 2026-06-27: completed `packages/core/src/__tests__/config/web-api-config.functional.test.ts web api config projection guardrail follow-up`.
- `config-pipeline-summary.test.ts`: added edge-case guardrails — empty/undefined inputs, stochastic/bollinger paths, metadata-without-description, export boundary check.
- `config-pipeline-summary.ts`: `buildStrategyMetadataSummaryLines` parameter narrowed to `{ metadata?: StrategyConfigV2['metadata'] }` to match actual null-safe behavior.
- `web-api-config.ts`: `DEFAULT_WEB_API_INDICATOR_PREFERENCES` typed as `Required<WebApiIndicatorPreferences>` — removes `!` assertions in `getDefaultWebApiIndicatorPreferences` and `?? []` fallbacks in `normalizeWebApiConfig`; `getDefaultWebApiConfig` return type narrowed to `{ indicatorPreferences: Required<WebApiIndicatorPreferences> }`.
- `web-api-config.functional.test.ts`: added guardrails for undefined config, empty array preservation, invalid-value filtering, and clone isolation.
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
- 2026-06-28: `npm test -- --runInBand config-validator.functional config-validator.service.test config-validator.error-handling strategy-config-merger.functional strategy-config-merger.error-handling` (5 suites, 80 tests)
- 2026-06-28: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-28: `npm run build` — clean
- 2026-06-28: `npm test -- --runInBand trading-lifecycle.functional trading-lifecycle.error-handling graceful-shutdown.functional graceful-shutdown.service.test` (4 suites, 71 tests)
- 2026-06-28: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-28: `npm run build` — clean
- 2026-06-27: `npm test -- --runInBand risk-management.validate.functional orchestration-config` (2 suites, 47 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- Earlier 2026-06-27: `npm test -- --runInBand config-pipeline.constants config-loader.test` (2 suites, 15 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- Earlier 2026-06-27: `npm test -- --runInBand config-pipeline-summary web-api-config.functional` (2 suites, 14 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- Earlier 2026-06-27: `npm test -- --runInBand config-pipeline.functional config-pipeline-summary runtime-service-adapters.functional` (3 suites, 21 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- Earlier 2026-06-27: `npm test -- --runInBand packages/core/src/__tests__/config/config-pipeline.functional.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts` (2 suites, 16 tests)
- 2026-06-27: `npm test -- --runInBand position-monitor` (6 suites, 59 tests)
- 2026-06-27: `npm run build` — clean
- 2026-06-05: `npm test -- --runInBand packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/config/config-entrypoint.functional.test.ts packages/core/src/__tests__/config/config-pipeline.functional.test.ts` (7 suites, 55 tests)

## Next Step
- Continue with the next active component batch from `REFACTOR_COMPONENT_CHECKLIST.md`.
- Start with `position-exiting.service.ts`, `position-lifecycle.service.ts`, and `limit-order-executor.service.ts`.

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
