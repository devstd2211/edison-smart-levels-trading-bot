/**
 * Whale Detector Service Tests
 *
 * Tests real whale detection logic with proper orderbook tracking
 */

import { WhaleDetectorService, WhaleDetectionMode, WhaleDetectorConfig } from '../../services/whale-detector.service';
import { OrderBookAnalysis, OrderBookWall, LoggerService, LogLevel, SignalDirection } from '../../types';

function createAnalysis(walls: OrderBookWall[], ratio: number, direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): OrderBookAnalysis {
  return {
    timestamp: Date.now(),
    orderBook: {
      symbol: 'APEXUSDT',
      timestamp: Date.now(),
      bids: [],
      asks: [],
      updateId: 0,
    },
    walls,
    imbalance: {
      bidVolume: 1000,
      askVolume: 1000,
      ratio,
      direction,
      strength: 0.5,
    },
    strongestBid: null,
    strongestAsk: null,
    spread: 0.05,
    depth: { bid: 50, ask: 50 },
  };
}

describe('WhaleDetectorService', () => {
  let detector: WhaleDetectorService;
  let logger: LoggerService;
  let config: WhaleDetectorConfig;

  beforeEach(() => {
    jest.useFakeTimers(); // Use fake timers for wall break tests
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = {
      modes: {
        wallBreak: {
          enabled: true,
          minWallSize: 15, // 15%
          breakConfirmationMs: 3000, // 3s
          maxConfidence: 85,
        },
        wallDisappearance: {
          enabled: true,
          minWallSize: 20, // 20%
          minWallDuration: 60000, // 60s
          wallGoneThresholdMs: 15000,
          maxConfidence: 80,
        },
        imbalanceSpike: {
          enabled: true,
          minRatioChange: 0.5, // 50%
          detectionWindow: 10000, // 10s
          maxConfidence: 90,
        },
      },
      maxImbalanceHistory: 20,
      wallExpiryMs: 60000,
      breakExpiryMs: 300000,
    };
    detector = new WhaleDetectorService(config, logger);
  });

  afterEach(() => {
    jest.useRealTimers(); // Restore real timers after each test
  });

  describe('Initialization', () => {
    it('should initialize correctly', () => {
      expect(detector).toBeDefined();
      const stats = detector.getStats();
      expect(stats).toHaveProperty('trackedWalls');
      expect(stats.trackedWalls.bids).toBe(0);
      expect(stats.trackedWalls.asks).toBe(0);
    });
  });

  describe('WALL_BREAK Detection', () => {
    it('should detect BID wall break and signal LONG', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 20, // 20% > minWallSize (15%)
        distance: 0.5,
      };

      // Track the wall first
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);

      // Wait for confirmation time (> 3s)
      jest.advanceTimersByTime(3500);

      // Price breaks BELOW wall → BID wall broken → LONG signal (reversal)
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 995);

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.WALL_BREAK);
      expect(signal.direction).toBe(SignalDirection.LONG); // Whale absorbed sells, Momentum UP
      expect(signal.confidence).toBeGreaterThan(0);
      expect(signal.reason).toContain('BID wall BROKEN');
      expect(signal.reason).toContain('Momentum UP');
    });

    it('should detect ASK wall break and signal SHORT', () => {
      const askWall: OrderBookWall = {
        side: 'ASK',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 20, // 20% > minWallSize (15%)
        distance: 0.5,
      };

      // Track the wall first
      detector.detectWhale(createAnalysis([askWall], 1.0, 'NEUTRAL'), 995);

      // Wait for confirmation time (> 3s)
      jest.advanceTimersByTime(3500);

      // Price breaks ABOVE wall → ASK wall broken → SHORT signal (reversal)
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1005);

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.WALL_BREAK);
      expect(signal.direction).toBe(SignalDirection.SHORT); // Whale absorbed buys, Momentum DOWN
      expect(signal.confidence).toBeGreaterThan(0);
      expect(signal.reason).toContain('ASK wall BROKEN');
      expect(signal.reason).toContain('Momentum DOWN');
    });

    it('should NOT detect wall break if wall too small', () => {
      const smallWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 100,
        percentOfTotal: 5, // 5% < minWallSize (15%)
        distance: 0.5,
      };

      detector.detectWhale(createAnalysis([smallWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(3500);

      // Price breaks below - should not signal (wall too small)
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 995);

      expect(signal.detected).toBe(false);
    });

    it('should NOT detect wall break if not confirmed (< 3s)', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 20,
        distance: 0.5,
      };

      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);

      // Wait only 2s (< 3s confirmation)
      jest.advanceTimersByTime(2000);

      // Price breaks - should not signal yet
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 995);

      expect(signal.detected).toBe(false);
    });
  });

  describe('IMBALANCE_SPIKE Detection', () => {
    it('should detect ratio increase (LONG signal)', () => {
      // Build up history with 3 snapshots at ratio 1.0
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);

      // Now spike to 1.6 (60% increase)
      const signal = detector.detectWhale(createAnalysis([], 1.6, 'BULLISH'), 1000);

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.IMBALANCE_SPIKE);
      expect(signal.direction).toBe(SignalDirection.LONG);
      expect(signal.confidence).toBeGreaterThan(0);
    });

    it('should detect ratio decrease (SHORT signal)', () => {
      // Build up history
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);

      // Spike down to 0.4 (60% decrease)
      const signal = detector.detectWhale(createAnalysis([], 0.4, 'BEARISH'), 1000);

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.IMBALANCE_SPIKE);
      expect(signal.direction).toBe(SignalDirection.SHORT);
    });

    it('should NOT detect if change too small', () => {
      // Build up history
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);

      // Small increase to 1.2 (20% - below 50% threshold)
      const signal = detector.detectWhale(createAnalysis([], 1.2, 'BULLISH'), 1000);

      expect(signal.detected).toBe(false);
    });

    it('should NOT detect if outside time window', () => {
      // Build up history
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);
      detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1000);

      // Wait 11s (> 10s detection window) using fake timers
      jest.advanceTimersByTime(11000);

      const signal = detector.detectWhale(createAnalysis([], 1.6, 'BULLISH'), 1000);
      expect(signal.detected).toBe(false);
    });
  });

  describe('WALL_DISAPPEARANCE Trend-Aware Logic', () => {
    it('should use default logic in NEUTRAL market (BID disappears → SHORT)', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25, // 25% > minWallSize (20%)
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);

      // Wait for wall to exist long enough (> 60s)
      jest.advanceTimersByTime(65000);

      // Update without the wall - should detect disappearance
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);

      // Wait for wall to be considered gone (> 15s)
      jest.advanceTimersByTime(20000);

      // BID wall disappeared in NEUTRAL market → SHORT signal
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1005, 0.2, 'NEUTRAL');

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.WALL_DISAPPEARANCE);
      expect(signal.direction).toBe(SignalDirection.SHORT); // Default logic
      expect(signal.reason).toContain('NEUTRAL market');
      expect(signal.metadata.trendInverted).toBe(false);
    });

    it('should INVERT signal in BEARISH market (BID disappears → LONG instead of SHORT)', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25,
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(65000);
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(20000);

      // BID wall disappeared in BEARISH market (BTC DOWN) → INVERTED to LONG
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1005, 0.6, 'DOWN');

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.WALL_DISAPPEARANCE);
      expect(signal.direction).toBe(SignalDirection.LONG); // INVERTED!
      expect(signal.reason).toContain('BEARISH trend');
      expect(signal.reason).toContain('LONG [INVERTED]');
      expect(signal.metadata.trendInverted).toBe(true);
    });

    it('should INVERT signal in BULLISH market (ASK disappears → SHORT instead of LONG)', () => {
      const askWall: OrderBookWall = {
        side: 'ASK',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25,
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([askWall], 1.0, 'NEUTRAL'), 995);
      jest.advanceTimersByTime(65000);
      detector.detectWhale(createAnalysis([askWall], 1.0, 'NEUTRAL'), 995);
      jest.advanceTimersByTime(20000);

      // ASK wall disappeared in BULLISH market (BTC UP) → INVERTED to SHORT
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 995, 0.6, 'UP');

      expect(signal.detected).toBe(true);
      expect(signal.mode).toBe(WhaleDetectionMode.WALL_DISAPPEARANCE);
      expect(signal.direction).toBe(SignalDirection.SHORT); // INVERTED!
      expect(signal.reason).toContain('BULLISH trend');
      expect(signal.reason).toContain('SHORT [INVERTED]');
      expect(signal.metadata.trendInverted).toBe(true);
    });

    it('should BLOCK signal going against strong trend (BID disappears in BULLISH)', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25,
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(65000);
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(20000);

      // BID wall disappeared in BULLISH market → Would signal SHORT (against trend) → BLOCKED
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1005, 0.6, 'UP');

      expect(signal.detected).toBe(false); // Signal blocked!
    });

    it('should BLOCK signal going against strong trend (ASK disappears in BEARISH)', () => {
      const askWall: OrderBookWall = {
        side: 'ASK',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25,
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([askWall], 1.0, 'NEUTRAL'), 995);
      jest.advanceTimersByTime(65000);
      detector.detectWhale(createAnalysis([askWall], 1.0, 'NEUTRAL'), 995);
      jest.advanceTimersByTime(20000);

      // ASK wall disappeared in BEARISH market → Would signal LONG (against trend) → BLOCKED
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 995, 0.6, 'DOWN');

      expect(signal.detected).toBe(false); // Signal blocked!
    });

    it('should use default logic in MODERATE trend (momentum 0.3-0.5)', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25,
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(65000);
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(20000);

      // BID wall disappeared in MODERATE DOWN trend (momentum 0.4) → Use default SHORT
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1005, 0.4, 'DOWN');

      expect(signal.detected).toBe(true);
      expect(signal.direction).toBe(SignalDirection.SHORT); // Default logic
      expect(signal.reason).toContain('MODERATE trend');
      expect(signal.metadata.trendInverted).toBe(false);
    });

    it('should use default logic when BTC data NOT available', () => {
      const bidWall: OrderBookWall = {
        side: 'BID',
        price: 1000,
        quantity: 5000,
        percentOfTotal: 25,
        distance: 0.5,
      };

      // Track the wall
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(65000);
      detector.detectWhale(createAnalysis([bidWall], 1.0, 'NEUTRAL'), 1005);
      jest.advanceTimersByTime(20000);

      // BID wall disappeared WITHOUT BTC data → Use default SHORT
      const signal = detector.detectWhale(createAnalysis([], 1.0, 'NEUTRAL'), 1005, undefined, undefined);

      expect(signal.detected).toBe(true);
      expect(signal.direction).toBe(SignalDirection.SHORT); // Default logic
      expect(signal.reason).toContain('Accumulation done, distribution likely');
      expect(signal.metadata.trendInverted).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled modes', () => {
      const disabledConfig: WhaleDetectorConfig = {
        modes: {
          wallBreak: { enabled: false, minWallSize: 15, breakConfirmationMs: 3000, maxConfidence: 85 },
          wallDisappearance: { enabled: false, minWallSize: 20, minWallDuration: 60000, wallGoneThresholdMs: 15000, maxConfidence: 80 },
          imbalanceSpike: { enabled: false, minRatioChange: 0.5, detectionWindow: 10000, maxConfidence: 90 },
        },
        maxImbalanceHistory: 20,
        wallExpiryMs: 60000,
        breakExpiryMs: 300000,
      };
      const disabledDetector = new WhaleDetectorService(disabledConfig, logger);

      const analysis = createAnalysis([], 1.6, 'BULLISH');
      const signal = disabledDetector.detectWhale(analysis, 1000);

      expect(signal.detected).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', () => {
      const analysis = createAnalysis(
        [{ side: 'ASK', price: 1010, quantity: 1000, percentOfTotal: 20, distance: 1.0 }],
        0.8,
        'BEARISH',
      );

      detector.detectWhale(analysis, 1000);

      const stats = detector.getStats();
      expect(stats).toHaveProperty('trackedWalls');
      expect(stats).toHaveProperty('recentBreaks');
      expect(stats).toHaveProperty('imbalanceHistory');
    });
  });

  describe('Clear State', () => {
    it('should clear all tracked state', () => {
      const analysis = createAnalysis(
        [
          { side: 'ASK', price: 1010, quantity: 1000, percentOfTotal: 20, distance: 1.0 },
          { side: 'BID', price: 990, quantity: 1000, percentOfTotal: 20, distance: 1.0 },
        ],
        0.8,
        'BEARISH',
      );

      // Track some walls
      detector.detectWhale(analysis, 1000);

      // Clear
      detector.clear();

      // Check stats
      const stats = detector.getStats();
      expect(stats.trackedWalls.bids).toBe(0);
      expect(stats.trackedWalls.asks).toBe(0);
      expect(stats.imbalanceHistory).toBe(0);
    });
  });

  describe('No Detection Scenarios', () => {
    it('should return no signal when no whale activity', () => {
      const analysis = createAnalysis([], 1.0, 'NEUTRAL');
      const signal = detector.detectWhale(analysis, 1000);

      expect(signal.detected).toBe(false);
      expect(signal.mode).toBeNull();
      expect(signal.direction).toBeNull();
      expect(signal.confidence).toBe(0);
    });

    it('should return no signal with empty orderbook', () => {
      const analysis = createAnalysis([], 1.0, 'NEUTRAL');
      const signal = detector.detectWhale(analysis, 1000);

      expect(signal.detected).toBe(false);
    });
  });
});
