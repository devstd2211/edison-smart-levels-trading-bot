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

type FoundationalOptionalServicesState = Pick<
  BotServiceState,
  | 'logger'
  | 'errorHandler'
  | 'bybitService'
  | 'journal'
  | 'compoundInterestCalculator'
  | 'retestEntryService'
  | 'deltaAnalyzerService'
  | 'orderbookImbalanceService'
  | 'wallTrackerService'
>;

type ExecutionOptionalServicesState = Pick<
  BotServiceState,
  | 'logger'
  | 'errorHandler'
  | 'bybitService'
  | 'advancedOrderFlowService'
  | 'dynamicPositionSizer'
  | 'positionScalingService'
  | 'smartOrderExecution'
  | 'ladderExitDetector'
>;

type OptionalMonitoringServicesState = Pick<
  BotServiceState,
  'logger' | 'errorHandler' | 'orderStateMachine' | 'metricsService'
>;

export type OptionalServicesBuilderState =
  & FoundationalOptionalServicesState
  & ExecutionOptionalServicesState
  & OptionalMonitoringServicesState;

export const initializeFoundationalOptionalServices = (
  state: FoundationalOptionalServicesState,
  config: Config,
): void => {
  const builderState = state as BotServiceState;
  initializeCompoundInterestService(builderState, config);
  initializeRetestEntryService(builderState, config);
  initializeDeltaAnalyzerService(builderState, config);
  initializeOrderbookImbalanceService(builderState, config);
  initializeWallTrackerService(builderState, config);
};

export const initializeExecutionOptionalServices = (
  state: ExecutionOptionalServicesState,
  config: Config,
): void => {
  const builderState = state as BotServiceState;
  initializeAdvancedOrderFlowService(builderState, config);
  initializeDynamicPositionSizerService(builderState, config);
  initializePositionScalingService(builderState, config);
  initializeSmartOrderExecutionService(builderState, config);
  initializeLadderExitDetectorService(builderState);
};

export const initializeOptionalMonitoringServices = (
  state: OptionalMonitoringServicesState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  const builderState = state as BotServiceState;
  initializeOrderStateMachineService(builderState, config);
  initializePrometheusMetricsService(builderState, monitoring);
};

export const initializeOptionalServices = (
  state: OptionalServicesBuilderState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  initializeFoundationalOptionalServices(state, config);
  initializeExecutionOptionalServices(state, config);
  initializeOptionalMonitoringServices(state, config, monitoring);
};
