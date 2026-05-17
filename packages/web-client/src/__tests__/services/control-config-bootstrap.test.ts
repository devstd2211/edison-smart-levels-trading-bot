import {
  applyRiskSettingsToConfig,
  applyStrategyToggleToConfig,
  buildControlBackupStatus,
  buildStrategySummariesFromConfig,
  createFallbackControlConfig,
  loadControlBootstrap,
} from '../../services/control-config-bootstrap';

jest.mock('../../services/api.service', () => ({
  configApi: {
    getConfigBackups: jest.fn(),
    getConfig: jest.fn(),
    getConfigHistory: jest.fn(),
    getConfigSchema: jest.fn(),
    getStrategies: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    getConfig: jest.Mock;
    getConfigBackups: jest.Mock;
    getConfigHistory: jest.Mock;
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
    configApi.getConfigBackups.mockResolvedValue({
      success: false,
      error: 'backups unavailable',
    });
    configApi.getConfigHistory.mockResolvedValue({
      success: false,
      error: 'history unavailable',
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
    configApi.getConfigBackups.mockResolvedValue({
      success: false,
      error: 'offline',
    });
    configApi.getConfigHistory.mockResolvedValue({
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
    expect(bootstrap.backupStatus.latestBackup).toBeNull();
    expect(bootstrap.backupStatus.backupCount).toBe(0);
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

  test('derives typed backup status from backup and history payloads', () => {
    const backupStatus = buildControlBackupStatus(
      {
        backups: [{
          id: 'backup-1',
          timestamp: 10,
          filePath: 'D:/tmp/config.json.backup.1.json',
          path: 'D:/tmp/config.json.backup.1.json',
          filename: 'config.json.backup.1.json',
          size: 128,
        }],
        count: 1,
      },
      {
        backups: [{
          id: 'backup-1',
          timestamp: 10,
          filePath: 'D:/tmp/config.json.backup.1.json',
          path: 'D:/tmp/config.json.backup.1.json',
          filename: 'config.json.backup.1.json',
          size: 128,
        }],
        count: 1,
      },
    );

    expect(backupStatus.latestBackup?.filename).toBe('config.json.backup.1.json');
    expect(backupStatus.backupCount).toBe(1);
    expect(backupStatus.historyCount).toBe(1);
    expect(backupStatus.historyMatchesBackups).toBe(true);
  });
});
