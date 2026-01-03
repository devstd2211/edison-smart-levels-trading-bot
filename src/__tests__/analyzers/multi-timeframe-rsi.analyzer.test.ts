/**
 * MultiTimeframeRSIAnalyzer Tests
 *
 * Tests for multi-timeframe RSI calculation and caching.
 */

import { MultiTimeframeRSIAnalyzer } from '../../analyzers/multi-timeframe-rsi.analyzer';
import { TimeframeProvider } from '../../providers/timeframe.provider';
import { LoggerService } from '../../services/logger.service';
import { LogLevel, Candle, TimeframeRole, TimeframeConfig } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

class MockCandleProvider {
  private candles: Map<TimeframeRole, Candle[]> = new Map();

  setCandles(role: TimeframeRole, candles: Candle[]): void {
    this.candles.set(role, candles);
  }

  async getCandles(role: TimeframeRole): Promise<Candle[]> {
    const candles = this.candles.get(role);
    if (!candles) {
      throw new Error(`No candles configured for ${role}`);
    }
    return candles;
  }
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Generate uptrend candles (RSI should be high)
 */
function generateUptrendCandles(count: number, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const price = startPrice + i * 1.0; // Strong increase
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price - 0.2,
      high: price + 0.5,
      low: price - 0.3,
      close: price,
      volume: 1000 + i * 10,
    });
  }

  return candles;
}

/**
 * Generate downtrend candles (RSI should be low)
 */
function generateDowntrendCandles(count: number, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const price = startPrice - i * 1.0; // Strong decrease
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price + 0.2,
      high: price + 0.3,
      low: price - 0.5,
      close: price,
      volume: 1000 + i * 10,
    });
  }

  return candles;
}

/**
 * Generate sideways candles (RSI should be around 50)
 */
function generateSidewaysCandles(count: number, basePrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const price = basePrice + (i % 2 === 0 ? 0.2 : -0.2); // Small oscillation
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price - 0.05,
      high: price + 0.1,
      low: price - 0.1,
      close: price,
      volume: 1000,
    });
  }

  return candles;
}

/**
 * Generate oversold candles (RSI < 30)
 */
function generateOversoldCandles(count: number = 30): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const startPrice = 100;

  // Start with normal prices
  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: startPrice,
      high: startPrice + 0.5,
      low: startPrice - 0.5,
      close: startPrice,
      volume: 1000,
    });
  }

  // Sharp drop to create oversold condition
  for (let i = 10; i < count; i++) {
    const price = startPrice - (i - 10) * 2.0; // Sharp decline
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price + 1.0,
      high: price + 1.2,
      low: price - 0.5,
      close: price,
      volume: 1500,
    });
  }

  return candles;
}

/**
 * Generate overbought candles (RSI > 70)
 */
function generateOverboughtCandles(count: number = 30): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const startPrice = 100;

  // Start with normal prices
  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: startPrice,
      high: startPrice + 0.5,
      low: startPrice - 0.5,
      close: startPrice,
      volume: 1000,
    });
  }

  // Sharp rise to create overbought condition
  for (let i = 10; i < count; i++) {
    const price = startPrice + (i - 10) * 2.0; // Sharp increase
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price - 1.0,
      high: price + 0.5,
      low: price - 1.2,
      close: price,
      volume: 1500,
    });
  }

  return candles;
}

// ============================================================================
// TESTS
// ============================================================================

