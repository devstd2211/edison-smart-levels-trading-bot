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

  test('guards spread, bar widths, volume profile max volume, and predicted funding copy when visible values are zero', async () => {
    dataApi.getOrderBook.mockResolvedValueOnce({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        asks: [
          { price: 101, quantity: 0 },
          { price: 0, quantity: 0 },
        ],
        bids: [
          { price: 0, quantity: 0 },
          { price: 98, quantity: 0 },
        ],
        timestamp: Date.now(),
      },
    });
    dataApi.getFundingRate.mockResolvedValueOnce({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        current: 0,
        predicted: 0,
        nextFundingTime: Date.now() + 60 * 60 * 1000,
        lastFundingTime: Date.now(),
      },
    });

    const { container } = render(<OrderBook />);

    expect(await screen.findByText('Order Book Monitor')).toBeInTheDocument();
    expect(screen.queryByText('Infinity%')).not.toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
    expect(screen.getAllByText('0.000%').length).toBeGreaterThan(0);
    expect(screen.getByText(/Predicted rate: Funding pressure balanced/)).toBeInTheDocument();
    expect(screen.queryByText('LONG pressure continues')).not.toBeInTheDocument();
    expect(screen.queryByText('SHORT pressure continues')).not.toBeInTheDocument();
    expect(screen.queryByText('+0.0000%')).not.toBeInTheDocument();
    expect(screen.queryByText('-0.0000%')).not.toBeInTheDocument();

    const maxVolumeCard = (await screen.findByText('Max Volume')).closest('div');
    expect(maxVolumeCard).not.toBeNull();
    expect(within(maxVolumeCard as HTMLElement).getByText('0.00')).toBeInTheDocument();

    const zeroWidthBars = container.querySelectorAll('[style*="width: 0px"], [style*="width: 0%"]');
    expect(zeroWidthBars.length).toBeGreaterThan(0);
  });

  test('renders neutral current funding copy and no sign when the current funding rate is exactly zero', async () => {
    dataApi.getFundingRate.mockResolvedValueOnce({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        current: 0,
        predicted: 0.0002,
        nextFundingTime: Date.now() + 60 * 60 * 1000,
        lastFundingTime: Date.now(),
      },
    });

    render(<OrderBook />);

    expect(await screen.findByText('Order Book Monitor')).toBeInTheDocument();
    expect(screen.getByText('0.0000%')).toBeInTheDocument();
    expect(screen.getByText('Funding balanced')).toBeInTheDocument();
    expect(
      screen.getByText('Neutral rates keep LONG and SHORT funding balanced')
    ).toBeInTheDocument();
    expect(screen.queryByText('+0.0000%')).not.toBeInTheDocument();
    expect(screen.queryByText('-0.0000%')).not.toBeInTheDocument();
    expect(screen.queryByText('High long funding')).not.toBeInTheDocument();
    expect(screen.queryByText('High short funding')).not.toBeInTheDocument();
    expect(screen.queryByText('Longs pay shorts')).not.toBeInTheDocument();
    expect(screen.queryByText('Shorts pay longs')).not.toBeInTheDocument();
  });

  test('renders a zero predicted funding rate with neutral color and no sign', async () => {
    dataApi.getFundingRate.mockResolvedValueOnce({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        current: 0.0002,
        predicted: 0,
        nextFundingTime: Date.now() + 60 * 60 * 1000,
        lastFundingTime: Date.now(),
      },
    });

    render(<OrderBook />);

    expect(await screen.findByText('Predicted Next Rate')).toBeInTheDocument();

    const predictedValue = screen.getAllByText('0.0000%').find((node) =>
      node.className.includes('text-3xl font-bold')
    );

    expect(predictedValue).toBeDefined();
    expect(predictedValue?.className).toContain('text-gray-600');
    expect(screen.queryByText('+0.0000%')).not.toBeInTheDocument();
    expect(screen.queryByText('-0.0000%')).not.toBeInTheDocument();
  });

  test('renders an empty volume-profile range without fabricated price levels when the order book is empty', async () => {
    dataApi.getOrderBook.mockResolvedValueOnce({
      success: true,
      data: {
        symbol: 'BTCUSDT',
        asks: [],
        bids: [],
        timestamp: Date.now(),
      },
    });

    render(<OrderBook />);

    const priceRangeCard = (await screen.findByText('Price Range')).closest('div');
    const levelsCard = (await screen.findByText('Levels')).closest('div');

    expect(priceRangeCard).not.toBeNull();
    expect(levelsCard).not.toBeNull();
    expect(within(priceRangeCard as HTMLElement).getByText('N/A')).toBeInTheDocument();
    expect(within(levelsCard as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('$3000.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$undefined/)).not.toBeInTheDocument();
  });

  test('builds the volume-profile range from visible order-book levels instead of synthetic placeholder prices', async () => {
    render(<OrderBook />);

    const priceRangeCard = (await screen.findByText('Price Range')).closest('div');

    expect(priceRangeCard).not.toBeNull();
    expect(
      within(priceRangeCard as HTMLElement).getByText('$98.00 - $102.00')
    ).toBeInTheDocument();
    expect(screen.queryByText('$3000.00 - $3150.00')).not.toBeInTheDocument();
  });
});
