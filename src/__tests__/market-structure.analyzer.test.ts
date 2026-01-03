/**
 * Market Structure Analyzer Tests
 */

import { MarketStructureAnalyzer } from '../analyzers/market-structure.analyzer';
import { SwingPoint, SwingPointType, MarketStructure, TrendBias, LogLevel, MarketStructureConfig } from '../types';
import { LoggerService } from '../services/logger.service';

// Default config for tests
const defaultConfig: MarketStructureConfig = {
  chochAlignedBoost: 1.3,
  chochAgainstPenalty: 0.5,
  bosAlignedBoost: 1.1,
  noModification: 1.0,
};

describe('MarketStructureAnalyzer', () => {
  let analyzer: MarketStructureAnalyzer;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR);
    analyzer = new MarketStructureAnalyzer(defaultConfig, logger);
  });

  describe('identifyStructure', () => {
    it('should identify Higher High (HH)', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 105, timestamp: 2000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBe(MarketStructure.HIGHER_HIGH);
    });

    it('should identify Higher Low (HL)', () => {
      const highs: SwingPoint[] = [];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 1000, type: SwingPointType.LOW },
        { price: 95, timestamp: 2000, type: SwingPointType.LOW },
      ];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBe(MarketStructure.HIGHER_LOW);
    });

    it('should identify Lower High (LH)', () => {
      const highs: SwingPoint[] = [
        { price: 105, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100, timestamp: 2000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBe(MarketStructure.LOWER_HIGH);
    });

    it('should identify Lower Low (LL)', () => {
      const highs: SwingPoint[] = [];
      const lows: SwingPoint[] = [
        { price: 95, timestamp: 1000, type: SwingPointType.LOW },
        { price: 90, timestamp: 2000, type: SwingPointType.LOW },
      ];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBe(MarketStructure.LOWER_LOW);
    });

    it('should identify Equal High (EH)', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100.05, timestamp: 2000, type: SwingPointType.HIGH }, // Within 0.1% threshold
      ];
      const lows: SwingPoint[] = [];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBe(MarketStructure.EQUAL_HIGH);
    });

    it('should identify Equal Low (EL)', () => {
      const highs: SwingPoint[] = [];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 1000, type: SwingPointType.LOW },
        { price: 90.05, timestamp: 2000, type: SwingPointType.LOW }, // Within 0.1% threshold
      ];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBe(MarketStructure.EQUAL_LOW);
    });

    it('should return null if not enough points', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [];

      const structure = analyzer.identifyStructure(highs, lows);
      expect(structure).toBeNull();
    });
  });

  describe('getLastPattern', () => {
    it('should identify HH_HL pattern (bullish trend)', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 110, timestamp: 3000, type: SwingPointType.HIGH }, // Higher High
      ];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 500, type: SwingPointType.LOW },
        { price: 95, timestamp: 2000, type: SwingPointType.LOW }, // Higher Low
      ];

      const pattern = analyzer.getLastPattern(highs, lows);
      expect(pattern).toBe('HH_HL');
    });

    it('should identify LH_LL pattern (bearish trend)', () => {
      const highs: SwingPoint[] = [
        { price: 110, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100, timestamp: 3000, type: SwingPointType.HIGH }, // Lower High
      ];
      const lows: SwingPoint[] = [
        { price: 95, timestamp: 500, type: SwingPointType.LOW },
        { price: 85, timestamp: 2000, type: SwingPointType.LOW }, // Lower Low
      ];

      const pattern = analyzer.getLastPattern(highs, lows);
      expect(pattern).toBe('LH_LL');
    });

    it('should identify FLAT pattern', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100.05, timestamp: 3000, type: SwingPointType.HIGH }, // Equal High
      ];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 500, type: SwingPointType.LOW },
        { price: 90.05, timestamp: 2000, type: SwingPointType.LOW }, // Equal Low
      ];

      const pattern = analyzer.getLastPattern(highs, lows);
      expect(pattern).toBe('FLAT');
    });

    it('should return null if not enough points', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 500, type: SwingPointType.LOW },
      ];

      const pattern = analyzer.getLastPattern(highs, lows);
      expect(pattern).toBeNull();
    });

    it('should return null for mixed unclear structure', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 110, timestamp: 3000, type: SwingPointType.HIGH }, // HH
      ];
      const lows: SwingPoint[] = [
        { price: 95, timestamp: 500, type: SwingPointType.LOW },
        { price: 85, timestamp: 2000, type: SwingPointType.LOW }, // LL (conflicting)
      ];

      const pattern = analyzer.getLastPattern(highs, lows);
      expect(pattern).toBeNull();
    });
  });

  describe('getTrendBias', () => {
    it('should return BULLISH for HH_HL pattern', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 110, timestamp: 3000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 500, type: SwingPointType.LOW },
        { price: 95, timestamp: 2000, type: SwingPointType.LOW },
      ];

      const bias = analyzer.getTrendBias(highs, lows);
      expect(bias).toBe(TrendBias.BULLISH);
    });

    it('should return BEARISH for LH_LL pattern', () => {
      const highs: SwingPoint[] = [
        { price: 110, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100, timestamp: 3000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [
        { price: 95, timestamp: 500, type: SwingPointType.LOW },
        { price: 85, timestamp: 2000, type: SwingPointType.LOW },
      ];

      const bias = analyzer.getTrendBias(highs, lows);
      expect(bias).toBe(TrendBias.BEARISH);
    });

    it('should return NEUTRAL for FLAT pattern', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100.05, timestamp: 3000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 500, type: SwingPointType.LOW },
        { price: 90.05, timestamp: 2000, type: SwingPointType.LOW },
      ];

      const bias = analyzer.getTrendBias(highs, lows);
      expect(bias).toBe(TrendBias.NEUTRAL);
    });

    it('should return NEUTRAL for unclear pattern', () => {
      const highs: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
      ];
      const lows: SwingPoint[] = [
        { price: 90, timestamp: 500, type: SwingPointType.LOW },
      ];

      const bias = analyzer.getTrendBias(highs, lows);
      expect(bias).toBe(TrendBias.NEUTRAL);
    });
  });
});
