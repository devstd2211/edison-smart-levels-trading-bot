# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

Work directly on local `main`. Do not create worktrees. If the current branch is not
`main`, switch back to `main` before editing.

## Goal
- Continue behavior-preserving refactor in one batch of three large component slices.
- Do not run build or tests at session start.
- Do not spend time reading historical plan files.
- Use this file as the working instruction. Only open other planning docs when this file
  explicitly says to update them or when the active queue needs more tasks.

## Current Batch
Start with these three active queue items:
1. `packages/core/src/cli/index.ts cli runtime compatibility boundary follow-up`
2. `packages/core/src/__tests__/cli/cli-entrypoint.functional.test.ts cli startup runtime handoff guardrail follow-up`
3. `packages/core/src/__tests__/cli/cli-entrypoint-runtime.test.ts cli runtime handoff guardrail follow-up`

If one of these turns out to be too small, merge it with the next adjacent runtime,
initializer, or websocket boundary item from `REFACTOR_COMPONENT_CHECKLIST.md` and keep
the batch at three large component slices.

## Refactor Rules
1. For each slice, inspect only the relevant production file, direct consumers, and related functional/guardrail tests.
2. Refactor production code first, then align the related tests in the same slice.
3. Add a functional test only if the component lacks functional coverage.
4. Do not do naming-only work. A completed slice must narrow a contract, clarify ownership, reduce duplication, make lifecycle safer, or tie tests more directly to behavior.
5. Avoid regex/bulk replacement except as a small mechanical step after understanding the code path.
6. When touching user-facing logs/messages, replace inline emoji with shared `ICONS` from `packages/core/src/cli/cli-runtime.ts`.
7. When touching fallback constants or magic numbers, classify them:
   - static/runtime constant: extract to a constants file
   - strategy/tuning value: move into config

## Queue Rules
- Keep `REFACTOR_COMPONENT_CHECKLIST.md` as the finite active queue.
- Before editing, check only the Active Components section. If it has fewer than 15 large tasks, top it up to 15.
- Prefer adding tasks from the current runtime/initializer/websocket boundary stream. Use `REFACTOR_TASKS.md` only if the next boundary tasks are unclear.
- Completed slices must be moved from Active Components to Completed History with `prod: yes | tests: yes | func: yes`.
- Do not add microtasks, one-line aliases, or naming-only entries.

## Verification And Commit
After all three slices are complete:
1. Run targeted tests for the changed areas.
2. Run the smoke test: `npm test -- --runInBand position-monitor`.
3. Run `npm run build`.
4. Update:
   - `ACTIVE_REFACTOR_PLAN.md` with only the latest completed batch and latest verification.
   - `REFACTOR_COMPONENT_CHECKLIST.md` with completed items moved to history and active queue topped up to 15.
   - `docs/architecture/dependency-map.md` only if canonical runtime contract names changed or more than five adapter interfaces were added.
   - `NEXT_SESSION_PROMPT.md` with the next three concrete active queue items.
5. Commit the batch after tests, smoke, build, and docs updates pass.

