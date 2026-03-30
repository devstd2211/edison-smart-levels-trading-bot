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
  OrderFlowAnalyzerConfig,
  SignalDirection,
} from '../../types/legacy';
import {
  createMockFlow,
  createMockOrderbook,
  type ManagedOrderFlowAnalyzerContext,
  createManagedOrderFlowAnalyzerContext,
  createOrderFlowSeries,
  createOrderFlowUpdateSeries,
  seedOrderFlowHistory,
} from '../helpers/order-flow-analyzer-test.utils';

describe('OrderFlowAnalyzerService', () => {
  let service: OrderFlowAnalyzerService;
  let config: OrderFlowAnalyzerConfig;

  type OrderFlowAnalyzerFixtures = Pick<
    ManagedOrderFlowAnalyzerContext,
    'service' | 'config'
  >;

  function bindOrderFlowAnalyzerFixtures() {
    let fixtures: OrderFlowAnalyzerFixtures;
    let cleanup: ManagedOrderFlowAnalyzerContext['cleanup'];

    beforeEach(() => {
      const context = createManagedOrderFlowAnalyzerContext();
      fixtures = {
        service: context.service,
        config: context.config,
      };
      cleanup = context.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindOrderFlowAnalyzerFixtures();

  beforeEach(() => {
    const fixtures = getFixtures();
    service = fixtures.service;
    config = fixtures.config;
  });

  describe('processOrderbookUpdate', () => {
    it('should store first orderbook update without detecting flow', () => {
      const orderbook = createMockOrderbook(1.0, 100, 1.001, 100);

      service.processOrderbookUpdate(orderbook);

      const history = service.getFlowHistory();
      expect(history).toHaveLength(0);
    });

    it('should detect aggressive BUY when price rises and asks removed', () => {
      const [orderbook1, orderbook2] = createOrderFlowUpdateSeries([
        [1.0, 100, 1.001, 100],
        [1.001, 100, 1.002, 50],
      ]);

      service.processOrderbookUpdate(orderbook1);
      service.processOrderbookUpdate(orderbook2);

      const history = service.getFlowHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].direction).toBe('BUY');
    });

    it('should detect aggressive SELL when price falls and bids removed', () => {
      const [orderbook1, orderbook2] = createOrderFlowUpdateSeries([
        [1.0, 100, 1.001, 100],
        [0.999, 50, 1.0, 100],
      ]);

      service.processOrderbookUpdate(orderbook1);
      service.processOrderbookUpdate(orderbook2);

      const history = service.getFlowHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].direction).toBe('SELL');
    });

    it('should NOT detect flow when price moves but no volume removed', () => {
      const [orderbook1, orderbook2] = createOrderFlowUpdateSeries([
        [1.0, 100, 1.001, 100],
        [1.0, 100, 1.001, 100],
      ]);

      service.processOrderbookUpdate(orderbook1);
      service.processOrderbookUpdate(orderbook2);

      const history = service.getFlowHistory();
      expect(history).toHaveLength(0);
    });

    it('should accumulate multiple flow events', () => {
      createOrderFlowUpdateSeries([
        [1.0, 100, 1.001, 100],
        [1.001, 100, 1.002, 80],
        [1.002, 100, 1.003, 90],
        [1.003, 100, 1.004, 70],
      ]).forEach((orderbook) => service.processOrderbookUpdate(orderbook));

      const history = service.getFlowHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('calculateFlowRatio', () => {
    it('should return neutral ratio (1.0) with no flow', () => {
      const ratio = service.calculateFlowRatio();
      expect(ratio).toBe(1.0);
    });

    it('should calculate ratio with more aggressive buys', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([6000, 4000], [2000], now));

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBeCloseTo(5.0, 1);
    });

    it('should calculate ratio with more aggressive sells', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([2000], [6000, 4000], now));

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBeCloseTo(0.2, 1);
    });

    it('should return max ratio (999) with only buy flow', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([3000, 2000], [], now));

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBe(999);
    });

    it('should return min ratio (0.001) with only sell flow', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([], [3000, 2000], now));

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBe(0.001);
    });

    it('should only count flow within time window', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, [
        createMockFlow('BUY', 10000, now - 5000),
        ...createOrderFlowSeries([3000], [1000], now),
      ]);

      const ratio = service.calculateFlowRatio();
      expect(ratio).toBeCloseTo(3.0, 1);
    });
  });

  describe('detectFlowImbalance', () => {
    it('should detect BUY imbalance (3x ratio)', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([9000], [3000], now));

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.direction).toBe(SignalDirection.LONG);
      expect(imbalance!.ratio).toBeCloseTo(3.0, 1);
      expect(imbalance!.totalVolumeUSDT).toBe(12000);
      expect(imbalance!.confidence).toBeGreaterThan(0);
    });

    it('should detect SELL imbalance (inverse 3x ratio)', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([2000], [6000], now));

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.direction).toBe(SignalDirection.SHORT);
      expect(imbalance!.ratio).toBeCloseTo(3.0, 1);
    });

    it('should NOT detect imbalance if ratio too weak (2x < 3x)', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([6000], [3000], now));

      const imbalance = service.detectFlowImbalance();
      expect(imbalance).toBeNull();
    });

    it('should NOT detect imbalance if volume too low', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([3000], [1000], now));

      const imbalance = service.detectFlowImbalance();
      expect(imbalance).toBeNull();
    });

    it('should calculate correct confidence', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([12000], [3000], now));

      const imbalance = service.detectFlowImbalance();

      expect(imbalance).not.toBeNull();
      expect(imbalance!.confidence).toBeGreaterThan(70);
      expect(imbalance!.confidence).toBeLessThanOrEqual(config.maxConfidence);
    });

    it('should cap confidence at maxConfidence', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([100000], [5000], now));

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
      seedOrderFlowHistory(service, [createMockFlow('BUY', 10000, now - 5000)]);

      const imbalance = service.detectFlowImbalance();
      expect(imbalance).toBeNull();
    });
  });

  describe('cleanupOldFlow', () => {
    it('should remove flow older than 2x detection window', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, [
        createMockFlow('BUY', 1000, now - 7000),
        createMockFlow('BUY', 2000, now),
      ]);

      service.cleanupOldFlow();

      const cleanedHistory = service.getFlowHistory();
      expect(cleanedHistory.length).toBe(1);
      expect(cleanedHistory[0].volumeUSDT).toBe(2000);
    });

    it('should keep flow within 2x detection window', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, [
        createMockFlow('BUY', 1000, now - 5000),
        createMockFlow('BUY', 2000, now),
      ]);

      service.cleanupOldFlow();

      const cleanedHistory = service.getFlowHistory();
      expect(cleanedHistory.length).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty flow history', () => {
      const ratio = service.calculateFlowRatio();
      const imbalance = service.detectFlowImbalance();

      expect(ratio).toBe(1.0);
      expect(imbalance).toBeNull();
    });

    it('should clear history', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, [createMockFlow('BUY', 1000, now)]);

      service.clearHistory();

      const cleared = service.getFlowHistory();
      expect(cleared).toHaveLength(0);
    });

    it('should handle balanced flow (1:1 ratio)', () => {
      const now = Date.now();
      seedOrderFlowHistory(service, createOrderFlowSeries([5000], [5000], now));

      const imbalance = service.detectFlowImbalance();
      expect(imbalance).toBeNull();
    });
  });
});
