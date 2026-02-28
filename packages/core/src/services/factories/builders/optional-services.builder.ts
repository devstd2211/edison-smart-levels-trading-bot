import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { CompoundInterestCalculatorService } from '../../compound-interest-calculator.service';
import { RetestEntryService } from '../../retest-entry.service';
import { DeltaAnalyzerService } from '../../delta-analyzer.service';
import { OrderbookImbalanceService } from '../../orderbook-imbalance.service';
import { WallTrackerService } from '../../wall-tracker.service';
import { AdvancedOrderFlowService } from '../../advanced-order-flow.service';
import { DynamicPositionSizerService } from '../../dynamic-position-sizer.service';
import { PositionScalingService } from '../../position-scaling.service';
import { SmartOrderExecutionService } from '../../smart-order-execution.service';
import { AdvancedOrderStateMachineService } from '../../advanced-order-state-machine.service';
import { PrometheusMetricsService } from '../../prometheus-metrics.service';
import { LadderExitDetectorService } from '../../ladder-exit-detector.service';
import type {
  DynamicPositionSizingConfig,
  MonitoringConfig,
  OrderStateMachineConfig,
  PositionScalingConfig,
  SmartOrderExecutionConfig,
} from './bot-services.types';

export const initializeOptionalServices = (
  state: BotServicesState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  if (config.compoundInterest && config.compoundInterest.enabled) {
    state.compoundInterestCalculator = new CompoundInterestCalculatorService(
      config.compoundInterest,
      state.logger,
      async () => {
        if (config.compoundInterest?.useVirtualBalance) {
          return state.journal.getVirtualBalance();
        }
        const balance = await state.bybitService.getBalance();
        return balance.walletBalance;
      },
    );
  }

  if (config.retestEntry?.enabled) {
    state.retestEntryService = new RetestEntryService(
      config.retestEntry,
      state.logger,
    );
  }

  if (config.delta?.enabled) {
    state.deltaAnalyzerService = new DeltaAnalyzerService(
      config.delta,
      state.logger,
    );
    state.logger.info('✅ Delta Analyzer initialized', {
      windowMs: config.delta.windowSizeMs,
      threshold: config.delta.minDeltaThreshold,
    });
  }

  if (config.orderbookImbalance?.enabled) {
    state.orderbookImbalanceService = new OrderbookImbalanceService(
      config.orderbookImbalance,
      state.logger,
    );
    state.logger.info('✅ Orderbook Imbalance initialized', {
      minImbalance: config.orderbookImbalance.minImbalancePercent + '%',
      levels: config.orderbookImbalance.levels,
    });
  }

  if (config.wallTracking?.enabled) {
    state.wallTrackerService = new WallTrackerService(
      config.wallTracking,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Wall Tracker initialized (PHASE 4)', {
      minLifetime: config.wallTracking.minLifetimeMs + 'ms',
      spoofingThreshold: config.wallTracking.spoofingThresholdMs + 'ms',
      trackHistory: config.wallTracking.trackHistoryCount,
    });
  }

  if (config.advancedOrderFlow?.enabled) {
    state.advancedOrderFlowService = new AdvancedOrderFlowService(
      config.advancedOrderFlow,
      config.orderFlowAnalysis,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Advanced Order Flow Service initialized (Phase 10.1)', {
      tickWindowMs: config.advancedOrderFlow.tickWindowMs,
      enableSpoofing: config.advancedOrderFlow.enableSpoofingDetection,
      enableMomentum: config.advancedOrderFlow.enableMomentum,
    });
  }

  const dynamicPositionSizing = (config as Partial<{ dynamicPositionSizing: DynamicPositionSizingConfig }>).dynamicPositionSizing;
  if (dynamicPositionSizing?.enabled) {
    state.dynamicPositionSizer = new DynamicPositionSizerService(
      dynamicPositionSizing,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Dynamic Position Sizer initialized (Phase 11.1)', {
      baseRiskPercent: dynamicPositionSizing.baseRiskPercent,
      maxRiskPercent: dynamicPositionSizing.maxRiskPercent,
      volatilityMultiplier: dynamicPositionSizing.volatilityMultiplier,
    });
  }

  const positionScaling = (config as Partial<{ positionScaling: PositionScalingConfig }>).positionScaling;
  if (positionScaling?.enabled) {
    state.positionScalingService = new PositionScalingService(
      positionScaling,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Position Scaling Service initialized (Phase 11.2)', {
      scaleInThreshold: positionScaling.scaleInThreshold,
      maxScales: positionScaling.maxScales,
      scaleReduction: positionScaling.scaleReduction,
    });
  }

  const smartOrderExecution = (config as Partial<{ smartOrderExecution: SmartOrderExecutionConfig }>).smartOrderExecution;
  if (smartOrderExecution?.enabled) {
    state.smartOrderExecution = new SmartOrderExecutionService(
      smartOrderExecution,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Smart Order Execution initialized (Phase 13.1)', {
      maxSlippagePercent: smartOrderExecution.maxSlippagePercent,
      executionStrategy: smartOrderExecution.executionStrategy,
      adaptiveExecution: smartOrderExecution.adaptiveExecution,
    });
  }

  const orderStateMachine = (config as Partial<{ orderStateMachine: OrderStateMachineConfig }>).orderStateMachine;
  if (orderStateMachine?.enabled) {
    state.orderStateMachine = new AdvancedOrderStateMachineService(
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Order State Machine initialized (Phase 13.2)', {
      hasErrorHandler: !!state.errorHandler,
    });
  }

  if (monitoring?.metricsEnabled) {
    state.metricsService = new PrometheusMetricsService(
      {
        enabled: true,
        prefix: monitoring.metricsPrefix || 'trading_bot_',
        collectInterval: monitoring.collectInterval || 10000,
        defaultLabels: monitoring.defaultLabels,
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Prometheus Metrics initialized (Phase 14.1.1)', {
      prefix: monitoring.metricsPrefix || 'trading_bot_',
      collectInterval: monitoring.collectInterval || 10000,
    });
  }

  state.ladderExitDetector = new LadderExitDetectorService(
    state.logger,
    state.bybitService,
    state.errorHandler,
  );
  state.logger.debug('✅ Ladder Exit Detector initialized (Phase 8.9.27)', {
    hasErrorHandler: !!state.errorHandler,
  });
};
