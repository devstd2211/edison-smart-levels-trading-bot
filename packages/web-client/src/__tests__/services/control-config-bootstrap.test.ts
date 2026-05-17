import {
  applyRiskSettingsToConfig,
  applyStrategyToggleToConfig,
  buildStrategySummariesFromConfig,
  createFallbackControlConfig,
  loadControlBootstrap,
} from '../../services/control-config-bootstrap';

jest.mock('../../services/api.service', () => ({
  configApi: {
    getConfig: jest.fn(),
    getConfigSchema: jest.fn(),
    getStrategies: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    getConfig: jest.Mock;
    getConfigSchema: jest.Mock;
    getStrategies: jest.Mock;
  };
};

describe('control-config-bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('falls back to strategy summaries derived from config when the strategies endpoint is unavailable', async () => {
    configApi.getConfig.mockResolvedValue({
      success: true,
      data: {
        strategies: {
          breakoutStrategy: {
            enabled: true,
            description: 'Breakout runtime config',
          },
        },
      },
    });
    configApi.getStrategies.mockResolvedValue({
      success: false,
      error: 'route unavailable',
    });
    configApi.getConfigSchema.mockResolvedValue({
      success: false,
      error: 'schema unavailable',
    });

    const bootstrap = await loadControlBootstrap();

    expect(bootstrap.strategies).toEqual([
      expect.objectContaining({
        id: 'breakoutStrategy',
        name: 'Breakout Strategy',
        enabled: true,
      }),
    ]);
  });

  test('uses the shared fallback config when config bootstrap fails entirely', async () => {
    configApi.getConfig.mockResolvedValue({
      success: false,
      error: 'offline',
    });
    configApi.getStrategies.mockResolvedValue({
      success: false,
      error: 'offline',
    });
    configApi.getConfigSchema.mockResolvedValue({
      success: false,
      error: 'offline',
    });

    const bootstrap = await loadControlBootstrap();

    expect(bootstrap.config).toEqual(createFallbackControlConfig());
    expect(bootstrap.strategies).toEqual([]);
    expect(bootstrap.schema.sections.risk.fields[0].name).toBe('maxLeverage');
  });

  test('applies strategy and risk mutations against the shared control config payload', () => {
    const initialConfig = createFallbackControlConfig();
    const strategyUpdatedConfig = applyStrategyToggleToConfig(initialConfig, 'breakout', false);
    const riskUpdatedConfig = applyRiskSettingsToConfig(strategyUpdatedConfig, {
      maxLeverage: 2,
      maxPositionSize: 0,
    });

    expect(buildStrategySummariesFromConfig(strategyUpdatedConfig.strategies)).toEqual([
      expect.objectContaining({ id: 'breakout', enabled: false }),
    ]);
    expect(riskUpdatedConfig.risk?.maxLeverage).toBe(2);
    expect(riskUpdatedConfig.risk?.maxPositionSize).toBe(0);
  });
});
