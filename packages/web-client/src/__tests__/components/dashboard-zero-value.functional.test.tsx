import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { Dashboard } from '../../pages/Dashboard';
import { useBotStore } from '../../stores/botStore';
import { useMarketStore } from '../../stores/marketStore';
import { useConfigStore } from '../../stores/configStore';

jest.mock('../../components/dashboard/BotStatusCard', () => ({
  BotStatusCard: () => <div>BotStatusCard</div>,
}));

jest.mock('../../components/dashboard/PositionCard', () => ({
  PositionCard: () => <div>PositionCard</div>,
}));

jest.mock('../../components/dashboard/BalanceCard', () => ({
  BalanceCard: () => <div>BalanceCard</div>,
}));

jest.mock('../../components/dashboard/LiveTicker', () => ({
  LiveTicker: () => <div>LiveTicker</div>,
}));

jest.mock('../../components/dashboard/SignalsList', () => ({
  SignalsList: () => <div>SignalsList</div>,
}));

jest.mock('../../components/dashboard/StrategyStatus', () => ({
  StrategyStatus: () => <div>StrategyStatus</div>,
}));

jest.mock('../../components/dashboard/TrendSlider', () => ({
  TrendSlider: () => <div>TrendSlider</div>,
}));

jest.mock('../../components/dashboard/LogConsole', () => ({
  LogConsole: () => <div>LogConsole</div>,
}));

jest.mock('../../components/charts/PriceChart', () => ({
  PriceChart: () => <div>PriceChart</div>,
}));

jest.mock('../../services/websocket.service', () => ({
  wsClient: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../services/api.service', () => ({
  api: {
    getStatus: jest.fn(),
  },
  dataApi: {
    getMarketData: jest.fn(),
  },
}));

const { api, dataApi } = jest.requireMock('../../services/api.service') as {
  api: {
    getStatus: jest.Mock;
  };
  dataApi: {
    getMarketData: jest.Mock;
  };
};

describe('Dashboard zero-value functional behavior', () => {
  beforeEach(() => {
    useBotStore.getState().reset();
    useMarketStore.getState().reset();
    useConfigStore.setState({
      symbol: 'BTCUSDT',
      timeframe: '5m',
      leverage: 1,
      riskPercent: 1,
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
    api.getStatus.mockResolvedValue({
      success: true,
      data: {
        isRunning: false,
        currentPosition: null,
        balance: 0,
        unrealizedPnL: 0,
      },
    });
    dataApi.getMarketData.mockResolvedValue({
      success: true,
      data: {
        currentPrice: 0,
        priceChangePercent: 0,
        trend: 'NEUTRAL',
      },
    });
  });

  test('keeps zero market values when dashboard syncs fetched market data', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(useMarketStore.getState()).toMatchObject({
        currentPrice: 0,
        priceChangePercent: 0,
        trend: 'NEUTRAL',
      });
    });
  });
});
