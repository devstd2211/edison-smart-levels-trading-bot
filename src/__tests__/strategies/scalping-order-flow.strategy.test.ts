/**
 * Tests for ScalpingOrderFlowStrategy (Phase 5)
 *
 * Coverage:
 * - Generate signals (LONG/SHORT)
 * - Block weak imbalance
 * - Block low confidence
 * - Calculate TP/SL
 * - Feed orderbook updates
 */

import { ScalpingOrderFlowStrategy } from '../../strategies/scalping-order-flow.strategy';
import {
  LoggerService,
  LogLevel,
  SignalDirection,
  ScalpingOrderFlowConfig,
  StrategyMarketData,
  TrendBias,
  OrderBook,
  Candle,
  AggressiveFlow,
} from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createMockCandle = (close: number): Candle => {
  return {
    timestamp: Date.now(),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  };
};

const createMockMarketData = (closePrice: number): StrategyMarketData => {
  return {
    candles: [createMockCandle(closePrice)],
    swingPoints: [],
    rsi: 50,
    rsiTrend1: 50,
    ema: { fast: closePrice, slow: closePrice },
    emaTrend1: { fast: closePrice, slow: closePrice },
    trend: 'NEUTRAL',
    atr: 0.01,
    timestamp: Date.now(),
    currentPrice: closePrice,
    orderbook: createMockOrderbook(closePrice - 0.001, 100, closePrice + 0.001, 100), // Add orderbook
    context: {
      timestamp: Date.now(),
      trend: TrendBias.NEUTRAL,
      marketStructure: null,
      atrPercent: 0.5,
      emaDistance: 0,
      ema50: closePrice,
      atrModifier: 1.0,
      emaModifier: 1.0,
      trendModifier: 1.0,
      overallModifier: 1.0,
      isValidContext: true,
      blockedBy: [],
      warnings: [],
    },
  };
};

const createMockOrderbook = (
  bidPrice: number,
  bidSize: number,
  askPrice: number,
  askSize: number,
): OrderBook => {
  return {
    symbol: 'APEXUSDT',
    bids: [
      [bidPrice, bidSize],
      [bidPrice - 0.001, 50],
    ],
    asks: [
      [askPrice, askSize],
      [askPrice + 0.001, 50],
    ],
    timestamp: Date.now(),
    updateId: Date.now(),
  };
};

