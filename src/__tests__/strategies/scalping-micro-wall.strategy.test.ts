/**
 * Scalping Micro Wall Strategy Tests
 */

import { ScalpingMicroWallStrategy } from '../../strategies/scalping-micro-wall.strategy';
import { MicroWallDetectorService } from '../../services/micro-wall-detector.service';
import {
  LoggerService,
  LogLevel,
  SignalDirection,
  StrategyMarketData,
  OrderBook,
  TrendBias,
  ScalpingMicroWallConfig,
  MicroWallDetectorConfig,
  MicroWall,
} from '../../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMarketData(orderbook: OrderBook | undefined, price: number): StrategyMarketData {
  return {
    candles: [{ timestamp: Date.now(), open: price, high: price, low: price, close: price, volume: 1000 }],
    swingPoints: [],
    rsi: 50,
    ema: { fast: price, slow: price },
    trend: 'NEUTRAL',
    timestamp: Date.now(),
    currentPrice: price,
    orderbook,
    context: {
      timestamp: Date.now(),
      trend: TrendBias.NEUTRAL,
      marketStructure: null,
      atrPercent: 0.5,
      emaDistance: 0,
      ema50: price,
      atrModifier: 1,
      emaModifier: 1,
      trendModifier: 1,
      overallModifier: 1,
      isValidContext: true,
      blockedBy: [],
      warnings: [],
    },
  };
}

function createOrderBook(bids: Array<[number, number]>, asks: Array<[number, number]>): OrderBook {
  return { symbol: 'APEXUSDT', timestamp: Date.now(), bids, asks, updateId: 1 };
}

function createConfig(overrides?: Partial<ScalpingMicroWallConfig>): ScalpingMicroWallConfig {
  return {
    enabled: true,
    priority: 2,
    minConfidence: 65,
    takeProfitPercent: 0.15,
    stopLossPercent: 0.08,
    maxHoldingTimeMs: 120000,
    cooldownMs: 60000,
    detector: {
      minWallSizePercent: 5,
      breakConfirmationMs: 1000,
      maxConfidence: 75,
      wallExpiryMs: 60000,
    },
    ...overrides,
  };
}

