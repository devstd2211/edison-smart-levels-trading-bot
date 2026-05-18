import {
  applyRiskSettingsToConfig,
  applyStrategyToggleToConfig,
  buildControlBackupStatus,
  buildStrategySummariesFromConfig,
  cleanupControlBackups,
  createFallbackControlConfig,
  loadControlBootstrap,
  restoreLatestControlBackup,
} from '../../services/control-config-bootstrap';

jest.mock('../../services/api.service', () => ({
  configApi: {
    getConfigBackups: jest.fn(),
    getConfig: jest.fn(),
    getConfigHistory: jest.fn(),
    getConfigSchema: jest.fn(),
    getServerConfig: jest.fn(),
    getStrategies: jest.fn(),
    cleanupConfigBackups: jest.fn(),
    restoreConfigBackup: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    getConfig: jest.Mock;
    getConfigBackups: jest.Mock;
    getConfigHistory: jest.Mock;
    getConfigSchema: jest.Mock;
    getServerConfig: jest.Mock;
    getStrategies: jest.Mock;
    cleanupConfigBackups: jest.Mock;
    restoreConfigBackup: jest.Mock;
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
    configApi.getServerConfig.mockResolvedValue({
      success: false,
      error: 'runtime unavailable',
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
    configApi.getServerConfig.mockResolvedValue({
      success: false,
      error: 'offline',
    });

    const bootstrap = await loadControlBootstrap();

    expect(bootstrap.config).toEqual(createFallbackControlConfig());
    expect(bootstrap.strategies).toEqual([]);
    expect(bootstrap.schema.sections.risk.fields[0].name).toBe('maxLeverage');
    expect(bootstrap.backupStatus.latestBackup).toBeNull();
    expect(bootstrap.backupStatus.backupCount).toBe(0);
    expect(bootstrap.runtime.api.url).toContain('http://');
  });

  test('loads runtime endpoint metadata through the shared control bootstrap', async () => {
    configApi.getConfig.mockResolvedValue({ success: false, error: 'offline' });
    configApi.getConfigBackups.mockResolvedValue({ success: false, error: 'offline' });
    configApi.getConfigHistory.mockResolvedValue({ success: false, error: 'offline' });
    configApi.getStrategies.mockResolvedValue({ success: false, error: 'offline' });
    configApi.getConfigSchema.mockResolvedValue({ success: false, error: 'offline' });
    configApi.getServerConfig.mockResolvedValue({
      success: true,
      data: {
        api: { port: 4100, url: 'http://localhost:4100' },
        websocket: { port: 4101, url: 'ws://localhost:4101' },
      },
    });

    const bootstrap = await loadControlBootstrap();

    expect(configApi.getServerConfig).toHaveBeenCalledTimes(1);
    expect(bootstrap.runtime).toEqual({
      api: { port: 4100, url: 'http://localhost:4100' },
      websocket: { port: 4101, url: 'ws://localhost:4101' },
    });
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

  test('restores the latest backup and refreshes typed backup status', async () => {
    configApi.restoreConfigBackup.mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'Configuration restored from 2026-05-17T00:00:00.000Z',
        restoredBackup: {
          id: 'backup-1',
          timestamp: 10,
          filePath: 'D:/tmp/config.json.backup.1.json',
          path: 'D:/tmp/config.json.backup.1.json',
          filename: 'config.json.backup.1.json',
          size: 128,
        },
        preRestoreBackupPath: 'D:/tmp/config.json.pre-restore.1.json',
        requiresRestart: true,
      },
    });
    configApi.getConfigBackups.mockResolvedValue({
      success: true,
      data: {
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
    });
    configApi.getConfigHistory.mockResolvedValue({
      success: true,
      data: {
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
    });

    const restoreResult = await restoreLatestControlBackup({
      id: 'backup-1',
      timestamp: 10,
      filePath: 'D:/tmp/config.json.backup.1.json',
      path: 'D:/tmp/config.json.backup.1.json',
      filename: 'config.json.backup.1.json',
      size: 128,
    });

    expect(configApi.restoreConfigBackup).toHaveBeenCalledWith('backup-1');
    expect(restoreResult.result.requiresRestart).toBe(true);
    expect(restoreResult.bootstrap.backupStatus.latestBackup?.id).toBe('backup-1');
  });

  test('cleans up backups and returns the refreshed typed status', async () => {
    configApi.cleanupConfigBackups.mockResolvedValue({
      success: true,
      data: {
        deleted: 2,
        remainingBackups: 1,
        totalBackups: 3,
        message: 'Deleted 2 old backup(s)',
      },
    });
    configApi.getConfigBackups.mockResolvedValue({
      success: true,
      data: {
        backups: [{
          id: 'backup-3',
          timestamp: 30,
          filePath: 'D:/tmp/config.json.backup.3.json',
          path: 'D:/tmp/config.json.backup.3.json',
          filename: 'config.json.backup.3.json',
          size: 128,
        }],
        count: 1,
      },
    });
    configApi.getConfigHistory.mockResolvedValue({
      success: true,
      data: {
        backups: [{
          id: 'backup-3',
          timestamp: 30,
          filePath: 'D:/tmp/config.json.backup.3.json',
          path: 'D:/tmp/config.json.backup.3.json',
          filename: 'config.json.backup.3.json',
          size: 128,
        }],
        count: 1,
      },
    });

    const cleanupResult = await cleanupControlBackups(1);

    expect(configApi.cleanupConfigBackups).toHaveBeenCalledWith(1);
    expect(cleanupResult.result.remainingBackups).toBe(1);
    expect(cleanupResult.bootstrap.backupStatus.backupCount).toBe(1);
  });
});
