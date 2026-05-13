import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { PriceChart } from '../../components/charts/PriceChart';

const setCandlestickData = jest.fn();
const setMarkers = jest.fn();
const setHistogramData = jest.fn();
const candlestickPriceScaleApplyOptions = jest.fn();
const volumePriceScaleApplyOptions = jest.fn();
const timeScaleFitContent = jest.fn();
const chartApplyOptions = jest.fn();
const chartRemove = jest.fn();
const addCandlestickSeries = jest.fn(() => ({
  setData: setCandlestickData,
  setMarkers,
  priceScale: () => ({
    applyOptions: candlestickPriceScaleApplyOptions,
  }),
}));
const addHistogramSeries = jest.fn(() => ({
  setData: setHistogramData,
}));
const chartPriceScale = jest.fn(() => ({
  applyOptions: volumePriceScaleApplyOptions,
}));
const chartTimeScale = jest.fn(() => ({
  fitContent: timeScaleFitContent,
}));
const mockCreateChart = jest.fn((_container?: unknown, _options?: unknown) => ({
  addCandlestickSeries,
  addHistogramSeries,
  priceScale: chartPriceScale,
  timeScale: chartTimeScale,
  applyOptions: chartApplyOptions,
  remove: chartRemove,
}));

jest.mock('lightweight-charts', () => ({
  createChart: (container: unknown, options: unknown) => mockCreateChart(container, options),
  ColorType: {
    Solid: 'solid',
  },
}));

jest.mock('../../services/api.service', () => ({
  dataApi: {
    getCandles: jest.fn(),
    getPositionHistory: jest.fn(),
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
    getCandles: jest.Mock;
    getPositionHistory: jest.Mock;
  };
};

describe('PriceChart functional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataApi.getCandles.mockResolvedValue({
      success: true,
      data: {
        candles: [],
      },
    });
    dataApi.getPositionHistory.mockResolvedValue({
      success: true,
      data: {
        positions: [],
      },
    });
  });

  test('preserves zero realized pnl in position marker labels', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 10,
          },
        ],
      },
    });
    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: {
        positions: [
          {
            entryTime: 1_000,
            exitTime: 2_000,
            side: 'LONG',
            pnl: 0,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      expect(setMarkers).toHaveBeenCalled();
    });

    const markerCalls = setMarkers.mock.calls.flatMap(([markerBatch]) => markerBatch);
    expect(markerCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: '+0.00 USDT',
        }),
      ]),
    );
  });

  test('renders a volume histogram when candle volume is explicitly zero', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 0,
          },
          {
            timestamp: 2_000,
            open: 102,
            high: 106,
            low: 101,
            close: 104,
            volume: 0,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      expect(addHistogramSeries).toHaveBeenCalled();
    });

    expect(setHistogramData).toHaveBeenCalledWith([
      expect.objectContaining({ value: 0 }),
      expect.objectContaining({ value: 0 }),
    ]);
  });
});
