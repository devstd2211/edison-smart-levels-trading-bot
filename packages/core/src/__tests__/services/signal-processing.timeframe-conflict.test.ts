/**
 * Signal Processing Service - Timeframe Conflict Detection Tests
 *
 * Tests for PHASE 6c: Multi-timeframe conflict detection
 * Verifies that signals conflicting with trend are penalized via production utility logic
 */

import { SignalDirection, TrendAnalysis, TrendBias } from '../../types/legacy';
import { getTimeframeConflictMultiplier } from '../../services/signal-processing/timeframe-conflict.utils';

const NO_CONFLICT_MULTIPLIER = 1.0;
const CONFLICT_MULTIPLIER = 0.7;
const ENTRY_THRESHOLD = 60;

const createTrendAnalysis = (
  bias: TrendBias,
  timeframe: string,
  overrides: Partial<TrendAnalysis> = {},
): TrendAnalysis => ({
  bias,
  strength: bias === TrendBias.NEUTRAL ? 0 : 0.8,
  restrictedDirections:
    bias === TrendBias.BULLISH
      ? [SignalDirection.SHORT]
      : bias === TrendBias.BEARISH
        ? [SignalDirection.LONG]
        : [],
  timeframe,
  reasoning: [],
  ...overrides,
});

describe('Signal Processing - Timeframe Conflict Detection (PHASE 6c)', () => {
  describe('Conflict Detection Logic', () => {
    it('should return 1.0 (no adjustment) when trend is NEUTRAL', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.NEUTRAL, '1h');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(NO_CONFLICT_MULTIPLIER);

      const multiplier2 = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier2).toBe(NO_CONFLICT_MULTIPLIER);
    });

    it('should return 0.7 (30% reduction) when LONG signal in BEARISH trend', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '15m', {
        reasoning: ['Lower high - Lower low'],
      });

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(CONFLICT_MULTIPLIER); // 30% confidence reduction
    });

    it('should return 0.7 (30% reduction) when SHORT signal in BULLISH trend', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '15m', {
        reasoning: ['Higher high - Higher low'],
      });

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier).toBe(CONFLICT_MULTIPLIER); // 30% confidence reduction
    });

    it('should return 1.0 (no penalty) when SHORT signal aligns with BEARISH trend', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '15m');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier).toBe(NO_CONFLICT_MULTIPLIER); // No conflict - SHORT aligns with BEARISH
    });

    it('should return 1.0 (no penalty) when LONG signal aligns with BULLISH trend', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '15m');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(NO_CONFLICT_MULTIPLIER); // No conflict - LONG aligns with BULLISH
    });

    it('should return 1.0 when no trend analysis provided (null)', () => {
      const multiplier = getTimeframeConflictMultiplier(null, SignalDirection.LONG);
      expect(multiplier).toBe(NO_CONFLICT_MULTIPLIER);
    });
  });

  describe('Confidence Adjustment Application', () => {
    it('should reduce 80% confidence by 30% in conflict scenario', () => {
      const originalConfidence = 80;
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '1h', {
        strength: 0.7,
      });

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(56); // 80 * 0.7 = 56
    });

    it('should reduce 70% confidence to 49% (below 60% entry threshold)', () => {
      const originalConfidence = 70;
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '1h');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(49); // 70 * 0.7 = 49
      expect(adjustedConfidence).toBeLessThan(60); // Below minimum entry threshold
    });

    it('should not reduce confidence when aligned with trend', () => {
      const originalConfidence = 80;
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '1h');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(80); // No reduction
    });

    it('should handle very high confidence with conflict penalty', () => {
      const originalConfidence = 95;
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '1h', {
        strength: 0.9,
      });

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(66.5); // 95 * 0.7 = 66.5 (still usable)
    });

    it('should handle weak confidence with conflict penalty (may block entry)', () => {
      const originalConfidence = 65;
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '1h');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(45.5); // 65 * 0.7 = 45.5 (below 60% threshold)
    });
  });

  describe('Multi-Timeframe Scenarios', () => {
    it('should detect conflict: LONG in local downtrend despite higher timeframe uptrend', () => {
      // Scenario: 15m shows BEARISH, but signal is LONG
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '15m', {
        strength: 0.6,
      });

      const confidence = 80;
      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);

      expect(multiplier).toBe(CONFLICT_MULTIPLIER);
      expect(confidence * multiplier).toBe(56); // Reduced but not blocked
    });

    it('should detect no conflict: SHORT in BEARISH trend (aligned)', () => {
      // Scenario: 15m BEARISH, signal is SHORT = perfect alignment
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '15m');

      const confidence = 75;
      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);

      expect(multiplier).toBe(NO_CONFLICT_MULTIPLIER);
      expect(confidence * multiplier).toBe(75); // No reduction
    });

    it('should allow any direction in NEUTRAL trend', () => {
      // Scenario: No clear trend bias - both directions allowed
      const trendAnalysis = createTrendAnalysis(TrendBias.NEUTRAL, '1h', {
        strength: 0.2,
      });

      const multiplierLong = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const multiplierShort = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);

      expect(multiplierLong).toBe(NO_CONFLICT_MULTIPLIER);
      expect(multiplierShort).toBe(NO_CONFLICT_MULTIPLIER);
    });
  });

  describe('Entry Decision Impact', () => {
    it('should block entry: 70% confidence - 30% penalty = 49% (below 60%)', () => {
      const originalConfidence = 70;
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '1h', {
        strength: 0.7,
      });

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBeLessThan(ENTRY_THRESHOLD);
    });

    it('should allow entry: 90% confidence - 30% penalty = 63% (above 60%)', () => {
      const originalConfidence = 90;
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '1h', {
        strength: 0.7,
      });

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBeGreaterThanOrEqual(ENTRY_THRESHOLD);
    });

    it('should not block aligned signals', () => {
      const originalConfidence = 65;
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '1h');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const adjustedConfidence = originalConfidence * multiplier;

      expect(adjustedConfidence).toBe(65); // No penalty
      expect(adjustedConfidence).toBeGreaterThanOrEqual(ENTRY_THRESHOLD);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trend with 0 strength (neutral-like)', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.NEUTRAL, '1h');

      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      expect(multiplier).toBe(NO_CONFLICT_MULTIPLIER);
    });

    it('should handle trend with 1.0 strength (very strong)', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.BULLISH, '1h', {
        strength: 1.0,
      });

      // Conflict still exists regardless of strength
      const multiplier = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.SHORT);
      expect(multiplier).toBe(CONFLICT_MULTIPLIER); // Same 30% penalty
    });

    it('should handle undefined trend analysis', () => {
      const multiplier = getTimeframeConflictMultiplier(
        undefined as unknown as TrendAnalysis,
        SignalDirection.LONG,
      );
      expect(multiplier).toBe(1.0);
    });

    it('should be idempotent (same input = same output)', () => {
      const trendAnalysis = createTrendAnalysis(TrendBias.BEARISH, '1h', {
        strength: 0.7,
      });

      const multiplier1 = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);
      const multiplier2 = getTimeframeConflictMultiplier(trendAnalysis, SignalDirection.LONG);

      expect(multiplier1).toBe(multiplier2);
    });
  });
});
