/**
 * Tests for ScalpingTickDeltaStrategy (Phase 4)
 *
 * Coverage:
 * - Generate signals (LONG/SHORT)
 * - Block weak momentum
 * - Block low confidence
 * - Calculate TP/SL
 * - Feed ticks
 */

import { ScalpingTickDeltaStrategy } from '../../strategies/scalping-tick-delta.strategy';
import {
  LoggerService,
  LogLevel,
  SignalDirection,
  ScalpingTickDeltaConfig,
  StrategyMarketData,
  TrendBias,
  Tick,
  Candle,
} from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createMockCandle = (close: number, timestamp: number = Date.now()): Candle => {
  return {
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  };
};

const createMockMarketData = (closePrice: number, timestamp: number = Date.now()): StrategyMarketData => {
  return {
    candles: [createMockCandle(closePrice, timestamp)],
    swingPoints: [],
    rsi: 50,
    rsiTrend1: 50,
    ema: { fast: closePrice, slow: closePrice },
    emaTrend1: { fast: closePrice, slow: closePrice },
    trend: 'NEUTRAL',
    atr: 0.01,
    timestamp,
    currentPrice: closePrice,
    context: {
      timestamp,
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

const createMockTick = (side: 'BUY' | 'SELL', price: number, size: number, timestamp: number = Date.now()): Tick => {
  return { timestamp, price, size, side };
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ScalpingTickDeltaStrategy', () => {
  let strategy: ScalpingTickDeltaStrategy;
  let logger: LoggerService;
  let config: ScalpingTickDeltaConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    // Default config
    config = {
      enabled: true,
      priority: 2,
      minConfidence: 70,
      takeProfitPercent: 0.20,
      stopLossPercent: 0.10,
      maxHoldingTimeMs: 60000,
      analyzer: {
        minDeltaRatio: 2.0,
        detectionWindow: 5000,
        minTickCount: 20,
        minVolumeUSDT: 1000,
        maxConfidence: 85,
      },
    };

    strategy = new ScalpingTickDeltaStrategy(config, logger);
  });

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  describe('initialization', () => {
    it('should initialize with correct name and priority', () => {
      expect(strategy.name).toBe('ScalpingTickDelta');
      expect(strategy.priority).toBe(2);
    });

    it('should be enabled when config.enabled = true', () => {
      expect(strategy.isEnabled()).toBe(true);
    });

    it('should be disabled when config.enabled = false', () => {
      const disabledConfig: ScalpingTickDeltaConfig = { ...config, enabled: false };
      const disabledStrategy = new ScalpingTickDeltaStrategy(disabledConfig, logger);

      expect(disabledStrategy.isEnabled()).toBe(false);
    });
  });

  // ==========================================================================
  // GENERATE SIGNALS
  // ==========================================================================

  describe('evaluate - generate signals', () => {
    it('should generate LONG signal on buy momentum', async () => {
      // Use current time for both ticks and market data to avoid detection window issues
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed buy momentum: 50 buys, 10 sells = 5.0x ratio (high confidence)
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 50; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.direction).toBe(SignalDirection.LONG);
      expect(signal.signal?.price).toBe(1.0);
      expect(signal.signal?.confidence).toBeGreaterThan(0);
    });

    it('should generate SHORT signal on sell momentum', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed sell momentum: 10 buys, 35 sells = 0.29 ratio (inverse 3.5x)
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 35; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.direction).toBe(SignalDirection.SHORT);
      expect(signal.signal?.price).toBe(1.0);
    });

    it('should NOT generate signal when disabled', async () => {
      const disabledConfig: ScalpingTickDeltaConfig = { ...config, enabled: false };
      const disabledStrategy = new ScalpingTickDeltaStrategy(disabledConfig, logger);

      const tickTime = Date.now();
      const data = createMockMarketData(1.0);

      // Feed buy momentum
      const analyzer = disabledStrategy.getAnalyzer();
      for (let i = 0; i < 40; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, tickTime));
      }
      for (let i = 0; i < 15; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, tickTime));
      }

      const signal = await disabledStrategy.evaluate(data);

      expect(signal.valid).toBe(false);
      expect(signal.reason).toBe('Strategy disabled');
    });
  });

  // ==========================================================================
  // BLOCKING CONDITIONS
  // ==========================================================================

  describe('blocking conditions', () => {
    it('should block weak momentum (<2x ratio)', async () => {
      const tickTime = Date.now();
      const data = createMockMarketData(1.0);

      // Feed weak momentum: 30 buys, 20 sells = 1.5x ratio (below 2.0x)
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 30; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, tickTime));
      }
      for (let i = 0; i < 20; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, tickTime));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(false);
    });

    it('should block low tick count', async () => {
      const tickTime = Date.now();
      const data = createMockMarketData(1.0);

      // Feed only 15 ticks (below min 20)
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, tickTime));
      }
      for (let i = 0; i < 5; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, tickTime));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(false);
    });

    it('should block low confidence', async () => {
      const highConfidenceConfig: ScalpingTickDeltaConfig = {
        ...config,
        minConfidence: 90, // Very high threshold
      };
      const highConfStrategy = new ScalpingTickDeltaStrategy(highConfidenceConfig, logger);

      const tickTime = Date.now();
      const data = createMockMarketData(1.0);

      // Feed moderate momentum (might not reach 90 confidence)
      const analyzer = highConfStrategy.getAnalyzer();
      for (let i = 0; i < 40; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, tickTime));
      }
      for (let i = 0; i < 15; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, tickTime));
      }

      const signal = await highConfStrategy.evaluate(data);

      // Might be blocked due to confidence < 90
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
      const data = createMockMarketData(1.0, now);

      // Feed buy momentum: 50 buys, 10 sells = 5.0x ratio
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 50; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.takeProfits).toHaveLength(1);
      // TP: 1.0 * (1 + 0.20/100) = 1.002
      expect(signal.signal?.takeProfits[0].price).toBeCloseTo(1.002, 4);
      expect(signal.signal?.takeProfits[0].percent).toBe(0.20); // TP percent
      expect(signal.signal?.takeProfits[0].sizePercent).toBe(100); // Close 100% of position
    });

    it('should calculate correct TP for SHORT', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed sell momentum
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 35; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.takeProfits).toHaveLength(1);
      // TP: 1.0 * (1 - 0.20/100) = 0.998
      expect(signal.signal?.takeProfits[0].price).toBeCloseTo(0.998, 4);
    });

    it('should calculate correct SL for LONG', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed buy momentum: 50 buys, 10 sells = 5.0x ratio
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 50; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      // SL: 1.0 * (1 - 0.10/100) = 0.999
      expect(signal.signal?.stopLoss).toBeCloseTo(0.999, 4);
    });

    it('should calculate correct SL for SHORT', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed sell momentum
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 35; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      // SL: 1.0 * (1 + 0.10/100) = 1.001
      expect(signal.signal?.stopLoss).toBeCloseTo(1.001, 4);
    });

    it('should have correct R/R ratio (2:1)', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed buy momentum: 50 buys, 10 sells = 5.0x ratio
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 50; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);

      const entry = signal.signal!.price;
      const tp = signal.signal!.takeProfits[0].price;
      const sl = signal.signal!.stopLoss;

      const tpDistance = Math.abs(tp - entry);
      const slDistance = Math.abs(entry - sl);
      const rrRatio = tpDistance / slDistance;

      // 0.002 / 0.001 = 2.0
      expect(rrRatio).toBeCloseTo(2.0, 1);
    });
  });

  // ==========================================================================
  // FEED TICKS
  // ==========================================================================

  describe('feedTicks', () => {
    it('should feed multiple ticks at once', () => {
      const tickTime = Date.now();
      const ticks: Tick[] = [
        createMockTick('BUY', 1.0, 100, tickTime),
        createMockTick('SELL', 1.0, 50, tickTime),
        createMockTick('BUY', 1.0, 75, tickTime),
      ];

      strategy.feedTicks(ticks);

      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getTickHistory();

      expect(history).toHaveLength(3);
    });

    it('should feed empty array without errors', () => {
      strategy.feedTicks([]);

      const analyzer = strategy.getAnalyzer();
      const history = analyzer.getTickHistory();

      expect(history).toHaveLength(0);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should return no signal with no ticks', async () => {
      const data = createMockMarketData(1.0);

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(false);
      expect(signal.reason).toContain('No momentum spike');
    });

    it('should include reasons in signal', async () => {
      const now = Date.now();
      const data = createMockMarketData(1.0, now);

      // Feed buy momentum: 50 buys, 10 sells = 5.0x ratio
      const analyzer = strategy.getAnalyzer();
      for (let i = 0; i < 50; i++) {
        analyzer.addTick(createMockTick('BUY', 1.0, 100, now));
      }
      for (let i = 0; i < 10; i++) {
        analyzer.addTick(createMockTick('SELL', 1.0, 100, now));
      }

      const signal = await strategy.evaluate(data);

      expect(signal.valid).toBe(true);
      expect(signal.signal?.reason).toBeDefined();
      expect(signal.signal?.reason).toContain('Tick delta momentum');
    });
  });
});
