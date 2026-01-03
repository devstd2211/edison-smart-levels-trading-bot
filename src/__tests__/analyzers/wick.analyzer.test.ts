/**
 * Wick Analyzer Tests
 */

import { WickAnalyzer, WickDirection } from '../../analyzers/wick.analyzer';
import { LoggerService, LogLevel, Candle, SignalDirection } from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandle(
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return {
    timestamp: Date.now(),
    open,
    high,
    low,
    close,
    volume: 1000,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('WickAnalyzer', () => {
  let analyzer: WickAnalyzer;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    analyzer = new WickAnalyzer(logger);
  });

  // ============================================================================
  // TEST 1: No Large Wick (Normal Candles)
  // ============================================================================

  describe('analyze - normal candles', () => {
    it('should detect no large wick on normal candle', () => {
      // Body: 1 (100->101), Upper wick: 0.5, Lower wick: 0.5
      const candle = createCandle(100, 101.5, 99.5, 101);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(false);
      expect(result.wickDirection).toBe(WickDirection.NONE);
      expect(result.wickToBodyRatio).toBe(0);
      expect(result.blocksDirection).toBeUndefined();
    });

    it('should detect no large wick on small wicks', () => {
      // Body: 2, Upper wick: 1, Lower wick: 1 (wicks < 2x body)
      const candle = createCandle(100, 103, 99, 102);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(false);
      expect(result.bodySize).toBe(2);
    });
  });

  // ============================================================================
  // TEST 2: Large Upper Wick
  // ============================================================================

  describe('analyze - large upper wick', () => {
    it('should detect large upper wick (3x body)', () => {
      // Body: 1 (100->101), Upper wick: 3 (101->104), Lower wick: 0
      const candle = createCandle(100, 104, 100, 101);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(true);
      expect(result.wickDirection).toBe(WickDirection.UP);
      expect(result.wickSize).toBe(3);
      expect(result.bodySize).toBe(1);
      expect(result.wickToBodyRatio).toBe(3);
      expect(result.blocksDirection).toBe(SignalDirection.LONG);
    });

    it('should detect large upper wick on bearish candle', () => {
      // Body: 2 (102->100), Upper wick: 5 (102->107), Lower wick: 0
      const candle = createCandle(102, 107, 100, 100);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(true);
      expect(result.wickDirection).toBe(WickDirection.UP);
      expect(result.wickSize).toBe(5);
      expect(result.bodySize).toBe(2);
      expect(result.wickToBodyRatio).toBe(2.5);
    });

    it('should NOT detect large upper wick at boundary (exactly 2x)', () => {
      // Body: 1, Upper wick: 2 (exactly 2x - should not trigger)
      const candle = createCandle(100, 103, 100, 101);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(false); // threshold is > 2x, not >=
    });
  });

  // ============================================================================
  // TEST 3: Large Lower Wick
  // ============================================================================

  describe('analyze - large lower wick', () => {
    it('should detect large lower wick (3x body)', () => {
      // Body: 1 (100->101), Lower wick: 3 (97->100), Upper wick: 0
      const candle = createCandle(100, 101, 97, 101);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(true);
      expect(result.wickDirection).toBe(WickDirection.DOWN);
      expect(result.wickSize).toBe(3);
      expect(result.bodySize).toBe(1);
      expect(result.wickToBodyRatio).toBe(3);
      expect(result.blocksDirection).toBe(SignalDirection.SHORT);
    });

    it('should detect large lower wick on bearish candle', () => {
      // Body: 2 (102->100), Lower wick: 5 (95->100), Upper wick: 0
      const candle = createCandle(102, 102, 95, 100);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(true);
      expect(result.wickDirection).toBe(WickDirection.DOWN);
      expect(result.wickSize).toBe(5);
      expect(result.bodySize).toBe(2);
      expect(result.wickToBodyRatio).toBe(2.5);
    });
  });

  // ============================================================================
  // TEST 4: Doji Candle
  // ============================================================================

  describe('analyze - doji candle', () => {
    it('should handle doji candle (no body)', () => {
      // Body: 0 (100->100), wicks don't matter
      const candle = createCandle(100, 105, 95, 100);

      const result = analyzer.analyze(candle);

      expect(result.hasLargeWick).toBe(false);
      expect(result.bodySize).toBe(0);
      expect(result.wickToBodyRatio).toBe(0);
    });
  });

  // ============================================================================
  // TEST 5: blocksSignal Method
  // ============================================================================

  describe('blocksSignal', () => {
    it('should block LONG signal when upper wick detected', () => {
      const candle = createCandle(100, 104, 100, 101); // Upper wick
      const wickAnalysis = analyzer.analyze(candle);

      const blocksLong = analyzer.blocksSignal(wickAnalysis, SignalDirection.LONG);
      const blocksShort = analyzer.blocksSignal(wickAnalysis, SignalDirection.SHORT);

      expect(blocksLong).toBe(true);
      expect(blocksShort).toBe(false);
    });

    it('should block SHORT signal when lower wick detected', () => {
      const candle = createCandle(100, 101, 97, 101); // Lower wick
      const wickAnalysis = analyzer.analyze(candle);

      const blocksLong = analyzer.blocksSignal(wickAnalysis, SignalDirection.LONG);
      const blocksShort = analyzer.blocksSignal(wickAnalysis, SignalDirection.SHORT);

      expect(blocksLong).toBe(false);
      expect(blocksShort).toBe(true);
    });

    it('should not block any signal when no wick detected', () => {
      const candle = createCandle(100, 101.5, 99.5, 101); // Normal candle
      const wickAnalysis = analyzer.analyze(candle);

      const blocksLong = analyzer.blocksSignal(wickAnalysis, SignalDirection.LONG);
      const blocksShort = analyzer.blocksSignal(wickAnalysis, SignalDirection.SHORT);

      expect(blocksLong).toBe(false);
      expect(blocksShort).toBe(false);
    });
  });
});
