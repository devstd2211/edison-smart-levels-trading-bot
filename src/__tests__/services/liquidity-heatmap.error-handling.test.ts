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
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService } from '../../types/legacy';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock logger for testing
 */
function createMockLogger(methodToFail?: string): LoggerService {
  return {
    minLevel: 'debug',
    logDir: '/tmp',
    logToFile: false,
    logs: [],
    info: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn((_msg: string, _meta?: any) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  } as any;
}

/**
 * Create valid configuration
 */
function createValidConfig(): LiquidityHeatmapConfig {
  return {
    maxLevels: 50,
    minStrengthThreshold: 10, // Lowered to 10 to allow more zones
    clusteringTolerance: 0.1,
    enableSupportResistance: true,
    enableSlippageCalc: true,
    enableExecutionCost: true,
  };
}

/**
 * Create mock orderbook with realistic data
 */
function createMockOrderbook(): Orderbook {
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];

  // Generate realistic bid levels (descending price)
  // Higher volumes to ensure zones are created
  for (let i = 0; i < 20; i++) {
    bids.push({
      price: 50000 - i * 10,
      volume: Math.random() * 10 + 5, // Increased from 5+0.5
      orderCount: Math.floor(Math.random() * 20) + 5, // Increased
    });
  }

  // Generate realistic ask levels (ascending price)
  for (let i = 0; i < 20; i++) {
    asks.push({
      price: 50010 + i * 10,
      volume: Math.random() * 10 + 5, // Increased from 5+0.5
      orderCount: Math.floor(Math.random() * 20) + 5, // Increased
    });
  }

  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids,
    asks,
  };
}

/**
 * Create thin orderbook (low liquidity)
 */
function createThinOrderbook(): Orderbook {
  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids: [
      { price: 50000, volume: 0.1, orderCount: 1 },
      { price: 49990, volume: 0.05, orderCount: 1 },
    ],
    asks: [
      { price: 50010, volume: 0.1, orderCount: 1 },
      { price: 50020, volume: 0.05, orderCount: 1 },
    ],
  };
}

/**
 * Create deep orderbook (high liquidity)
 */
function createDeepOrderbook(): Orderbook {
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];

  // Very deep liquidity with concentration at top levels
  for (let i = 0; i < 50; i++) {
    // Larger volumes at top of book (exponential decay)
    const volumeMultiplier = Math.exp(-i / 10);
    const baseVolume = 50; // Increased base volume

    bids.push({
      price: 50000 - i * 5,
      volume: baseVolume * volumeMultiplier + Math.random() * 10,
      orderCount: Math.floor(100 * volumeMultiplier) + 10,
    });

    asks.push({
      price: 50010 + i * 5,
      volume: baseVolume * volumeMultiplier + Math.random() * 10,
      orderCount: Math.floor(100 * volumeMultiplier) + 10,
    });
  }

  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids,
    asks,
  };
}

// ============================================================================
// TESTS: THROW - CONFIG VALIDATION
// ============================================================================

describe('LiquidityHeatmapService - Config Validation (THROW)', () => {
  it('should THROW when config is null', () => {
    const logger = createMockLogger();

    expect(() => {
      new LiquidityHeatmapService(null as any, undefined, logger);
    }).toThrow('LiquidityHeatmapConfig cannot be null or undefined');
  });

  it('should THROW when config is undefined', () => {
    const logger = createMockLogger();

    expect(() => {
      new LiquidityHeatmapService(undefined as any, undefined, logger);
    }).toThrow('LiquidityHeatmapConfig cannot be null or undefined');
  });

  it('should THROW when maxLevels is invalid', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.maxLevels = -10;

    expect(() => {
      new LiquidityHeatmapService(config, undefined, logger);
    }).toThrow('Invalid maxLevels');
  });

  it('should THROW when minStrengthThreshold is out of range', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.minStrengthThreshold = 150; // > 100

    expect(() => {
      new LiquidityHeatmapService(config, undefined, logger);
    }).toThrow('Invalid minStrengthThreshold');
  });

  it('should THROW when clusteringTolerance is invalid', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.clusteringTolerance = -0.5;

    expect(() => {
      new LiquidityHeatmapService(config, undefined, logger);
    }).toThrow('Invalid clusteringTolerance');
  });
});

// ============================================================================
// TESTS: THROW - ORDERBOOK VALIDATION
// ============================================================================

