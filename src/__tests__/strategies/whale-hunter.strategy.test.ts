/**
 * Whale Hunter Strategy Tests - Simplified
 */

import { WhaleHunterStrategy } from '../../strategies/whale-hunter.strategy';
import { WhaleDetectorService, WhaleDetectionMode } from '../../services/whale-detector.service';
import { OrderBookAnalyzer } from '../../analyzers/orderbook.analyzer';
import { LoggerService, LogLevel, SignalDirection, StrategyMarketData, Candle, OrderBook, TrendBias } from '../../types';

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

describe('WhaleHunterStrategy', () => {
  let strategy: WhaleHunterStrategy;
  let whaleDetector: WhaleDetectorService;
  let orderbookAnalyzer: OrderBookAnalyzer;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    const detectorConfig = { modes: {
      wallBreak: { enabled: true, minWallSize: 15, breakConfirmationMs: 3000, maxConfidence: 85 },
      wallDisappearance: { enabled: true, minWallSize: 20, minWallDuration: 60000, wallGoneThresholdMs: 15000, maxConfidence: 80 },
      imbalanceSpike: { enabled: true, minRatioChange: 0.5, detectionWindow: 10000, maxConfidence: 90 },
    }, maxImbalanceHistory: 20, wallExpiryMs: 60000, breakExpiryMs: 300000 };
    whaleDetector = new WhaleDetectorService(detectorConfig, logger);
    const analyzerConfig = { enabled: true, depth: 50, wallThreshold: 0.1, imbalanceThreshold: 1.5, updateIntervalMs: 5000 };
    orderbookAnalyzer = new OrderBookAnalyzer(analyzerConfig, logger);
    const strategyConfig = { enabled: true, priority: 1, minConfidence: 70, requireTrendAlignment: false, requireMultipleSignals: false, cooldownMs: 60000, detector: detectorConfig };
    strategy = new WhaleHunterStrategy(strategyConfig, whaleDetector, orderbookAnalyzer, logger);
  });

  it('should have correct name', () => {
    expect(strategy.name).toBe('WHALE_HUNTER');
  });

  it('should return no signal when disabled', async () => {
    const disabledConfig = { enabled: false, priority: 1, minConfidence: 70, requireTrendAlignment: false, requireMultipleSignals: false, cooldownMs: 60000,
      detector: { modes: { wallBreak: { enabled: false, minWallSize: 15, breakConfirmationMs: 3000, maxConfidence: 85 },
        wallDisappearance: { enabled: false, minWallSize: 20, minWallDuration: 60000, wallGoneThresholdMs: 15000, maxConfidence: 80 },
        imbalanceSpike: { enabled: false, minRatioChange: 0.5, detectionWindow: 10000, maxConfidence: 90 } }, maxImbalanceHistory: 20, wallExpiryMs: 60000, breakExpiryMs: 300000 },
    };
    const disabledStrategy = new WhaleHunterStrategy(disabledConfig, whaleDetector, orderbookAnalyzer, logger);
    const result = await disabledStrategy.evaluate(createMarketData(createOrderBook([[1000, 100]], [[1010, 100]]), 1000));
    expect(result.valid).toBe(false);
  });

  it('should return no signal when no orderbook', async () => {
    const result = await strategy.evaluate(createMarketData(undefined, 1000));
    expect(result.valid).toBe(false);
  });

  it('should generate signal on whale detection', async () => {
    jest.spyOn(whaleDetector, 'detectWhale').mockReturnValue({
      detected: true, mode: WhaleDetectionMode.IMBALANCE_SPIKE, direction: SignalDirection.LONG, confidence: 85,
      reason: 'Spike', metadata: {},
    });
    const result = await strategy.evaluate(createMarketData(createOrderBook([[1000, 100]], [[1010, 100]]), 1000));
    expect(result.valid).toBe(true);
  });

  it('should block low confidence signals', async () => {
    jest.spyOn(whaleDetector, 'detectWhale').mockReturnValue({
      detected: true, mode: WhaleDetectionMode.IMBALANCE_SPIKE, direction: SignalDirection.LONG, confidence: 50,
      reason: 'Weak', metadata: {},
    });
    const result = await strategy.evaluate(createMarketData(createOrderBook([[1000, 100]], [[1010, 100]]), 1000));
    expect(result.valid).toBe(false);
  });

  it('should enforce cooldown', async () => {
    jest.spyOn(whaleDetector, 'detectWhale').mockReturnValue({
      detected: true, mode: WhaleDetectionMode.IMBALANCE_SPIKE, direction: SignalDirection.LONG, confidence: 85,
      reason: 'Spike', metadata: {},
    });
    const marketData = createMarketData(createOrderBook([[1000, 100]], [[1010, 100]]), 1000);
    await strategy.evaluate(marketData);
    const result = await strategy.evaluate(marketData);
    expect(result.valid).toBe(false);
  });
});
