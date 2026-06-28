import { ConfigValidatorService } from '../../services/config-validator.service';
import {
  ConfigValidationError,
  ConfigDeprecationError,
  ConfigFormatError,
} from '../../errors/DomainErrors';
import {
  createManagedConfigValidatorContext,
  createConfigValidatorConfig,
  omitConfigValidatorSection,
  asConfigValidatorInput,
} from '../helpers/config-validator-test.utils';

describe('ConfigValidatorService functional', () => {
  describe('validateAtStartup()', () => {
    it('does not throw on a valid minimal config', () => {
      const config = createConfigValidatorConfig();
      expect(() => ConfigValidatorService.validateAtStartup(config)).not.toThrow();
    });

    it('throws when a required startup field is missing', () => {
      const config = omitConfigValidatorSection(createConfigValidatorConfig(), 'exchange');
      expect(() => ConfigValidatorService.validateAtStartup(config)).toThrow();
    });
  });

  describe('validateAll()', () => {
    it('does not throw on a valid config', () => {
      const { validator, validConfig, cleanup } = createManagedConfigValidatorContext();
      try {
        expect(() => validator.validateAll(validConfig)).not.toThrow();
      } finally {
        cleanup();
      }
    });

    it('throws ConfigValidationError when a required runtime field is missing', () => {
      const { validator, cleanup } = createManagedConfigValidatorContext();
      try {
        const config = asConfigValidatorInput(
          omitConfigValidatorSection(createConfigValidatorConfig(), 'exchange'),
        );
        expect(() => validator.validateAll(config)).toThrow(ConfigValidationError);
      } finally {
        cleanup();
      }
    });

    it('throws ConfigDeprecationError when a deprecated key is present', () => {
      const { validator, validConfig, cleanup } = createManagedConfigValidatorContext();
      try {
        const config = asConfigValidatorInput({
          ...validConfig,
          mode: 'demo',
        });
        expect(() => validator.validateAll(config)).toThrow(ConfigDeprecationError);
      } finally {
        cleanup();
      }
    });

    it('throws ConfigFormatError when a confidence value uses 0-100 scale instead of 0-1', () => {
      const { validator, cleanup } = createManagedConfigValidatorContext();
      try {
        const config = asConfigValidatorInput(
          createConfigValidatorConfig({ thresholdsDefaultsConfidence: { min: 60 } }),
        );
        expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
      } finally {
        cleanup();
      }
    });

    it('throws ConfigFormatError when stopLossPercent exceeds 20%', () => {
      const { validator, cleanup } = createManagedConfigValidatorContext();
      try {
        const config = asConfigValidatorInput(
          createConfigValidatorConfig({ riskManagement: { stopLossPercent: 25, positionSizeUsdt: 10 } }),
        );
        expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
      } finally {
        cleanup();
      }
    });
  });

  describe('printEnabledAnalyzers()', () => {
    it('does not throw on a valid config', () => {
      const { validator, validConfig, cleanup } = createManagedConfigValidatorContext();
      try {
        expect(() => validator.printEnabledAnalyzers(validConfig)).not.toThrow();
      } finally {
        cleanup();
      }
    });

    it('does not throw when strategicWeights is absent', () => {
      const { validator, cleanup } = createManagedConfigValidatorContext();
      try {
        expect(() => validator.printEnabledAnalyzers({})).not.toThrow();
      } finally {
        cleanup();
      }
    });
  });

  describe('export boundary', () => {
    it('ConfigValidatorService is a constructible class', () => {
      expect(typeof ConfigValidatorService).toBe('function');
    });

    it('validateAtStartup is a static method', () => {
      expect(typeof ConfigValidatorService.validateAtStartup).toBe('function');
    });
  });
});