describe('LiquidityHeatmapService - Orderbook Validation (THROW)', () => {
  it('should THROW when orderbook is null', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);

    await expect(
      service.buildLiquidityHeatmap(null as any),
    ).rejects.toThrow('Orderbook cannot be null or undefined');
  });

  it('should THROW when orderbook is undefined', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);

    await expect(
      service.buildLiquidityHeatmap(undefined as any),
    ).rejects.toThrow('Orderbook cannot be null or undefined');
  });

  it('should THROW when orderbook has invalid symbol', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);

    const invalidOrderbook = createMockOrderbook();
    invalidOrderbook.symbol = null as any;

    await expect(
      service.buildLiquidityHeatmap(invalidOrderbook),
    ).rejects.toThrow('Orderbook must have valid symbol');
  });

  it('should THROW when orderbook has invalid timestamp', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);

    const invalidOrderbook = createMockOrderbook();
    invalidOrderbook.timestamp = NaN;

    await expect(
      service.buildLiquidityHeatmap(invalidOrderbook),
    ).rejects.toThrow('Orderbook must have valid timestamp');
  });

  it('should THROW when orderbook has missing bids/asks arrays', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);

    const invalidOrderbook = createMockOrderbook();
    invalidOrderbook.bids = null as any;

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
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);
    const orderbook = createMockOrderbook();

    await expect(
      service.calculateSlippageForSize(orderbook, -1, 'buy'),
    ).rejects.toThrow('Invalid order size');
  });

  it('should THROW when slippage direction is invalid', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);
    const orderbook = createMockOrderbook();

    await expect(
      service.calculateSlippageForSize(orderbook, 1.0, 'invalid' as any),
    ).rejects.toThrow("Invalid direction");
  });

  it('should THROW when execution cost size is invalid', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger);
    const orderbook = createMockOrderbook();

    await expect(
      service.estimateExecutionCost(orderbook, 0),
    ).rejects.toThrow('Invalid order size');
  });
});

// ============================================================================
// TESTS: GRACEFUL_DEGRADE - CALCULATION FAILURES
// ============================================================================

