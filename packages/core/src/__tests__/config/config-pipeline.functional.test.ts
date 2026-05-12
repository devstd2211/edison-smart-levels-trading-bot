jest.mock('../../config', () => ({
  getConfig: jest.fn(),
}));

jest.mock('../../services/config-validator.service', () => ({
  ConfigValidatorService: {
    validateAtStartup: jest.fn(),
  },
}));

jest.mock('../../services/strategy-loader.service', () => ({
  StrategyLoaderService: jest.fn().mockImplementation(() => ({
    loadStrategy: jest.fn(),
  })),
}));

jest.mock('../../services/strategy-config-merger.service', () => ({
  StrategyConfigMergerService: jest.fn().mockImplementation(() => ({
    mergeConfigs: jest.fn(),
    getChangeReport: jest.fn(),
  })),
}));

import { getConfig } from '../../config';
import { ConfigValidatorService } from '../../services/config-validator.service';
import { applyStrategyConfig, loadRuntimeConfig } from '../../config/config-pipeline';
import { StrategyConfigMergerService } from '../../services/strategy-config-merger.service';
import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { createMinimalLifecycleConfig } from '../helpers/service-lifecycle-test.utils';

describe('config pipeline composition root', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loadRuntimeConfig loads base config, applies the pipeline, and validates the result', async () => {
    const config = createMinimalLifecycleConfig();
    (getConfig as jest.Mock).mockReturnValue(config);

    const result = await loadRuntimeConfig();

    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(ConfigValidatorService.validateAtStartup).toHaveBeenCalledWith(result);
    expect(result).toBe(config);
  });

  test('applyStrategyConfig formats indicator details without arrow delimiters', async () => {
    const config = {
      ...createMinimalLifecycleConfig(),
      meta: {
        strategy: 'momentum',
      },
    };
    const mergedConfig = {
      ...config,
      runtime: { merged: true },
    };
    const strategy = {
      metadata: {
        name: 'Momentum',
        version: '1.0.0',
      },
      analyzers: [],
      indicators: {
        ema: { period: 20 },
        macd: { fastPeriod: 12, slowPeriod: 26 },
      },
    };

    const loadStrategy = jest.fn().mockResolvedValue(strategy as never);
    const mergeConfigs = jest.fn().mockReturnValue(mergedConfig as never);
    const getChangeReport = jest.fn().mockReturnValue({ changesCount: 2 } as never);

    (StrategyLoaderService as unknown as jest.Mock).mockImplementation(() => ({
      loadStrategy,
    }));
    (StrategyConfigMergerService as unknown as jest.Mock).mockImplementation(() => ({
      mergeConfigs,
      getChangeReport,
    }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await applyStrategyConfig(config as never);

    expect(result).toBe(mergedConfig);
    expect(loadStrategy).toHaveBeenCalledWith('momentum');
    expect(consoleSpy).toHaveBeenCalledWith('   - ema: period=20');
    expect(consoleSpy).toHaveBeenCalledWith('   - macd: fast=12, slow=26');
    expect(consoleSpy.mock.calls.flat().join(' ')).not.toContain(' -> ');

    consoleSpy.mockRestore();
  });
});
