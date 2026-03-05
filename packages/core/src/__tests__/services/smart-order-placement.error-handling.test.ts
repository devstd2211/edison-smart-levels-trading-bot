/**
 * Phase 10.1.3: SmartOrderPlacementService Error Handling Tests
 *
 * Tests ErrorHandler integration with recovery strategies:
 * - THROW: Config validation (5 tests)
 * - THROW: Input validation (3 tests)
 * - GRACEFUL_DEGRADE: Planning failures (6 tests)
 * - SKIP: Logger errors (3 tests)
 * - Integration E2E scenarios (8 tests)
 * - Edge cases (5 tests)
 * - Backward compatibility (3 tests)
 *
 * Total: 33 tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SmartOrderPlacementService } from '../../services/smart-order-placement.service';
import { SmartOrderPlacementConfig, Orderbook } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService } from '../../types/legacy';

// ============================================================================
// TEST HELPERS
// ============================================================================

type LoggerLike = Pick<LoggerService, 'info' | 'warn' | 'debug' | 'error'>;
const asConfig = (value: unknown): SmartOrderPlacementConfig =>
  value as SmartOrderPlacementConfig;
const asOrderbook = (value: unknown): Orderbook => value as Orderbook;
const asDirection = (value: unknown): 'buy' | 'sell' => value as 'buy' | 'sell';

function createMockLogger(methodToFail?: string): LoggerService {
  const logger: LoggerLike = {
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  };
  return logger as unknown as LoggerService;
}

function createValidConfig(): SmartOrderPlacementConfig {
  return {
    maxOrderSize: 10.0,
    maxSlippageBps: 50,
    minFillProbability: 80,
    analyzeLevels: 20,
    enableAdaptive: true,
    executionTimeHorizon: 60000,
  };
}

function createMockOrderbook(): Orderbook {
  const bids = [];
  const asks = [];

  for (let i = 0; i < 20; i++) {
    bids.push({
      price: 50000 - i * 10,
      volume: 5 + Math.random() * 10,
      orderCount: 10 + Math.floor(Math.random() * 20),
    });

    asks.push({
      price: 50010 + i * 10,
      volume: 5 + Math.random() * 10,
      orderCount: 10 + Math.floor(Math.random() * 20),
    });
  }

  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids,
    asks,
  };
}

function createThinOrderbook(): Orderbook {
  return {
    symbol: 'BTCUSDT',
    timestamp: Date.now(),
    bids: [
      { price: 50000, volume: 0.5, orderCount: 1 },
      { price: 49990, volume: 0.3, orderCount: 1 },
    ],
    asks: [
      { price: 50010, volume: 0.5, orderCount: 1 },
      { price: 50020, volume: 0.3, orderCount: 1 },
    ],
  };
}

// ============================================================================
// TESTS: THROW - CONFIG VALIDATION
// ============================================================================

describe('SmartOrderPlacementService - Config Validation (THROW)', () => {
  it('should THROW when config is null', () => {
    const logger = createMockLogger();

    expect(() => {
      new SmartOrderPlacementService(asConfig(null), undefined, logger);
    }).toThrow('SmartOrderPlacementConfig cannot be null or undefined');
  });

  it('should THROW when maxOrderSize is invalid', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.maxOrderSize = -10;

    expect(() => {
      new SmartOrderPlacementService(config, undefined, logger);
    }).toThrow('Invalid maxOrderSize');
  });

  it('should THROW when maxSlippageBps is invalid', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.maxSlippageBps = -1;

    expect(() => {
      new SmartOrderPlacementService(config, undefined, logger);
    }).toThrow('Invalid maxSlippageBps');
  });

  it('should THROW when minFillProbability is out of range', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.minFillProbability = 150;

    expect(() => {
      new SmartOrderPlacementService(config, undefined, logger);
    }).toThrow('Invalid minFillProbability');
  });

  it('should THROW when executionTimeHorizon is invalid', () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    config.executionTimeHorizon = 0;

    expect(() => {
      new SmartOrderPlacementService(config, undefined, logger);
    }).toThrow('Invalid executionTimeHorizon');
  });
});

// ============================================================================
// TESTS: THROW - INPUT VALIDATION
// ============================================================================

describe('SmartOrderPlacementService - Input Validation (THROW)', () => {
  it('should THROW when order size is invalid', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger);
    const orderbook = createMockOrderbook();

    await expect(
      service.planOrderExecution(orderbook, -1, 'buy'),
    ).rejects.toThrow('Invalid order size');
  });

  it('should THROW when direction is invalid', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger);
    const orderbook = createMockOrderbook();

    await expect(
      service.planOrderExecution(orderbook, 1.0, asDirection('invalid')),
    ).rejects.toThrow('Invalid direction');
  });

  it('should THROW when orderbook is null', async () => {
    const logger = createMockLogger();
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger);

    await expect(
      service.planOrderExecution(asOrderbook(null), 1.0, 'buy'),
    ).rejects.toThrow('Orderbook cannot be null or undefined');
  });
});

// ============================================================================
// TESTS: GRACEFUL_DEGRADE - PLANNING FAILURES
// ============================================================================

describe('SmartOrderPlacementService - Planning Failures (GRACEFUL_DEGRADE)', () => {
  let errorHandler: ErrorHandler;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger);
  });

  it('should return conservative plan on corrupt orderbook', async () => {
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.bids.forEach((b) => {
      b.price = NaN;
      b.volume = Infinity;
    });
    corruptOrderbook.asks.forEach((a) => {
      a.price = Infinity;
      a.volume = NaN;
    });

    const result = await service.planOrderExecution(
      corruptOrderbook,
      1.0,
      'buy',
    );

    expect(result).toBeDefined();
    expect(result.totalSize).toBe(1.0);
    expect(result.risk).toBe('high'); // Conservative plan has high risk
  });

  it('should return single order split on calculation failure', async () => {
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.asks.forEach((a) => {
      a.volume = NaN;
    });

    const result = await service.calculateOptimalSplit(
      corruptOrderbook,
      50.0,
      'buy',
    );

    expect(result).toBeDefined();
    expect(result.originalSize).toBe(50.0);
    // Should return single order or safe default
  });

  it('should return market price level on liquidity search failure', async () => {
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.asks.forEach((a) => {
      a.price = NaN;
      a.volume = NaN;
    });

    const result = await service.findBestLiquidityLevel(
      corruptOrderbook,
      'buy',
    );

    expect(result).toBeDefined();
    expect(result.isOptimal).toBe(true);
  });

  it('should return conservative fill probability on estimation failure', async () => {
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.asks.forEach((a) => {
      a.volume = Infinity;
    });

    const result = await service.estimateFillProbability(
      corruptOrderbook,
      50010,
      1.0,
      'buy',
    );

    expect(result).toBeDefined();
    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(100);
  });

  it('should handle empty orderbook gracefully', async () => {
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);

    const emptyOrderbook: Orderbook = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      bids: [],
      asks: [],
    };

    const result = await service.planOrderExecution(
      emptyOrderbook,
      1.0,
      'buy',
    );

    expect(result).toBeDefined();
    expect(result.strategy).toBe('single');
  });

  it('should handle disabled adaptive mode', async () => {
    const config = createValidConfig();
    config.enableAdaptive = false;
    const service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);
    const orderbook = createMockOrderbook();

    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.orders[0].priority).toBe('immediate');
  });
});

// ============================================================================
// TESTS: SKIP - LOGGER FAILURES
// ============================================================================

describe('SmartOrderPlacementService - Logger Failures (SKIP)', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    const mockLogger = createMockLogger();
    errorHandler = new ErrorHandler(mockLogger);
  });

  it('should SKIP logger.info failure during construction', () => {
    const loggerWithFailingInfo = createMockLogger('info');
    const config = createValidConfig();

    expect(() => {
      new SmartOrderPlacementService(config, undefined, loggerWithFailingInfo, errorHandler);
    }).not.toThrow();
  });

  it('should SKIP logger.warn failure during planning', async () => {
    const loggerWithFailingWarn = createMockLogger('warn');
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(
      config, undefined, loggerWithFailingWarn,
      errorHandler,
    );

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.asks.forEach((a) => (a.volume = NaN));

    const result = await service.planOrderExecution(corruptOrderbook, 1.0, 'buy');
    expect(result).toBeDefined();
  });

  it('should SKIP logger.error failure during error handling', async () => {
    const loggerWithFailingError = createMockLogger('error');
    const config = createValidConfig();
    const service = new SmartOrderPlacementService(
      config, undefined, loggerWithFailingError,
      errorHandler,
    );

    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.bids.forEach((b) => {
      b.price = NaN;
      b.volume = NaN;
    });

    const result = await service.findBestLiquidityLevel(corruptOrderbook, 'sell');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// TESTS: INTEGRATION - E2E SCENARIOS
// ============================================================================

describe('SmartOrderPlacementService - Integration (E2E)', () => {
  let service: SmartOrderPlacementService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger);
    const config = createValidConfig();
    service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);
  });

  it('should plan single order execution for small size', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result.totalSize).toBe(1.0);
    expect(result.direction).toBe('buy');
    expect(result.strategy).toBe('single');
    expect(result.orders.length).toBe(1);
    expect(result.expectedFill).toBeGreaterThan(0);
  });

  it('should plan split order execution for large size', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.planOrderExecution(orderbook, 50.0, 'buy');

    expect(result.totalSize).toBe(50.0);
    expect(result.strategy).toBe('split');
    expect(result.orders.length).toBeGreaterThan(1);
  });

  it('should calculate optimal split for large orders', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.calculateOptimalSplit(orderbook, 50.0, 'buy');

    expect(result.originalSize).toBe(50.0);
    expect(result.subOrderSizes.length).toBeGreaterThan(1);
    expect(result.improvement).toBeDefined();
  });

  it('should find best liquidity level', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.findBestLiquidityLevel(orderbook, 'buy');

    expect(result.price).toBeGreaterThan(0);
    expect(result.volume).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should estimate fill probability accurately', async () => {
    const orderbook = createMockOrderbook();
    const marketPrice = orderbook.asks[0].price;

    const result = await service.estimateFillProbability(
      orderbook,
      marketPrice,
      1.0,
      'buy',
    );

    expect(result.probability).toBeGreaterThan(0);
    expect(result.probability).toBeLessThanOrEqual(100);
    expect(result.factors).toBeDefined();
    expect(result.expectedFillTime).toBeGreaterThan(0);
  });

  it('should handle sell orders correctly', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'sell');

    expect(result.direction).toBe('sell');
    expect(result.orders.length).toBeGreaterThan(0);
  });

  it('should assess risk appropriately', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(['low', 'medium', 'high']).toContain(result.risk);
  });

  it('should plan execution with target price', async () => {
    const orderbook = createMockOrderbook();
    const targetPrice = 50050;

    const result = await service.planOrderExecution(
      orderbook,
      1.0,
      'buy',
      targetPrice,
    );

    expect(result.targetPrice).toBe(targetPrice);
  });
});

// ============================================================================
// TESTS: EDGE CASES
// ============================================================================

describe('SmartOrderPlacementService - Edge Cases', () => {
  let service: SmartOrderPlacementService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger);
    const config = createValidConfig();
    service = new SmartOrderPlacementService(config, undefined, logger, errorHandler);
  });

  it('should handle very thin liquidity', async () => {
    const orderbook = createThinOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.risk).toBe('high'); // Thin liquidity = high risk
  });

  it('should handle very large orders (exceeds total liquidity)', async () => {
    const orderbook = createThinOrderbook();
    const result = await service.planOrderExecution(orderbook, 100.0, 'buy');

    expect(result).toBeDefined();
    expect(result.expectedFill).toBeLessThan(100); // Can't fill 100%
  });

  it('should handle single-sided orderbook', async () => {
    const orderbook = createMockOrderbook();
    orderbook.asks = []; // No asks

    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
  });

  it('should handle zero volume levels', async () => {
    const orderbook = createMockOrderbook();
    orderbook.asks.forEach((a) => (a.volume = 0));

    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
  });

  it('should not split orders below threshold', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.calculateOptimalSplit(orderbook, 5.0, 'buy');

    // Size 5.0 is below maxOrderSize (10.0), should not split
    expect(result.subOrderSizes.length).toBe(1);
  });
});

// ============================================================================
// TESTS: BACKWARD COMPATIBILITY
// ============================================================================

describe('SmartOrderPlacementService - Backward Compatibility', () => {
  let service: SmartOrderPlacementService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
    const config = createValidConfig();
    service = new SmartOrderPlacementService(config, undefined, logger); // No ErrorHandler
  });

  it('should work without ErrorHandler', async () => {
    const orderbook = createMockOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.orders.length).toBeGreaterThan(0);
  });

  it('should handle planning failures gracefully without ErrorHandler', async () => {
    const corruptOrderbook = createMockOrderbook();
    corruptOrderbook.asks.forEach((a) => {
      a.price = NaN;
      a.volume = NaN;
    });

    const result = await service.planOrderExecution(corruptOrderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.risk).toBe('high');
  });

  it('should handle logger failures without ErrorHandler', async () => {
    const failingLogger = createMockLogger('info');
    const config = createValidConfig();

    expect(() => {
      new SmartOrderPlacementService(config, undefined, failingLogger);
    }).not.toThrow();
  });
});