describe('LiquidityHeatmapService - Calculation Failures (GRACEFUL_DEGRADE)', () => {
  let errorHandler: ErrorHandler;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger);
  });

  it('should return safe default heatmap on calculation failure', async () => {
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);

    // Corrupt orderbook to force calculation error
    // Make >50% of levels invalid to trigger data quality check
    const corruptOrderbook = createMockOrderbook();
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
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
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
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
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
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.asks.forEach((a) => (a.price = Infinity));

    const result = await service.estimateExecutionCost(corruptOrderbook, 1.0);

    expect(result).toBeDefined();
    expect(result.totalCostPercent).toBeGreaterThan(0);
  });

  it('should handle empty orderbook gracefully', async () => {
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);

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
    const config = createValidConfig();
    config.enableSupportResistance = false;
    config.enableSlippageCalc = false;
    config.enableExecutionCost = false;

    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);
    const orderbook = createMockOrderbook();

    const heatmap = await service.buildLiquidityHeatmap(orderbook);
    expect(heatmap.supportResistance).toBeNull();

    const slippage = await service.calculateSlippageForSize(orderbook, 1.0, 'buy');
    expect(slippage.slippageBps).toBeGreaterThan(0);

    const cost = await service.estimateExecutionCost(orderbook, 1.0);
    expect(cost.totalCostPercent).toBeGreaterThan(0);
  });

  it('should survive when all calculations fail', async () => {
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);

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
    const mockLogger = createMockLogger();
    errorHandler = new ErrorHandler(mockLogger);
  });

  it('should SKIP logger.info failure during construction', () => {
    const loggerWithFailingInfo = createMockLogger('info');
    const config = createValidConfig();

    // Should not throw despite logger.info failure
    expect(() => {
      new LiquidityHeatmapService(config, undefined, loggerWithFailingInfo, errorHandler);
    }).not.toThrow();
  });

  it('should SKIP logger.warn failure during calculations', async () => {
    const loggerWithFailingWarn = createMockLogger('warn');
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(
      config, undefined, loggerWithFailingWarn,
      errorHandler,
    );

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.bids.forEach((b) => (b.volume = NaN));

    // Should not throw despite logger.warn failure
    const result = await service.buildLiquidityHeatmap(corruptOrderbook);
    expect(result).toBeDefined();
  });

  it('should SKIP logger.error failure during error handling', async () => {
    const loggerWithFailingError = createMockLogger('error');
    const config = createValidConfig();
    const service = new LiquidityHeatmapService(
      config, undefined, loggerWithFailingError,
      errorHandler,
    );

    const corruptOrderbook = createMockOrderbook();
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
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger);
    const config = createValidConfig();
    service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);
  });

  it('should build complete heatmap for normal orderbook', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.zones.length).toBeGreaterThan(0);
    expect(result.liquidityScore).toBeGreaterThan(0);
    expect(result.spreadBps).toBeGreaterThan(0);
    expect(result.totalBidDepth).toBeGreaterThan(0);
    expect(result.totalAskDepth).toBeGreaterThan(0);
  });

  it('should identify support/resistance levels', async () => {
    const orderbook = createDeepOrderbook();
    const result = await service.findSupportResistance(orderbook);

    expect(result.support.length).toBeGreaterThan(0);
    expect(result.resistance.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should calculate slippage for buy order', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 1.0, 'buy');

    expect(result.direction).toBe('buy');
    expect(result.orderSize).toBe(1.0);
    expect(result.slippageBps).toBeGreaterThanOrEqual(0);
    expect(result.avgExecutionPrice).toBeGreaterThan(0);
    expect(result.fillablePercent).toBeGreaterThan(0);
  });

  it('should calculate slippage for sell order', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 1.0, 'sell');

    expect(result.direction).toBe('sell');
    expect(result.orderSize).toBe(1.0);
    expect(result.slippageBps).toBeGreaterThanOrEqual(0);
    expect(result.avgExecutionPrice).toBeGreaterThan(0);
  });

  it('should estimate execution cost accurately', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.estimateExecutionCost(orderbook, 1.0);

    expect(result.orderSize).toBe(1.0);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.estimatedFee).toBeGreaterThan(0);
    expect(result.totalCostPercent).toBeGreaterThan(0);
  });

  it('should handle thin orderbook with low liquidity', async () => {
    const orderbook = createThinOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.liquidityScore).toBeLessThan(50); // Low score for thin orderbook
    expect(result.spreadBps).toBeGreaterThan(0);
  });

  it('should handle deep orderbook with high liquidity', async () => {
    const orderbook = createDeepOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.liquidityScore).toBeGreaterThan(50); // High score for deep orderbook
    expect(result.zones.length).toBeGreaterThan(10);
  });

  it('should calculate bid/ask imbalance correctly', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.imbalanceRatio).toBeGreaterThanOrEqual(-1);
    expect(result.imbalanceRatio).toBeLessThanOrEqual(1);
  });

  it('should identify strong liquidity zones', async () => {
    const orderbook = createDeepOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    // Strong zones have strength >= 35 (matching support/resistance threshold)
    const strongZones = result.zones.filter((z) => z.strength >= 35);
    expect(strongZones.length).toBeGreaterThan(0);
  });

  it('should classify zones as support/resistance/neutral', async () => {
    const orderbook = createDeepOrderbook();
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
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger);
    const config = createValidConfig();
    service = new LiquidityHeatmapService(config, undefined, logger, errorHandler);
  });

  it('should handle single-sided orderbook (only bids)', async () => {
    const orderbook = createMockOrderbook();
    orderbook.asks = []; // No asks

    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.totalAskDepth).toBe(0);
    expect(result.spreadBps).toBeGreaterThan(0);
  });

  it('should handle single-sided orderbook (only asks)', async () => {
    const orderbook = createMockOrderbook();
    orderbook.bids = []; // No bids

    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result.totalBidDepth).toBe(0);
  });

  it('should handle very large order size (exceeds available liquidity)', async () => {
    const orderbook = createThinOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 100.0, 'buy');

    expect(result.fillablePercent).toBeLessThan(100);
    expect(result.slippageBps).toBeGreaterThan(0);
  });

  it('should handle zero volume levels gracefully', async () => {
    const orderbook = createMockOrderbook();
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
    const orderbook = createMockOrderbook();
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
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
    const config = createValidConfig();
    service = new LiquidityHeatmapService(config, undefined, logger); // No ErrorHandler
  });

  it('should work without ErrorHandler', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.buildLiquidityHeatmap(orderbook);

    expect(result).toBeDefined();
    expect(result.zones.length).toBeGreaterThan(0);
  });

  it('should handle calculation failures gracefully without ErrorHandler', async () => {
    const corruptOrderbook = createMockOrderbook();
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
    const failingLogger = createMockLogger('info');
    const config = createValidConfig();

    expect(() => {
      new LiquidityHeatmapService(config, undefined, failingLogger);
    }).not.toThrow();
  });

  it('should calculate slippage without ErrorHandler', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.calculateSlippageForSize(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.slippageBps).toBeGreaterThanOrEqual(0);
  });
});

