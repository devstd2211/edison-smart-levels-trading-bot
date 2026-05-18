import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BotConfigPayload } from '@edison/contracts/runtime-api';
import { ConfigEditor } from '../../components/control/ConfigEditor';

jest.mock('../../services/api.service', () => ({
  configApi: {
    previewConfig: jest.fn(),
    saveConfig: jest.fn(),
    validateConfig: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    previewConfig: jest.Mock;
    saveConfig: jest.Mock;
    validateConfig: jest.Mock;
  };
};

describe('ConfigEditor functional behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configApi.validateConfig.mockResolvedValue({
      success: true,
      data: {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          errorCount: 0,
          warningCount: 0,
          issueCount: 0,
        },
      },
    });
    configApi.previewConfig.mockResolvedValue({
      success: true,
      data: {
        changes: [{
          path: 'trading.leverage',
          kind: 'updated',
          previousValue: '3',
          nextValue: '4',
        }],
        summary: {
          addedCount: 0,
          updatedCount: 1,
          removedCount: 0,
          totalChanges: 1,
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
          summary: {
            errorCount: 0,
            warningCount: 0,
            issueCount: 0,
          },
        },
      },
    });
    configApi.saveConfig.mockResolvedValue({
      success: true,
      data: {
        message: 'Configuration updated successfully',
        backupPath: 'D:/tmp/config.json.backup.1.json',
        requiresRestart: true,
        preview: {
          changes: [{
            path: 'trading.leverage',
            kind: 'updated',
            previousValue: '3',
            nextValue: '4',
          }],
          summary: {
            addedCount: 0,
            updatedCount: 1,
            removedCount: 0,
            totalChanges: 1,
          },
          validation: {
            valid: true,
            errors: [],
            warnings: [],
            summary: {
              errorCount: 0,
              warningCount: 0,
              issueCount: 0,
            },
          },
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
          summary: {
            errorCount: 0,
            warningCount: 0,
            issueCount: 0,
          },
        },
      },
    });
  });

  test('uses shared validation issues before save when the config payload is invalid', async () => {
    configApi.validateConfig.mockResolvedValueOnce({
      success: true,
      data: {
        valid: false,
        errors: [{ path: 'risk.maxLeverage', message: 'Must be a number' }],
        warnings: [],
        summary: {
          errorCount: 1,
          warningCount: 0,
          issueCount: 1,
        },
      },
    });

    render(
      <ConfigEditor
        currentConfig={{
          trading: { leverage: 3 },
          risk: { maxLeverage: 5 },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('JSON Configuration'), {
      target: {
        value: JSON.stringify({
          trading: { leverage: 3 },
          risk: { maxLeverage: 'oops' },
        }, null, 2),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Validate Configuration' }));

    await waitFor(() => {
      expect(configApi.validateConfig).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Validation Failed')).toBeInTheDocument();
      expect(screen.getByText('risk.maxLeverage')).toBeInTheDocument();
      expect(screen.getByText('Must be a number')).toBeInTheDocument();
    });

    expect(configApi.saveConfig).not.toHaveBeenCalled();
  });

  test('loads typed diff preview summaries before save', async () => {
    render(
      <ConfigEditor
        currentConfig={{
          trading: { leverage: 3 },
          risk: { maxLeverage: 5 },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('JSON Configuration'), {
      target: {
        value: JSON.stringify({
          trading: { leverage: 4 },
          risk: { maxLeverage: 5 },
        }, null, 2),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show Diff' }));

    await waitFor(() => {
      expect(configApi.previewConfig).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Diff Preview Ready')).toBeInTheDocument();
      expect(screen.getAllByText('1 change | 0 added | 1 updated | 0 removed')).toHaveLength(2);
      expect(screen.getByText('trading.leverage')).toBeInTheDocument();
      expect(screen.getByText('Changed 3 -> 4')).toBeInTheDocument();
    });
  });

  test('saves the config only after shared validation succeeds and surfaces typed save status', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <ConfigEditor
        currentConfig={{
          trading: { leverage: 3 },
          risk: { maxLeverage: 5 },
        }}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('JSON Configuration'), {
      target: {
        value: JSON.stringify({
          trading: { leverage: 4 },
          risk: { maxLeverage: 6 },
        }, null, 2),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

    await waitFor(() => {
      expect(configApi.validateConfig).toHaveBeenCalledTimes(1);
      expect(configApi.saveConfig).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        trading: { leverage: 4 },
        risk: { maxLeverage: 6 },
      });
      expect(screen.getByText('Configuration Saved')).toBeInTheDocument();
      expect(screen.getByText(/1 change \| 0 added \| 1 updated \| 0 removed/)).toBeInTheDocument();
      expect(screen.getByText(/Backup snapshot: D:\/tmp\/config\.json\.backup\.1\.json/)).toBeInTheDocument();
    });
  });

  test('keeps save feedback visible when the parent refreshes the loaded snapshot after save', async () => {
    function WrappedEditor() {
      const [config, setConfig] = React.useState<BotConfigPayload>({
        trading: { leverage: 3 },
        risk: { maxLeverage: 5 },
      });

      return (
        <ConfigEditor
          currentConfig={config}
          onSave={async (nextConfig) => {
            setConfig(nextConfig);
          }}
        />
      );
    }

    render(<WrappedEditor />);

    fireEvent.change(screen.getByLabelText('JSON Configuration'), {
      target: {
        value: JSON.stringify({
          trading: { leverage: 4 },
          risk: { maxLeverage: 6 },
        }, null, 2),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show Diff' }));

    await waitFor(() => {
      expect(configApi.previewConfig).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Diff Preview Ready')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

    await waitFor(() => {
      expect(configApi.saveConfig).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Configuration Saved')).toBeInTheDocument();
    });

    expect(screen.queryByText('Configuration Loaded')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Diff' })).toBeInTheDocument();
  });
});
