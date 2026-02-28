/**
 * Tests for ConfidenceHelper
 */

import { ConfidenceHelper } from '../../utils/confidence.helper';

describe('ConfidenceHelper', () => {
  describe('normalize', () => {
    it('should keep 0.75 as 0.75 (0.0-1.0 range)', () => {
      expect(ConfidenceHelper.normalize(0.75)).toBe(0.75);
    });

    it('should keep 1.0 as 1.0', () => {
      expect(ConfidenceHelper.normalize(1.0)).toBe(1.0);
    });

    it('should keep 0.3 as 0.3', () => {
      expect(ConfidenceHelper.normalize(0.3)).toBe(0.3);
    });

    it('should clamp values below 0.3 to 0.3', () => {
      expect(ConfidenceHelper.normalize(0.2)).toBe(0.3);
      expect(ConfidenceHelper.normalize(0.1)).toBe(0.3);
      expect(ConfidenceHelper.normalize(0)).toBe(0.3);
      expect(ConfidenceHelper.normalize(-0.5)).toBe(0.3);
    });

    it('should clamp values above 1.0 to 1.0', () => {
      expect(ConfidenceHelper.normalize(1.1)).toBe(1.0);
      expect(ConfidenceHelper.normalize(1.5)).toBe(1.0);
      expect(ConfidenceHelper.normalize(2.0)).toBe(1.0);
    });

    it('should handle edge case: exactly 0.3', () => {
      expect(ConfidenceHelper.normalize(0.3)).toBe(0.3);
    });

    it('should handle edge case: exactly 1.0', () => {
      expect(ConfidenceHelper.normalize(1.0)).toBe(1.0);
    });

    it('should handle decimal precision', () => {
      expect(ConfidenceHelper.normalize(0.825)).toBe(0.825);
      expect(ConfidenceHelper.normalize(0.9666666666666666)).toBeCloseTo(0.9667, 4);
    });
  });

  describe('meetsThreshold', () => {
    it('should return true when confidence meets threshold', () => {
      expect(ConfidenceHelper.meetsThreshold(0.75, 0.5)).toBe(true);
      expect(ConfidenceHelper.meetsThreshold(0.5, 0.5)).toBe(true);
    });

    it('should return false when confidence below threshold', () => {
      expect(ConfidenceHelper.meetsThreshold(0.45, 0.5)).toBe(false);
      expect(ConfidenceHelper.meetsThreshold(0.499, 0.5)).toBe(false);
    });

    it('should use default threshold of 0.5', () => {
      expect(ConfidenceHelper.meetsThreshold(0.6)).toBe(true);
      expect(ConfidenceHelper.meetsThreshold(0.4)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(ConfidenceHelper.meetsThreshold(1.0, 1.0)).toBe(true);
      expect(ConfidenceHelper.meetsThreshold(0.3, 0.3)).toBe(true);
      expect(ConfidenceHelper.meetsThreshold(0, 0)).toBe(true);
    });
  });

  describe('getLevel', () => {
    it('should return LOW for confidence < 0.5', () => {
      expect(ConfidenceHelper.getLevel(0.3)).toBe('LOW');
      expect(ConfidenceHelper.getLevel(0.45)).toBe('LOW');
      expect(ConfidenceHelper.getLevel(0.499)).toBe('LOW');
    });

    it('should return MEDIUM for confidence 0.5-0.79', () => {
      expect(ConfidenceHelper.getLevel(0.5)).toBe('MEDIUM');
      expect(ConfidenceHelper.getLevel(0.65)).toBe('MEDIUM');
      expect(ConfidenceHelper.getLevel(0.799)).toBe('MEDIUM');
    });

    it('should return HIGH for confidence >= 0.8', () => {
      expect(ConfidenceHelper.getLevel(0.8)).toBe('HIGH');
      expect(ConfidenceHelper.getLevel(0.9)).toBe('HIGH');
      expect(ConfidenceHelper.getLevel(1.0)).toBe('HIGH');
    });
  });

  describe('format', () => {
    it('should format with 1 decimal by default', () => {
      expect(ConfidenceHelper.format(0.755)).toBe('75.5%');
      expect(ConfidenceHelper.format(0.75567)).toBe('75.6%');
    });

    it('should format with custom decimals', () => {
      expect(ConfidenceHelper.format(0.75567, 2)).toBe('75.57%');
      expect(ConfidenceHelper.format(0.75567, 0)).toBe('76%');
    });

    it('should handle whole numbers', () => {
      expect(ConfidenceHelper.format(0.75)).toBe('75.0%');
      expect(ConfidenceHelper.format(1.0, 0)).toBe('100%');
    });
  });

  describe('combine', () => {
    it('should return simple average for equal scores', () => {
      expect(ConfidenceHelper.combine([0.8, 0.6, 0.7])).toBeCloseTo(0.7, 2);
    });

    it('should return weighted average when weights provided', () => {
      // (0.8 * 2 + 0.6 * 1) / 3 = 2.2 / 3 = 0.7333
      expect(ConfidenceHelper.combine([0.8, 0.6], [2, 1])).toBeCloseTo(0.733, 2);
    });

    it('should handle single score', () => {
      expect(ConfidenceHelper.combine([0.75])).toBe(0.75);
    });

    it('should return MIN_CONFIDENCE for empty array', () => {
      expect(ConfidenceHelper.combine([])).toBe(0.3);
    });

    it('should return MIN_CONFIDENCE when total weight is zero', () => {
      expect(ConfidenceHelper.combine([0.8, 0.6], [0, 0])).toBe(0.3);
    });

    it('should ignore weights if length mismatch', () => {
      // Falls back to simple average
      expect(ConfidenceHelper.combine([0.8, 0.6, 0.7], [2, 1])).toBeCloseTo(0.7, 2);
    });

    it('should handle all equal weights (same as simple average)', () => {
      const result = ConfidenceHelper.combine([0.8, 0.6, 0.7], [1, 1, 1]);
      expect(result).toBeCloseTo(0.7, 2);
    });

    it('should heavily weight one score', () => {
      // (0.9 * 10 + 0.5 * 1) / 11 = 9.5 / 11 = 0.863
      const result = ConfidenceHelper.combine([0.9, 0.5], [10, 1]);
      expect(result).toBeCloseTo(0.863, 2);
    });
  });

  describe('integration: normalize + combine', () => {
    it('should combine and normalize multiple factors', () => {
      const trendConfidence = 0.8;
      const levelConfidence = 0.7;
      const rsiConfidence = 0.6;

      const combined = ConfidenceHelper.combine([trendConfidence, levelConfidence, rsiConfidence]);
      const normalized = ConfidenceHelper.normalize(combined);

      expect(normalized).toBeCloseTo(0.7, 2); // Average 0.7 stays 0.7
    });

    it('should handle weighted combination then normalize', () => {
      const trendConfidence = 0.9;
      const levelConfidence = 0.5;

      // Trend is more important (weight 3 vs 1)
      const combined = ConfidenceHelper.combine([trendConfidence, levelConfidence], [3, 1]);
      const normalized = ConfidenceHelper.normalize(combined);

      // (0.9*3 + 0.5*1) / 4 = 3.2 / 4 = 0.8
      expect(normalized).toBeCloseTo(0.8, 2);
    });
  });
});
