import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { LiveTicker } from '../../components/dashboard/LiveTicker';
import { PositionCard } from '../../components/dashboard/PositionCard';
import { StrategyStatus } from '../../components/dashboard/StrategyStatus';
import { TrendSlider } from '../../components/dashboard/TrendSlider';
import { useBotStore } from '../../stores/botStore';
import { useMarketStore } from '../../stores/marketStore';

jest.mock('../../services/api.service', () => ({
  dataApi: {
    getMarketData: jest.fn(),
  },
  configApi: {
    getStrategies: jest.fn(),
    toggleStrategy: jest.fn(),
  },
}));

jest.mock('../../services/websocket.service', () => ({
  wsClient: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

const { configApi, dataApi } = jest.requireMock('../../services/api.service') as {
  dataApi: {
    getMarketData: jest.Mock;
  };
  configApi: {
    getStrategies: jest.Mock;
    toggleStrategy: jest.Mock;
  };
};

describe('dashboard copy functional coverage', () => {
  beforeEach(() => {
    useMarketStore.getState().reset();
    useBotStore.getState().reset();
    jest.clearAllMocks();
    dataApi.getMarketData.mockResolvedValue({
      success: true,
      data: {
        currentPrice: 0,
        priceChangePercent: 0,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('TrendSlider renders ASCII-safe market guidance copy', () => {
    useMarketStore.setState({ trend: 'BULLISH', btcCorrelation: 0.81234 });

    render(<TrendSlider />);

    expect(screen.getByText('Strong Uptrend')).toBeInTheDocument();
    expect(screen.getAllByText('BULLISH')).toHaveLength(2);
    expect(screen.getByText('0.812')).toBeInTheDocument();
    expect(
      screen.getByText('Momentum favors buyers. Long positions have the edge.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/ðŸ“ˆ|ðŸ“‰|âš–ï¸|Ã¢â€ â€™|Ã¢â‚¬â€/)).not.toBeInTheDocument();
  });

  test('LiveTicker renders N/A fallbacks for missing metrics, trend, and correlation', async () => {
    render(<LiveTicker />);

    expect(await screen.findByText('Live Market Data')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(6);
    expect(screen.queryByText(/â€”|Ã¢â‚¬â€|Ã¢â€šÂ¬/)).not.toBeInTheDocument();
  });

  test('StrategyStatus renders plain enabled and disabled state labels', async () => {
    configApi.getStrategies.mockResolvedValue({
      success: true,
      data: {
        strategies: [
          { id: 'alpha', name: 'Alpha', enabled: true },
          { id: 'beta', name: 'Beta', enabled: false },
        ],
      },
    });

    render(<StrategyStatus />);

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('Click to enable or disable strategies')).toBeInTheDocument();
    expect(screen.queryByText(/âœ“|âœ—|Ã¢Å“/)).not.toBeInTheDocument();
  });

  test('PositionCard renders a plain take-profit hit badge', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-13T12:00:00.000Z'));

    useBotStore.setState({
      currentPosition: {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: 0.25,
        entryPrice: 100000,
        currentPrice: 101000,
        leverage: 5,
        marginUsed: 5000,
        unrealizedPnL: 250,
        unrealizedPnLPercent: 1.25,
        stopLoss: {
          price: 99000,
          breakeven: 100100,
        },
        takeProfits: [
          { price: 101500, quantity: 0.1, hit: true },
          { price: 102000, quantity: 0.15, hit: false },
        ],
        openedAt: Date.parse('2026-05-13T11:58:55.000Z'),
        status: 'OPEN',
      },
    });

    render(<PositionCard />);

    await waitFor(() => {
      expect(screen.getByText('1m 5s')).toBeInTheDocument();
    });
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.queryByText(/âœ“ HIT|Ã¢Å“/)).not.toBeInTheDocument();
  });
});
