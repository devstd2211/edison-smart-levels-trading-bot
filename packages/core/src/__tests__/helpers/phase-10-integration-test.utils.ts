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

export type Phase10Orderbook = ReturnType<typeof createLiquidityHeatmapOrderbook>;

export function asPhase10SignalType(value: unknown): Signal['type'] {
  return value as Signal['type'];
}

export function asPhase10Signal(value: unknown): Signal {
  return value as Signal;
}

export function asPhase10Context(value: unknown): MarketContext {
  return value as MarketContext;
}

export function asPhase10Orderbook(value: unknown): Phase10Orderbook {
  return value as Phase10Orderbook;
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

export function createPhase10IntegrationOrderbook(overrides: Partial<Phase10Orderbook> = {}) {
  return {
    ...createLiquidityHeatmapOrderbook(),
    ...overrides,
  };
}

export function createPhase10BalancedOrderbook(): ReturnType<typeof createPhase10IntegrationOrderbook> {
  return createPhase10IntegrationOrderbook({
    bids: [
      { price: 50000, volume: 10.0 },
      { price: 49990, volume: 8.0 },
      { price: 49980, volume: 12.0 },
      { price: 49970, volume: 5.0 },
      { price: 49960, volume: 7.0 },
    ],
    asks: [
      { price: 50010, volume: 9.0 },
      { price: 50020, volume: 11.0 },
      { price: 50030, volume: 6.0 },
      { price: 50040, volume: 8.0 },
      { price: 50050, volume: 4.0 },
    ],
  });
}

export function createPhase10SlippageOrderbook(): ReturnType<typeof createPhase10IntegrationOrderbook> {
  return createPhase10IntegrationOrderbook({
    bids: [
      { price: 50000, volume: 15.0 },
      { price: 49990, volume: 20.0 },
      { price: 49980, volume: 10.0 },
    ],
    asks: [
      { price: 50010, volume: 12.0 },
      { price: 50020, volume: 18.0 },
      { price: 50030, volume: 8.0 },
    ],
  });
}

export function createPhase10SupportResistanceOrderbook(): ReturnType<typeof createPhase10IntegrationOrderbook> {
  return createPhase10IntegrationOrderbook({
    bids: [
      { price: 50000, volume: 25.0 },
      { price: 49990, volume: 10.0 },
      { price: 49980, volume: 8.0 },
    ],
    asks: [
      { price: 50010, volume: 8.0 },
      { price: 50020, volume: 12.0 },
      { price: 50030, volume: 22.0 },
    ],
  });
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
  orderbook?: Partial<Phase10Orderbook>;
  signal?: Partial<Signal>;
  context?: Partial<MarketContext>;
} = {}) {
  return {
    orderbook: createPhase10IntegrationOrderbook(options.orderbook),
    signal: createPhase10Signal(options.signal),
    context: createPhase10Context(options.context),
  };
}

export function createPhase10InvalidOrderbook() {
  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids: null,
    asks: [],
  };
}

export function createPhase10ValidRecoveryOrderbook(): ReturnType<typeof createPhase10IntegrationOrderbook> {
  return createPhase10IntegrationOrderbook({
    symbol: 'BTCUSDT',
    bids: [{ price: 50000, volume: 10 }],
    asks: [{ price: 50010, volume: 10 }],
  });
}

export function createPhase10InvalidSignal(): Signal {
  return createPhase10Signal({
    type: 'invalid' as never,
    direction: 'wrong' as never,
    confidence: 5.0,
    timestamp: NaN,
  });
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

export type Phase10Harness = ReturnType<typeof createPhase10Harness>;

export interface ManagedPhase10Context extends Phase10Harness {
  createHarness: () => Phase10Harness;
  cleanup: () => void;
}

export function createManagedPhase10Context(): ManagedPhase10Context {
  const trackedHarnesses: Phase10Harness[] = [];
  const createHarness = () => {
    const harness = createPhase10Harness();
    trackedHarnesses.push(harness);
    return harness;
  };

  const harness = createHarness();

  return {
    ...harness,
    createHarness,
    cleanup: () => {
      trackedHarnesses.length = 0;
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function seedPhase10VolumeBaseline(service: Phase10Harness['anomalyService']): void {
  for (let i = 0; i < 25; i++) {
    seedVolumeHistory(service, [100 + Math.random() * 20]);
  }
}
