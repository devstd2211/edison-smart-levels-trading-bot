import { VolatilityRegimeService } from '../../services/volatility-regime.service';
import {
  LoggerService,
  LogLevel,
  VolatilityRegime,
  VolatilityRegimeConfig,
} from '../../types';

describe('VolatilityRegimeService', () => {
  let service: VolatilityRegimeService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    service = new VolatilityRegimeService(logger);
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(service).toBeDefined();
      expect(service.isEnabled()).toBe(true);
    });

    it('should start in MEDIUM regime', () => {
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.MEDIUM);
    });

    it('should start with zero regime changes', () => {
      expect(service.getRegimeChangeCount()).toBe(0);
    });
  });

  describe('analyze', () => {
    describe('LOW regime detection', () => {
      it('should detect LOW regime when ATR < 0.3%', () => {
        const result = service.analyze(0.1);

        expect(result.regime).toBe(VolatilityRegime.LOW);
        expect(result.atrPercent).toBe(0.1);
        expect(result.reason).toContain('LOW volatility');
      });

      it('should return LOW regime params', () => {
        const result = service.analyze(0.2);

        expect(result.params.maxDistancePercent).toBe(0.3);
        expect(result.params.minTouchesRequired).toBe(4);
        expect(result.params.clusterThresholdPercent).toBe(0.15);
        expect(result.params.minConfidenceThreshold).toBe(0.65);
      });

      it('should detect LOW at boundary (0.29%)', () => {
        const result = service.analyze(0.29);
        expect(result.regime).toBe(VolatilityRegime.LOW);
      });
    });

    describe('MEDIUM regime detection', () => {
      it('should detect MEDIUM regime when 0.3% <= ATR <= 1.5%', () => {
        const result = service.analyze(0.8);

        expect(result.regime).toBe(VolatilityRegime.MEDIUM);
        expect(result.reason).toContain('MEDIUM volatility');
      });

      it('should return MEDIUM regime params', () => {
        const result = service.analyze(1.0);

        expect(result.params.maxDistancePercent).toBe(0.6);
        expect(result.params.minTouchesRequired).toBe(3);
        expect(result.params.clusterThresholdPercent).toBe(0.25);
        expect(result.params.minConfidenceThreshold).toBe(0.55);
      });

      it('should detect MEDIUM at lower boundary (0.3%)', () => {
        const result = service.analyze(0.3);
        expect(result.regime).toBe(VolatilityRegime.MEDIUM);
      });

      it('should detect MEDIUM at upper boundary (1.5%)', () => {
        const result = service.analyze(1.5);
        expect(result.regime).toBe(VolatilityRegime.MEDIUM);
      });
    });

    describe('HIGH regime detection', () => {
      it('should detect HIGH regime when ATR > 1.5%', () => {
        const result = service.analyze(2.0);

        expect(result.regime).toBe(VolatilityRegime.HIGH);
        expect(result.reason).toContain('HIGH volatility');
      });

      it('should return HIGH regime params', () => {
        const result = service.analyze(3.0);

        expect(result.params.maxDistancePercent).toBe(1.2);
        expect(result.params.minTouchesRequired).toBe(2);
        expect(result.params.clusterThresholdPercent).toBe(0.4);
        expect(result.params.minConfidenceThreshold).toBe(0.5);
      });

      it('should detect HIGH at boundary (1.51%)', () => {
        const result = service.analyze(1.51);
        expect(result.regime).toBe(VolatilityRegime.HIGH);
      });

      it('should handle extreme volatility (5%+)', () => {
        const result = service.analyze(5.5);
        expect(result.regime).toBe(VolatilityRegime.HIGH);
      });
    });
  });

  describe('regime change tracking', () => {
    it('should track regime changes', () => {
      // Start in MEDIUM (default)
      expect(service.getRegimeChangeCount()).toBe(0);

      // Transition to LOW
      service.analyze(0.1);
      expect(service.getRegimeChangeCount()).toBe(1);
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.LOW);

      // Stay in LOW (no change)
      service.analyze(0.2);
      expect(service.getRegimeChangeCount()).toBe(1);

      // Transition to HIGH
      service.analyze(2.5);
      expect(service.getRegimeChangeCount()).toBe(2);
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.HIGH);

      // Transition back to MEDIUM
      service.analyze(1.0);
      expect(service.getRegimeChangeCount()).toBe(3);
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.MEDIUM);
    });

    it('should not count non-changes', () => {
      // Multiple analyses in same regime
      service.analyze(0.8);
      service.analyze(1.0);
      service.analyze(1.2);
      service.analyze(0.5);

      // All are MEDIUM, no transitions from initial MEDIUM
      expect(service.getRegimeChangeCount()).toBe(0);
    });
  });

  describe('disabled service', () => {
    beforeEach(() => {
      service = new VolatilityRegimeService(logger, { enabled: false });
    });

    it('should return disabled status', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should return MEDIUM with default params when disabled', () => {
      const result = service.analyze(0.1); // Would be LOW if enabled

      expect(result.regime).toBe(VolatilityRegime.MEDIUM);
      expect(result.reason).toContain('disabled');
    });

    it('should not track regime changes when disabled', () => {
      service.analyze(0.1);
      service.analyze(2.0);

      expect(service.getRegimeChangeCount()).toBe(0);
    });
  });

  describe('custom config', () => {
    it('should accept custom thresholds', () => {
      const customConfig: Partial<VolatilityRegimeConfig> = {
        enabled: true,
        thresholds: {
          lowAtrPercent: 0.5, // Higher threshold for LOW
          highAtrPercent: 2.0, // Higher threshold for HIGH
        },
      };

      service = new VolatilityRegimeService(logger, customConfig);

      // 0.4% should now be LOW (was MEDIUM with default 0.3%)
      const lowResult = service.analyze(0.4);
      expect(lowResult.regime).toBe(VolatilityRegime.LOW);

      // 1.8% should now be MEDIUM (was HIGH with default 1.5%)
      const medResult = service.analyze(1.8);
      expect(medResult.regime).toBe(VolatilityRegime.MEDIUM);

      // 2.5% should be HIGH
      const highResult = service.analyze(2.5);
      expect(highResult.regime).toBe(VolatilityRegime.HIGH);
    });

    it('should accept custom regime params', () => {
      const customConfig: Partial<VolatilityRegimeConfig> = {
        enabled: true,
        regimes: {
          LOW: {
            maxDistancePercent: 0.2,
            minTouchesRequired: 5,
            clusterThresholdPercent: 0.1,
            minConfidenceThreshold: 0.7,
          },
          MEDIUM: {
            maxDistancePercent: 0.5,
            minTouchesRequired: 3,
            clusterThresholdPercent: 0.2,
            minConfidenceThreshold: 0.6,
          },
          HIGH: {
            maxDistancePercent: 1.0,
            minTouchesRequired: 2,
            clusterThresholdPercent: 0.35,
            minConfidenceThreshold: 0.45,
          },
        },
      };

      service = new VolatilityRegimeService(logger, customConfig);

      const lowResult = service.analyze(0.1);
      expect(lowResult.params.maxDistancePercent).toBe(0.2);
      expect(lowResult.params.minTouchesRequired).toBe(5);
    });
  });

  describe('getParamsForRegime', () => {
    it('should return params for specific regime', () => {
      const lowParams = service.getParamsForRegime(VolatilityRegime.LOW);
      expect(lowParams.maxDistancePercent).toBe(0.3);
      expect(lowParams.minTouchesRequired).toBe(4);

      const medParams = service.getParamsForRegime(VolatilityRegime.MEDIUM);
      expect(medParams.maxDistancePercent).toBe(0.6);

      const highParams = service.getParamsForRegime(VolatilityRegime.HIGH);
      expect(highParams.maxDistancePercent).toBe(1.2);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const initialConfig = service.getConfig();
      expect(initialConfig.thresholds.lowAtrPercent).toBe(0.3);

      service.updateConfig({
        thresholds: {
          lowAtrPercent: 0.4,
          highAtrPercent: 2.0,
        },
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.thresholds.lowAtrPercent).toBe(0.4);
      expect(updatedConfig.thresholds.highAtrPercent).toBe(2.0);
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      // Build up state
      service.analyze(0.1); // LOW
      service.analyze(2.0); // HIGH
      expect(service.getRegimeChangeCount()).toBe(2);
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.HIGH);

      // Reset
      service.reset();

      expect(service.getRegimeChangeCount()).toBe(0);
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.MEDIUM);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      service.analyze(0.1); // LOW

      const state = service.getState();

      expect(state.enabled).toBe(true);
      expect(state.currentRegime).toBe(VolatilityRegime.LOW);
      expect(state.regimeChangeCount).toBe(1);
      expect(state.thresholds.lowAtrPercent).toBe(0.3);
      expect(state.thresholds.highAtrPercent).toBe(1.5);
    });
  });

  describe('edge cases', () => {
    it('should handle zero ATR', () => {
      const result = service.analyze(0);
      expect(result.regime).toBe(VolatilityRegime.LOW);
    });

    it('should handle negative ATR (invalid input)', () => {
      const result = service.analyze(-0.5);
      expect(result.regime).toBe(VolatilityRegime.LOW);
    });

    it('should handle very small ATR', () => {
      const result = service.analyze(0.001);
      expect(result.regime).toBe(VolatilityRegime.LOW);
    });

    it('should handle very large ATR', () => {
      const result = service.analyze(100);
      expect(result.regime).toBe(VolatilityRegime.HIGH);
    });
  });
});
