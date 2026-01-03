/**
 * Orderbook Imbalance Service Tests (PHASE 4 Feature 4)
 * Tests bid/ask volume analysis for buy/sell pressure detection
 */

import { OrderbookImbalanceService } from '../../services/orderbook-imbalance.service';
import { OrderbookImbalanceConfig, LoggerService, LogLevel } from '../../types';

describe('OrderbookImbalanceService', () => {
  let service: OrderbookImbalanceService;
  let logger: LoggerService;
  let config: OrderbookImbalanceConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = {
      enabled: true,
      minImbalancePercent: 30, // 30% threshold for significant imbalance
      levels: 10, // Analyze top 10 levels
    };
    service = new OrderbookImbalanceService(config, logger);
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with disabled config', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledService = new OrderbookImbalanceService(disabledConfig, logger);
      expect(disabledService).toBeDefined();
    });
  });

  describe('analyze() - BID imbalance (buying pressure)', () => {
    it('should detect BID direction when bid volume > ask volume', () => {
      const orderbook = {
        bids: [
          [50000, 10] as [number, number], // Total bid volume: 35
          [49990, 15] as [number, number],
          [49980, 10] as [number, number],
        ],
        asks: [
          [50010, 3] as [number, number], // Total ask volume: 8
          [50020, 5] as [number, number],
        ],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=35, askVolume=8, total=43
      // imbalance = (35 - 8) / 43 * 100 = 62.8%
      expect(analysis.direction).toBe('BID');
      expect(analysis.bidVolume).toBe(35);
      expect(analysis.askVolume).toBe(8);
      expect(analysis.totalVolume).toBe(43);
      expect(analysis.imbalance).toBeCloseTo(62.8, 1);
      expect(analysis.strength).toBeCloseTo(62.8, 1);
    });

    it('should calculate correct strength for strong BID imbalance', () => {
      const orderbook = {
        bids: [[50000, 100] as [number, number]],
        asks: [[50010, 10] as [number, number]],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=100, askVolume=10, total=110
      // imbalance = (100 - 10) / 110 * 100 = 81.8%
      expect(analysis.direction).toBe('BID');
      expect(analysis.strength).toBeCloseTo(81.8, 1);
    });
  });

  describe('analyze() - ASK imbalance (selling pressure)', () => {
    it('should detect ASK direction when ask volume > bid volume', () => {
      const orderbook = {
        bids: [
          [50000, 5] as [number, number], // Total bid volume: 10
          [49990, 5] as [number, number],
        ],
        asks: [
          [50010, 20] as [number, number], // Total ask volume: 50
          [50020, 30] as [number, number],
        ],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=10, askVolume=50, total=60
      // imbalance = (10 - 50) / 60 * 100 = -66.7%
      expect(analysis.direction).toBe('ASK');
      expect(analysis.bidVolume).toBe(10);
      expect(analysis.askVolume).toBe(50);
      expect(analysis.totalVolume).toBe(60);
      expect(analysis.imbalance).toBeCloseTo(-66.7, 1);
      expect(analysis.strength).toBeCloseTo(66.7, 1); // Strength is absolute value
    });

    it('should calculate correct strength for strong ASK imbalance', () => {
      const orderbook = {
        bids: [[50000, 5] as [number, number]],
        asks: [[50010, 45] as [number, number]],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=5, askVolume=45, total=50
      // imbalance = (5 - 45) / 50 * 100 = -80%
      expect(analysis.direction).toBe('ASK');
      expect(analysis.strength).toBe(80);
    });
  });

  describe('analyze() - NEUTRAL (balanced)', () => {
    it('should detect NEUTRAL when volumes are balanced', () => {
      const orderbook = {
        bids: [[50000, 10] as [number, number]],
        asks: [[50010, 10] as [number, number]],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=10, askVolume=10, total=20
      // imbalance = (10 - 10) / 20 * 100 = 0%
      expect(analysis.direction).toBe('NEUTRAL'); // 0% < 30% threshold
      expect(analysis.imbalance).toBe(0);
      expect(analysis.strength).toBe(0);
    });

    it('should detect NEUTRAL when imbalance below threshold', () => {
      const orderbook = {
        bids: [[50000, 55] as [number, number]], // 55%
        asks: [[50010, 45] as [number, number]], // 45%
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=55, askVolume=45, total=100
      // imbalance = (55 - 45) / 100 * 100 = 10%
      expect(analysis.direction).toBe('NEUTRAL'); // 10% < 30% threshold
      expect(analysis.imbalance).toBe(10);
      expect(analysis.strength).toBe(10);
    });
  });

  describe('analyze() - threshold boundary', () => {
    it('should detect BID when imbalance exactly at threshold', () => {
      const orderbook = {
        bids: [[50000, 65] as [number, number]],
        asks: [[50010, 35] as [number, number]],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=65, askVolume=35, total=100
      // imbalance = (65 - 35) / 100 * 100 = 30%
      // Math.abs(30) < 30 = false → BID
      expect(analysis.direction).toBe('BID');
      expect(analysis.imbalance).toBe(30);
    });

    it('should detect NEUTRAL when imbalance just below threshold', () => {
      const orderbook = {
        bids: [[50000, 64] as [number, number]],
        asks: [[50010, 36] as [number, number]],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=64, askVolume=36, total=100
      // imbalance = (64 - 36) / 100 * 100 = 28%
      // Math.abs(28) < 30 = true → NEUTRAL
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.imbalance).toBeCloseTo(28, 1);
    });
  });

  describe('analyze() - levels parameter', () => {
    it('should analyze only top N levels', () => {
      const orderbook = {
        bids: [
          [50000, 10] as [number, number], // Level 1
          [49990, 10] as [number, number], // Level 2
          [49980, 10] as [number, number], // Level 3 (beyond config.levels=2)
        ],
        asks: [
          [50010, 5] as [number, number], // Level 1
          [50020, 5] as [number, number], // Level 2
          [50030, 5] as [number, number], // Level 3 (beyond config.levels=2)
        ],
      };

      const config2Levels = { ...config, levels: 2 };
      const service2Levels = new OrderbookImbalanceService(config2Levels, logger);
      const analysis = service2Levels.analyze(orderbook);

      // Only top 2 levels: bidVolume=20, askVolume=10
      expect(analysis.bidVolume).toBe(20);
      expect(analysis.askVolume).toBe(10);
    });
  });

  describe('analyze() - edge cases', () => {
    it('should handle empty orderbook', () => {
      const orderbook = {
        bids: [],
        asks: [],
      };

      const analysis = service.analyze(orderbook);

      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
      expect(analysis.totalVolume).toBe(0);
      expect(analysis.imbalance).toBe(0);
    });

    it('should handle orderbook with only bids', () => {
      const orderbook = {
        bids: [[50000, 10] as [number, number]],
        asks: [],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=10, askVolume=0, total=10
      // imbalance = (10 - 0) / 10 * 100 = 100%
      expect(analysis.direction).toBe('BID');
      expect(analysis.bidVolume).toBe(10);
      expect(analysis.askVolume).toBe(0);
      expect(analysis.imbalance).toBe(100);
      expect(analysis.strength).toBe(100);
    });

    it('should handle orderbook with only asks', () => {
      const orderbook = {
        bids: [],
        asks: [[50010, 10] as [number, number]],
      };

      const analysis = service.analyze(orderbook);

      // bidVolume=0, askVolume=10, total=10
      // imbalance = (0 - 10) / 10 * 100 = -100%
      expect(analysis.direction).toBe('ASK');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(10);
      expect(analysis.imbalance).toBe(-100);
      expect(analysis.strength).toBe(100);
    });

    it('should cap strength at 100', () => {
      const orderbook = {
        bids: [[50000, 1000] as [number, number]],
        asks: [],
      };

      const analysis = service.analyze(orderbook);

      // Imbalance = 100%, strength capped at 100
      expect(analysis.strength).toBe(100);
    });
  });

  describe('analyze() - disabled mode', () => {
    it('should return neutral analysis when disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledService = new OrderbookImbalanceService(disabledConfig, logger);

      const orderbook = {
        bids: [[50000, 100] as [number, number]], // Strong BID imbalance
        asks: [[50010, 10] as [number, number]],
      };

      const analysis = disabledService.analyze(orderbook);

      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
      expect(analysis.totalVolume).toBe(0);
      expect(analysis.imbalance).toBe(0);
      expect(analysis.strength).toBe(0);
    });
  });
});
