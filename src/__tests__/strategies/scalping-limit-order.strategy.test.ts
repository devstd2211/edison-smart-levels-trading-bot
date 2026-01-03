/**
 * Scalping Limit Order Strategy Tests (Phase 2)
 *
 * Tests for wrapper strategy that modifies order execution
 */

import { ScalpingLimitOrderStrategy } from '../../strategies/scalping-limit-order.strategy';
import { LoggerService } from '../../services/logger.service';
import {
  LogLevel,
  ScalpingLimitOrderConfig,
  StrategyMarketData,
  TrendBias,
} from '../../types';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('ScalpingLimitOrderStrategy', () => {
  let strategy: ScalpingLimitOrderStrategy;
  let logger: LoggerService;
  let config: ScalpingLimitOrderConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    config = {
      enabled: true,
      priority: 2,
      minConfidence: 70,
      executor: {
        enabled: true,
        timeoutMs: 5000,
        slippagePercent: 0.02,
        fallbackToMarket: true,
        maxRetries: 1,
      },
      baseSignalSource: 'levelBased',
    };

    strategy = new ScalpingLimitOrderStrategy(config, logger);
  });

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  it('should initialize with correct configuration', () => {
    expect(strategy.name).toBe('ScalpingLimitOrder');
    expect(strategy.priority).toBe(2);
  });

  it('should return executor config', () => {
    const executorConfig = strategy.getExecutorConfig();

    expect(executorConfig).toEqual(config.executor);
    expect(executorConfig.timeoutMs).toBe(5000);
    expect(executorConfig.slippagePercent).toBe(0.02);
  });

  it('should check if enabled (both flags true)', () => {
    expect(strategy.isEnabled()).toBe(true);
  });

  it('should check if disabled when strategy disabled', () => {
    const disabledConfig = { ...config, enabled: false };
    const disabledStrategy = new ScalpingLimitOrderStrategy(disabledConfig, logger);

    expect(disabledStrategy.isEnabled()).toBe(false);
  });

  it('should check if disabled when executor disabled', () => {
    const disabledExecutorConfig = {
      ...config,
      executor: { ...config.executor, enabled: false },
    };
    const disabledStrategy = new ScalpingLimitOrderStrategy(disabledExecutorConfig, logger);

    expect(disabledStrategy.isEnabled()).toBe(false);
  });

  it('should return base signal source', () => {
    expect(strategy.getBaseSignalSource()).toBe('levelBased');
  });

  // ==========================================================================
  // SIGNAL GENERATION (ALWAYS NO_SIGNAL)
  // ==========================================================================

  it('should always return NO_SIGNAL (wrapper strategy)', async () => {
    const mockData: StrategyMarketData = {
      currentPrice: 100,
      candles: [],
      swingPoints: [],
      rsi: 50,
      ema: { fast: 100, slow: 100 },
      trend: 'NEUTRAL',
      timestamp: Date.now(),
      context: {
        timestamp: Date.now(),
        trend: TrendBias.NEUTRAL,
        marketStructure: null,
        atrPercent: 0.5,
        emaDistance: 0,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      },
    };

    const signal = await strategy.evaluate(mockData);

    expect(signal.valid).toBe(false);
    expect(signal.strategyName).toBe('ScalpingLimitOrder');
    expect(signal.priority).toBe(2);
    expect(signal.reason).toBe('Wrapper strategy - does not generate signals');
  });

  it('should return NO_SIGNAL even with perfect market conditions', async () => {
    // This strategy never generates signals regardless of market data
    const mockData: StrategyMarketData = {
      currentPrice: 100,
      candles: [
        {
          timestamp: Date.now(),
          open: 99,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000000,
        },
      ],
      swingPoints: [],
      rsi: 30,
      ema: { fast: 100, slow: 100 },
      trend: 'BULLISH',
      timestamp: Date.now(),
      context: {
        timestamp: Date.now(),
        trend: TrendBias.BULLISH,
        marketStructure: null,
        atrPercent: 0.5,
        emaDistance: 0,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      },
    };

    const signal = await strategy.evaluate(mockData);

    expect(signal.valid).toBe(false);
    expect(signal.reason).toBe('Wrapper strategy - does not generate signals');
  });

  it('should return NO_SIGNAL when disabled', async () => {
    const disabledConfig = { ...config, enabled: false };
    const disabledStrategy = new ScalpingLimitOrderStrategy(disabledConfig, logger);

    const mockData: StrategyMarketData = {
      currentPrice: 100,
      candles: [],
      swingPoints: [],
      rsi: 50,
      ema: { fast: 100, slow: 100 },
      trend: 'NEUTRAL',
      timestamp: Date.now(),
      context: {
        timestamp: Date.now(),
        trend: TrendBias.NEUTRAL,
        marketStructure: null,
        atrPercent: 0.5,
        emaDistance: 0,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      },
    };

    const signal = await disabledStrategy.evaluate(mockData);

    expect(signal.valid).toBe(false);
    expect(signal.reason).toBe('Wrapper strategy - does not generate signals');
  });

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  it('should handle different base signal sources', () => {
    const whaleConfig = { ...config, baseSignalSource: 'whaleHunter' };
    const whaleStrategy = new ScalpingLimitOrderStrategy(whaleConfig, logger);

    expect(whaleStrategy.getBaseSignalSource()).toBe('whaleHunter');

    const trendConfig = { ...config, baseSignalSource: 'trendFollowing' };
    const trendStrategy = new ScalpingLimitOrderStrategy(trendConfig, logger);

    expect(trendStrategy.getBaseSignalSource()).toBe('trendFollowing');
  });

  it('should handle different executor timeouts', () => {
    const fastConfig = {
      ...config,
      executor: { ...config.executor, timeoutMs: 3000 },
    };
    const fastStrategy = new ScalpingLimitOrderStrategy(fastConfig, logger);

    expect(fastStrategy.getExecutorConfig().timeoutMs).toBe(3000);
  });

  it('should handle different slippage percentages', () => {
    const lowSlippageConfig = {
      ...config,
      executor: { ...config.executor, slippagePercent: 0.01 },
    };
    const lowSlippageStrategy = new ScalpingLimitOrderStrategy(lowSlippageConfig, logger);

    expect(lowSlippageStrategy.getExecutorConfig().slippagePercent).toBe(0.01);
  });
});
