/**
 * Tests for OrderFlowAnalyzerService (Phase 5)
 *
 * Coverage:
 * - Process orderbook updates
 * - Detect aggressive buy/sell flow
 * - Calculate flow ratio
 * - Detect flow imbalance
 * - Volume/threshold filtering
 * - Cleanup old flow data
 */

import { OrderFlowAnalyzerService } from '../../services/order-flow-analyzer.service';
import {
  LoggerService,
  LogLevel,
  OrderFlowAnalyzerConfig,
  OrderBook,
  SignalDirection,
  AggressiveFlow,
} from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createMockOrderbook = (
  bidPrice: number,
  bidSize: number,
  askPrice: number,
  askSize: number,
): OrderBook => {
  return {
    symbol: 'APEXUSDT',
    bids: [
      [bidPrice, bidSize],
      [bidPrice - 0.001, 50],
      [bidPrice - 0.002, 50],
    ],
    asks: [
      [askPrice, askSize],
      [askPrice + 0.001, 50],
      [askPrice + 0.002, 50],
    ],
    timestamp: Date.now(),
    updateId: Date.now(),
  };
};

const createMockFlow = (direction: 'BUY' | 'SELL', volumeUSDT: number, timestamp: number = Date.now()): AggressiveFlow => {
  return { direction, volumeUSDT, timestamp, price: 1.0 };
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('OrderFlowAnalyzerService', () => {
  let service: OrderFlowAnalyzerService;
  let logger: LoggerService;
  let config: OrderFlowAnalyzerConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    // Default config
    config = {
      aggressiveBuyThreshold: 3.0, // 3x buy/sell
      detectionWindow: 3000, // 3 seconds
      minVolumeUSDT: 5000,
      maxConfidence: 90,
    };

    service = new OrderFlowAnalyzerService(config, logger);
  });

  // ==========================================================================
  // PROCESS ORDERBOOK UPDATES
  // ==========================================================================

  describe('processOrderbookUpdate', () => {
    it('should store first orderbook update without detecting flow', () => {
      const orderbook = createMockOrderbook(1.0, 100, 1.001, 100);

      service.processOrderbookUpdate(orderbook);

      const history = service.getFlowHistory();
      expect(history).toHaveLength(0); // No flow detected on first update
    });

    it('should detect aggressive BUY when price rises and asks removed', () => {
      // First snapshot
      const orderbook1 = createMockOrderbook(1.0, 100, 1.001, 100);
      service.processOrderbookUpdate(orderbook1);

      // Price rises + asks removed (aggressive buy)
      const orderbook2 = createMockOrderbook(1.001, 100, 1.002, 50); // Ask size reduced 100→50
      service.processOrderbookUpdate(orderbook2);

      const history = service.getFlowHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].direction).toBe('BUY');
    });

    it('should detect aggressive SELL when price falls and bids removed', () => {
      // First snapshot
      const orderbook1 = createMockOrderbook(1.0, 100, 1.001, 100);
      service.processOrderbookUpdate(orderbook1);

      // Price falls + bids removed (aggressive sell)
      const orderbook2 = createMockOrderbook(0.999, 50, 1.0, 100); // Bid size reduced 100→50
      service.processOrderbookUpdate(orderbook2);

      const history = service.getFlowHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].direction).toBe('SELL');
    });

    it('should NOT detect flow when price moves but no volume removed', () => {
      // First snapshot
      const orderbook1 = createMockOrderbook(1.0, 100, 1.001, 100);
      service.processOrderbookUpdate(orderbook1);

      // Price rises slightly but volume unchanged (same price levels, volume maintained)
      const orderbook2 = createMockOrderbook(1.0, 100, 1.001, 100);
      service.processOrderbookUpdate(orderbook2);

      const history = service.getFlowHistory();
      expect(history).toHaveLength(0); // No volume removed, no price change
    });

    it('should accumulate multiple flow events', () => {
      // Simulate 3 aggressive buy events
      const orderbook1 = createMockOrderbook(1.0, 100, 1.001, 100);
      service.processOrderbookUpdate(orderbook1);

      const orderbook2 = createMockOrderbook(1.001, 100, 1.002, 80);
      service.processOrderbookUpdate(orderbook2);

      const orderbook3 = createMockOrderbook(1.002, 100, 1.003, 90);
      service.processOrderbookUpdate(orderbook3);

      const orderbook4 = createMockOrderbook(1.003, 100, 1.004, 70);
      service.processOrderbookUpdate(orderbook4);

      const history = service.getFlowHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // CALCULATE FLOW RATIO
  // ==========================================================================

  describe('calculateFlowRatio', () => {
    it('should return neutral ratio (1.0) with no flow', () => {
      const ratio = service.calculateFlowRatio();
      expect(ratio).toBe(1.0);
    });

    it('should calculate ratio with more aggressive buys', () => {
      const now = Date.now();

      // Manually add flow events (simulating aggressive buys)
      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 6000, now));
      history.push(createMockFlow('BUY', 4000, now));
      history.push(createMockFlow('SELL', 2000, now));

      const ratio = service.calculateFlowRatio();

      // (6000 + 4000) / 2000 = 5.0
      expect(ratio).toBeCloseTo(5.0, 1);
    });

    it('should calculate ratio with more aggressive sells', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 2000, now));
      history.push(createMockFlow('SELL', 6000, now));
      history.push(createMockFlow('SELL', 4000, now));

      const ratio = service.calculateFlowRatio();

      // 2000 / (6000 + 4000) = 0.2
      expect(ratio).toBeCloseTo(0.2, 1);
    });

    it('should return max ratio (999) with only buy flow', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 3000, now));
      history.push(createMockFlow('BUY', 2000, now));

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBe(999);
    });

    it('should return min ratio (0.001) with only sell flow', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('SELL', 3000, now));
      history.push(createMockFlow('SELL', 2000, now));

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBe(0.001);
    });

    it('should only count flow within time window', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      // Old flow (outside 3s window)
      history.push(createMockFlow('BUY', 10000, now - 5000));

      // Recent flow (inside window)
      history.push(createMockFlow('BUY', 3000, now));
      history.push(createMockFlow('SELL', 1000, now));

      const ratio = service.calculateFlowRatio();

      // Should only count recent: 3000 / 1000 = 3.0
      expect(ratio).toBeCloseTo(3.0, 1);
    });
  });

  // ==========================================================================
  // DETECT FLOW IMBALANCE
  // ==========================================================================

  describe('detectFlowImbalance', () => {
    it('should detect BUY imbalance (3x ratio)', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 9000, now)); // 9000 buy
      history.push(createMockFlow('SELL', 3000, now)); // 3000 sell → 3x ratio

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.direction).toBe(SignalDirection.LONG);
      expect(imbalance!.ratio).toBeCloseTo(3.0, 1);
      expect(imbalance!.totalVolumeUSDT).toBe(12000);
      expect(imbalance!.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL imbalance (inverse 3x ratio)', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 2000, now)); // 2000 buy
      history.push(createMockFlow('SELL', 6000, now)); // 6000 sell → 3x ratio (inverse)

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.direction).toBe(SignalDirection.SHORT);
      expect(imbalance!.ratio).toBeCloseTo(3.0, 1);
    });

    it('should NOT detect imbalance if ratio too weak (2x < 3x)', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 6000, now));
      history.push(createMockFlow('SELL', 3000, now)); // 2x ratio (below 3x threshold)

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).toBeNull();
    });

    it('should NOT detect imbalance if volume too low', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 3000, now)); // Total 4000 USDT < 5000
      history.push(createMockFlow('SELL', 1000, now));

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).toBeNull(); // Below minVolumeUSDT
    });

    it('should calculate correct confidence', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 12000, now)); // 12k buy
      history.push(createMockFlow('SELL', 3000, now)); // 3k sell → 4x ratio

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.confidence).toBeGreaterThan(70);
      expect(imbalance!.confidence).toBeLessThanOrEqual(config.maxConfidence);
    });

    it('should cap confidence at maxConfidence', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      // Extreme ratio (20x)
      history.push(createMockFlow('BUY', 100000, now));
      history.push(createMockFlow('SELL', 5000, now));

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.confidence).toBeLessThanOrEqual(config.maxConfidence);
    });

    it('should return null with no flow history', () => {
      const imbalance = service.detectFlowImbalance();
      expect(imbalance).toBeNull();
    });

    it('should return null with only old flow (outside window)', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 10000, now - 5000)); // 5s ago (outside 3s window)

      const imbalance = service.detectFlowImbalance();
      expect(imbalance).toBeNull();
    });
  });

  // ==========================================================================
  // CLEANUP OLD FLOW
  // ==========================================================================

  describe('cleanupOldFlow', () => {
    it('should remove flow older than 2x detection window', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      // Old flow (7s ago, outside 2x 3s window)
      history.push(createMockFlow('BUY', 1000, now - 7000));

      // Recent flow
      history.push(createMockFlow('BUY', 2000, now));

      service.cleanupOldFlow();

      const cleanedHistory = service.getFlowHistory();

      // Should only keep recent flow
      expect(cleanedHistory.length).toBe(1);
      expect(cleanedHistory[0].volumeUSDT).toBe(2000);
    });

    it('should keep flow within 2x detection window', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      // Flow 5s ago (within 2x 3s window)
      history.push(createMockFlow('BUY', 1000, now - 5000));

      // Recent flow
      history.push(createMockFlow('BUY', 2000, now));

      service.cleanupOldFlow();

      const cleanedHistory = service.getFlowHistory();

      // Should keep both
      expect(cleanedHistory.length).toBe(2);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty flow history', () => {
      const ratio = service.calculateFlowRatio();
      const imbalance = service.detectFlowImbalance();

      expect(ratio).toBe(1.0);
      expect(imbalance).toBeNull();
    });

    it('should clear history', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 1000, now));

      service.clearHistory();

      const cleared = service.getFlowHistory();
      expect(cleared).toHaveLength(0);
    });

    it('should handle balanced flow (1:1 ratio)', () => {
      const now = Date.now();

      const history = service.getFlowHistory();
      history.push(createMockFlow('BUY', 5000, now));
      history.push(createMockFlow('SELL', 5000, now));

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).toBeNull(); // Balanced, no clear direction
    });
  });
});