## Last Completed
- 2026-05-30: completed `packages/core/src/web/web-entrypoint-runtime.ts web runtime composition boundary follow-up`.
- 2026-05-30: completed `packages/core/src/web/index.ts web runtime compatibility boundary follow-up`.
- 2026-05-30: completed `packages/core/src/__tests__/web/web-entrypoint.functional.test.ts web runtime handoff guardrail follow-up`.
- `web-entrypoint-runtime.ts` now keeps the concrete `WebServerBotInstanceAdapter` internal to the runtime helper and publishes the narrower `WebServerBotPort` contract instead, so the explicit `{ botAdapter, webApiAdapter }` handoff no longer exposes adapter implementation ownership.
- `web/index.ts` stays a thin compatibility barrel while re-exporting the new `WebServerBotPort` type from the dedicated runtime helper instead of widening back to the concrete adapter class.
- The web entrypoint guardrails now prove the lower-level runtime source publishes the narrow bot port contract and keeps the concrete adapter class non-exported.
- 2026-05-30: completed `packages/core/src/core/core-entrypoint-runtime.ts configured runtime projection seam follow-up`.
- 2026-05-30: completed `packages/core/src/legacy-entrypoint-runtime.ts legacy runtime export boundary follow-up`.
- 2026-05-30: completed `packages/core/src/index.ts legacy runtime compatibility boundary follow-up`.
- `core-entrypoint-runtime.ts` now owns the concrete core helper implementations end-to-end, including raw bot/runtime creation, the shared `loadBotRuntimeConfig(loader?)` seam, and configured helper orchestration, so `packages/core/src/core/index.ts` can stay a thin public barrel instead of mixing boundary exports with runtime assembly.
- `legacy-entrypoint-runtime.ts` now owns the shared CLI `main` handoff together with the legacy export-name/runtime runner contract, which keeps the compatibility wrapper on `packages/core/src/index.ts` from importing the dedicated CLI entrypoint directly.
- The core and legacy entrypoint guardrails now prove both barrels re-export their runtime helpers directly, preserving the explicit `{ bot, webApiAdapter }` handoff while narrowing ownership of CLI/config orchestration to the dedicated runtime files.
- 2026-05-29: completed `packages/core/src/factories/create-runtime-bundle.ts grouped read adapter bundle handoff follow-up`.
- 2026-05-29: completed `packages/core/src/bot-factory.ts runtime dependency bundle handoff follow-up`.
- 2026-05-29: completed `packages/core/src/factories/create-trading-bot-runtime.ts runtime source consumer handoff follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts legacy runtime read adapter guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/core/core-entrypoint.functional.test.ts configured runtime handoff guardrail follow-up`.
- `create-runtime-bundle.ts` now owns the public read-only web API handoff through `createBotRuntimeReadApi(...)`, so grouped `readAdapters.webApiAdapter` is the single adapter source across bundle/runtime projections.
- `createTradingBotRuntimeFromFactoryRuntime(...)` now materializes the public `{ bot, webApiAdapter }` pair from grouped read adapters rather than the duplicated bundle field, and `BotFactory` routes runtime/bundle materialization through the same factory-runtime owner helpers.
- The core and legacy entrypoint guardrails now prove those compatibility surfaces preserve the explicit runtime handoff without rediscovering the adapter through bot internals or widening back to `runtimeSource`.
- 2026-05-29: completed `packages/core/src/services/runtime-service-adapters.ts runtime dependency adapter boundary follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/trading-bot.lifecycle.test.ts trading bot lifecycle guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts websocket handler error guardrail follow-up`.
- `runtime-service-adapters.ts` now materializes the final grouped `readAdapters` shell directly inside runtime dependency parts, so the internal `webApiReadServices` staging container no longer crosses the parts-to-dependencies seam.
- `TradingBot` now keeps critical-error hooks, dashboard listeners, and runtime hook readiness under one lifecycle-state owner, and the lifecycle guardrail now proves failed startup leaves no dangling event listeners behind.
- `WebSocketEventHandlerManager` now routes invalid candle, orderbook, and trade payload recovery through one shared SKIP helper, and the websocket error guardrails now assert those invalid public events are rejected before runtime consumers see them.
- 2026-05-29: completed `packages/core/src/__tests__/bot-factory.test.ts runtime bundle handoff guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/core/index.ts programmatic runtime handoff boundary follow-up`.
- 2026-05-29: completed `README.md and ARCHITECTURE_QUICK_START.md runtime boundary docs follow-up`.
- `BotFactory` now routes both `createRuntime(...)` and `createBotRuntimeBundle(...)` through one shared factory-runtime seam, so bundle assembly and public bot/runtime materialization start from the same ownership boundary.
- `@edison/core/core` now projects programmatic runtime creation onto the explicit `{ bot, webApiAdapter }` handoff, which keeps the broader `runtimeSource` contract local to the factory seam instead of the public programmatic entrypoint.
- README and architecture docs now document that narrowed handoff explicitly, and the entrypoint guardrails prove the legacy wrapper still re-exports the runtime helpers without re-exposing the factory runtime source.
- 2026-05-29: completed `packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts runtime contract guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/helpers/service-lifecycle-test.utils.ts runtime harness factory boundary follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts runtime factory handoff guardrail follow-up`.
- `packages/core/src/interfaces/IRuntimeContracts.ts` now defines the canonical `IBotRuntimeBundle`, `ITradingBotFactoryRuntime`, and `ITradingBotRuntime` shells, and `interfaces/index.ts` re-exports them for downstream consumers.
- `createTradingBotRuntime(...)` now materializes the public bot/runtime pair through `createTradingBotRuntimeFromFactoryRuntime(...)`, so factory handoff and bot handoff reuse one runtime seam.
- `service-lifecycle-test.utils.ts` now keeps factory-runtime and bot-runtime harness ownership separate, and the direct trading-bot/web-entrypoint guardrails consume the explicit bot/runtime pair instead of the factory bundle harness.
- 2026-05-29: completed `packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts websocket runtime functional guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/services/bot-factory.service.ts runtime source ownership boundary follow-up`.
- 2026-05-29: completed `packages/core/src/services/factories/bot-service-state.ts runtime source ownership boundary follow-up`.
- `bot-service-state.ts` now owns the explicit projection from mutable builder state into the public `IBotFactoryRuntimeSource`, so bot-factory callers no longer receive bootstrap-only fields such as `telegram`, `timeService`, or repository internals on the runtime shell.
- `BotFactory.createWithValidation(...)` now reuses that same projection in both the normal and override-fallback paths, keeping runtime source ownership consistent even when DI overrides fail.
- The websocket functional guardrail now proves the lifecycle event-handler shell stays narrowed to websocket collaborators and does not leak initializer-only exchange, journal, or web API ownership.
- 2026-05-29: completed `packages/core/src/interfaces/ITradingBotRuntimeDependencies.ts runtime dependency bundle contract follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/runtime-service-adapters.functional.test.ts runtime adapter functional guardrail follow-up`.
- 2026-05-29: completed `packages/core/src/__tests__/services/bot-initializer.functional.test.ts initializer runtime functional guardrail follow-up`.
- `ITradingBotRuntimeDependencies` now groups collaborator ownership into `lifecycleDependencies` and `readAdapters`, so `TradingBot` consumes explicit lifecycle/read shells instead of a flat runtime dependency bag.
- `runtime-service-adapters.ts` and `create-runtime-bundle.ts` now preserve that grouped contract from runtime dependency parts through bundle handoff, while keeping the shared web API adapter cached once.
- `BotInitializer` functional coverage now proves the grouped runtime dependency shell still swaps monitoring reads onto a factory-created exchange.
- 2026-05-29: completed `packages/core/src/services/bot-initializer.ts initializer runtime lifecycle boundary follow-up`.
- 2026-05-29: completed `packages/core/src/services/websocket-event-handler-manager.ts websocket handler manager boundary follow-up`.
- 2026-05-29: completed `packages/core/src/bot.ts trading bot lifecycle collaborator boundary follow-up`.
- `BotInitializer` now skips optional monitoring/resilience stage startup when the narrowed runtime shell only carries empty service placeholders, which keeps optional lifecycle ownership local to actual lifecycle-backed collaborators.
- `WebSocketEventHandlerManager.registerAllHandlers()` no longer requires a `TradingBot` collaborator, and `TradingBot` now routes runtime handler registration through a zero-argument lifecycle seam.
- 2026-05-29: completed `packages/core/src/factories/create-runtime-bundle.ts runtime bundle assembly boundary follow-up`.
- 2026-05-29: completed `packages/core/src/bot-factory.ts runtime bundle handoff boundary follow-up`.
- 2026-05-29: completed `packages/core/src/factories/create-trading-bot-runtime.ts runtime factory boundary follow-up`.
- The runtime factory boundary now reuses a shared `createTradingBotFactoryRuntime(...)` handoff so `runtimeSource` and `runtimeBundle` stay assembled in one place before `TradingBot` construction.
- `create-runtime-bundle.ts` now materializes the final bundle from preassembled runtime dependencies, and `BotFactory.createBotRuntimeBundle(...)` now reuses that same shared handoff instead of rebuilding the bundle shell manually.
- 2026-05-28: completed `packages/core/src/interfaces/IWebSocketEventHandlerServices.ts websocket handler contract consolidation follow-up`.
- 2026-05-28: completed `packages/core/src/interfaces/IRuntimeSources.ts runtime source contract consolidation follow-up`.
- 2026-05-28: completed `packages/core/src/interfaces/ITradingBotServices.ts trading bot service contract consolidation follow-up`.
- 2026-05-28: completed `packages/core/src/interfaces/IBotInitializerServices.ts initializer service contract consolidation follow-up`.
- The websocket runtime contract now reuses `coreServices.logger` instead of flattening logger ownership, keeping the grouped runtime boundary consistent across TradingBot, BotInitializer, and WebSocketEventHandlerManager.
- Canonical narrow runtime slices now live in the consumer-facing interface files, and `IRuntimeSources.ts` now reuses them instead of repeating inline runtime `Pick` contracts.

