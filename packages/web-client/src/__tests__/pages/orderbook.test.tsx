import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { OrderBook } from '../../pages/OrderBook';

jest.mock('../../services/api.service', () => ({
  dataApi: {
    getOrderBook: jest.fn(),
    getWalls: jest.fn(),
    getFundingRate: jest.fn(),
  },
}));

jest.mock('../../services/websocket.service', () => ({
  wsClient: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

const { dataApi } = jest.requireMock('../../services/api.service') as {
  dataApi: {
    getOrderBook: jest.Mock;
    getWalls: jest.Mock;
    getFundingRate: jest.Mock;
  };
};

describe('OrderBook page', () => {
  beforeEach(() => {
    dataApi.getOrderBook.mockResolvedValue({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        asks: [
          { price: 101, quantity: 2 },
          { price: 102, quantity: 3 },
        ],
        bids: [
          { price: 99, quantity: 4 },
          { price: 98, quantity: 1 },
        ],
        timestamp: Date.now(),
      },
    });
    dataApi.getWalls.mockResolvedValue({
      success: true,
      data: { walls: [] },
    });
    dataApi.getFundingRate.mockResolvedValue({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        current: 0.0002,
        predicted: -0.0001,
        nextFundingTime: Date.now() + 60 * 60 * 1000,
        lastFundingTime: Date.now(),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders cleaned legend copy without mojibake markers', async () => {
    render(<OrderBook />);

    expect(await screen.findByText('Order Book Monitor')).toBeInTheDocument();
    expect(await screen.findByText('Green = Buy orders (bid)')).toBeInTheDocument();
    expect(screen.getByText('Strength = Share of the visible order book')).toBeInTheDocument();
    expect(screen.getByText('Positive rates = Longs pay shorts')).toBeInTheDocument();
    expect(
      screen.getByText(/Large walls near support or resistance can indicate institutional interest/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/Ã¢|Ã°Å¸|Ã¢Å“â€¦|Ã¢Å¡/)).not.toBeInTheDocument();
  });

  test('preserves zero-valued top bid and ask summary prices instead of replacing them with fallbacks', async () => {
    dataApi.getOrderBook.mockResolvedValueOnce({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        asks: [
          { price: 102, quantity: 2 },
          { price: 0, quantity: 3 },
        ],
        bids: [
          { price: 0, quantity: 4 },
          { price: 98, quantity: 1 },
        ],
        timestamp: Date.now(),
      },
    });

    render(<OrderBook />);

    const topBidCard = (await screen.findByText('Top Bid')).closest('div');
    const topAskCard = (await screen.findByText('Top Ask')).closest('div');

    expect(topBidCard).not.toBeNull();
    expect(topAskCard).not.toBeNull();
    expect(within(topBidCard as HTMLElement).getByText('$0.00')).toBeInTheDocument();
    expect(within(topAskCard as HTMLElement).getByText('$0.00')).toBeInTheDocument();
  });
});
