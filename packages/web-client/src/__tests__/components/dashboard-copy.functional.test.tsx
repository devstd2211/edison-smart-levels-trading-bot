import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { BalanceCard } from '../../components/dashboard/BalanceCard';
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

const { wsClient } = jest.requireMock('../../services/websocket.service') as {
  wsClient: {
    on: jest.Mock;
    off: jest.Mock;
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
    expect(
      screen.queryByText(/Ã°Å¸â€œË†|Ã°Å¸â€œâ€°|Ã¢Å¡â€“Ã¯Â¸Â|ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/)
    ).not.toBeInTheDocument();
  });

  test('LiveTicker renders N/A fallbacks for missing metrics, trend, and correlation', async () => {
    render(<LiveTicker />);

    expect(await screen.findByText('Live Market Data')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(6);
    expect(
      screen.queryByText(/Ã¢â‚¬â€|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬/)
    ).not.toBeInTheDocument();
  });

  test('LiveTicker keeps zero-valued websocket prices as the latest observed boundary', async () => {
    useMarketStore.setState({ currentPrice: 100, priceChangePercent: 0 });

    const { container } = render(<LiveTicker />);

    expect(await screen.findByText('Live Market Data')).toBeInTheDocument();

    const marketDataHandler = wsClient.on.mock.calls.find(
      ([eventName]: [string]) => eventName === 'MARKET_DATA_UPDATE'
    )?.[1] as ((payload: { currentPrice: number }) => void) | undefined;

    expect(marketDataHandler).toBeDefined();

    act(() => {
      marketDataHandler?.({ currentPrice: 0 });
    });

    act(() => {
      useMarketStore.setState({ currentPrice: 0, priceChangePercent: 0 });
    });

    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument();
  });

  test('LiveTicker renders zero-valued distance to level instead of dropping it', async () => {
    useMarketStore.setState({
      currentPrice: 100,
      priceChangePercent: 0,
      nearestLevel: 100,
      distanceToLevel: 0,
    });

    render(<LiveTicker />);

    expect(await screen.findByText('Live Market Data')).toBeInTheDocument();
    expect(screen.getByText('(0.00%)')).toBeInTheDocument();
  });

  test('LiveTicker renders a neutral zero price-change direction instead of implying upside', async () => {
    useMarketStore.setState({
      currentPrice: 100,
      priceChangePercent: 0,
    });

    render(<LiveTicker />);

    expect(await screen.findByText('Live Market Data')).toBeInTheDocument();
    expect(screen.getByText('FLAT 0.00%')).toBeInTheDocument();
    expect(screen.queryByText('UP +0.00%')).not.toBeInTheDocument();
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
    expect(screen.queryByText(/Ã¢Å“â€œ|Ã¢Å“â€”|ÃƒÂ¢Ã…â€œ/)).not.toBeInTheDocument();
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
        currentPrice: 0,
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
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('+99.00% away')).toBeInTheDocument();
    expect(screen.queryByText(/Ã¢Å“â€œ HIT|ÃƒÂ¢Ã…â€œ/)).not.toBeInTheDocument();
  });

  test('PositionCard preserves zero-value boundaries for openedAt and breakeven without division artifacts', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(5_000));

    useBotStore.setState({
      currentPosition: {
        id: 'pos-zero-boundaries',
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: 1,
        entryPrice: 0,
        currentPrice: undefined,
        leverage: 1,
        marginUsed: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        stopLoss: {
          price: 0,
          breakeven: 0,
        },
        takeProfits: [
          { price: 10, quantity: 0.5, hit: false },
          { price: 20, quantity: 0.5, hit: false },
        ],
        openedAt: 0,
        status: 'OPEN',
      } as unknown as NonNullable<ReturnType<typeof useBotStore.getState>['currentPosition']>,
    });

    render(<PositionCard />);

    await waitFor(() => {
      expect(screen.getByText('5s')).toBeInTheDocument();
    });
    expect(screen.getByText('0.00 (0.00%)')).toBeInTheDocument();
    expect(screen.queryByText('+0.00 (0.00%)')).not.toBeInTheDocument();
    expect(screen.getByText('Breakeven triggered at: $0.00')).toBeInTheDocument();
    expect(screen.queryByText(/Infinity% away|NaN% away/)).not.toBeInTheDocument();
  });

  test('BalanceCard keeps a zero unrealized pnl in a neutral state instead of implying profit', () => {
    useBotStore.setState({
      balance: 1_000,
      unrealizedPnL: 0,
    });

    render(<BalanceCard />);

    const pnlAmount = screen.getByText('0.00 USDT');
    const pnlPercent = screen.getByText('0.00%');

    expect(pnlAmount).toBeInTheDocument();
    expect(pnlPercent).toBeInTheDocument();
    expect(screen.queryByText('+0.00 USDT')).not.toBeInTheDocument();
    expect(screen.queryByText('+0.00%')).not.toBeInTheDocument();
    expect(pnlAmount.className).toContain('text-gray-600');
    expect(pnlPercent.className).toContain('text-gray-600');
  });
});
