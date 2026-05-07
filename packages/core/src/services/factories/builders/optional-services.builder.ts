import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import type { MonitoringConfig } from './bot-services.types';
import { initializeAdvancedOrderFlowService } from './advanced-order-flow-service.builder';
import { initializeCompoundInterestService } from './compound-interest-service.builder';
import { initializeDeltaAnalyzerService } from './delta-analyzer-service.builder';
import { initializeDynamicPositionSizerService } from './dynamic-position-sizer-service.builder';
import { initializeLadderExitDetectorService } from './ladder-exit-detector-service.builder';
import { initializeOrderbookImbalanceService } from './orderbook-imbalance-service.builder';
import { initializeOrderStateMachineService } from './order-state-machine-service.builder';
import { initializePositionScalingService } from './position-scaling-service.builder';
import { initializePrometheusMetricsService } from './prometheus-metrics-service.builder';
import { initializeRetestEntryService } from './retest-entry-service.builder';
import { initializeSmartOrderExecutionService } from './smart-order-execution-service.builder';
import { initializeWallTrackerService } from './wall-tracker-service.builder';

export const initializeOptionalServices = (
  state: BotServiceState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  initializeCompoundInterestService(state, config);
  initializeRetestEntryService(state, config);
  initializeDeltaAnalyzerService(state, config);
  initializeOrderbookImbalanceService(state, config);
  initializeWallTrackerService(state, config);
  initializeAdvancedOrderFlowService(state, config);
  initializeDynamicPositionSizerService(state, config);
  initializePositionScalingService(state, config);
  initializeSmartOrderExecutionService(state, config);
  initializeOrderStateMachineService(state, config);
  initializePrometheusMetricsService(state, monitoring);

  initializeLadderExitDetectorService(state);
};
