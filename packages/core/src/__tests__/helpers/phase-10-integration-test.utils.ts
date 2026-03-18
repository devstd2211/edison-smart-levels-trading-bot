import { ErrorHandler } from '../../errors/ErrorHandler';
import { MLSignalValidatorService } from '../../services/ml-signal-validator.service';
import { PatternRecognitionService } from '../../services/pattern-recognition.service';
import { LoggerService, MarketContext, Signal, SignalDirection } from '../../types/legacy';
import { createAdvancedOrderFlowHarness } from './advanced-order-flow-test.utils';
import {
  createLiquidityHeatmapConfig,
  createLiquidityHeatmapHarness,
  createLiquidityHeatmapLogger,
  createLiquidityHeatmapOrderbook,
} from './liquidity-heatmap-test.utils';
import {
  createSmartOrderPlacementConfig,
  createSmartOrderPlacementHarness,
} from './smart-order-placement-test.utils';
import {
  createAnomalyDetectionServiceHarness,
  seedVolumeHistory,
} from './anomaly-detection-test.utils';

export function asPhase10SignalType(value: unknown): Signal['type'] {
  return value as Signal['type'];
}

export function asPhase10Signal(value: unknown): Signal {
  return value as Signal;
}

export function asPhase10Context(value: unknown): MarketContext {
  return value as MarketContext;
}

export function createPhase10Logger(): LoggerService {
  return createLiquidityHeatmapLogger();
}

export function createPhase10Signal(overrides: Partial<Signal> = {}): Signal {
  return {
    type: asPhase10SignalType('delta'),
    direction: SignalDirection.LONG,
    confidence: 0.75,
    timestamp: Date.now(),
    price: 50000,
    stopLoss: 49500,
    takeProfits: [],
    reason: 'test signal',
    ...overrides,
  };
}

export function createPhase10Context(overrides: Partial<MarketContext> = {}): MarketContext {
  return {
    currentPrice: 50000,
    volatility: 0.02,
    regime: 'trending_up',
    trendStrength: 0.5,
    volumeRatio: 1.0,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createPhase10IntegrationOrderbook(overrides: Partial<ReturnType<typeof createLiquidityHeatmapOrderbook>> = {}) {
  return {
    ...createLiquidityHeatmapOrderbook(),
    ...overrides,
  };
}

export function createPhase10OrderbookSide(
  basePrice: number,
  levels: number,
  direction: 'bids' | 'asks',
  volumeFactory: (index: number) => number,
  step = 10,
): Array<{ price: number; volume: number }> {
  return Array.from({ length: levels }, (_, index) => ({
    price: direction === 'bids' ? basePrice - index * step : basePrice + index * step,
    volume: volumeFactory(index),
  }));
}

export function createPhase10PerformanceOrderbook(
  bidBase = 50000,
  askBase = 50010,
  levels = 20,
): ReturnType<typeof createPhase10IntegrationOrderbook> {
  return createPhase10IntegrationOrderbook({
    bids: createPhase10OrderbookSide(bidBase, levels, 'bids', () => Math.random() * 10),
    asks: createPhase10OrderbookSide(askBase, levels, 'asks', () => Math.random() * 10),
  });
}

export function createPhase10WorkflowFixtures(options: {
  orderbook?: Partial<ReturnType<typeof createPhase10IntegrationOrderbook>>;
  signal?: Partial<Signal>;
  context?: Partial<MarketContext>;
} = {}) {
  return {
    orderbook: createPhase10IntegrationOrderbook(options.orderbook),
    signal: createPhase10Signal(options.signal),
    context: createPhase10Context(options.context),
  };
}

export function createPhase10Harness() {
  const logger = createPhase10Logger();
  const errorHandler = new ErrorHandler(logger);

  const { service: orderFlowService } = createAdvancedOrderFlowHarness({
    logger,
    errorHandler,
  });

  const { service: liquidityService } = createLiquidityHeatmapHarness({
    logger,
    config: createLiquidityHeatmapConfig({
      minStrengthThreshold: 30,
    }),
  });

  const { service: smartOrderService } = createSmartOrderPlacementHarness({
    logger,
    config: createSmartOrderPlacementConfig(),
  });

  const mlValidatorService = new MLSignalValidatorService(
    {
      minHistoricalSamples: 30,
      timeDecayFactor: 0.95,
    },
    undefined,
    logger,
    errorHandler,
  );

  const patternService = new PatternRecognitionService(
    {
      minPatternStrength: 40,
      minPatternReliability: 50,
    },
    undefined,
    logger,
    errorHandler,
  );

  const { service: anomalyService } = createAnomalyDetectionServiceHarness({
    config: {
      volumeAnomalyThreshold: 2.5,
      volatilitySpikeThreshold: 2.0,
      whaleTradeThreshold: 5.0,
      volumeWindowSize: 50,
      volatilityWindowSize: 50,
    },
    logger,
  });

  return {
    logger,
    errorHandler,
    orderFlowService,
    liquidityService,
    smartOrderService,
    mlValidatorService,
    patternService,
    anomalyService,
  };
}

export function seedPhase10VolumeBaseline(service: ReturnType<typeof createAnomalyDetectionServiceHarness>['service']): void {
  for (let i = 0; i < 25; i++) {
    seedVolumeHistory(service, [100 + Math.random() * 20]);
  }
}
