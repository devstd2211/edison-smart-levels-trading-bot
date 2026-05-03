import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { AdvancedOrderFlowService } from '../../advanced-order-flow.service';
import { DynamicPositionSizerService } from '../../dynamic-position-sizer.service';
import { PositionScalingService } from '../../position-scaling.service';
import { SmartOrderExecutionService } from '../../smart-order-execution.service';
import { AdvancedOrderStateMachineService } from '../../advanced-order-state-machine.service';
import { PrometheusMetricsService } from '../../prometheus-metrics.service';
import { LadderExitDetectorService } from '../../ladder-exit-detector.service';
import type { MonitoringConfig } from './bot-services.types';
import { initializeCompoundInterestService } from './compound-interest-service.builder';
import { createDynamicPositionSizingConfig } from './dynamic-position-sizing-config.builder';
import { initializeDeltaAnalyzerService } from './delta-analyzer-service.builder';
import { createOrderStateMachineConfig } from './order-state-machine-config.builder';
import { initializeOrderbookImbalanceService } from './orderbook-imbalance-service.builder';
import { createPositionScalingConfig } from './position-scaling-config.builder';
import { createPrometheusMetricsConfig } from './prometheus-metrics-config.builder';
import { initializeRetestEntryService } from './retest-entry-service.builder';
import { createSmartOrderExecutionConfig } from './smart-order-execution-config.builder';
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

  if (config.advancedOrderFlow?.enabled) {
    state.advancedOrderFlowService = new AdvancedOrderFlowService(
      config.advancedOrderFlow,
      config.orderFlowAnalysis,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('\u2705 Advanced Order Flow Service initialized (Phase 10.1)', {
      tickWindowMs: config.advancedOrderFlow.tickWindowMs,
      enableSpoofing: config.advancedOrderFlow.enableSpoofingDetection,
      enableMomentum: config.advancedOrderFlow.enableMomentum,
    });
  }

  const dynamicPositionSizing = createDynamicPositionSizingConfig(config);
  if (dynamicPositionSizing?.enabled) {
    state.dynamicPositionSizer = new DynamicPositionSizerService(
      dynamicPositionSizing,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('\u2705 Dynamic Position Sizer initialized (Phase 11.1)', {
      baseRiskPercent: dynamicPositionSizing.baseRiskPercent,
      maxRiskPercent: dynamicPositionSizing.maxRiskPercent,
      volatilityMultiplier: dynamicPositionSizing.volatilityMultiplier,
    });
  }

  const positionScaling = createPositionScalingConfig(config);
  if (positionScaling?.enabled) {
    state.positionScalingService = new PositionScalingService(
      positionScaling,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('\u2705 Position Scaling Service initialized (Phase 11.2)', {
      scaleInThreshold: positionScaling.scaleInThreshold,
      maxScales: positionScaling.maxScales,
      scaleReduction: positionScaling.scaleReduction,
    });
  }

  const smartOrderExecution = createSmartOrderExecutionConfig(config);
  if (smartOrderExecution?.enabled) {
    state.smartOrderExecution = new SmartOrderExecutionService(
      smartOrderExecution,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('\u2705 Smart Order Execution initialized (Phase 13.1)', {
      maxSlippagePercent: smartOrderExecution.maxSlippagePercent,
      executionStrategy: smartOrderExecution.executionStrategy,
      adaptiveExecution: smartOrderExecution.adaptiveExecution,
    });
  }

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

  state.ladderExitDetector = new LadderExitDetectorService(
    state.logger,
    state.bybitService,
    state.errorHandler,
  );
  state.logger.debug('\u2705 Ladder Exit Detector initialized (Phase 8.9.27)', {
    hasErrorHandler: !!state.errorHandler,
  });
};
