import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { AdvancedOrderStateMachineService } from '../../advanced-order-state-machine.service';
import { PrometheusMetricsService } from '../../prometheus-metrics.service';
import type { MonitoringConfig } from './bot-services.types';
import { initializeAdvancedOrderFlowService } from './advanced-order-flow-service.builder';
import { initializeCompoundInterestService } from './compound-interest-service.builder';
import { initializeDeltaAnalyzerService } from './delta-analyzer-service.builder';
import { initializeDynamicPositionSizerService } from './dynamic-position-sizer-service.builder';
import { initializeLadderExitDetectorService } from './ladder-exit-detector-service.builder';
import { createOrderStateMachineConfig } from './order-state-machine-config.builder';
import { initializeOrderbookImbalanceService } from './orderbook-imbalance-service.builder';
import { initializePositionScalingService } from './position-scaling-service.builder';
import { createPrometheusMetricsConfig } from './prometheus-metrics-config.builder';
import { initializeRetestEntryService } from './retest-entry-service.builder';
import { initializeSmartOrderExecutionService } from './smart-order-execution-service.builder';
import { initializeWallTrackerService } from './wall-tracker-service.builder';

export const initializeOptionalServices = (
  state: BotServicesState,
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

  const orderStateMachine = createOrderStateMachineConfig(config);
  if (orderStateMachine?.enabled) {
    state.orderStateMachine = new AdvancedOrderStateMachineService(
      state.logger,
      state.errorHandler,
    );
    state.logger.info('\u2705 Order State Machine initialized (Phase 13.2)', {
      hasErrorHandler: !!state.errorHandler,
    });
  }

  if (monitoring?.metricsEnabled) {
    const metricsConfig = createPrometheusMetricsConfig(monitoring);

    state.metricsService = new PrometheusMetricsService(
      metricsConfig,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('\u2705 Prometheus Metrics initialized (Phase 14.1.1)', {
      prefix: metricsConfig.prefix,
      collectInterval: metricsConfig.collectInterval,
    });
  }

  initializeLadderExitDetectorService(state);
};