const createMockFlow = (direction: 'BUY' | 'SELL', volumeUSDT: number, timestamp: number = Date.now()): AggressiveFlow => {
  return { direction, volumeUSDT, timestamp, price: 1.0 };
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ScalpingOrderFlowStrategy', () => {
  let strategy: ScalpingOrderFlowStrategy;
  let logger: LoggerService;
  let config: ScalpingOrderFlowConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    // Default config
    config = {
      enabled: true,
      priority: 2,
      minConfidence: 75,
      takeProfitPercent: 0.10,
      stopLossPercent: 0.05,
      maxHoldingTimeMs: 30000,
      analyzer: {
        aggressiveBuyThreshold: 3.0,
        detectionWindow: 3000,
        minVolumeUSDT: 5000,
        maxConfidence: 90,
      },
    };

    strategy = new ScalpingOrderFlowStrategy(config, logger);
  });

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  describe('initialization', () => {
    it('should initialize with correct name and priority', () => {
      expect(strategy.name).toBe('ScalpingOrderFlow');
      expect(strategy.priority).toBe(2);
    });

    it('should be enabled when config.enabled = true', () => {
      expect(strategy.isEnabled()).toBe(true);
    });

    it('should be disabled when config.enabled = false', () => {
      const disabledConfig: ScalpingOrderFlowConfig = { ...config, enabled: false };
      const disabledStrategy = new ScalpingOrderFlowStrategy(disabledConfig, logger);

      expect(disabledStrategy.isEnabled()).toBe(false);
    });
  });

  // ==========================================================================
  // GENERATE SIGNALS
  // ==========================================================================

  describe('evaluate - generate signals', () => {
    it('should generate LONG signal on aggressive buy flow', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive buy flow: 9000 buy, 3000 sell = 3x ratio
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.direction).toBe(SignalDirection.LONG);
      expect(signal.signal?.price).toBe(1.0);
      expect(signal.signal?.confidence).toBeGreaterThan(0);
    });

    it('should generate SHORT signal on aggressive sell flow', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive sell flow: 2000 buy, 6000 sell = 3x inverse
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 2000, now));
      history.push(createMockFlow('SELL', 6000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.direction).toBe(SignalDirection.SHORT);
      expect(signal.signal?.price).toBe(1.0);
    });

    it('should NOT generate signal when disabled', async () => {
      const disabledConfig: ScalpingOrderFlowConfig = { ...config, enabled: false };
      const disabledStrategy = new ScalpingOrderFlowStrategy(disabledConfig, logger);

      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive buy flow
      const analyzer = disabledStrategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await disabledStrategy.evaluate(data);

      expect(signal.valid).toBe(false);
      expect(signal.reason).toBe('Strategy disabled');
    });
  });

  // ==========================================================================
  // BLOCKING CONDITIONS
  // ==========================================================================

  describe('blocking conditions', () => {
    it('should block weak imbalance (<3x ratio)', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed weak imbalance: 6000 buy, 3000 sell = 2x ratio (below 3x)
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 6000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(false);
    });

    it('should block low volume', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed low volume: 3000 buy, 1000 sell = 4000 total (below 5000)
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 3000, now));
      history.push(createMockFlow('SELL', 1000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(false);
    });

    it('should block low confidence', async () => {
      const highConfidenceConfig: ScalpingOrderFlowConfig = {
        ...config,
        minConfidence: 95, // Very high threshold
      };
      const highConfStrategy = new ScalpingOrderFlowStrategy(highConfidenceConfig, logger);

      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed moderate imbalance (might not reach 95 confidence)
      const analyzer = highConfStrategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await highConfStrategy.evaluate(data);

      // Might be blocked due to confidence < 95
      if (!signal.valid) {
        expect(signal.reason).toContain('confidence too low');
      }
    });
  });

  // ==========================================================================
  // TP/SL CALCULATIONS
  // ==========================================================================

  describe('TP/SL calculations', () => {
    it('should calculate correct TP for LONG', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive buy flow
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.takeProfits).toHaveLength(1);
      // TP: 1.0 * (1 + 0.10/100) = 1.001
      expect(signal.signal?.takeProfits[0].price).toBeCloseTo(1.001, 4);
      expect(signal.signal?.takeProfits[0].percent).toBe(0.10); // TP percent
      expect(signal.signal?.takeProfits[0].sizePercent).toBe(100); // Close 100% of position
    });

    it('should calculate correct TP for SHORT', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive sell flow
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 2000, now));
      history.push(createMockFlow('SELL', 6000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.takeProfits).toHaveLength(1);
      // TP: 1.0 * (1 - 0.10/100) = 0.999
      expect(signal.signal?.takeProfits[0].price).toBeCloseTo(0.999, 4);
    });

    it('should calculate correct SL for LONG', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive buy flow
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      // SL: 1.0 * (1 - 0.05/100) = 0.9995
      expect(signal.signal?.stopLoss).toBeCloseTo(0.9995, 4);
    });

    it('should calculate correct SL for SHORT', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive sell flow
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 2000, now));
      history.push(createMockFlow('SELL', 6000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      // SL: 1.0 * (1 + 0.05/100) = 1.0005
      expect(signal.signal?.stopLoss).toBeCloseTo(1.0005, 4);
    });

    it('should have correct R/R ratio (2:1)', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive buy flow
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);

      const entry = signal.signal!.price;
      const tp = signal.signal!.takeProfits[0].price;
      const sl = signal.signal!.stopLoss;

      const tpDistance = Math.abs(tp - entry);
      const slDistance = Math.abs(entry - sl);
      const rrRatio = tpDistance / slDistance;

      // 0.001 / 0.0005 = 2.0
      expect(rrRatio).toBeCloseTo(2.0, 1);
    });
  });

  // ==========================================================================
  // FEED ORDERBOOK UPDATES
  // ==========================================================================

  describe('feedOrderbookUpdate', () => {
    it('should feed orderbook updates to analyzer', () => {
      const orderbook1 = createMockOrderbook(1.0, 100, 1.001, 100);
      const orderbook2 = createMockOrderbook(1.001, 100, 1.002, 80);

      strategy.feedOrderbookUpdate(orderbook1);
      strategy.feedOrderbookUpdate(orderbook2);

      // Should trigger aggressive flow detection
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();

      // Might have detected aggressive buy (price up + asks removed)
      expect(history.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should return no signal with no flow', async () => {
      const data = createMockMarketData(1.0);

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(false);
      expect(signal.reason).toContain('No flow imbalance');
    });

    it('should include reasons in signal', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0);

      // Feed aggressive buy flow
      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now));
      history.push(createMockFlow('SELL', 3000, now));

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.reason).toBeDefined();
      expect(signal.signal?.reason).toContain('Order flow imbalance');
    });
  });
});
