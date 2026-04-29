import { ConfigValidatorService } from '../services/config-validator.service';
import {
  createConfigValidatorConfig,
  createConfigValidatorLogger,
  createManagedConfigValidatorContext,
} from './helpers/config-validator-test.utils';

describe('ConfigValidatorService public API', () => {
  let validator: ConfigValidatorService;
  let validConfig: ReturnType<typeof createConfigValidatorConfig>;
  let cleanup: () => void;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    ({ validator, validConfig, cleanup } = createManagedConfigValidatorContext());
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    consoleLogSpy.mockRestore();
  });

  test('validateAtStartup accepts a valid config and logs a pass message', () => {
    expect(() => ConfigValidatorService.validateAtStartup(validConfig)).not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith('Config validation passed');
  });

  test('validateAll accepts the runtime config contract', () => {
    expect(() => validator.validateAll(validConfig)).not.toThrow();
  });

  test('validateAnalyzerConfig accepts a complete analyzer section set', () => {
    expect(() => validator.validateAnalyzerConfig(validConfig)).not.toThrow();
  });

  test('validateStrategyConfig accepts a complete strategy section', () => {
    expect(() => validator.validateStrategyConfig(validConfig)).not.toThrow();
  });

  test('printEnabledAnalyzers reports enabled and disabled analyzers through the logger', () => {
    const logger = createConfigValidatorLogger();
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const service = new ConfigValidatorService(logger);

    service.printEnabledAnalyzers(validConfig);

    expect(infoSpy).toHaveBeenCalledWith(
      'Analyzer Configuration Summary',
      expect.objectContaining({
        enabledAnalyzers: expect.any(Number),
        disabledAnalyzers: expect.any(Number),
        enabledList: expect.arrayContaining(['technicalIndicators.rsi']),
      }),
    );

    infoSpy.mockRestore();
  });
});
