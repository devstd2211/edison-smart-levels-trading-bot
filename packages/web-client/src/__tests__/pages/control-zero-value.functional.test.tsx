import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Control } from '../../pages/Control';

jest.mock('../../services/api.service', () => ({
  configApi: {
    getConfig: jest.fn(),
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
    getConfig: jest.Mock;
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
    configApi.toggleStrategy.mockResolvedValue({ success: true, data: { enabled: false } });
  });

  test('keeps a zero maxPositionSize in the current settings summary', async () => {
    render(<Control />);

    await waitFor(() => {
      expect(configApi.getConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Risk Management' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Zero Risk' }));

    expect(screen.getByText('Position Size:')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  test('loads strategy toggles from the typed config api instead of page-local seed data', async () => {
    render(<Control />);

    fireEvent.click(screen.getByRole('button', { name: 'Strategies' }));

    await waitFor(() => {
      expect(configApi.getStrategies).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Strategies:Breakout')).toBeInTheDocument();
    });

    expect(screen.queryByText('WhaleHunter')).not.toBeInTheDocument();
  });
});
