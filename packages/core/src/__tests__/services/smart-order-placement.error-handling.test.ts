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
import { Orderbook } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../types/legacy';
import {
  asSmartOrderDirection as asDirection,
  asSmartOrderPlacementConfig as asConfig,
  asSmartOrderPlacementOrderbook as asOrderbook,
  createSmartOrderPlacementConfig,
  createSmartOrderPlacementErrorHandler,
  createManagedSmartOrderPlacementContext,
  createSmartOrderPlacementLogger,
  createSmartOrderPlacementOrderbook,
  createThinSmartOrderPlacementOrderbook,
  type SmartOrderPlacementFactories,
  type SmartOrderPlacementRuntime,
  type SmartOrderPlacementValidationContext,
} from '../helpers/smart-order-placement-test.utils';

type SmartOrderPlacementValidationFixtures = {
  factories: Pick<SmartOrderPlacementValidationContext, 'createStandardService'>;
};
type SmartOrderPlacementValidationState = SmartOrderPlacementValidationFixtures &
  Pick<SmartOrderPlacementValidationContext, 'cleanup'>;
type SmartOrderPlacementFixtures = {
  runtime: Pick<SmartOrderPlacementRuntime, 'service' | 'logger'>;
  factories: Pick<
    SmartOrderPlacementFactories,
    'createStandardService' | 'createLegacyService'
  >;
};
type SmartOrderPlacementSuiteState = SmartOrderPlacementFixtures &
  Pick<SmartOrderPlacementFactories, 'cleanup'>;

// ============================================================================
// TESTS: THROW - CONFIG VALIDATION
// ============================================================================

