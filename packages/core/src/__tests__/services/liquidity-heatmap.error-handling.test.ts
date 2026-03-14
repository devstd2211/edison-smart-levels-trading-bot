/**
 * Phase 10.1.2: LiquidityHeatmapService Error Handling Tests
 *
 * Tests ErrorHandler integration with recovery strategies:
 * - THROW: Config validation (5 tests)
 * - THROW: Orderbook validation (5 tests)
 * - GRACEFUL_DEGRADE: Calculation failures (7 tests)
 * - SKIP: Logger errors (3 tests)
 * - Integration E2E scenarios (10 tests)
 * - Edge cases (6 tests)
 * - Backward compatibility (4 tests)
 *
 * Total: 40 tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LiquidityHeatmapService } from '../../services/liquidity-heatmap.service';
import {
  LiquidityHeatmapConfig,
  Orderbook,
  LiquidityHeatmapOrderbookLevel as OrderbookLevel,
} from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../types/legacy';
import {
  asLiquidityDirection as asDirection,
  asLiquidityHeatmapConfig as asConfig,
  asLiquidityHeatmapOrderbook as asOrderbook,
  createDeepLiquidityHeatmapOrderbook,
  createLiquidityHeatmapConfig,
  createLiquidityHeatmapErrorHandler,
  createLiquidityHeatmapHarness,
  createLiquidityHeatmapLogger,
  createLiquidityHeatmapOrderbook,
  createLiquidityHeatmapService,
  createThinLiquidityHeatmapOrderbook,
} from '../helpers/liquidity-heatmap-test.utils';

// ============================================================================
// TESTS: THROW - CONFIG VALIDATION
// ============================================================================

describe('LiquidityHeatmapService - Config Validation (THROW)', () => {
  it('should THROW when config is null', () => {
    const logger = createLiquidityHeatmapLogger();

    expect(() => {
      createLiquidityHeatmapService({ config: asConfig(null), logger });
    }).toThrow('LiquidityHeatmapConfig cannot be null or undefined');
  });

  it('should THROW when config is undefined', () => {
    const logger = createLiquidityHeatmapLogger();

    expect(() => {
      createLiquidityHeatmapService({ config: asConfig(undefined), logger });
    }).toThrow('LiquidityHeatmapConfig cannot be null or undefined');
  });

  it('should THROW when maxLevels is invalid', () => {
    const logger = createLiquidityHeatmapLogger();
    const config = createLiquidityHeatmapConfig();
    config.maxLevels = -10;

    expect(() => {
      createLiquidityHeatmapService({ config, logger });
    }).toThrow('Invalid maxLevels');
  });

  it('should THROW when minStrengthThreshold is out of range', () => {
    const logger = createLiquidityHeatmapLogger();
    const config = createLiquidityHeatmapConfig();
    config.minStrengthThreshold = 150; // > 100

    expect(() => {
      createLiquidityHeatmapService({ config, logger });
    }).toThrow('Invalid minStrengthThreshold');
  });

  it('should THROW when clusteringTolerance is invalid', () => {
    const logger = createLiquidityHeatmapLogger();
    const config = createLiquidityHeatmapConfig();
    config.clusteringTolerance = -0.5;

    expect(() => {
      createLiquidityHeatmapService({ config, logger });
    }).toThrow('Invalid clusteringTolerance');
  });
});

// ============================================================================
// TESTS: THROW - ORDERBOOK VALIDATION
// ============================================================================

describe('LiquidityHeatmapService - Orderbook Validation (THROW)', () => {
  it('should THROW when orderbook is null', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });

    await expect(
      service.buildLiquidityHeatmap(asOrderbook(null)),
    ).rejects.toThrow('Orderbook cannot be null or undefined');
  });

  it('should THROW when orderbook is undefined', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });

    await expect(
      service.buildLiquidityHeatmap(asOrderbook(undefined)),
    ).rejects.toThrow('Orderbook cannot be null or undefined');
  });

  it('should THROW when orderbook has invalid symbol', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });

    const invalidOrderbook = createLiquidityHeatmapOrderbook();
    invalidOrderbook.symbol = null as unknown as string;

    await expect(
      service.buildLiquidityHeatmap(invalidOrderbook),
    ).rejects.toThrow('Orderbook must have valid symbol');
  });

  it('should THROW when orderbook has invalid timestamp', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });

    const invalidOrderbook = createLiquidityHeatmapOrderbook();
    invalidOrderbook.timestamp = NaN;

    await expect(
      service.buildLiquidityHeatmap(invalidOrderbook),
    ).rejects.toThrow('Orderbook must have valid timestamp');
  });

  it('should THROW when orderbook has missing bids/asks arrays', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });

    const invalidOrderbook = createLiquidityHeatmapOrderbook();
    invalidOrderbook.bids = null as unknown as OrderbookLevel[];

    await expect(
      service.buildLiquidityHeatmap(invalidOrderbook),
    ).rejects.toThrow('Orderbook must have bids array');
  });
});

// ============================================================================
// TESTS: THROW - INPUT VALIDATION (Slippage & ExecutionCost)
// ============================================================================

describe('LiquidityHeatmapService - Input Validation (THROW)', () => {
  it('should THROW when slippage size is invalid', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });
    const orderbook = createLiquidityHeatmapOrderbook();

    await expect(
      service.calculateSlippageForSize(orderbook, -1, 'buy'),
    ).rejects.toThrow('Invalid order size');
  });

  it('should THROW when slippage direction is invalid', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });
    const orderbook = createLiquidityHeatmapOrderbook();

    await expect(
      service.calculateSlippageForSize(orderbook, 1.0, asDirection('invalid')),
    ).rejects.toThrow("Invalid direction");
  });

  it('should THROW when execution cost size is invalid', async () => {
    const { service } = createLiquidityHeatmapHarness({ withErrorHandler: false });
    const orderbook = createLiquidityHeatmapOrderbook();

    await expect(
      service.estimateExecutionCost(orderbook, 0),
    ).rejects.toThrow('Invalid order size');
  });
});

// ============================================================================
// TESTS: GRACEFUL_DEGRADE - CALCULATION FAILURES
// ============================================================================

describe('LiquidityHeatmapService - Calculation Failures (GRACEFUL_DEGRADE)', () => {
  let logger: LoggerService;

  beforeEach(() => {
    ({ logger } = createLiquidityHeatmapHarness());
  });

  it('should return safe default heatmap on calculation failure', async () => {
    const { service } = createLiquidityHeatmapHarness({ logger });

    // Corrupt orderbook to force calculation error
    // Make >50% of levels invalid to trigger data quality check
    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    corruptOrderbook.bids = corruptOrderbook.bids.map((b) => ({
      ...b,
      volume: NaN, // Force NaN propagation
      price: NaN, // Also corrupt price
    }));
    corruptOrderbook.asks = corruptOrderbook.asks.map((a) => ({
      ...a,
      volume: Infinity,
      price: Infinity,
    }));

    const result = await service.buildLiquidityHeatmap(corruptOrderbook);

    // Should return safe default
    expect(result).toBeDefined();
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.zones).toEqual([]);
    expect(result.liquidityScore).toBe(0);
  });

  it('should return empty support/resistance on detection failure', async () => {
    const { service } = createLiquidityHeatmapHarness({ logger });

    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    // Corrupt both bids and asks to force failure
    corruptOrderbook.bids.forEach((b) => {
      b.volume = NaN;
      b.price = NaN;
    });
    corruptOrderbook.asks.forEach((a) => {
      a.volume = Infinity;
      a.price = Infinity;
    });

    const result = await service.findSupportResistance(corruptOrderbook);

    expect(result).toBeDefined();
    expect(result.support).toEqual([]);
    expect(result.resistance).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('should return pessimistic slippage estimate on calculation failure', async () => {
    const { service } = createLiquidityHeatmapHarness({ logger });

    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    corruptOrderbook.asks.forEach((a) => (a.volume = NaN));

    const result = await service.calculateSlippageForSize(
      corruptOrderbook,
      1.0,
      'buy',
    );

    expect(result).toBeDefined();
    expect(result.slippageBps).toBeGreaterThan(0); // Pessimistic estimate
    expect(result.fillablePercent).toBe(0);
  });

  it('should return conservative execution cost on failure', async () => {
    const { service } = createLiquidityHeatmapHarness({ logger });

    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    corruptOrderbook.asks.forEach((a) => (a.price = Infinity));

    const result = await service.estimateExecutionCost(corruptOrderbook, 1.0);

    expect(result).toBeDefined();
    expect(result.totalCostPercent).toBeGreaterThan(0);
  });

  it('should handle empty orderbook gracefully', async () => {
    const { service } = createLiquidityHeatmapHarness({ logger });

    const emptyOrderbook: Orderbook = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      bids: [],
      asks: [],
    };

    const result = await service.buildLiquidityHeatmap(emptyOrderbook);

    expect(result).toBeDefined();
    expect(result.zones).toEqual([]);
    expect(result.totalBidDepth).toBe(0);
    expect(result.totalAskDepth).toBe(0);
  });

  it('should handle disabled features gracefully', async () => {
    const config = createLiquidityHeatmapConfig({
      enableSupportResistance: false,
      enableSlippageCalc: false,
      enableExecutionCost: false,
    });

    const { service } = createLiquidityHeatmapHarness({ config, logger });
    const orderbook = createLiquidityHeatmapOrderbook();

    const heatmap = await service.buildLiquidityHeatmap(orderbook);
    expect(heatmap.supportResistance).toBeNull();

    const slippage = await service.calculateSlippageForSize(orderbook, 1.0, 'buy');
    expect(slippage.slippageBps).toBeGreaterThan(0);

    const cost = await service.estimateExecutionCost(orderbook, 1.0);
    expect(cost.totalCostPercent).toBeGreaterThan(0);
  });

  it('should survive when all calculations fail', async () => {
    const { service } = createLiquidityHeatmapHarness({ logger });

    const corruptOrderbook: Orderbook = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(), // Valid timestamp to pass validation
      bids: [{ price: NaN, volume: NaN }],
      asks: [{ price: Infinity, volume: -1 }],
    };

    // All methods should return safe defaults
    const heatmap = await service.buildLiquidityHeatmap(corruptOrderbook);
    expect(heatmap.liquidityScore).toBe(0);

    const sr = await service.findSupportResistance(corruptOrderbook);
    expect(sr.support.length).toBe(0);
  });
});

// ============================================================================
// TESTS: SKIP - LOGGER FAILURES
// ============================================================================

describe('LiquidityHeatmapService - Logger Failures (SKIP)', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    const mockLogger = createLiquidityHeatmapLogger();
    errorHandler = createLiquidityHeatmapErrorHandler(mockLogger);
  });

  it('should SKIP logger.info failure during construction', () => {
    const loggerWithFailingInfo = createLiquidityHeatmapLogger('info');
    const config = createLiquidityHeatmapConfig();

    // Should not throw despite logger.info failure
    expect(() => {
      createLiquidityHeatmapService({
        config,
        logger: loggerWithFailingInfo,
        errorHandler,
      });
    }).not.toThrow();
  });

  it('should SKIP logger.warn failure during calculations', async () => {
    const loggerWithFailingWarn = createLiquidityHeatmapLogger('warn');
    const config = createLiquidityHeatmapConfig();
    const service = createLiquidityHeatmapService({
      config,
      logger: loggerWithFailingWarn,
      errorHandler,
    });

    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    corruptOrderbook.bids.forEach((b) => (b.volume = NaN));

    // Should not throw despite logger.warn failure
    const result = await service.buildLiquidityHeatmap(corruptOrderbook);
    expect(result).toBeDefined();
  });

  it('should SKIP logger.error failure during error handling', async () => {
    const loggerWithFailingError = createLiquidityHeatmapLogger('error');
    const config = createLiquidityHeatmapConfig();
    const service = createLiquidityHeatmapService({
      config,
      logger: loggerWithFailingError,
      errorHandler,
    });

    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    corruptOrderbook.asks.forEach((a) => (a.price = NaN));

    // Should not throw despite logger.error failure
    const result = await service.calculateSlippageForSize(
      corruptOrderbook,
      1.0,
      'buy',
    );
    expect(result).toBeDefined();
  });
});

// ============================================================================
// TESTS: INTEGRATION - E2E SCENARIOS
// ============================================================================

describe('LiquidityHeatmapService - Integration (E2E)', () => {
  let service: LiquidityHeatmapService;

  beforeEach(() => {
    ({ service } = createLiquidityHeatmapHarness());
  });

  it('should build complete heatmap for normal orderbook', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.zones.length).toBeGreaterThan(0);
    expect(result.liquidityScore).toBeGreaterThan(0);
    expect(result.spreadBps).toBeGreaterThan(0);
    expect(result.totalBidDepth).toBeGreaterThan(0);
    expect(result.totalAskDepth).toBeGreaterThan(0);
  });

  it('should identify support/resistance levels', async () => {
    const orderbook = createDeepLiquidityHeatmapOrderbook();
    const result = await service.findSupportResistance(orderbook);

    expect(result.support.length).toBeGreaterThan(0);
    expect(result.resistance.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should calculate slippage for buy order', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 1.0, 'buy');

    expect(result.direction).toBe('buy');
    expect(result.orderSize).toBe(1.0);
    expect(result.slippageBps).toBeGreaterThanOrEqual(0);
    expect(result.avgExecutionPrice).toBeGreaterThan(0);
    expect(result.fillablePercent).toBeGreaterThan(0);
  });

  it('should calculate slippage for sell order', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 1.0, 'sell');

    expect(result.direction).toBe('sell');
    expect(result.orderSize).toBe(1.0);
    expect(result.slippageBps).toBeGreaterThanOrEqual(0);
    expect(result.avgExecutionPrice).toBeGreaterThan(0);
  });

  it('should estimate execution cost accurately', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.estimateExecutionCost(orderbook, 1.0);

    expect(result.orderSize).toBe(1.0);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.estimatedFee).toBeGreaterThan(0);
    expect(result.totalCostPercent).toBeGreaterThan(0);
  });

  it('should handle thin orderbook with low liquidity', async () => {
    const orderbook = createThinLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.liquidityScore).toBeLessThan(50); // Low score for thin orderbook
    expect(result.spreadBps).toBeGreaterThan(0);
  });

  it('should handle deep orderbook with high liquidity', async () => {
    const orderbook = createDeepLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.liquidityScore).toBeGreaterThan(50); // High score for deep orderbook
    expect(result.zones.length).toBeGreaterThan(10);
  });

  it('should calculate bid/ask imbalance correctly', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.imbalanceRatio).toBeGreaterThanOrEqual(-1);
    expect(result.imbalanceRatio).toBeLessThanOrEqual(1);
  });

  it('should identify strong liquidity zones', async () => {
    const orderbook = createDeepLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    // Strong zones have strength >= 35 (matching support/resistance threshold)
    const strongZones = result.zones.filter((z) => z.strength >= 35);
    expect(strongZones.length).toBeGreaterThan(0);
  });

  it('should classify zones as support/resistance/neutral', async () => {
    const orderbook = createDeepLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    const supportZones = result.zones.filter((z) => z.type === 'support');
    const resistanceZones = result.zones.filter((z) => z.type === 'resistance');

    expect(supportZones.length + resistanceZones.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS: EDGE CASES
// ============================================================================

describe('LiquidityHeatmapService - Edge Cases', () => {
  let service: LiquidityHeatmapService;

  beforeEach(() => {
    ({ service } = createLiquidityHeatmapHarness());
  });

  it('should handle single-sided orderbook (only bids)', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    orderbook.asks = []; // No asks

    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.totalAskDepth).toBe(0);
    expect(result.spreadBps).toBeGreaterThan(0);
  });

  it('should handle single-sided orderbook (only asks)', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    orderbook.bids = []; // No bids

    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.totalBidDepth).toBe(0);
  });

  it('should handle very large order size (exceeds available liquidity)', async () => {
    const orderbook = createThinLiquidityHeatmapOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 100.0, 'buy');

    expect(result.fillablePercent).toBeLessThan(100);
    expect(result.slippageBps).toBeGreaterThan(0);
  });

  it('should handle zero volume levels gracefully', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    orderbook.bids[0].volume = 0;
    orderbook.asks[0].volume = 0;

    const result = await service.buildLiquidityHeatmap(orderbook);
    expect(result).toBeDefined();
  });

  it('should handle wide spread (gap in orderbook)', async () => {
    const orderbook: Orderbook = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      bids: [{ price: 45000, volume: 1.0, orderCount: 1 }],
      asks: [{ price: 55000, volume: 1.0, orderCount: 1 }],
    };

    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.spreadBps).toBeGreaterThan(1000); // Very wide spread
  });

  it('should handle extreme bid/ask imbalance', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    orderbook.bids.forEach((b) => (b.volume = 100)); // Very high bid liquidity
    orderbook.asks.forEach((a) => (a.volume = 0.01)); // Very low ask liquidity

    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.imbalanceRatio).toBeGreaterThan(0.5); // Bullish imbalance
  });
});

// ============================================================================
// TESTS: BACKWARD COMPATIBILITY (Without ErrorHandler)
// ============================================================================

describe('LiquidityHeatmapService - Backward Compatibility', () => {
  let service: LiquidityHeatmapService;

  beforeEach(() => {
    ({ service } = createLiquidityHeatmapHarness({ withErrorHandler: false }));
  });

  it('should work without ErrorHandler', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result).toBeDefined();
    expect(result.zones.length).toBeGreaterThan(0);
  });

  it('should handle calculation failures gracefully without ErrorHandler', async () => {
    const corruptOrderbook = createLiquidityHeatmapOrderbook();
    // Corrupt >50% of data
    corruptOrderbook.bids.forEach((b) => {
      b.volume = NaN;
      b.price = NaN;
    });
    corruptOrderbook.asks.forEach((a) => {
      a.volume = Infinity;
      a.price = Infinity;
    });

    const result = await service.buildLiquidityHeatmap(corruptOrderbook);

    expect(result).toBeDefined();
    expect(result.liquidityScore).toBe(0);
  });

  it('should handle logger failures without ErrorHandler', async () => {
    const failingLogger = createLiquidityHeatmapLogger('info');
    const config = createLiquidityHeatmapConfig();

    expect(() => {
      createLiquidityHeatmapService({
        config,
        logger: failingLogger,
        withErrorHandler: false,
      });
    }).not.toThrow();
  });

  it('should calculate slippage without ErrorHandler', async () => {
    const orderbook = createLiquidityHeatmapOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.slippageBps).toBeGreaterThanOrEqual(0);
  });
});

