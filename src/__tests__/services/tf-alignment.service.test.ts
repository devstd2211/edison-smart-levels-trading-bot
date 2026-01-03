/**
 * Tests for TFAlignmentService
 * PHASE 6: Multi-Timeframe Optimization
 */

import { TFAlignmentService } from '../../services/tf-alignment.service';
import { LoggerService, LogLevel, TFAlignmentConfig } from '../../types';

describe('TFAlignmentService', () => {
  let service: TFAlignmentService;
  let logger: LoggerService;
  let config: TFAlignmentConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = {
      enabled: true,
      timeframes: {
        entry: { weight: 20 },
        primary: { weight: 50 },
        trend1: { weight: 30 },
      },
      minAlignmentScore: 70,
    };
    service = new TFAlignmentService(config, logger);
  });

  describe('calculateAlignment - LONG', () => {
    it('should return perfect score when all timeframes align (LONG)', () => {
      const result = service.calculateAlignment('LONG', 100, {
        entry: { ema20: 99 }, // Price > EMA20 ✅
        primary: { ema20: 98, ema50: 97 }, // Price > both EMAs ✅
        trend1: { ema20: 99, ema50: 96 }, // EMA20 > EMA50 ✅
      });

      expect(result.score).toBe(100); // 20 + 50 + 30
      expect(result.aligned).toBe(true);
      expect(result.contributions.entry).toBe(20);
      expect(result.contributions.primary).toBe(50); // 30 (EMA20) + 20 (EMA50)
      expect(result.contributions.trend1).toBe(30);
    });

    it('should return partial score when entry TF not aligned (LONG)', () => {
      const result = service.calculateAlignment('LONG', 100, {
        entry: { ema20: 101 }, // Price < EMA20 ❌
        primary: { ema20: 98, ema50: 97 }, // Price > both EMAs ✅
        trend1: { ema20: 99, ema50: 96 }, // EMA20 > EMA50 ✅
      });

      expect(result.score).toBe(80); // 0 + 50 + 30
      expect(result.aligned).toBe(true); // Still above threshold (70)
      expect(result.contributions.entry).toBe(0);
    });

    it('should return partial score when primary TF partially aligned (LONG)', () => {
      const result = service.calculateAlignment('LONG', 100, {
        entry: { ema20: 99 }, // Price > EMA20 ✅
        primary: { ema20: 98, ema50: 101 }, // Price > EMA20 ✅, Price < EMA50 ❌
        trend1: { ema20: 99, ema50: 96 }, // EMA20 > EMA50 ✅
      });

      expect(result.score).toBe(80); // 20 + 30 + 30
      expect(result.aligned).toBe(true);
      expect(result.contributions.primary).toBeCloseTo(30, 0); // Only EMA20 (60% of 50)
    });

    it('should return partial score when trend1 TF not aligned (LONG)', () => {
      const result = service.calculateAlignment('LONG', 100, {
        entry: { ema20: 99 }, // Price > EMA20 ✅
        primary: { ema20: 98, ema50: 97 }, // Price > both EMAs ✅
        trend1: { ema20: 95, ema50: 96 }, // EMA20 < EMA50 ❌
      });

      expect(result.score).toBe(70); // 20 + 50 + 0
      expect(result.aligned).toBe(true); // Exactly at threshold
      expect(result.contributions.trend1).toBe(0);
    });

    it('should return not aligned when score below threshold (LONG)', () => {
      const result = service.calculateAlignment('LONG', 100, {
        entry: { ema20: 101 }, // Price < EMA20 ❌
        primary: { ema20: 101, ema50: 102 }, // Price < both EMAs ❌
        trend1: { ema20: 95, ema50: 96 }, // EMA20 < EMA50 ❌
      });

      expect(result.score).toBe(0); // 0 + 0 + 0
      expect(result.aligned).toBe(false); // Below threshold (70)
    });
  });

  describe('calculateAlignment - SHORT', () => {
    it('should return perfect score when all timeframes align (SHORT)', () => {
      const result = service.calculateAlignment('SHORT', 100, {
        entry: { ema20: 101 }, // Price < EMA20 ✅
        primary: { ema20: 102, ema50: 103 }, // Price < both EMAs ✅
        trend1: { ema20: 99, ema50: 100 }, // EMA20 < EMA50 ✅
      });

      expect(result.score).toBe(100); // 20 + 50 + 30
      expect(result.aligned).toBe(true);
      expect(result.contributions.entry).toBe(20);
      expect(result.contributions.primary).toBe(50);
      expect(result.contributions.trend1).toBe(30);
    });

    it('should return partial score when entry TF not aligned (SHORT)', () => {
      const result = service.calculateAlignment('SHORT', 100, {
        entry: { ema20: 99 }, // Price > EMA20 ❌
        primary: { ema20: 102, ema50: 103 }, // Price < both EMAs ✅
        trend1: { ema20: 99, ema50: 100 }, // EMA20 < EMA50 ✅
      });

      expect(result.score).toBe(80); // 0 + 50 + 30
      expect(result.aligned).toBe(true);
      expect(result.contributions.entry).toBe(0);
    });

    it('should return partial score when primary TF partially aligned (SHORT)', () => {
      const result = service.calculateAlignment('SHORT', 100, {
        entry: { ema20: 101 }, // Price < EMA20 ✅
        primary: { ema20: 102, ema50: 99 }, // Price < EMA20 ✅, Price > EMA50 ❌
        trend1: { ema20: 99, ema50: 100 }, // EMA20 < EMA50 ✅
      });

      expect(result.score).toBe(80); // 20 + 30 + 30
      expect(result.aligned).toBe(true);
      expect(result.contributions.primary).toBeCloseTo(30, 0); // Only EMA20
    });

    it('should return partial score when trend1 TF not aligned (SHORT)', () => {
      const result = service.calculateAlignment('SHORT', 100, {
        entry: { ema20: 101 }, // Price < EMA20 ✅
        primary: { ema20: 102, ema50: 103 }, // Price < both EMAs ✅
        trend1: { ema20: 101, ema50: 100 }, // EMA20 > EMA50 ❌
      });

      expect(result.score).toBe(70); // 20 + 50 + 0
      expect(result.aligned).toBe(true);
      expect(result.contributions.trend1).toBe(0);
    });
  });

  describe('disabled mode', () => {
    it('should return disabled result when service disabled', () => {
      const disabledConfig: TFAlignmentConfig = {
        enabled: false,
        timeframes: {
          entry: { weight: 20 },
          primary: { weight: 50 },
          trend1: { weight: 30 },
        },
        minAlignmentScore: 70,
      };

      const disabledService = new TFAlignmentService(disabledConfig, logger);

      const result = disabledService.calculateAlignment('LONG', 100, {
        entry: { ema20: 99 },
        primary: { ema20: 98, ema50: 97 },
        trend1: { ema20: 99, ema50: 96 },
      });

      expect(result.score).toBe(0);
      expect(result.aligned).toBe(false);
      expect(result.details).toBe('TF Alignment disabled');
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const returnedConfig = service.getConfig();

      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config); // Should be a copy
    });
  });

  describe('edge cases', () => {
    it('should handle exact EMA values (price = EMA)', () => {
      const result = service.calculateAlignment('LONG', 100, {
        entry: { ema20: 100 }, // Price = EMA20
        primary: { ema20: 100, ema50: 100 }, // Price = both EMAs
        trend1: { ema20: 100, ema50: 100 }, // EMA20 = EMA50
      });

      // For LONG: price > EMA (100 > 100 = false)
      expect(result.contributions.entry).toBe(0);
      expect(result.contributions.primary).toBe(0);
      expect(result.contributions.trend1).toBe(0);
    });

    it('should handle custom minAlignmentScore threshold', () => {
      const customConfig: TFAlignmentConfig = {
        enabled: true,
        timeframes: {
          entry: { weight: 20 },
          primary: { weight: 50 },
          trend1: { weight: 30 },
        },
        minAlignmentScore: 50, // Lower threshold
      };

      const customService = new TFAlignmentService(customConfig, logger);

      const result = customService.calculateAlignment('LONG', 100, {
        entry: { ema20: 101 }, // ❌
        primary: { ema20: 98, ema50: 97 }, // ✅
        trend1: { ema20: 95, ema50: 96 }, // ❌
      });

      expect(result.score).toBe(50);
      expect(result.aligned).toBe(true); // Meets lower threshold
    });
  });
});