function bindSmartOrderPlacementValidationFixtures() {
  let factories: SmartOrderPlacementValidationFixtures['factories'];
  let cleanup: SmartOrderPlacementValidationState['cleanup'];

  beforeEach(() => {
    let createStandardService: SmartOrderPlacementValidationContext['createStandardService'];
    ({ createStandardService, cleanup } = createManagedSmartOrderPlacementContext());
    factories = {
      createStandardService,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => ({ factories });
}

describe('SmartOrderPlacementService - Config Validation (THROW)', () => {
  let createStandardService: SmartOrderPlacementValidationFixtures['factories']['createStandardService'];
  const getFixtures = bindSmartOrderPlacementValidationFixtures();

  beforeEach(() => {
    ({ createStandardService } = getFixtures().factories);
  });

  it('should THROW when config is null', () => {
    expect(() => {
      createStandardService({ config: asConfig(null) });
    }).toThrow('SmartOrderPlacementConfig cannot be null or undefined');
  });

  it('should THROW when maxOrderSize is invalid', () => {
    const config = createSmartOrderPlacementConfig();
    config.maxOrderSize = -10;

    expect(() => {
      createStandardService({ config });
    }).toThrow('Invalid maxOrderSize');
  });

  it('should THROW when maxSlippageBps is invalid', () => {
    const config = createSmartOrderPlacementConfig();
    config.maxSlippageBps = -1;

    expect(() => {
      createStandardService({ config });
    }).toThrow('Invalid maxSlippageBps');
  });

  it('should THROW when minFillProbability is out of range', () => {
    const config = createSmartOrderPlacementConfig();
    config.minFillProbability = 150;

    expect(() => {
      createStandardService({ config });
    }).toThrow('Invalid minFillProbability');
  });

  it('should THROW when executionTimeHorizon is invalid', () => {
    const config = createSmartOrderPlacementConfig();
    config.executionTimeHorizon = 0;

    expect(() => {
      createStandardService({ config });
    }).toThrow('Invalid executionTimeHorizon');
  });
});

function bindSmartOrderPlacementFixtures(
  options: Parameters<typeof createManagedSmartOrderPlacementContext>[0] = {},
) {
  let runtime: SmartOrderPlacementFixtures['runtime'];
  let factories: SmartOrderPlacementFixtures['factories'];
  let cleanup: SmartOrderPlacementSuiteState['cleanup'];

  beforeEach(() => {
    let service: SmartOrderPlacementRuntime['service'];
    let logger: SmartOrderPlacementRuntime['logger'];
    let createStandardService: SmartOrderPlacementFactories['createStandardService'];
    let createLegacyService: SmartOrderPlacementFactories['createLegacyService'];
    ({
      service,
      logger,
      createStandardService,
      createLegacyService,
      cleanup,
    } = createManagedSmartOrderPlacementContext(options));
    runtime = {
      service,
      logger,
    };
    factories = {
      createStandardService,
      createLegacyService,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => ({ runtime, factories });
}

// ============================================================================
// TESTS: THROW - INPUT VALIDATION
// ============================================================================

describe('SmartOrderPlacementService - Input Validation (THROW)', () => {
  const getFixtures = bindSmartOrderPlacementFixtures({ withErrorHandler: false });

  it('should THROW when order size is invalid', async () => {
    const { service } = getFixtures().runtime;
    const orderbook = createSmartOrderPlacementOrderbook();

    await expect(
      service.planOrderExecution(orderbook, -1, 'buy'),
    ).rejects.toThrow('Invalid order size');
  });

  it('should THROW when direction is invalid', async () => {
    const { service } = getFixtures().runtime;
    const orderbook = createSmartOrderPlacementOrderbook();

    await expect(
      service.planOrderExecution(orderbook, 1.0, asDirection('invalid')),
    ).rejects.toThrow('Invalid direction');
  });

  it('should THROW when orderbook is null', async () => {
    const { service } = getFixtures().runtime;

    await expect(
      service.planOrderExecution(asOrderbook(null), 1.0, 'buy'),
    ).rejects.toThrow('Orderbook cannot be null or undefined');
  });
});

// ============================================================================
// TESTS: GRACEFUL_DEGRADE - PLANNING FAILURES
// ============================================================================

describe('SmartOrderPlacementService - Planning Failures (GRACEFUL_DEGRADE)', () => {
  let logger: LoggerService;
  let createStandardService: SmartOrderPlacementFixtures['factories']['createStandardService'];
  const getFixtures = bindSmartOrderPlacementFixtures();

  beforeEach(() => {
    const { runtime, factories } = getFixtures();
    ({ logger } = runtime);
    ({ createStandardService } = factories);
  });

  it('should return conservative plan on corrupt orderbook', async () => {
    const service = createStandardService({ logger });

    const corruptOrderbook = createSmartOrderPlacementOrderbook();
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
    const service = createStandardService({ logger });

    const corruptOrderbook = createSmartOrderPlacementOrderbook();
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
    const service = createStandardService({ logger });

    const corruptOrderbook = createSmartOrderPlacementOrderbook();
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
    const service = createStandardService({ logger });

    const corruptOrderbook = createSmartOrderPlacementOrderbook();
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
    const service = createStandardService({ logger });

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
    const config = createSmartOrderPlacementConfig({ enableAdaptive: false });
    const service = createStandardService({ config, logger });
    const orderbook = createSmartOrderPlacementOrderbook();

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
  let createStandardService: SmartOrderPlacementFixtures['factories']['createStandardService'];
  const getFixtures = bindSmartOrderPlacementFixtures();

  beforeEach(() => {
    const mockLogger = createSmartOrderPlacementLogger();
    errorHandler = createSmartOrderPlacementErrorHandler(mockLogger);
    ({ createStandardService } = getFixtures().factories);
  });

  it('should SKIP logger.info failure during construction', () => {
    const loggerWithFailingInfo = createSmartOrderPlacementLogger('info');
    const config = createSmartOrderPlacementConfig();

    expect(() => {
      createStandardService({
        config,
        logger: loggerWithFailingInfo,
        errorHandler,
      });
    }).not.toThrow();
  });

  it('should SKIP logger.warn failure during planning', async () => {
    const loggerWithFailingWarn = createSmartOrderPlacementLogger('warn');
    const config = createSmartOrderPlacementConfig();
    const service = createStandardService({
      config,
      logger: loggerWithFailingWarn,
      errorHandler,
    });

    const corruptOrderbook = createSmartOrderPlacementOrderbook();
    corruptOrderbook.asks.forEach((a) => (a.volume = NaN));

    const result = await service.planOrderExecution(corruptOrderbook, 1.0, 'buy');
    expect(result).toBeDefined();
  });

  it('should SKIP logger.error failure during error handling', async () => {
    const loggerWithFailingError = createSmartOrderPlacementLogger('error');
    const config = createSmartOrderPlacementConfig();
    const service = createStandardService({
      config,
      logger: loggerWithFailingError,
      errorHandler,
    });

    const corruptOrderbook = createSmartOrderPlacementOrderbook();
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
  const getFixtures = bindSmartOrderPlacementFixtures();

  beforeEach(() => {
    ({ service } = getFixtures().runtime);
  });

  it('should plan single order execution for small size', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result.totalSize).toBe(1.0);
    expect(result.direction).toBe('buy');
    expect(result.strategy).toBe('single');
    expect(result.orders.length).toBe(1);
    expect(result.expectedFill).toBeGreaterThan(0);
  });

  it('should plan split order execution for large size', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 50.0, 'buy');

    expect(result.totalSize).toBe(50.0);
    expect(result.strategy).toBe('split');
    expect(result.orders.length).toBeGreaterThan(1);
  });

  it('should calculate optimal split for large orders', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.calculateOptimalSplit(orderbook, 50.0, 'buy');

    expect(result.originalSize).toBe(50.0);
    expect(result.subOrderSizes.length).toBeGreaterThan(1);
    expect(result.improvement).toBeDefined();
  });

  it('should find best liquidity level', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.findBestLiquidityLevel(orderbook, 'buy');

    expect(result.price).toBeGreaterThan(0);
    expect(result.volume).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should estimate fill probability accurately', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
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
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'sell');

    expect(result.direction).toBe('sell');
    expect(result.orders.length).toBeGreaterThan(0);
  });

  it('should assess risk appropriately', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(['low', 'medium', 'high']).toContain(result.risk);
  });

  it('should plan execution with target price', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
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
  const getFixtures = bindSmartOrderPlacementFixtures();

  beforeEach(() => {
    ({ service } = getFixtures().runtime);
  });

  it('should handle very thin liquidity', async () => {
    const orderbook = createThinSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.risk).toBe('high'); // Thin liquidity = high risk
  });

  it('should handle very large orders (exceeds total liquidity)', async () => {
    const orderbook = createThinSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 100.0, 'buy');

    expect(result).toBeDefined();
    expect(result.expectedFill).toBeLessThan(100); // Can't fill 100%
  });

  it('should handle single-sided orderbook', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    orderbook.asks = []; // No asks

    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
  });

  it('should handle zero volume levels', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    orderbook.asks.forEach((a) => (a.volume = 0));

    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
  });

  it('should not split orders below threshold', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
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
  const getFixtures = bindSmartOrderPlacementFixtures({ withErrorHandler: false });

  beforeEach(() => {
    ({ service } = getFixtures().runtime);
  });

  it('should work without ErrorHandler', async () => {
    const orderbook = createSmartOrderPlacementOrderbook();
    const result = await service.planOrderExecution(orderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.orders.length).toBeGreaterThan(0);
  });

  it('should handle planning failures gracefully without ErrorHandler', async () => {
    const corruptOrderbook = createSmartOrderPlacementOrderbook();
    corruptOrderbook.asks.forEach((a) => {
      a.price = NaN;
      a.volume = NaN;
    });

    const result = await service.planOrderExecution(corruptOrderbook, 1.0, 'buy');

    expect(result).toBeDefined();
    expect(result.risk).toBe('high');
  });

  it('should handle logger failures without ErrorHandler', async () => {
    const failingLogger = createSmartOrderPlacementLogger('info');
    const fixtures = getFixtures();

    expect(() => {
      fixtures.factories.createLegacyService({
        logger: failingLogger,
      });
    }).not.toThrow();
  });
});

