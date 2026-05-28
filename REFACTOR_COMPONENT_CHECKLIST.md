# Refactor Component Checklist

Rules:
- This is a finite component queue for the active refactor campaign.
- Active work stays in `Active Components`.
- When a component is fully done, move it to `REFACTOR_COMPONENT_CHECKLIST_ARCHIVE.md` so the active list stays short.
- A component is complete only when all three conditions are true:
  - production refactor done
  - related tests refactored/aligned
  - functional test exists

Legend:
- `prod` = production refactor done
- `tests` = related tests refactored/aligned
- `func` = functional test exists

## Active Components
- [ ] `packages/core/src/factories/create-runtime-bundle.ts runtime bundle assembly boundary follow-up`
- [ ] `packages/core/src/bot-factory.ts runtime bundle handoff boundary follow-up`
- [ ] `packages/core/src/factories/create-trading-bot-runtime.ts runtime factory boundary follow-up`
- [ ] `packages/core/src/services/bot-initializer.ts initializer runtime lifecycle boundary follow-up`
- [ ] `packages/core/src/services/websocket-event-handler-manager.ts websocket handler manager boundary follow-up`
- [ ] `packages/core/src/bot.ts trading bot lifecycle collaborator boundary follow-up`
- [ ] `packages/core/src/interfaces/ITradingBotRuntimeDependencies.ts runtime dependency bundle contract follow-up`
- [ ] `packages/core/src/__tests__/runtime-service-adapters.functional.test.ts runtime adapter functional guardrail follow-up`
- [ ] `packages/core/src/__tests__/services/bot-initializer.functional.test.ts initializer runtime functional guardrail follow-up`
- [ ] `packages/core/src/__tests__/services/websocket-event-handler.functional.test.ts websocket runtime functional guardrail follow-up`
- [ ] `packages/core/src/services/bot-factory.service.ts runtime source ownership boundary follow-up`
- [ ] `packages/core/src/services/factories/bot-service-state.ts runtime source ownership boundary follow-up`
- [ ] `packages/core/src/__tests__/interfaces/runtime-contracts.functional.test.ts runtime contract guardrail follow-up`
- [ ] `README.md and ARCHITECTURE_QUICK_START.md runtime boundary docs follow-up`

## Archive
- Completed items were moved to REFACTOR_COMPONENT_CHECKLIST_ARCHIVE.md.
