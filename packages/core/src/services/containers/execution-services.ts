/**
 * ExecutionServices
 *
 * Grouped container for execution dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type { IExecutionServices } from '../../interfaces/IExecutionServices';

export class ExecutionServices implements IExecutionServices {
  readonly positionManager: IExecutionServices['positionManager'];
  readonly positionMonitor: IExecutionServices['positionMonitor'];
  readonly positionExitingService: IExecutionServices['positionExitingService'];
  readonly tradingOrchestrator: IExecutionServices['tradingOrchestrator'];
  readonly realTimeRiskMonitor: IExecutionServices['realTimeRiskMonitor'];
  readonly ladderExitDetector?: IExecutionServices['ladderExitDetector'];
  readonly dynamicPositionSizer?: IExecutionServices['dynamicPositionSizer'];
  readonly positionScalingService?: IExecutionServices['positionScalingService'];
  readonly smartOrderExecution?: IExecutionServices['smartOrderExecution'];
  readonly orderStateMachine?: IExecutionServices['orderStateMachine'];

  constructor(deps: IExecutionServices) {
    this.positionManager = deps.positionManager;
    this.positionMonitor = deps.positionMonitor;
    this.positionExitingService = deps.positionExitingService;
    this.tradingOrchestrator = deps.tradingOrchestrator;
    this.realTimeRiskMonitor = deps.realTimeRiskMonitor;
    this.ladderExitDetector = deps.ladderExitDetector;
    this.dynamicPositionSizer = deps.dynamicPositionSizer;
    this.positionScalingService = deps.positionScalingService;
    this.smartOrderExecution = deps.smartOrderExecution;
    this.orderStateMachine = deps.orderStateMachine;
  }
}
