import React from 'react';
import { render, waitFor } from '@testing-library/react';
import App from '../../App';
import { useConfigStore } from '../../stores/configStore';

jest.mock('../../pages/Dashboard', () => ({
  Dashboard: () => <div>Dashboard Page</div>,
}));

jest.mock('../../pages/Analytics', () => ({
  Analytics: () => <div>Analytics Page</div>,
}));

jest.mock('../../pages/AdvancedAnalytics', () => ({
  AdvancedAnalytics: () => <div>Advanced Analytics Page</div>,
}));

jest.mock('../../pages/Control', () => ({
  Control: () => <div>Control Page</div>,
}));

jest.mock('../../pages/OrderBook', () => ({
  OrderBook: () => <div>OrderBook Page</div>,
}));

jest.mock('../../services/websocket.service', () => ({
  wsClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  },
}));

jest.mock('../../services/api.service', () => ({
  configApi: {
    getConfig: jest.fn(),
  },
}));

const { configApi } = jest.requireMock('../../services/api.service') as {
  configApi: {
    getConfig: jest.Mock;
  };
};

describe('App config functional behavior', () => {
  beforeEach(() => {
    useConfigStore.setState({
      symbol: 'BTCUSDT',
      timeframe: '5m',
      leverage: 1,
      riskPercent: 1,
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  test('keeps zero leverage and zero risk percent from config payloads', async () => {
    configApi.getConfig.mockResolvedValue({
      success: true,
      data: {
        exchange: { symbol: 'ETHUSDT' },
        timeframes: { primary: { interval: '15' } },
        trading: { leverage: 0 },
        riskManagement: { stopLossPercent: 0 },
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(useConfigStore.getState()).toMatchObject({
        symbol: 'ETHUSDT',
        timeframe: '15m',
        leverage: 0,
        riskPercent: 0,
      });
    });
  });
});
