/**
 * Tests for WeightCalculator (Phase 3)
 */

import { WeightCalculator } from '../../analyzers/weight.calculator';
import { WeightSystemConfig, SignalDirection, LogLevel, LoggerService } from '../../types';

describe('WeightCalculator', () => {
  let calculator: WeightCalculator;
  let logger: LoggerService;
  let config: WeightSystemConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    config = {
      enabled: true,
      rsiWeights: {
        enabled: true,
        extremeBonus: 0.20,
        strongBonus: 0.15,
        moderateBonus: 0.10,
        neutralZoneMin: 40,
        neutralZoneMax: 60,
        slightPenalty: 0.05,
        moderatePenalty: 0.10,
        strongPenalty: 0.15,
      },
      volumeWeights: {
        enabled: true,
        veryHighBonus: 0.10,
        highBonus: 0.05,
        lowPenalty: 0.05,
        veryLowPenalty: 0.10,
      },
      levelStrengthWeights: {
        enabled: true,
        strongLevelBonus: 0.40,
        mediumLevelBonus: 0.20,
        minTouchesForStrong: 3,
        minTouchesForMedium: 2,
      },
    };

    calculator = new WeightCalculator(config, logger);
  });

  // ============================================================================
  // RSI WEIGHTS TESTS (6 tests)
  // ============================================================================

  describe('getRSIModifier', () => {
    it('should give +20% bonus for extreme oversold LONG (RSI < 20)', () => {
      const modifier = calculator.getRSIModifier(15, SignalDirection.LONG);
      expect(modifier).toBeCloseTo(1.20, 2);
    });

    it('should give +15% bonus for oversold LONG (RSI 20-30)', () => {
      const modifier = calculator.getRSIModifier(25, SignalDirection.LONG);
      expect(modifier).toBeCloseTo(1.15, 2);
    });

    it('should give +10% bonus for moderate oversold LONG (RSI 30-40)', () => {
      const modifier = calculator.getRSIModifier(35, SignalDirection.LONG);
      expect(modifier).toBeCloseTo(1.10, 2);
    });

    it('should give no modifier in neutral zone (RSI 40-60)', () => {
      const modifierLong = calculator.getRSIModifier(50, SignalDirection.LONG);
      const modifierShort = calculator.getRSIModifier(50, SignalDirection.SHORT);
      expect(modifierLong).toBeCloseTo(1.0, 2);
      expect(modifierShort).toBeCloseTo(1.0, 2);
    });

    it('should penalize overbought LONG (RSI > 70)', () => {
      const modifier = calculator.getRSIModifier(75, SignalDirection.LONG);
      expect(modifier).toBeCloseTo(0.90, 2); // -10% penalty
    });

    it('should give bonus for overbought SHORT (RSI > 80)', () => {
      const modifier = calculator.getRSIModifier(85, SignalDirection.SHORT);
      expect(modifier).toBeCloseTo(1.20, 2); // +20% bonus
    });
  });

  // ============================================================================
  // VOLUME WEIGHTS TESTS (4 tests)
  // ============================================================================

  describe('getVolumeModifier', () => {
    it('should give +10% bonus for very high volume (> 2x)', () => {
      const modifier = calculator.getVolumeModifier(2.5);
      expect(modifier).toBeCloseTo(1.10, 2);
    });

    it('should give +5% bonus for high volume (1.5-2x)', () => {
      const modifier = calculator.getVolumeModifier(1.7);
      expect(modifier).toBeCloseTo(1.05, 2);
    });

    it('should give no modifier for normal volume (0.8-1.5x)', () => {
      const modifier = calculator.getVolumeModifier(1.0);
      expect(modifier).toBeCloseTo(1.0, 2);
    });

    it('should penalize low volume (< 0.5x)', () => {
      const modifier = calculator.getVolumeModifier(0.3);
      expect(modifier).toBeCloseTo(0.90, 2); // -10% penalty
    });
  });

  // ============================================================================
  // LEVEL STRENGTH WEIGHTS TESTS (4 tests)
  // ============================================================================

  describe('getLevelStrengthModifier', () => {
    it('should give +40% bonus for strong level (3+ touches)', () => {
      const modifier = calculator.getLevelStrengthModifier(4);
      expect(modifier).toBeCloseTo(1.40, 2);
    });

    it('should give +20% bonus for medium level (2 touches)', () => {
      const modifier = calculator.getLevelStrengthModifier(2);
      expect(modifier).toBeCloseTo(1.20, 2);
    });

    it('should give no modifier for weak level (1 touch)', () => {
      const modifier = calculator.getLevelStrengthModifier(1);
      expect(modifier).toBeCloseTo(1.0, 2);
    });

    it('should handle edge case: exactly 3 touches (strong threshold)', () => {
      const modifier = calculator.getLevelStrengthModifier(3);
      expect(modifier).toBeCloseTo(1.40, 2); // Strong level
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (Combined weights)
  // ============================================================================

  describe('applyWeights', () => {
    it('should combine all modifiers correctly', () => {
      // Base confidence: 0.70
      // RSI 15 (LONG): ×1.20
      // Volume 2.5x: ×1.10
      // Level 4 touches: ×1.40
      // Expected: 0.70 × 1.20 × 1.10 × 1.40 = 1.2936 → clamped to 1.0

      const result = calculator.applyWeights(0.70, {
        rsi: 15,
        direction: SignalDirection.LONG,
        volumeRatio: 2.5,
        levelTouches: 4,
      });

      expect(result).toBeCloseTo(1.0, 2); // Clamped to max
    });

    it('should handle disabled weight system', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledCalculator = new WeightCalculator(disabledConfig, logger);

      const result = disabledCalculator.applyWeights(0.70, {
        rsi: 15,
        direction: SignalDirection.LONG,
        volumeRatio: 2.5,
      });

      expect(result).toBe(0.70); // No modifiers applied
    });

    it('should clamp result to minimum 0.1', () => {
      // Base: 0.2
      // RSI 85 (LONG overbought): ×0.85
      // Volume 0.3x: ×0.90
      // Expected: 0.2 × 0.85 × 0.90 = 0.153 → clamped to 0.1

      const result = calculator.applyWeights(0.20, {
        rsi: 85,
        direction: SignalDirection.LONG,
        volumeRatio: 0.3,
      });

      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should handle partial parameters', () => {
      // Only RSI modifier applied
      const result = calculator.applyWeights(0.70, {
        rsi: 25,
        direction: SignalDirection.LONG,
      });

      expect(result).toBeCloseTo(0.70 * 1.15, 2); // 0.805
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle RSI at exact boundaries', () => {
      const mod19 = calculator.getRSIModifier(19, SignalDirection.LONG); // Extreme (< 20)
      const mod20 = calculator.getRSIModifier(20, SignalDirection.LONG); // Strong (20-30)
      const mod30 = calculator.getRSIModifier(30, SignalDirection.LONG); // Strong (20-30)
      const mod40 = calculator.getRSIModifier(40, SignalDirection.LONG); // Moderate (30-40)

      expect(mod19).toBeCloseTo(1.20, 2); // Extreme
      expect(mod20).toBeCloseTo(1.15, 2); // Strong
      expect(mod30).toBeCloseTo(1.15, 2); // Strong
      expect(mod40).toBeCloseTo(1.10, 2); // Moderate
    });

    it('should return 1.0 when all weights disabled', () => {
      const disabledConfig: WeightSystemConfig = {
        enabled: true,
        rsiWeights: { ...config.rsiWeights, enabled: false },
        volumeWeights: { ...config.volumeWeights, enabled: false },
        levelStrengthWeights: { ...config.levelStrengthWeights, enabled: false },
      };

      const calc = new WeightCalculator(disabledConfig, logger);
      const result = calc.applyWeights(0.70, {
        rsi: 15,
        direction: SignalDirection.LONG,
        volumeRatio: 2.5,
        levelTouches: 4,
      });

      expect(result).toBe(0.70); // No modifiers
    });
  });
});
