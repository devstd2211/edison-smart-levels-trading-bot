/**
 * ConfigValidatorService Tests
 * Tests for Phase 3 config validation
 */

import {
  asConfigValidatorInput,
  createConfigValidatorConfig,
  createManagedConfigValidatorContext,
  omitConfigValidatorSection,
  type ManagedConfigValidatorContext,
} from '../helpers/config-validator-test.utils';

describe('ConfigValidatorService', () => {
  describe('validateAtStartup', () => {
    type ConfigValidatorFixtures = Pick<
      ManagedConfigValidatorContext,
      'validateAtStartup' | 'validConfig'
    >;
    let validateAtStartup: ConfigValidatorFixtures['validateAtStartup'];
    let validConfig: ConfigValidatorFixtures['validConfig'];

    function bindConfigValidatorContext() {
      let fixtures: ConfigValidatorFixtures;
      let cleanup: ManagedConfigValidatorContext['cleanup'];

      beforeEach(() => {
        const managedContext = createManagedConfigValidatorContext();
        fixtures = {
          validateAtStartup: managedContext.validateAtStartup,
          validConfig: managedContext.validConfig,
        };
        cleanup = managedContext.cleanup;
      });

      afterEach(() => {
        cleanup();
      });

      return () => fixtures;
    }

    const getContext = bindConfigValidatorContext();

    beforeEach(() => {
      ({ validateAtStartup, validConfig } = getContext());
    });

    it('should pass validation for valid config', () => {
      expect(() => validateAtStartup(validConfig)).not.toThrow();
    });

    describe('required fields', () => {
      it('should fail when exchange.symbol is missing', () => {
        const config = createConfigValidatorConfig({
          exchange: { symbol: '' },
        });
        expect(() => validateAtStartup(config)).toThrow('REQUIRED FIELD MISSING');
      });

      it('should fail when riskManagement.stopLossPercent is missing', () => {
        const config = createConfigValidatorConfig({
          riskManagement: { stopLossPercent: undefined },
        });
        expect(() => validateAtStartup(asConfigValidatorInput(config))).toThrow(
          'REQUIRED FIELD MISSING',
        );
      });

      it('should fail when trading.leverage is missing', () => {
        const config = createConfigValidatorConfig({
          trading: { leverage: undefined },
        });
        expect(() => validateAtStartup(asConfigValidatorInput(config))).toThrow(
          'REQUIRED FIELD MISSING',
        );
      });
    });

    describe('deprecated keys', () => {
      it('should fail when deprecated contextConfig is present', () => {
        const config = { ...validConfig, contextConfig: { someValue: true } };
        expect(() => validateAtStartup(config)).toThrow('DEPRECATED KEY');
      });

      it('should fail when deprecated features is present', () => {
        const config = { ...validConfig, features: { someFeature: true } };
        expect(() => validateAtStartup(config)).toThrow('DEPRECATED KEY');
      });

      it('should fail when deprecated mode is present', () => {
        const config = { ...validConfig, mode: 'SCALPING' };
        expect(() => validateAtStartup(config)).toThrow('DEPRECATED KEY');
      });
    });

    describe('confidence format (0-1 range)', () => {
      it('should fail when confidence is in 0-100 format instead of 0-1', () => {
        const config = createConfigValidatorConfig({
          thresholdsDefaultsConfidence: { min: 60 },
        });
        expect(() => validateAtStartup(config)).toThrow('must be 0-1');
      });

      it('should pass when confidence is correctly in 0-1 format', () => {
        const config = createConfigValidatorConfig({
          thresholdsDefaultsConfidence: { min: 0.6 },
        });
        expect(() => validateAtStartup(config)).not.toThrow();
      });
    });

    describe('range validation', () => {
      it('should fail when stopLossPercent is negative', () => {
        const config = createConfigValidatorConfig({
          riskManagement: { stopLossPercent: -1 },
        });
        expect(() => validateAtStartup(config)).toThrow('must be > 0');
      });

      it('should fail when stopLossPercent is too high', () => {
        const config = createConfigValidatorConfig({
          riskManagement: { stopLossPercent: 25 },
        });
        expect(() => validateAtStartup(config)).toThrow('max 20%');
      });

      it('should fail when leverage is out of range', () => {
        const config = createConfigValidatorConfig({
          trading: { leverage: 150 },
        });
        expect(() => validateAtStartup(config)).toThrow('must be 1-100');
      });

      it('should fail when leverage is zero', () => {
        const config = createConfigValidatorConfig({
          trading: { leverage: 0 },
        });
        expect(() => validateAtStartup(config)).toThrow('must be 1-100');
      });
    });

    describe('multiple errors', () => {
      it('should collect and report multiple errors at once', () => {
        const config = {
          ...omitConfigValidatorSection(validConfig, 'strategies'),
          exchange: { symbol: '', apiKey: '', apiSecret: '' },
          riskManagement: { stopLossPercent: -1, positionSizeUsdt: 0 },
          trading: { leverage: 0 },
          contextConfig: {}, // deprecated
        };

        try {
          validateAtStartup(config);
          fail('Should have thrown');
        } catch (error: unknown) {
          const configError = error as Error;
          // Should contain multiple errors
          expect(configError.message).toContain('DEPRECATED KEY');
          expect(configError.message).toContain('REQUIRED FIELD MISSING');
          expect(configError.message).toContain('must be > 0');
          expect(configError.message).toContain('must be 1-100');
        }
      });
    });
  });
});
