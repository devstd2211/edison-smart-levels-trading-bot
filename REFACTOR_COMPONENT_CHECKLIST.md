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
- [ ] `CandleProvider` | prod: no | tests: no | func: no
- [ ] `IndicatorCacheService` | prod: no | tests: no | func: no
- [ ] `IndicatorPreCalculationService` | prod: no | tests: no | func: no
- [ ] `PositionLifecycleService` | prod: no | tests: no | func: no
- [ ] `PositionExitingService` | prod: no | tests: no | func: no
- [ ] `PositionMonitorService` | prod: no | tests: no | func: no
- [ ] `WebSocketManagerService` | prod: no | tests: no | func: no
- [ ] `PublicWebSocketService` | prod: no | tests: no | func: no
- [ ] `OrderbookManagerService` | prod: no | tests: no | func: no
- [ ] `ConsoleDashboardService` | prod: no | tests: no | func: no
- [ ] `RetestEntryService` | prod: no | tests: no | func: no
- [ ] `DeltaAnalyzerService` | prod: no | tests: no | func: no
- [ ] `OrderbookImbalanceService` | prod: no | tests: no | func: no
- [ ] `WallTrackerService` | prod: no | tests: no | func: no
- [ ] `LadderExitDetectorService` | prod: no | tests: no | func: no
- [ ] `AdvancedOrderFlowService` | prod: no | tests: no | func: no
- [ ] `DynamicPositionSizerService` | prod: no | tests: no | func: no
- [ ] `PositionScalingService` | prod: no | tests: no | func: no
- [ ] `SmartOrderExecutionService` | prod: no | tests: no | func: no
- [ ] `AdvancedOrderStateMachineService` | prod: no | tests: no | func: no
- [ ] `TradingOrchestrator` | prod: no | tests: no | func: no
- [ ] `StrategyOrchestratorService` | prod: no | tests: no | func: no
- [ ] `RealTimeRiskMonitor` | prod: no | tests: no | func: no
- [ ] `RiskManager` | prod: no | tests: no | func: no
- [ ] `OrderExecutionDetectorService` | prod: no | tests: no | func: no

## Completed History
- [x] `ExchangeFactory` | prod: yes | tests: yes | func: yes
- [x] `TimeService` | prod: yes | tests: yes | func: yes
- [x] `RealityCheckService` | prod: yes | tests: yes | func: yes
- [x] `SessionStatsService` | prod: yes | tests: yes | func: yes
- [x] `TradingJournalService` | prod: yes | tests: yes | func: yes
- [x] `BotMetricsService` | prod: yes | tests: yes | func: yes
- [x] `ConfigValidatorService` | prod: yes | tests: yes | func: yes
- [x] `BotFactory` | prod: yes | tests: yes | func: yes
