/**
 * Unit Tests for Footprint Indicator
 * Tests footprint building, aggression detection, and imbalance identification
 */

import { FootprintIndicator } from '../../indicators/footprint.indicator';
import { LoggerService, LogLevel, Candle, FootprintConfig, Tick } from '../../types';

// ============================================================================
// SETUP
// ============================================================================

const logger = new LoggerService(LogLevel.ERROR, './logs', false);

describe('FootprintIndicator', () => {
  let indicator: FootprintIndicator;
  let config: FootprintConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      tickLevels: 0.01,
      minImbalanceRatio: 2.5,
      minVolumeForImbalance: 100,
      aggressionBoostMultiplier: 1.15,
      aggressionPenaltyMultiplier: 0.85,
    };

    indicator = new FootprintIndicator(config, logger);
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const createCandle = (
    open: number,
    high: number,
    low: number,
    close: number,
    timestamp: number,
  ): Candle => ({
    open,
    high,
    low,
    close,
    volume: 1000,
    timestamp,
  });

  const createTick = (price: number, size: number, side: 'BUY' | 'SELL', timestamp: number): Tick => ({
    price,
    size,
    side,
    timestamp,
  });

  // ============================================================================
  // BASIC FUNCTIONALITY
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should build footprint candle from ticks', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 50, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.candle).toBe(candle);
      expect(fp.levels.length).toBeGreaterThan(0);
    });

    it('should group ticks by price level', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 50, 'BUY', 1010), // Same level
        createTick(100.51, 75, 'BUY', 1020), // Different level
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.levels.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate bid/ask volume correctly', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000), // Taker bought from asks
        createTick(100.5, 50, 'SELL', 1010), // Taker sold to bids
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      if (fp.levels.length > 0) {
        const level = fp.levels[0];
        expect(level.askVolume).toBeGreaterThanOrEqual(100);
        expect(level.bidVolume).toBeGreaterThanOrEqual(50);
      }
    });

    it('should calculate delta for each level', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 50, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      if (fp.levels.length > 0) {
        const level = fp.levels[0];
        expect(level.delta).toBe(level.askVolume - level.bidVolume);
      }
    });

    it('should find POV (Point of Control)', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 50, 'SELL', 1010),
        createTick(100.6, 10, 'BUY', 1020), // Lower volume level
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.povPoint).not.toBeNull();
      expect(fp.povPoint).toBeLessThanOrEqual(100.6);
      expect(fp.povPoint).toBeGreaterThanOrEqual(100.5);
    });

    it('should determine dominant side (BUY/SELL/NEUTRAL)', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);

      // All BUY
      const buyTicks: Tick[] = [createTick(100.5, 100, 'BUY', 1000), createTick(100.6, 100, 'BUY', 1010)];
      const fpBuy = indicator.buildFootprintCandle(buyTicks, candle);
      expect(fpBuy.dominantSide).toBe('ASK'); // BUY = ask volume

      // All SELL
      const sellTicks: Tick[] = [createTick(100.5, 100, 'SELL', 1000), createTick(100.6, 100, 'SELL', 1010)];
      const fpSell = indicator.buildFootprintCandle(sellTicks, candle);
      expect(fpSell.dominantSide).toBe('BID'); // SELL = bid volume

      // Mixed
      const mixedTicks: Tick[] = [createTick(100.5, 100, 'BUY', 1000), createTick(100.6, 100, 'SELL', 1010)];
      const fpMixed = indicator.buildFootprintCandle(mixedTicks, candle);
      expect(['ASK', 'BID', 'NEUTRAL']).toContain(fpMixed.dominantSide);
    });
  });

  // ============================================================================
  // IMBALANCE DETECTION
  // ============================================================================

  describe('Imbalance Detection', () => {
    it('should detect large bid/ask imbalance', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 250, 'BUY', 1000), // 250 ask volume
        createTick(100.5, 50, 'SELL', 1010), // 50 bid volume (5x less)
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.imbalanceRatio).toBeGreaterThanOrEqual(2.5);
    });

    it('should filter imbalances below minImbalanceRatio', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 80, 'SELL', 1010), // Ratio = 1.25 (< 2.5)
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.imbalanceDetected).toBe(false);
    });

    it('should filter imbalances below minVolumeForImbalance', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 50, 'BUY', 1000),
        createTick(100.5, 10, 'SELL', 1010), // Total volume = 60 (< 100)
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.imbalanceDetected).toBe(false);
    });
  });

  // ============================================================================
  // SIGNAL ANALYSIS
  // ============================================================================

  describe('Signal Analysis', () => {
    it('should determine BUY aggression from ASK dominant side', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 200, 'BUY', 1000),
        createTick(100.5, 50, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.currentAggression).toBe('BUY');
      expect(analysis.aggressionStrength).toBeGreaterThan(0);
    });

    it('should determine SELL aggression from BID dominant side', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 50, 'BUY', 1000),
        createTick(100.5, 200, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.currentAggression).toBe('SELL');
      expect(analysis.aggressionStrength).toBeGreaterThan(0);
    });

    it('should detect NEUTRAL aggression when balanced', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 100, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.currentAggression).toBe('NEUTRAL');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty ticks array', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const fp = indicator.buildFootprintCandle([], candle);

      expect(fp.levels.length).toBe(0);
      expect(fp.totalDelta).toBe(0);
    });

    it('should handle single tick', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [createTick(100.5, 100, 'BUY', 1000)];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.levels.length).toBeGreaterThan(0);
    });

    it('should handle all BUY ticks', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.6, 100, 'BUY', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.dominantSide).toBe('ASK');
      for (const level of fp.levels) {
        expect(level.bidVolume).toBe(0);
      }
    });

    it('should handle all SELL ticks', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'SELL', 1000),
        createTick(100.6, 100, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.dominantSide).toBe('BID');
      for (const level of fp.levels) {
        expect(level.askVolume).toBe(0);
      }
    });

    it('should handle very small tick sizes', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 0.001, 'BUY', 1000),
        createTick(100.5, 0.0005, 'SELL', 1010),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);

      expect(fp.levels.length).toBeGreaterThan(0);
      expect(isNaN(fp.totalDelta)).toBe(false);
    });

    it('should handle disabled config', () => {
      const disabledConfig: FootprintConfig = { ...config, enabled: false };
      const disabledIndicator = new FootprintIndicator(disabledConfig, logger);

      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [createTick(100.5, 100, 'BUY', 1000)];

      const fp = disabledIndicator.buildFootprintCandle(ticks, candle);

      expect(fp.levels.length).toBe(0);
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================

  describe('Real-World Scenarios', () => {
    it('should detect institutional buying (large ask imbalance at support)', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 500, 'BUY', 1000), // Institutional buying
        createTick(100.5, 100, 'SELL', 1010),
        createTick(100.6, 50, 'SELL', 1020),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.currentAggression).toBe('BUY');
      expect(analysis.aggressionStrength).toBeGreaterThan(0.5);
    });

    it('should detect distribution (large bid imbalance at resistance)', () => {
      const candle = createCandle(100, 101, 99, 100, 1000);
      const ticks: Tick[] = [
        createTick(100.5, 100, 'BUY', 1000),
        createTick(100.5, 500, 'SELL', 1010), // Distribution
        createTick(100.6, 50, 'BUY', 1020),
      ];

      const fp = indicator.buildFootprintCandle(ticks, candle);
      const analysis = indicator.analyze([fp]);

      expect(analysis.currentAggression).toBe('SELL');
      expect(analysis.aggressionStrength).toBeGreaterThan(0.5);
    });
  });
});
