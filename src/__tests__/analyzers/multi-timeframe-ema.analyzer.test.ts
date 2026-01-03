/**
 * MultiTimeframeEMAAnalyzer Tests
 *
 * Tests for multi-timeframe EMA calculation, caching, and crossover detection.
 */

import { MultiTimeframeEMAAnalyzer, CrossoverType } from '../../analyzers/multi-timeframe-ema.analyzer';
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
 * Generate uptrend candles (price increases)
 */
function generateUptrendCandles(count: number, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const price = startPrice + i * 0.5; // Gradual increase
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price - 0.1,
      high: price + 0.3,
      low: price - 0.2,
      close: price,
      volume: 1000 + i * 10,
    });
  }

  return candles;
}

/**
 * Generate downtrend candles (price decreases)
 */
function generateDowntrendCandles(count: number, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const price = startPrice - i * 0.5; // Gradual decrease
    candles.push({
      timestamp: now - (count - i) * 60000,
      open: price + 0.1,
      high: price + 0.2,
      low: price - 0.3,
      close: price,
      volume: 1000 + i * 10,
    });
  }

  return candles;
}

/**
 * Generate sideways candles (price oscillates)
 */
function generateSidewaysCandles(count: number, basePrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const price = basePrice + Math.sin(i * 0.3) * 0.5; // Oscillation
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

// ============================================================================
// TESTS
// ============================================================================

describe('MultiTimeframeEMAAnalyzer', () => {
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
      const analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        false,
      );

      expect(analyzer).toBeDefined();
      expect(analyzer.getConfig()).toEqual({ fastPeriod: 9, slowPeriod: 21 });
    });

    it('should throw error if fast period >= slow period', () => {
      expect(
        () =>
          new MultiTimeframeEMAAnalyzer(
            timeframeProvider,
            mockCandleProvider as any,
            logger,
            21, // fast = slow
            21,
            false,
          ),
      ).toThrow('Fast period (21) must be less than slow period (21)');
    });

    it('should throw error if fast period > slow period', () => {
      expect(
        () =>
          new MultiTimeframeEMAAnalyzer(
            timeframeProvider,
            mockCandleProvider as any,
            logger,
            30, // fast > slow
            20,
            false,
          ),
      ).toThrow('Fast period (30) must be less than slow period (20)');
    });

    it('should accept custom EMA periods', () => {
      const analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        20,
        50,
        false,
      );

      expect(analyzer.getConfig()).toEqual({ fastPeriod: 20, slowPeriod: 50 });
    });
  });

  // ============================================================================
  // CALCULATE (SINGLE TIMEFRAME)
  // ============================================================================

  describe('calculate', () => {
    let analyzer: MultiTimeframeEMAAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        false,
      );
    });

    it('should calculate EMA for PRIMARY timeframe with uptrend', async () => {
      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const result = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
      // In uptrend, fast EMA should be above slow EMA
      expect(result.fast).toBeGreaterThan(result.slow);
    });

    it('should calculate EMA for ENTRY timeframe', async () => {
      const candles = generateSidewaysCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, candles);

      const result = await analyzer.calculate(TimeframeRole.ENTRY);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });

    it('should calculate EMA for TREND1 timeframe', async () => {
      const candles = generateDowntrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.TREND1, candles);

      const result = await analyzer.calculate(TimeframeRole.TREND1);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
      // In downtrend, fast EMA should be below slow EMA
      expect(result.fast).toBeLessThan(result.slow);
    });

    it('should throw error if not enough candles', async () => {
      const candles = generateUptrendCandles(10, 100); // Only 10 candles, need 21 for slow EMA
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      await expect(analyzer.calculate(TimeframeRole.PRIMARY)).rejects.toThrow(
        'Not enough candles for EMA calculation on PRIMARY. Need 21, got 10',
      );
    });
  });

  // ============================================================================
  // CALCULATE ALL
  // ============================================================================

  describe('calculateAll', () => {
    let analyzer: MultiTimeframeEMAAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        false,
      );
    });

    it('should calculate EMA for all enabled timeframes (current config)', async () => {
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.TREND1, generateUptrendCandles(50, 100));

      const result = await analyzer.calculateAll();

      expect(result.entry).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.trend1).toBeDefined();
      expect(result.trend2).toBeUndefined(); // disabled
      expect(result.context).toBeUndefined(); // disabled

      expect(result.entry!.fast).toBeGreaterThan(0);
      expect(result.primary.fast).toBeGreaterThan(0);
      expect(result.trend1!.fast).toBeGreaterThan(0);
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
      // TREND1 should be missing due to error
      expect(result.trend1).toBeUndefined();
    });
  });

  // ============================================================================
  // CROSSOVER DETECTION
  // ============================================================================

  describe('detectCrossover', () => {
    let analyzer: MultiTimeframeEMAAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        false,
      );
    });

    it('should detect BULLISH crossover (fast > slow)', async () => {
      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const crossover = await analyzer.detectCrossover(TimeframeRole.PRIMARY);

      expect(crossover.type).toBe(CrossoverType.BULLISH);
      expect(crossover.fast).toBeGreaterThan(crossover.slow);
      expect(crossover.difference).toBeGreaterThan(0);
    });

    it('should detect BEARISH crossover (fast < slow)', async () => {
      const candles = generateDowntrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const crossover = await analyzer.detectCrossover(TimeframeRole.PRIMARY);

      expect(crossover.type).toBe(CrossoverType.BEARISH);
      expect(crossover.fast).toBeLessThan(crossover.slow);
      expect(crossover.difference).toBeLessThan(0);
    });

    it('should calculate correct difference value', async () => {
      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const crossover = await analyzer.detectCrossover(TimeframeRole.PRIMARY);

      expect(crossover.difference).toBe(crossover.fast - crossover.slow);
    });
  });

  describe('detectAllCrossovers', () => {
    let analyzer: MultiTimeframeEMAAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        false,
      );
    });

    it('should detect crossovers for all enabled timeframes', async () => {
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.TREND1, generateDowntrendCandles(50, 100));

      const crossovers = await analyzer.detectAllCrossovers();

      expect(crossovers.size).toBe(3);
      expect(crossovers.get(TimeframeRole.ENTRY)?.type).toBe(CrossoverType.BULLISH);
      expect(crossovers.get(TimeframeRole.PRIMARY)?.type).toBe(CrossoverType.BULLISH);
      expect(crossovers.get(TimeframeRole.TREND1)?.type).toBe(CrossoverType.BEARISH);
    });

    it('should handle errors gracefully', async () => {
      mockCandleProvider.setCandles(TimeframeRole.ENTRY, generateUptrendCandles(50, 100));
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, generateUptrendCandles(10, 100)); // Insufficient
      mockCandleProvider.setCandles(TimeframeRole.TREND1, generateUptrendCandles(50, 100));

      const crossovers = await analyzer.detectAllCrossovers();

      // Should have results for successful timeframes
      expect(crossovers.size).toBe(2);
      expect(crossovers.has(TimeframeRole.ENTRY)).toBe(true);
      expect(crossovers.has(TimeframeRole.PRIMARY)).toBe(false); // Error
      expect(crossovers.has(TimeframeRole.TREND1)).toBe(true);
    });
  });

  // ============================================================================
  // CACHING
  // ============================================================================

  describe('caching', () => {
    it('should cache EMA values when caching enabled', async () => {
      const analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        true, // Enable caching
      );

      const candles = generateUptrendCandles(50, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      // First call - should calculate
      const result1 = await analyzer.calculate(TimeframeRole.PRIMARY);

      // Second call - should use cache
      const result2 = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(result1).toEqual(result2);

      const stats = analyzer.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should not cache when caching disabled', async () => {
      const analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
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
      const analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
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
      const analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
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
    let analyzer: MultiTimeframeEMAAnalyzer;

    beforeEach(() => {
      analyzer = new MultiTimeframeEMAAnalyzer(
        timeframeProvider,
        mockCandleProvider as any,
        logger,
        9,
        21,
        false,
      );
    });

    it('should handle exactly minimum candles (21)', async () => {
      const candles = generateUptrendCandles(21, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const result = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });

    it('should handle large datasets', async () => {
      const candles = generateUptrendCandles(500, 100);
      mockCandleProvider.setCandles(TimeframeRole.PRIMARY, candles);

      const result = await analyzer.calculate(TimeframeRole.PRIMARY);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });

    it('should handle flat prices (no trend)', async () => {
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

      const result = await analyzer.calculate(TimeframeRole.PRIMARY);

      // EMAs should converge to flat price
      expect(result.fast).toBeCloseTo(flatPrice, 1);
      expect(result.slow).toBeCloseTo(flatPrice, 1);
    });
  });
});