## Last Verification
- `npm test -- --runInBand packages/core/src/__tests__/web/web-entrypoint.functional.test.ts packages/core/src/__tests__/web/web-boundary.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts`
- `npm test -- --runInBand position-monitor`
- `npm run build`
- `npm test -- --runInBand packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts packages/core/src/__tests__/core/package-script-boundary.functional.test.ts`
- `npm test -- --runInBand position-monitor`
- `npm run build`
- `npm test -- --runInBand packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts`
- `npm test -- --runInBand packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/trading-bot.functional.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts`
- `npm test -- --runInBand packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/core/core-entrypoint.functional.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts packages/core/src/__tests__/core/readme-entrypoint-boundary.functional.test.ts packages/core/src/__tests__/core/architecture-entrypoint-boundary.functional.test.ts`
- `npm test -- --runInBand packages/core/src/__tests__/core/package-script-boundary.functional.test.ts`
- `npm test -- --runInBand packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts packages/core/src/__tests__/helpers/service-lifecycle-test.utils.test.ts packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/web/web-entrypoint.functional.test.ts`
- `npm test -- --runInBand packages/core/src/__tests__/services/bot-service-state.functional.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts`
- `npm test -- --runInBand packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts packages/core/src/__tests__/runtime-service-adapters.functional.test.ts packages/core/src/__tests__/services/bot-initializer.functional.test.ts packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts packages/core/src/__tests__/create-trading-bot-runtime.functional.test.ts packages/core/src/__tests__/bot-factory.test.ts packages/core/src/__tests__/core/legacy-entrypoint.functional.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts`
