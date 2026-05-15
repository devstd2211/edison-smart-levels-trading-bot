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
let containerWidth = 640;
let resizeObserverCallback: ResizeObserverCallback | undefined;
const resizeObserverObserve = jest.fn();
const resizeObserverDisconnect = jest.fn();

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
  beforeAll(() => {
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return containerWidth;
      },
    });

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe = resizeObserverObserve;
      disconnect = resizeObserverDisconnect;
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    websocketHandlers.clear();
    containerWidth = 640;
    resizeObserverCallback = undefined;
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
    });

    const latestCandles = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
    }>;

    expect(latestCandles).toEqual([
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

  test('synchronizes chart data when the candles prop is replaced by the parent', async () => {
    const { rerender } = render(
      <PriceChart
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
        ]}
      />,
    );

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

    rerender(
      <PriceChart
        candles={[
          {
            time: 2_000,
            open: 200,
            high: 210,
            low: 190,
            close: 205,
            volume: 13,
          },
        ]}
      />,
    );

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 2000,
          open: 200,
          high: 210,
          low: 190,
          close: 205,
        }),
      ]);
    });
  });

  test('ignores stale candle fetches that resolve after a newer timeframe request', async () => {
    let resolveFirstFetch: ((value: unknown) => void) | undefined;
    let resolveSecondFetch: ((value: unknown) => void) | undefined;

    dataApi.getCandles
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstFetch = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondFetch = resolve;
          }),
      );

    const { rerender } = render(<PriceChart timeframe="5m" />);

    rerender(<PriceChart timeframe="1h" />);

    act(() => {
      resolveSecondFetch?.({
        success: true,
        data: {
          candles: [
            {
              timestamp: 2_000,
              open: 200,
              high: 220,
              low: 180,
              close: 210,
              volume: 5,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 2000,
          close: 210,
        }),
      ]);
    });

    act(() => {
      resolveFirstFetch?.({
        success: true,
        data: {
          candles: [
            {
              timestamp: 1_000,
              open: 100,
              high: 110,
              low: 90,
              close: 105,
              volume: 4,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 2000,
          close: 210,
        }),
      ]);
    });
  });

  test('keeps the last controlled candles visible while uncontrolled handoff fetches live candles', async () => {
    let resolveLiveFetch: ((value: unknown) => void) | undefined;

    dataApi.getCandles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLiveFetch = resolve;
        }),
    );

    const { rerender, getByText, queryByText } = render(
      <PriceChart
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([
        expect.objectContaining({
          time: 1000,
          close: 102,
        }),
      ]);
    });

    rerender(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(dataApi.getCandles).toHaveBeenCalledTimes(1);
    });

    const handoffCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      close: number;
    }>;

    expect(handoffCall).toEqual([
      expect.objectContaining({
        time: 1000,
        close: 102,
      }),
    ]);
    expect(getByText('Loading candles...')).toBeInTheDocument();
    expect(queryByText('Last 0 candles')).not.toBeInTheDocument();

    act(() => {
      resolveLiveFetch?.({
        success: true,
        data: {
          candles: [],
        },
      });
    });

    await waitFor(() => {
      expect(getByText('Last 0 candles')).toBeInTheDocument();
    });
  });

  test('preserves websocket candle updates that arrive before a controlled-to-uncontrolled handoff fetch resolves', async () => {
    let resolveLiveFetch: ((value: unknown) => void) | undefined;

    dataApi.getCandles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLiveFetch = resolve;
        }),
    );

    const { rerender } = render(
      <PriceChart
        timeframe="5m"
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([
        expect.objectContaining({
          time: 1000,
          close: 102,
        }),
      ]);
    });

    rerender(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(dataApi.getCandles).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 2_000,
          open: 103,
          high: 109,
          low: 99,
          close: 108,
          volume: 9,
        },
      });
    });

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({ time: 1000, close: 102 }),
        expect.objectContaining({ time: 2000, close: 108 }),
      ]);
    });

    act(() => {
      resolveLiveFetch?.({
        success: true,
        data: {
          candles: [
            {
              timestamp: 1_000,
              open: 100,
              high: 105,
              low: 95,
              close: 101,
              volume: 8,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({ time: 1000, close: 102 }),
        expect.objectContaining({ time: 2000, close: 108 }),
      ]);
    });
  });

  test('drops queued position marker reloads after unmount instead of firing follow-up fetches', async () => {
    let resolvePositionHistory: ((value: unknown) => void) | undefined;

    dataApi.getPositionHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePositionHistory = resolve;
        }),
    );

    const { unmount } = render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_OPENED', { id: 'open-queued' });
    });

    unmount();

    act(() => {
      resolvePositionHistory?.({
        success: true,
        data: {
          positions: [],
        },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
  });

  test('hides the loading indicator immediately when candles are controlled by props', async () => {
    const { queryByText } = render(
      <PriceChart
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalled();
    });

    expect(queryByText('Loading candles...')).not.toBeInTheDocument();
  });

  test('treats an empty candles prop as controlled input instead of falling back to API candles', async () => {
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

    const { queryByText, getByText } = render(<PriceChart candles={[]} />);

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([]);
    });

    expect(dataApi.getCandles).not.toHaveBeenCalled();
    expect(queryByText('Loading candles...')).not.toBeInTheDocument();
    expect(getByText('Last 0 candles')).toBeInTheDocument();
  });

  test('ignores websocket candle updates while candles are controlled by props', async () => {
    render(
      <PriceChart
        timeframe="5m"
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([
        expect.objectContaining({
          time: 1000,
          close: 102,
        }),
      ]);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 2_000,
          open: 103,
          high: 109,
          low: 97,
          close: 108,
          volume: 9,
        },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      close: number;
    }>;

    expect(latestCall).toEqual([
      expect.objectContaining({
        time: 1000,
        close: 102,
      }),
    ]);
  });

  test('keeps only the newest marker history response when a newer reload is queued', async () => {
    let resolveFirstPositionHistory: ((value: unknown) => void) | undefined;
    let resolveSecondPositionHistory: ((value: unknown) => void) | undefined;

    dataApi.getPositionHistory
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstPositionHistory = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondPositionHistory = resolve;
          }),
      );

    render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_CLOSED', { id: 'reload-newer' });
      resolveFirstPositionHistory?.({
        success: true,
        data: {
          positions: [
            {
              entryTime: 1_000,
              side: 'LONG',
              pnl: 5,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(2);
    });

    const markerCountAfterFirstResponse = setMarkers.mock.calls.length;

    act(() => {
      resolveSecondPositionHistory?.({
        success: true,
        data: {
          positions: [
            {
              entryTime: 2_000,
              side: 'SHORT',
              pnl: -7,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(setMarkers.mock.calls.length).toBeGreaterThan(markerCountAfterFirstResponse);
    });

    const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      text: string;
    }>;

    expect(latestMarkers).toEqual([
      expect.objectContaining({
        time: 2,
        text: 'SHORT',
      }),
    ]);
  });

  test('recovers queued marker reloads after a failed history request', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getPositionHistory
      .mockRejectedValueOnce(new Error('marker history unavailable'))
      .mockResolvedValueOnce({
        success: true,
        data: {
          positions: [
            {
              entryTime: 2_000,
              side: 'SHORT',
              pnl: -7,
            },
          ],
        },
      });

    render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_OPENED', { id: 'retry-after-error' });
    });

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({
          time: 2,
          text: 'SHORT',
        }),
      ]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch position markers:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test('does not recreate the chart instance for candle and marker updates', async () => {
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

    const { rerender } = render(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledTimes(1);
    });

    rerender(<PriceChart timeframe="5m" height={420} />);

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 2_000,
          open: 103,
          high: 108,
          low: 99,
          close: 107,
          volume: 12,
        },
      });
    });

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalled();
    });

    expect(mockCreateChart).toHaveBeenCalledTimes(1);
  });

  test('resynchronizes chart width when a previously collapsed container becomes visible again', async () => {
    containerWidth = 0;

    render(<PriceChart />);

    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          width: 1,
        }),
      );
    });

    containerWidth = 640;

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(chartApplyOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 640,
      }),
    );
  });

  test('disconnects the resize observer when the chart unmounts', async () => {
    const { unmount } = render(<PriceChart />);

    await waitFor(() => {
      expect(resizeObserverObserve).toHaveBeenCalled();
    });

    unmount();

    expect(resizeObserverDisconnect).toHaveBeenCalledTimes(1);
  });

  test('keeps websocket subscriptions stable across timeframe rerenders', async () => {
    const { rerender } = render(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledTimes(1);
    });

    expect(websocketHandlers.get('CANDLE_CLOSED')?.size).toBe(1);
    expect(websocketHandlers.get('POSITION_OPENED')?.size).toBe(1);
    expect(websocketHandlers.get('POSITION_CLOSED')?.size).toBe(1);

    rerender(<PriceChart timeframe="1h" />);

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as unknown[];
      expect(Array.isArray(latestCall)).toBe(true);
    });

    expect(websocketHandlers.get('CANDLE_CLOSED')?.size).toBe(1);
    expect(websocketHandlers.get('POSITION_OPENED')?.size).toBe(1);
    expect(websocketHandlers.get('POSITION_CLOSED')?.size).toBe(1);
  });

  test('does not refit the candle viewport when only position markers reload', async () => {
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
    dataApi.getPositionHistory
      .mockResolvedValueOnce({
        success: true,
        data: {
          positions: [
            {
              entryTime: 1_000,
              side: 'LONG',
              pnl: 5,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          positions: [
            {
              entryTime: 2_000,
              side: 'SHORT',
              pnl: -7,
            },
          ],
        },
      });

    render(<PriceChart />);

    await waitFor(() => {
      expect(timeScaleFitContent).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_CLOSED', { id: 'marker-only-reload' });
    });

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({
          time: 2,
          text: 'SHORT',
        }),
      ]);
    });

    expect(timeScaleFitContent).toHaveBeenCalledTimes(1);
  });

  test('clears the custom autoscale range and restores price autoscale when candles become empty', async () => {
    const { rerender } = render(
      <PriceChart
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(candlestickSeriesApplyOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          autoscaleInfoProvider: expect.any(Function),
        }),
      );
    });

    rerender(<PriceChart candles={[]} />);

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([]);
    });

    expect(candlestickSeriesApplyOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        autoscaleInfoProvider: undefined,
      }),
    );
    expect(candlestickPriceScaleApplyOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        autoScale: true,
      }),
    );
  });

  test('retries queued marker reloads after a resolved API error response', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getPositionHistory
      .mockResolvedValueOnce({
        success: false,
        error: 'marker history unavailable',
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          positions: [
            {
              entryTime: 2_000,
              side: 'SHORT',
              pnl: -7,
            },
          ],
        },
      });

    render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_OPENED', { id: 'retry-after-response-error' });
    });

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({
          time: 2,
          text: 'SHORT',
        }),
      ]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch position markers:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test('guards zero-width container measurements during chart creation and resize updates', async () => {
    containerWidth = 0;

    render(<PriceChart />);

    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateChart).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        width: 1,
      }),
    );
    expect(chartApplyOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({
        width: 0,
      }),
    );

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(chartApplyOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({
        width: 0,
      }),
    );
  });

  test('preserves height updates when the container is temporarily zero-width', async () => {
    containerWidth = 0;

    const { rerender } = render(<PriceChart height={400} />);

    await waitFor(() => {
      expect(mockCreateChart).toHaveBeenCalledTimes(1);
    });

    rerender(<PriceChart height={420} />);

    await waitFor(() => {
      expect(chartApplyOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 420,
        }),
      );
    });

    expect(chartApplyOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({
        width: 0,
        height: 420,
      }),
    );
  });
});
