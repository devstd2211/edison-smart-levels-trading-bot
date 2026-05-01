# Refactor Component Checklist

Rules:
- This is a finite component queue for the active refactor campaign.
- Active work stays in `Active Components`.
- When a component is fully done, move it to `Completed History` so the active list gets shorter.
- A component is complete only when all three conditions are true:
  - production refactor done
  - related tests refactored/aligned
  - functional test exists

Legend:
- `prod` = production refactor done
- `tests` = related tests refactored/aligned
- `func` = functional test exists

## Active Components
- [ ] `BotWebAPI` | prod: no | tests: no | func: no
- [ ] `WebServer` | prod: no | tests: no | func: no
- [ ] `BotServices adapter boundary` | prod: no | tests: no | func: no

## Completed History
- [x] `BotBridgeService` | prod: yes | tests: yes | func: yes
- [x] `TradingBot` | prod: yes | tests: yes | func: yes
- [x] `OrderExecutionDetectorService` | prod: yes | tests: yes | func: yes
- [x] `RiskManager` | prod: yes | tests: yes | func: yes
- [x] `RealTimeRiskMonitor` | prod: yes | tests: yes | func: yes
- [x] `StrategyOrchestratorService` | prod: yes | tests: yes | func: yes
- [x] `TradingOrchestrator` | prod: yes | tests: yes | func: yes
- [x] `AdvancedOrderStateMachineService` | prod: yes | tests: yes | func: yes
- [x] `SmartOrderExecutionService` | prod: yes | tests: yes | func: yes
- [x] `PositionScalingService` | prod: yes | tests: yes | func: yes
- [x] `DynamicPositionSizerService` | prod: yes | tests: yes | func: yes
- [x] `AdvancedOrderFlowService` | prod: yes | tests: yes | func: yes
- [x] `LadderExitDetectorService` | prod: yes | tests: yes | func: yes
- [x] `WallTrackerService` | prod: yes | tests: yes | func: yes
- [x] `OrderbookImbalanceService` | prod: yes | tests: yes | func: yes
- [x] `DeltaAnalyzerService` | prod: yes | tests: yes | func: yes
- [x] `RetestEntryService` | prod: yes | tests: yes | func: yes
- [x] `ConsoleDashboardService` | prod: yes | tests: yes | func: yes
- [x] `OrderbookManagerService` | prod: yes | tests: yes | func: yes
- [x] `PublicWebSocketService` | prod: yes | tests: yes | func: yes
- [x] `WebSocketManagerService` | prod: yes | tests: yes | func: yes
- [x] `PositionMonitorService` | prod: yes | tests: yes | func: yes
- [x] `PositionExitingService` | prod: yes | tests: yes | func: yes
- [x] `PositionLifecycleService` | prod: yes | tests: yes | func: yes
- [x] `IndicatorPreCalculationService` | prod: yes | tests: yes | func: yes
- [x] `IndicatorCacheService` | prod: yes | tests: yes | func: yes
- [x] `CandleProvider` | prod: yes | tests: yes | func: yes
- [x] `ExchangeFactory` | prod: yes | tests: yes | func: yes
- [x] `TimeService` | prod: yes | tests: yes | func: yes
- [x] `RealityCheckService` | prod: yes | tests: yes | func: yes
- [x] `SessionStatsService` | prod: yes | tests: yes | func: yes
- [x] `TradingJournalService` | prod: yes | tests: yes | func: yes
- [x] `BotMetricsService` | prod: yes | tests: yes | func: yes
- [x] `ConfigValidatorService` | prod: yes | tests: yes | func: yes
- [x] `BotFactory` | prod: yes | tests: yes | func: yes
