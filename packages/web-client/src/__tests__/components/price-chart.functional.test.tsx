import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { PriceChart } from '../../components/charts/PriceChart';

const setCandlestickData = jest.fn();
const setMarkers = jest.fn();
const setHistogramData = jest.fn();
const candlestickSeriesApplyOptions = jest.fn();
const candlestickPriceScaleApplyOptions = jest.fn();
const volumePriceScaleApplyOptions = jest.fn();
const timeScaleFitContent = jest.fn();
const chartApplyOptions = jest.fn();
const chartRemove = jest.fn();
const addCandlestickSeries = jest.fn(() => ({
  setData: setCandlestickData,
  setMarkers,
  applyOptions: candlestickSeriesApplyOptions,
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
const websocketHandlers = new Map<string, Set<(payload: unknown) => void>>();

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
    on: jest.fn((event: string, handler: (payload: unknown) => void) => {
      const handlers = websocketHandlers.get(event) ?? new Set<(payload: unknown) => void>();
      handlers.add(handler);
      websocketHandlers.set(event, handlers);
    }),
    off: jest.fn((event: string, handler: (payload: unknown) => void) => {
      websocketHandlers.get(event)?.delete(handler);
    }),
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
    websocketHandlers.clear();
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

  const emitWebsocketEvent = (event: string, payload: unknown) => {
    websocketHandlers.get(event)?.forEach((handler) => handler(payload));
  };

  test('preserves zero-valued high and low candle fields while dropping incomplete candles and keeping marker timestamps', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 0,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 10,
          },
          {
            timestamp: 1_000,
            open: 100,
            high: 105,
            low: 0,
            close: 102,
            volume: 12,
          },
          {
            timestamp: 2_000,
            open: 102,
            high: undefined,
            low: 101,
            close: 103,
            volume: 8,
          },
        ],
      },
    });
    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: {
        positions: [
          {
            entryTime: 0,
            exitTime: 0,
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

    expect(setCandlestickData).toHaveBeenCalledWith([
      expect.objectContaining({
        time: 0,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      }),
      expect.objectContaining({
        time: 1000,
        open: 100,
        high: 105,
        low: 0,
        close: 102,
      }),
    ]);
    expect(setCandlestickData).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ time: 2000 })]),
    );

    const markerCalls = setMarkers.mock.calls.flatMap(([markerBatch]) => markerBatch);
    expect(markerCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          time: 0,
          text: 'LONG',
        }),
        expect.objectContaining({
          time: 0,
          text: '0.00 USDT',
          color: '#6b7280',
        }),
      ]),
    );
  });

  test('adds a visible price range for flat candles so zero-span charts do not collapse', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 1_000,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      expect(candlestickSeriesApplyOptions).toHaveBeenCalled();
    });

    const lastCall = candlestickSeriesApplyOptions.mock.calls[candlestickSeriesApplyOptions.mock.calls.length - 1];
    const autoscaleOptions = lastCall?.[0] as {
      autoscaleInfoProvider?: () => { priceRange: { minValue: number; maxValue: number } };
    };
    const autoscaleInfo = autoscaleOptions.autoscaleInfoProvider?.();

    expect(autoscaleInfo).toEqual({
      priceRange: {
        minValue: -1,
        maxValue: 1,
      },
    });
  });

  test('renders a volume histogram when candle volume is explicitly zero', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 1_000,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
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
      expect.objectContaining({ value: 0, color: 'rgba(107, 114, 128, 0.5)' }),
      expect.objectContaining({ value: 0 }),
    ]);
  });

  test('replaces duplicate websocket candle timestamps instead of appending duplicate bars', async () => {
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
            volume: 8,
          },
        ],
      },
    });

    render(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([
        expect.objectContaining({
          time: 1000,
          open: 100,
          high: 105,
          low: 95,
          close: 102,
        }),
      ]);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 1_000,
          open: 100,
          high: 110,
          low: 94,
          close: 109,
          volume: 12,
        },
      });
    });

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        high: number;
        low: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 1000,
          high: 110,
          low: 94,
          close: 109,
        }),
      ]);
    });
  });

  test('coalesces rapid position marker refresh requests into one queued follow-up fetch', async () => {
    let resolvePositionHistory: ((value: unknown) => void) | undefined;

    dataApi.getPositionHistory
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePositionHistory = resolve;
          }),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          positions: [],
        },
      });

    render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_OPENED', { id: 'open-1' });
      emitWebsocketEvent('POSITION_CLOSED', { id: 'close-1' });
      emitWebsocketEvent('POSITION_OPENED', { id: 'open-2' });
    });

    expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);

    act(() => {
      resolvePositionHistory?.({
        success: true,
        data: {
          positions: [],
        },
      });
    });

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(2);
    });
  });
});
