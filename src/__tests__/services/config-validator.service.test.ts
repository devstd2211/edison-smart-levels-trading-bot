/**
 * ConfigValidatorService Tests
 * Tests for Phase 3 config validation
 */

import { ConfigValidatorService } from '../../services/config-validator.service';

describe('ConfigValidatorService', () => {
  describe('validateAtStartup', () => {
    const validConfig = {
      exchange: {
        symbol: 'BTCUSDT',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      },
      riskManagement: {
        stopLossPercent: 2.5,
        positionSizeUsdt: 10,
      },
      trading: {
        leverage: 10,
      },
      thresholds: {
        defaults: {
          confidence: {
            min: 0.6,
          },
        },
      },
      strategies: {
        levelBased: {
          minConfidenceThreshold: 0.65,
        },
      },
      entryScanner: {
        minConfidenceThreshold: 0.3,
      },
      entryThresholds: {
        minTotalScore: 0.55,
      },
    };

    it('should pass validation for valid config', () => {
      expect(() => ConfigValidatorService.validateAtStartup(validConfig)).not.toThrow();
    });

    describe('required fields', () => {
      it('should fail when exchange.symbol is missing', () => {
        const config = { ...validConfig, exchange: { ...validConfig.exchange, symbol: '' } };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('REQUIRED FIELD MISSING');
      });

      it('should fail when riskManagement.stopLossPercent is missing', () => {
        const config = {
          ...validConfig,
          riskManagement: { ...validConfig.riskManagement, stopLossPercent: undefined },
        };
        expect(() => ConfigValidatorService.validateAtStartup(config as any)).toThrow(
          'REQUIRED FIELD MISSING',
        );
      });

      it('should fail when trading.leverage is missing', () => {
        const config = { ...validConfig, trading: { leverage: undefined } };
        expect(() => ConfigValidatorService.validateAtStartup(config as any)).toThrow(
          'REQUIRED FIELD MISSING',
        );
      });
    });

    describe('deprecated keys', () => {
      it('should fail when deprecated contextConfig is present', () => {
        const config = { ...validConfig, contextConfig: { someValue: true } };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('DEPRECATED KEY');
      });

      it('should fail when deprecated features is present', () => {
        const config = { ...validConfig, features: { someFeature: true } };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('DEPRECATED KEY');
      });

      it('should fail when deprecated mode is present', () => {
        const config = { ...validConfig, mode: 'SCALPING' };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('DEPRECATED KEY');
      });
    });

    describe('confidence format (0-1 range)', () => {
      it('should fail when confidence is in 0-100 format instead of 0-1', () => {
        const config = {
          ...validConfig,
          thresholds: {
            defaults: {
              confidence: { min: 60 }, // Should be 0.6, not 60
            },
          },
        };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('must be 0-1');
      });

      it('should pass when confidence is correctly in 0-1 format', () => {
        const config = {
          ...validConfig,
          thresholds: {
            defaults: {
              confidence: { min: 0.6 },
            },
          },
        };
        expect(() => ConfigValidatorService.validateAtStartup(config)).not.toThrow();
      });
    });

    describe('range validation', () => {
      it('should fail when stopLossPercent is negative', () => {
        const config = {
          ...validConfig,
          riskManagement: { ...validConfig.riskManagement, stopLossPercent: -1 },
        };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('must be > 0');
      });

      it('should fail when stopLossPercent is too high', () => {
        const config = {
          ...validConfig,
          riskManagement: { ...validConfig.riskManagement, stopLossPercent: 25 },
        };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('max 20%');
      });

      it('should fail when leverage is out of range', () => {
        const config = { ...validConfig, trading: { leverage: 150 } };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('must be 1-100');
      });

      it('should fail when leverage is zero', () => {
        const config = { ...validConfig, trading: { leverage: 0 } };
        expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow('must be 1-100');
      });
    });

    describe('multiple errors', () => {
      it('should collect and report multiple errors at once', () => {
        const config = {
          exchange: { symbol: '', apiKey: '', apiSecret: '' },
          riskManagement: { stopLossPercent: -1, positionSizeUsdt: 0 },
          trading: { leverage: 0 },
          contextConfig: {}, // deprecated
        };

        try {
          ConfigValidatorService.validateAtStartup(config);
          fail('Should have thrown');
        } catch (error: any) {
          // Should contain multiple errors
          expect(error.message).toContain('DEPRECATED KEY');
          expect(error.message).toContain('REQUIRED FIELD MISSING');
          expect(error.message).toContain('must be > 0');
          expect(error.message).toContain('must be 1-100');
        }
      });
    });
  });
});
