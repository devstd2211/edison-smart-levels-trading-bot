import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Control } from '../../pages/Control';

jest.mock('../../services/api.service', () => ({
  configApi: {
    cleanupConfigBackups: jest.fn(),
    getConfigBackups: jest.fn(),
    getConfig: jest.fn(),
    getConfigHistory: jest.fn(),
    getConfigSchema: jest.fn(),
    restoreConfigBackup: jest.fn(),
    getStrategies: jest.fn(),
    toggleStrategy: jest.fn(),
  },
}));

jest.mock('../../components/control/ConfigEditor', () => ({
  ConfigEditor: () => <div>ConfigEditor</div>,
}));

jest.mock('../../components/control/StrategyToggles', () => ({
  StrategyToggles: ({ strategies }: { strategies?: Array<{ name: string }> }) => (
    <div>{strategies?.length ? `Strategies:${strategies.map((strategy) => strategy.name).join(',')}` : 'StrategyToggles'}</div>
  ),
}));

jest.mock('../../components/control/RiskSettings', () => ({
  RiskSettings: ({ onSave }: { onSave?: (risk: {
    maxLeverage: number;
    maxPositionSize: number;
    dailyLossLimit: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  }) => Promise<void> }) => (
    <button
      type="button"
      onClick={() => {
        void onSave?.({
          maxLeverage: 5,
          maxPositionSize: 0,
          dailyLossLimit: 100,
          stopLossPercent: 1.5,
          takeProfitPercent: 3,
        });
      }}
    >
      Save Zero Risk
    </button>
  ),
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    cleanupConfigBackups: jest.Mock;
    getConfigBackups: jest.Mock;
    getConfig: jest.Mock;
    getConfigHistory: jest.Mock;
    getConfigSchema: jest.Mock;
    restoreConfigBackup: jest.Mock;
    getStrategies: jest.Mock;
    toggleStrategy: jest.Mock;
  };
};

describe('Control zero-value functional behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configApi.getConfig.mockResolvedValue({
      success: true,
      data: {
        strategies: {
          breakout: { enabled: true, description: 'Breakout config' },
        },
      },
    });
    configApi.getStrategies.mockResolvedValue({
      success: true,
      data: {
        strategies: [
          { id: 'breakout', name: 'Breakout', enabled: true, config: { description: 'Breakout config' } },
        ],
      },
    });
    configApi.getConfigSchema.mockResolvedValue({
      success: true,
      data: {
        sections: {
          risk: {
            name: 'Risk Management',
            fields: [
              { name: 'maxLeverage', type: 'number', label: 'Leverage Cap' },
              { name: 'maxPositionSize', type: 'number', label: 'Position Size' },
              { name: 'dailyLossLimit', type: 'number', label: 'Daily Loss Limit' },
              { name: 'stopLossPercent', type: 'number', label: 'SL' },
              { name: 'takeProfitPercent', type: 'number', label: 'TP' },
            ],
          },
        },
      },
    });
    configApi.getConfigBackups.mockResolvedValue({
      success: true,
      data: {
        backups: [{
          id: 'backup-1',
          timestamp: 1,
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
          timestamp: 1,
          filePath: 'D:/tmp/config.json.backup.1.json',
          path: 'D:/tmp/config.json.backup.1.json',
          filename: 'config.json.backup.1.json',
          size: 128,
        }],
        count: 1,
      },
    });
    configApi.toggleStrategy.mockResolvedValue({ success: true, data: { enabled: false } });
    configApi.restoreConfigBackup.mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'Configuration restored from 2026-05-17T00:00:00.000Z',
        restoredBackup: {
          id: 'backup-1',
          timestamp: 1,
          filePath: 'D:/tmp/config.json.backup.1.json',
          path: 'D:/tmp/config.json.backup.1.json',
          filename: 'config.json.backup.1.json',
          size: 128,
        },
        preRestoreBackupPath: 'D:/tmp/config.json.pre-restore.1.json',
        requiresRestart: true,
      },
    });
    configApi.cleanupConfigBackups.mockResolvedValue({
      success: true,
      data: {
        deleted: 0,
        remainingBackups: 1,
        totalBackups: 1,
        message: 'No backups to delete (1/10 kept)',
      },
    });
  });

  test('keeps a zero maxPositionSize in the current settings summary', async () => {
    render(<Control />);

    await waitFor(() => {
      expect(configApi.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Risk Management' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Zero Risk' }));

    expect(screen.getByText('Leverage Cap:')).toBeInTheDocument();
    expect(screen.getByText('Position Size:')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  test('loads strategy toggles from the typed config api instead of page-local seed data', async () => {
    render(<Control />);

    fireEvent.click(screen.getByRole('button', { name: 'Strategies' }));

    await waitFor(() => {
      expect(configApi.getStrategies).toHaveBeenCalledTimes(1);
      expect(configApi.getConfigSchema).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Strategies:Breakout')).toBeInTheDocument();
    });

    expect(screen.queryByText('WhaleHunter')).not.toBeInTheDocument();
  });

  test('renders typed backup and history metadata in the config tab', async () => {
    render(<Control />);

    await waitFor(() => {
      expect(configApi.getConfigBackups).toHaveBeenCalledTimes(1);
      expect(configApi.getConfigHistory).toHaveBeenCalledTimes(1);
      expect(screen.getByText('config.json.backup.1.json')).toBeInTheDocument();
      expect(screen.getByText('Backups: 1 | History alias: 1')).toBeInTheDocument();
    });

    expect(screen.getByText('History alias matches backup inventory')).toBeInTheDocument();
  });

  test('restores the latest backup through the typed control action flow', async () => {
    render(<Control />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Restore Latest Backup' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Restore Latest Backup' }));

    await waitFor(() => {
      expect(configApi.restoreConfigBackup).toHaveBeenCalledWith('backup-1');
      expect(
        screen.getByText(/Restart required before the restored config takes effect\./),
      ).toBeInTheDocument();
    });
  });

  test('cleans up backups through the typed control action flow', async () => {
    render(<Control />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cleanup Old Backups' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cleanup Old Backups' }));

    await waitFor(() => {
      expect(configApi.cleanupConfigBackups).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('No backups to delete (1/10 kept). 1 of 1 backup snapshots remain.'),
      ).toBeInTheDocument();
    });
  });
});