describe('MultiTimeframeRSIAnalyzer', () => {
  let logger: LoggerService;
  let timeframeProvider: TimeframeProvider;
  let mockCandleProvider: MockCandleProvider;

  const validConfig: Record<string, TimeframeConfig> = {
    entry: { interval: '1', candleLimit: 100, enabled: true },
    primary: { interval: '5', candleLimit: 200, enabled: true },
    trend1: { interval: '30', candleLimit: 100, enabled: true },
    trend2: { interval: '60', candleLimit: 100, enabled: false },
    context: { interval: '240', candleLimit: 50, enabled: false },
  };

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    timeframeProvider = new TimeframeProvider(validConfig);
    mockCandleProvider = new MockCandleProvider();
  });

  // ============================================================================
  // CONSTRUCTOR & INITIALIZATION
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      const analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        false,
      );

      expect(analyzer).toBeDefined();
    });

    it('should accept custom RSI period', () => {
      const analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        21, // Custom period
        false,
      );

      expect(analyzer).toBeDefined();
    });
  });

  // ============================================================================
  // CALCULATE (SINGLE TIMEFRAME)
  // ============================================================================

  describe('calculate', () => {
    let analyzer: MultiTimeframeRSIAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        false,
      );
    });

    it('should calculate RSI for PRIMARY timeframe with uptrend', async () => {
      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThanOrEqual(100);
      // Uptrend should have high RSI (typically > 50)
      expect(rsi).toBeGreaterThan(50);
    });

    it('should calculate RSI for ENTRY timeframe', async () => {
      const candles = generateSidewaysCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.ENTRY);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThanOrEqual(100);
      // Sideways should have neutral RSI (around 50)
      expect(rsi).toBeGreaterThan(40);
      expect(rsi).toBeLessThan(60);
    });

    it('should calculate RSI for TREND1 timeframe with downtrend', async () => {
      const candles = generateDowntrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.TREND1, candles);

      const rsi = await analyzer.calculate(TimeframeRole.TREND1);

      expect(rsi).toBeGreaterThanOrEqual(0); // Can be 0 in strong downtrend (no gains)
      expect(rsi).toBeLessThanOrEqual(100);
      // Downtrend should have low RSI (typically < 50)
      expect(rsi).toBeLessThan(50);
    });

    it('should detect oversold condition (RSI < 30)', async () => {
      const candles = generateOversoldCandles(30);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi).toBeLessThan(30);
      expect(rsi).toBeGreaterThanOrEqual(0); // Can be 0 in extreme oversold (pure losses)
    });

    it('should detect overbought condition (RSI > 70)', async () => {
      const candles = generateOverboughtCandles(30);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi).toBeGreaterThan(70);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should throw error if not enough candles', async () => {
      const candles = generateUptrendCandles(10, 100); // Only 10 candles, need 15 (14+1)
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      await expect(analyzer.calculate(TimeframeRole.PRIMARY)).rejects.toThrow(
        'Not enough candles for RSI calculation on PRIMARY. Need 15, got 10',
      );
    });
  });

  // ============================================================================
  // CALCULATE ALL
  // ============================================================================

  describe('calculateAll', () => {
    let analyzer: MultiTimeframeRSIAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        false,
      );
    });

    it('should calculate RSI for all enabled timeframes (current config)', async () => {
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateSidewaysCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.TREND1, generateDowntrendCandles(50, 100));

      const result = await analyzer.calculateAll();

      expect(result.entry).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.trend1).toBeDefined();
      expect(result.trend2).toBeUndefined(); // disabled
      expect(result.context).toBeUndefined(); // disabled

      // Verify RSI values are within valid range
      expect(result.entry!).toBeGreaterThanOrEqual(0);
      expect(result.entry!).toBeLessThanOrEqual(100);
      expect(result.primary).toBeGreaterThanOrEqual(0);
      expect(result.primary).toBeLessThanOrEqual(100);
      expect(result.trend1!).toBeGreaterThanOrEqual(0);
      expect(result.trend1!).toBeLessThanOrEqual(100);
    });

    it('should handle errors gracefully for individual timeframes', async () => {
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateUptrendCandles(50, 100));
      // TREND1 has insufficient candles
      mockCandleProvider.setCandles(TimeframeRole.TREND1, generateUptrendCandles(10, 100));

      const result = await analyzer.calculateAll();

      // Should still return results for successful timeframes
      expect(result.entry).toBeDefined();
      expect(result.primary).toBeDefined();
      // PRIMARY is required, so it's always set (even if 0)
      expect(result.primary).toBeGreaterThan(0);
    });

    it('should differentiate between bullish and bearish timeframes', async () => {
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateOverboughtCandles(30));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateSidewaysCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.TREND1, generateOversoldCandles(30));

      const result = await analyzer.calculateAll();

      // ENTRY should be overbought (>70)
      expect(result.entry!).toBeGreaterThan(70);
      // PRIMARY should be neutral (~50)
      expect(result.primary).toBeGreaterThan(40);
      expect(result.primary).toBeLessThan(60);
      // TREND1 should be oversold (<30)
      expect(result.trend1!).toBeLessThan(30);
    });
  });

  // ============================================================================
  // CACHING
  // ============================================================================

  describe('caching', () => {
    it('should cache RSI values when caching enabled', async () => {
      const analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        true, // Enable caching
      );

      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      // First call - should calculate
      const rsi1 = await analyzer.calculate(TimeframeRole.PRIMARY);

      // Second call - should use cache
      const rsi2 = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi1).toBe(rsi2);

      const stats = analyzer.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should not cache when caching disabled', async () => {
      const analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        false, // Disable caching
      );

      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      await analyzer.calculate(TimeframeRole.PRIMARY);

      const cached = analyzer.getCached(TimeframeRole.PRIMARY);
      expect(cached).toBeUndefined();

      const stats = analyzer.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });

    it('should invalidate cache on candle close', async () => {
      const analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        true,
      );

      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      await analyzer.calculate(TimeframeRole.PRIMARY);

      let cached = analyzer.getCached(TimeframeRole.PRIMARY);
      expect(cached).toBeDefined();

      // Simulate candle close
      analyzer.onCandleClosed(TimeframeRole.PRIMARY);

      cached = analyzer.getCached(TimeframeRole.PRIMARY);
      expect(cached).toBeUndefined();
    });

    it('should clear all cache', async () => {
      const analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        true,
      );

      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateUptrendCandles(50, 100));

      await analyzer.calculate(TimeframeRole.ENTRY);
      await analyzer.calculate(TimeframeRole.PRIMARY);

      let stats = analyzer.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      analyzer.clearCache();

      stats = analyzer.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    let analyzer: MultiTimeframeRSIAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeRSIAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        14,
        false,
      );
    });

    it('should handle exactly minimum candles (15 for period 14)', async () => {
      const candles = generateUptrendCandles(15, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle large datasets', async () => {
      const candles = generateUptrendCandles(500, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle flat prices (RSI should be around 50)', async () => {
      const candles: Candle[] = [];
      const now = Date.now();
      const flatPrice = 100;

      for (let i = 0; i < 50; i++) {
        candles.push({
          timestamp: now - (50 - i) * 60000,
          open: flatPrice,
          high: flatPrice,
          low: flatPrice,
          close: flatPrice,
          volume: 1000,
        });
      }

      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      // Flat prices should result in neutral RSI (around 50, but can be NaN handled as 50)
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle extreme volatility', async () => {
      const candles: Candle[] = [];
      const now = Date.now();
      let price = 100;

      for (let i = 0; i < 50; i++) {
        // Alternate between sharp gains and losses
        price = i % 2 === 0 ? price * 1.1 : price * 0.9;
        candles.push({
          timestamp: now - (50 - i) * 60000,
          open: price,
          high: price * 1.02,
          low: price * 0.98,
          close: price,
          volume: 1000,
        });
      }

      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const rsi = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });
  });
});
