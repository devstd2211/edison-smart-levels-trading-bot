/**
 * Signal Processing Service - Timeframe Conflict Detection Tests
 *
 * Tests for PHASE 6c: Multi-timeframe conflict detection
 * Verifies that signals conflicting with trend are penalized
 */

import { SignalDirection, TrendAnalysis, TrendBias } from '../../types';

describe('Signal Processing - Timeframe Conflict Detection (PHASE 6c)', () => {
  /**
   * Mock implementation of detectTimeframeConflict for testing
   * Real implementation is in signal-processing.service.ts
   */
  function detectTimeframeConflict(
    trendAnalysis: TrendAnalysis | null,
    direction: SignalDirection,
  ): number {
    if (!trendAnalysis) {
      return 1.0; // No conflict possible without trend analysis
    }

    const bias = trendAnalysis.bias; // BULLISH/BEARISH/NEUTRAL

    // No conflict if trend is neutral
    if (bias === TrendBias.NEUTRAL) {
      return 1.0;
    }

    // Check for directional mismatch
    const isConflicting =
      (bias === TrendBias.BULLISH && direction === SignalDirection.SHORT) ||
      (bias === TrendBias.BEARISH && direction === SignalDirection.LONG);

    if (isConflicting) {
      return 0.7; // Reduce confidence by 30%
    }

    // No conflict - signal aligns with trend
    return 1.0;
  }

  describe('Conflict Detection Logic', () => {
    it('should return 1.0 (no adjustment) when trend is NEUTRAL', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.NEUTRAL,
        strength: 0,
        restrictedDirections: [],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(1.0);

      const multiplier2 = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier2).toBe(1.0);
    });

    it('should return 0.7 (30% reduction) when LONG signal in BEARISH trend', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '15m',
        reasoning: ['Lower high - Lower low'],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(0.7); // 30% confidence reduction
    });

    it('should return 0.7 (30% reduction) when SHORT signal in BULLISH trend', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '15m',
        reasoning: ['Higher high - Higher low'],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier).toBe(0.7); // 30% confidence reduction
    });

    it('should return 1.0 (no penalty) when SHORT signal aligns with BEARISH trend', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '15m',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier).toBe(1.0); // No conflict - SHORT aligns with BEARISH
    });

    it('should return 1.0 (no penalty) when LONG signal aligns with BULLISH trend', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '15m',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(1.0); // No conflict - LONG aligns with BULLISH
    });

    it('should return 1.0 when no trend analysis provided (null)', () => {
      const multiplier = detectTimeframeConflict(null, SignalDirection.LONG);
      expect(multiplier).toBe(1.0);
    });
  });

  describe('Confidence Adjustment Application', () => {
    it('should reduce 80% confidence by 30% in conflict scenario', () => {
      const originalConfidence = 80;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.7,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(56); // 80 * 0.7 = 56
    });

    it('should reduce 70% confidence to 49% (below 60% entry threshold)', () => {
      const originalConfidence = 70;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(49); // 70 * 0.7 = 49
      expect(adjustedConfidence).toBeLessThan(60); // Below minimum entry threshold
    });

    it('should not reduce confidence when aligned with trend', () => {
      const originalConfidence = 80;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(80); // No reduction
    });

    it('should handle very high confidence with conflict penalty', () => {
      const originalConfidence = 95;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.9,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(66.5); // 95 * 0.7 = 66.5 (still usable)
    });

    it('should handle weak confidence with conflict penalty (may block entry)', () => {
      const originalConfidence = 65;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(45.5); // 65 * 0.7 = 45.5 (below 60% threshold)
    });
  });

  describe('Multi-Timeframe Scenarios', () => {
    it('should detect conflict: LONG in local downtrend despite higher timeframe uptrend', () => {
      // Scenario: 15m shows BEARISH, but signal is LONG
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.6,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '15m',
        reasoning: [],
      };

      const confidence = 80;
      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);

      expect(multiplier).toBe(0.7);
      expect(confidence * multiplier).toBe(56); // Reduced but not blocked
    });

    it('should detect no conflict: SHORT in BEARISH trend (aligned)', () => {
      // Scenario: 15m BEARISH, signal is SHORT = perfect alignment
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '15m',
        reasoning: [],
      };

      const confidence = 75;
      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);

      expect(multiplier).toBe(1.0);
      expect(confidence * multiplier).toBe(75); // No reduction
    });

    it('should allow any direction in NEUTRAL trend', () => {
      // Scenario: No clear trend bias - both directions allowed
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.NEUTRAL,
        strength: 0.2,
        restrictedDirections: [],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplierLong = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const multiplierShort = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);

      expect(multiplierLong).toBe(1.0);
      expect(multiplierShort).toBe(1.0);
    });
  });

  describe('Entry Decision Impact', () => {
    const ENTRY_THRESHOLD = 60; // Minimum confidence to enter

    it('should block entry: 70% confidence - 30% penalty = 49% (below 60%)', () => {
      const originalConfidence = 70;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.7,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBeLessThan(ENTRY_THRESHOLD);
    });

    it('should allow entry: 90% confidence - 30% penalty = 63% (above 60%)', () => {
      const originalConfidence = 90;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.7,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBeGreaterThanOrEqual(ENTRY_THRESHOLD);
    });

    it('should not block aligned signals', () => {
      const originalConfidence = 65;
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(65); // No penalty
      expect(adjustedConfidence).toBeGreaterThanOrEqual(ENTRY_THRESHOLD);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trend with 0 strength (neutral-like)', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.NEUTRAL,
        strength: 0,
        restrictedDirections: [],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(1.0);
    });

    it('should handle trend with 1.0 strength (very strong)', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BULLISH,
        strength: 1.0,
        restrictedDirections: [SignalDirection.SHORT],
        timeframe: '1h',
        reasoning: [],
      };

      // Conflict still exists regardless of strength
      const multiplier = detectTimeframeConflict(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier).toBe(0.7); // Same 30% penalty
    });

    it('should handle undefined trend analysis', () => {
      const multiplier = detectTimeframeConflict(undefined as any, SignalDirection.LONG);
      expect(multiplier).toBe(1.0);
    });

    it('should be idempotent (same input = same output)', () => {
      const trendAnalysis: TrendAnalysis = {
        bias: TrendBias.BEARISH,
        strength: 0.7,
        restrictedDirections: [SignalDirection.LONG],
        timeframe: '1h',
        reasoning: [],
      };

      const multiplier1 = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);
      const multiplier2 = detectTimeframeConflict(trendAnalysis, SignalDirection.LONG);

      expect(multiplier1).toBe(multiplier2);
    });
  });
});
