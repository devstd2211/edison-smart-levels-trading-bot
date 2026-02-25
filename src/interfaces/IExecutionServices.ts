/**
 * IExecutionServices
 *
 * Grouped execution services (position lifecycle, exits, orchestration).
 */

import type { PositionLifecycleService } from '../services/position-lifecycle.service';
import type { PositionExitingService } from '../services/position-exiting.service';
import type { PositionMonitorService } from '../services/position-monitor.service';
import type { TradingOrchestrator } from '../services/trading-orchestrator.service';
import type { RealTimeRiskMonitor } from '../services/real-time-risk-monitor.service';
import type { LadderExitDetectorService } from '../services/ladder-exit-detector.service';
import type { DynamicPositionSizerService } from '../services/dynamic-position-sizer.service';
import type { PositionScalingService } from '../services/position-scaling.service';
import type { SmartOrderExecutionService } from '../services/smart-order-execution.service';
import type { AdvancedOrderStateMachineService } from '../services/advanced-order-state-machine.service';

export interface IExecutionServices {
  readonly positionManager: PositionLifecycleService;
  readonly positionMonitor: PositionMonitorService;
  readonly positionExitingService: PositionExitingService;
  readonly tradingOrchestrator: TradingOrchestrator;
  readonly realTimeRiskMonitor: RealTimeRiskMonitor;
  readonly ladderExitDetector?: LadderExitDetectorService;
  readonly dynamicPositionSizer?: DynamicPositionSizerService;
  readonly positionScalingService?: PositionScalingService;
  readonly smartOrderExecution?: SmartOrderExecutionService;
  readonly orderStateMachine?: AdvancedOrderStateMachineService;
}