function createDetectorConfig(overrides?: Partial<MicroWallDetectorConfig>): MicroWallDetectorConfig {
  return {
    minWallSizePercent: 5,
    breakConfirmationMs: 1000,
    maxConfidence: 75,
    wallExpiryMs: 60000,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ScalpingMicroWallStrategy', () => {
  let strategy: ScalpingMicroWallStrategy;
  let detector: MicroWallDetectorService;
  let logger: LoggerService;
  let config: ScalpingMicroWallConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = createConfig();
    detector = new MicroWallDetectorService(config.detector, logger);
    strategy = new ScalpingMicroWallStrategy(config, detector, logger);
  });

  it('should have correct name', () => {
    expect(strategy.name).toBe('SCALPING_MICRO_WALL');
  });

  it('should have correct priority', () => {
    expect(strategy.priority).toBe(2);
  });

  it('should return no signal when disabled', async () => {
    const disabledConfig = createConfig({ enabled: false });
    const disabledStrategy = new ScalpingMicroWallStrategy(
      disabledConfig,
      detector,
      logger,
    );

    const result = await disabledStrategy.evaluate(
      createMarketData(createOrderBook([[1.0, 100]], [[1.001, 100]]), 1.0),
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('should return no signal when no orderbook', async () => {
    const result = await strategy.evaluate(createMarketData(undefined, 1.0));

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No orderbook data');
  });

  it('should return no signal when no micro walls detected', async () => {
    // Orderbook with no large walls (all below 5% threshold)
    // Create 50 small bids/asks (each ~2% of total = 10000 USDT)
    const smallBids: [number, number][] = [];
    const smallAsks: [number, number][] = [];
    for (let i = 0; i < 25; i++) {
      smallBids.push([1.0 - i * 0.0001, 200]); // 200 USDT each (2%)
      smallAsks.push([1.0 + i * 0.0001, 200]); // 200 USDT each (2%)
    }

    const orderbook = createOrderBook(smallBids, smallAsks);
    const result = await strategy.evaluate(createMarketData(orderbook, 1.0));

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('No micro walls detected');
  });

  it('should generate LONG signal on ASK wall break', async () => {
    // Mock detector to return a broken ASK wall
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'ASK',
        price: 1.001,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.LONG);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0),
    );

    expect(result.valid).toBe(true);
    expect(result.signal!.direction).toBe(SignalDirection.LONG);
    expect(result.signal!.confidence).toBe(0.7); // 70 / 100
    expect(result.signal!.stopLoss).toBeLessThan(1.0); // SL below entry for LONG
    expect(result.signal!.takeProfits[0].price).toBeGreaterThan(1.0); // TP above entry for LONG
  });

  it('should generate SHORT signal on BID wall break', async () => {
    // Mock detector to return a broken BID wall
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'BID',
        price: 1.0,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.SHORT);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 4900]], [[1.001, 100]]), 1.0),
    );

    expect(result.valid).toBe(true);
    expect(result.signal!.direction).toBe(SignalDirection.SHORT);
    expect(result.signal!.confidence).toBe(0.7); // 70 / 100
    expect(result.signal!.stopLoss).toBeGreaterThan(1.0); // SL above entry for SHORT
    expect(result.signal!.takeProfits[0].price).toBeLessThan(1.0); // TP below entry for SHORT
  });

  it('should block low confidence signals', async () => {
    // Mock detector to return low confidence
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'ASK',
        price: 1.001,
        size: 500,
        percentOfTotal: 5,
        distance: 1.0,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(50); // Below 65 threshold

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0),
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Confidence too low');
  });

  it('should respect cooldown period', async () => {
    // Mock detector to return a valid signal
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'ASK',
        price: 1.001,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.LONG);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const marketData = createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0);

    // First signal should succeed
    const result1 = await strategy.evaluate(marketData);
    expect(result1.valid).toBe(true);

    // Second signal immediately after should fail (cooldown)
    const result2 = await strategy.evaluate(marketData);
    expect(result2.valid).toBe(false);
    expect(result2.reason).toContain('cooldown');
  });

  it('should calculate correct TP/SL levels for LONG', async () => {
    // Mock detector
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'ASK',
        price: 1.001,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.LONG);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0),
    );

    expect(result.valid).toBe(true);

    // LONG: Entry 1.0, TP = 1.0 * 1.0015 = 1.0015, SL = 1.0 * 0.9992 = 0.9992
    expect(result.signal!.price).toBe(1.0);
    expect(result.signal!.takeProfits[0].price).toBeCloseTo(1.0015, 4);
    expect(result.signal!.stopLoss).toBeCloseTo(0.9992, 4);
  });

  it('should calculate correct TP/SL levels for SHORT', async () => {
    // Mock detector
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'BID',
        price: 1.0,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.SHORT);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 4900]], [[1.001, 100]]), 1.0),
    );

    expect(result.valid).toBe(true);

    // SHORT: Entry 1.0, TP = 1.0 * 0.9985 = 0.9985, SL = 1.0 * 1.0008 = 1.0008
    expect(result.signal!.price).toBe(1.0);
    expect(result.signal!.takeProfits[0].price).toBeCloseTo(0.9985, 4);
    expect(result.signal!.stopLoss).toBeCloseTo(1.0008, 4);
  });

  it('should block recently broken walls', async () => {
    // Mock detector to return wall already broken
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'ASK',
        price: 1.001,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(true); // Already broken recently

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0),
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('recently broken');
  });

  it('should include metadata in signal', async () => {
    // Mock detector
    const mockWall: MicroWall = {
      side: 'ASK',
      price: 1.001,
      size: 500,
      percentOfTotal: 10.5,
      distance: 0.12,
      timestamp: Date.now() - 2000,
      broken: false,
    };

    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([mockWall]);
    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.LONG);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const result = await strategy.evaluate(
      createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0),
    );

    expect(result.valid).toBe(true);
    expect(result.signal!.marketData).toBeDefined();
    expect(result.signal!.marketData!.whaleMode).toBe('MICRO_WALL_BREAK');
    expect(result.signal!.marketData!.wallSize).toBe(500);
  });

  it('should reset state correctly', async () => {
    // Simulate a trade (sets lastTradeTime)
    jest.spyOn(detector, 'detectMicroWalls').mockReturnValue([
      {
        side: 'ASK',
        price: 1.001,
        size: 500,
        percentOfTotal: 10,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      },
    ]);

    jest.spyOn(detector, 'isWallBroken').mockReturnValue(true);
    jest.spyOn(detector, 'calculateWallConfidence').mockReturnValue(70);
    jest.spyOn(detector, 'getSignalDirection').mockReturnValue(SignalDirection.LONG);
    jest.spyOn(detector, 'wasRecentlyBroken').mockReturnValue(false);

    const marketData = createMarketData(createOrderBook([[1.0, 100]], [[1.001, 4900]]), 1.0);

    // Generate signal (sets lastTradeTime)
    await strategy.evaluate(marketData);

    // Reset
    strategy.reset();

    // Should not be in cooldown after reset
    const result = await strategy.evaluate(marketData);
    expect(result.reason).not.toContain('cooldown');
  });
});
