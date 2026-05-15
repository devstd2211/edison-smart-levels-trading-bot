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

  const buildSequentialCandles = (
    startTime: number,
    count: number,
    closeOffset = 0,
  ) =>
    Array.from({ length: count }, (_, index) => {
      const time = startTime + index;
      const close = time + closeOffset;

      return {
        time,
        open: close - 1,
        high: close + 2,
        low: close - 2,
        close,
        volume: time,
      };
    });

  test('logs malformed candle payload entries while preserving zero-valued high and low fields and marker timestamps', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed candle payload entry:',
      expect.any(Error),
      expect.objectContaining({
        timestamp: 2_000,
      }),
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

    consoleErrorSpy.mockRestore();
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

    const autoscaleCall = candlestickSeriesApplyOptions.mock.calls.find(
      ([options]) => typeof (options as { autoscaleInfoProvider?: unknown }).autoscaleInfoProvider === 'function',
    );
    const autoscaleOptions = autoscaleCall?.[0] as {
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

  test('normalizes mixed-unit fetched candle timestamps before deduping and rendering', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 1_710_000_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
          {
            timestamp: 1_710_000_060,
            open: 102,
            high: 107,
            low: 101,
            close: 105,
            volume: 7,
          },
          {
            timestamp: 1_710_000_060_000,
            open: 103,
            high: 109,
            low: 100,
            close: 107,
            volume: 9,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 1710000000,
          close: 102,
        }),
        expect.objectContaining({
          time: 1710000060,
          close: 107,
        }),
      ]);
    });
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

  test('normalizes mixed-unit websocket candle timestamps before replacing the live bar', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: [
          {
            timestamp: 1_710_000_000,
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
          time: 1710000000,
          close: 102,
        }),
      ]);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 1_710_000_000_000,
          open: 101,
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
          time: 1710000000,
          high: 110,
          low: 94,
          close: 109,
        }),
      ]);
    });
  });

  test('drops malformed websocket candle payloads and preserves the last rendered live dataset', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
          high: undefined,
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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed websocket candle payload:',
      expect.any(Error),
      expect.objectContaining({
        timestamp: 2_000,
        high: undefined,
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('ignores websocket candle events whose envelope is not an object', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
          close: 102,
        }),
      ]);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', null);
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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Ignored malformed websocket candle event:',
      expect.any(Error),
      null,
    );

    consoleErrorSpy.mockRestore();
  });

  test('ignores websocket candle events whose timeframe envelope is malformed', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
          close: 102,
        }),
      ]);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: 5,
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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Ignored malformed websocket candle event:',
      expect.any(Error),
      expect.objectContaining({
        timeframe: 5,
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('ignores websocket candle events whose candle envelope is missing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
          close: 102,
        }),
      ]);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Ignored malformed websocket candle event:',
      expect.any(Error),
      expect.objectContaining({
        timeframe: '5m',
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('does not let a malformed websocket duplicate timestamp replace the last valid candle', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
          high: 111,
          low: 94,
          close: undefined,
          volume: 12,
        },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      high: number;
      low: number;
      close: number;
    }>;

    expect(latestCall).toEqual([
      expect.objectContaining({
        time: 1000,
        high: 105,
        low: 95,
        close: 102,
      }),
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed websocket candle payload:',
      expect.any(Error),
      expect.objectContaining({
        timestamp: 1_000,
        close: undefined,
      }),
    );

    consoleErrorSpy.mockRestore();
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

  test('ignores malformed position-opened event envelopes instead of reloading markers', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_OPENED', 'invalid-open-envelope');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Ignored malformed position opened event:',
      expect.any(Error),
      'invalid-open-envelope',
    );

    consoleErrorSpy.mockRestore();
  });

  test('ignores malformed position-closed event envelopes instead of reloading markers', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<PriceChart />);

    await waitFor(() => {
      expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('POSITION_CLOSED', {
        pnl: Number.NaN,
        exitType: 42,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(dataApi.getPositionHistory).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Ignored malformed position closed event:',
      expect.any(Error),
      expect.objectContaining({
        pnl: Number.NaN,
        exitType: 42,
      }),
    );

    consoleErrorSpy.mockRestore();
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

  test('logs malformed controlled candle payload entries while preserving valid controlled candles', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
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
          {
            time: 2_000,
            open: 103,
            high: undefined as unknown as number,
            low: 98,
            close: 104,
            volume: 6,
          },
        ]}
      />,
    );

    await waitFor(() => {
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

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed controlled candle payload entry:',
      expect.any(Error),
      expect.objectContaining({
        time: 2_000,
        high: undefined,
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('normalizes mixed-unit controlled candle timestamps before rendering the controlled snapshot', async () => {
    render(
      <PriceChart
        candles={[
          {
            time: '1710000060',
            open: 104,
            high: 109,
            low: 101,
            close: 107,
            volume: 7,
          },
          {
            time: 1_710_000_000_000,
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
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 1710000000,
          close: 102,
        }),
        expect.objectContaining({
          time: 1710000060,
          close: 107,
        }),
      ]);
    });
  });

  test('uses the last controlled candle when duplicate timestamps normalize to the same second', async () => {
    render(
      <PriceChart
        candles={[
          {
            time: 1_710_000_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 8,
          },
          {
            time: '1710000000000',
            open: 100,
            high: 110,
            low: 94,
            close: 109,
            volume: 12,
          },
        ]}
      />,
    );

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        high: number;
        low: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 1710000000,
          high: 110,
          low: 94,
          close: 109,
        }),
      ]);
    });
  });

  test('does not let a malformed controlled duplicate timestamp replace the valid candle in the same payload', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
          close: 102,
        }),
      ]);
    });

    rerender(
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
          {
            time: 1_000,
            open: 100,
            high: 111,
            low: 94,
            close: undefined as unknown as number,
            volume: 12,
          },
        ]}
      />,
    );

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
          high: 105,
          low: 95,
          close: 102,
        }),
      ]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed controlled candle payload entry:',
      expect.any(Error),
      expect.objectContaining({
        time: 1_000,
        close: undefined,
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('preserves the last valid controlled snapshot when a later controlled payload has only malformed timestamps', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <PriceChart
        candles={[
          {
            time: 1_710_000_000,
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
          time: 1710000000,
          close: 102,
        }),
      ]);
    });

    rerender(
      <PriceChart
        candles={[
          {
            time: 'not-a-timestamp',
            open: 120,
            high: 125,
            low: 118,
            close: 123,
            volume: 6,
          },
        ]}
      />,
    );

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 1710000000,
          close: 102,
        }),
      ]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed controlled candle payload entry:',
      expect.any(Error),
      expect.objectContaining({
        time: 'not-a-timestamp',
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('allows an explicit empty controlled candle snapshot to clear the previously rendered controlled candles', async () => {
    const { rerender } = render(
      <PriceChart
        candles={[
          {
            time: 1_710_000_000,
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
          time: 1710000000,
          close: 102,
        }),
      ]);
    });

    rerender(<PriceChart candles={[]} />);

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
      }>;

      expect(latestCall).toEqual([]);
    });
  });

  test('logs malformed candle volume payloads at controlled and websocket boundaries without dropping the candle body', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(
      <PriceChart
        candles={[
          {
            time: 1_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: Number.NaN,
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

    expect(setHistogramData).toHaveBeenCalledWith([
      expect.objectContaining({
        time: 1000,
        value: 0,
      }),
    ]);

    unmount();

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
      expect(dataApi.getCandles).toHaveBeenCalledTimes(1);
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
          volume: Number.NaN,
        },
      });
    });

    await waitFor(() => {
      const latestCandles = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCandles).toEqual([
        expect.objectContaining({
          time: 1000,
          close: 102,
        }),
        expect.objectContaining({
          time: 2000,
          close: 108,
        }),
      ]);
    });

    const latestHistogramCall = setHistogramData.mock.calls[setHistogramData.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      value: number;
    }>;

    expect(latestHistogramCall).toEqual([
      expect.objectContaining({
        time: 1000,
        value: 8,
      }),
      expect.objectContaining({
        time: 2000,
        value: 0,
      }),
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed candle volume payload:',
      expect.any(Error),
      expect.objectContaining({
        time: 1_000,
        volume: Number.NaN,
      }),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed candle volume payload:',
      expect.any(Error),
      expect.objectContaining({
        timestamp: 2_000,
        volume: Number.NaN,
      }),
    );

    consoleErrorSpy.mockRestore();
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

  test('logs a thrown candle fetch error and clears the loading state on the initial uncontrolled fetch', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getCandles.mockRejectedValueOnce(new Error('candle request crashed'));

    const { getByText, queryByText } = render(<PriceChart />);

    expect(getByText('Loading candles...')).toBeInTheDocument();

    await waitFor(() => {
      expect(queryByText('Loading candles...')).not.toBeInTheDocument();
    });

    expect(getByText('Last 0 candles')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch candles:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test('logs a resolved candle API error and clears the loading state on the initial uncontrolled fetch', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getCandles.mockResolvedValueOnce({
      success: false,
      error: 'candle history unavailable',
    });

    const { getByText, queryByText } = render(<PriceChart />);

    expect(getByText('Loading candles...')).toBeInTheDocument();

    await waitFor(() => {
      expect(queryByText('Loading candles...')).not.toBeInTheDocument();
    });

    expect(getByText('Last 0 candles')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch candles:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test('keeps the last controlled candles visible when a controlled-to-uncontrolled handoff throws before live fetch recovery completes', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getCandles.mockRejectedValueOnce(new Error('handoff candle request crashed'));

    const { rerender, queryByText, getByText } = render(
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
      expect(queryByText('Loading candles...')).not.toBeInTheDocument();
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
    expect(getByText('Last 1 candles')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch candles:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test('keeps the last controlled candles visible when a controlled-to-uncontrolled handoff resolves with an API error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getCandles.mockResolvedValueOnce({
      success: false,
      error: 'handoff candle history unavailable',
    });

    const { rerender, queryByText, getByText } = render(
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
      expect(queryByText('Loading candles...')).not.toBeInTheDocument();
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
    expect(getByText('Last 1 candles')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch candles:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test('treats a missing candle payload as a resolved fetch error and preserves the previous live dataset', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getCandles
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        success: true,
        data: undefined,
      });

    const { rerender, getByText, queryByText } = render(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(setCandlestickData).toHaveBeenCalledWith([
        expect.objectContaining({
          time: 1000,
          close: 102,
        }),
      ]);
    });

    rerender(<PriceChart timeframe="1h" />);

    await waitFor(() => {
      expect(queryByText('Loading candles...')).not.toBeInTheDocument();
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
    expect(getByText('Last 1 candles')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch candles:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
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

  test('keeps the last duplicate-normalized candle volume in the histogram data', async () => {
    render(
      <PriceChart
        candles={[
          {
            time: 1_710_000_000,
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 7,
          },
          {
            time: 1_710_000_000_000,
            open: 101,
            high: 109,
            low: 96,
            close: 108,
            volume: 25,
          },
        ]}
      />,
    );

    await waitFor(() => {
      const latestCandles = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCandles).toEqual([
        expect.objectContaining({
          time: 1710000000,
          close: 108,
        }),
      ]);
    });

    const latestHistogram = setHistogramData.mock.calls[setHistogramData.mock.calls.length - 1]?.[0] as Array<{
      time: number;
      value: number;
      color: string;
    }>;

    expect(latestHistogram).toEqual([
      expect.objectContaining({
        time: 1710000000,
        value: 25,
        color: 'rgba(34, 197, 94, 0.5)',
      }),
    ]);
  });

  test('keeps the newest 100 fetched candles after normalization and dedupe', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: buildSequentialCandles(1, 130).map((candle) => ({
          timestamp: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      },
    });

    const { getByText } = render(<PriceChart />);

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toHaveLength(100);
      expect(latestCall[0]).toEqual(expect.objectContaining({ time: 31, close: 31 }));
      expect(latestCall[99]).toEqual(expect.objectContaining({ time: 130, close: 130 }));
    });

    expect(getByText('Last 100 candles')).toBeInTheDocument();
  });

  test('keeps the newest 100 controlled candles before rendering the snapshot', async () => {
    const { getByText } = render(
      <PriceChart candles={buildSequentialCandles(1, 130)} />,
    );

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toHaveLength(100);
      expect(latestCall[0]).toEqual(expect.objectContaining({ time: 31, close: 31 }));
      expect(latestCall[99]).toEqual(expect.objectContaining({ time: 130, close: 130 }));
    });

    expect(getByText('Last 100 candles')).toBeInTheDocument();
  });

  test('keeps websocket updates within the newest 100 rendered candles', async () => {
    dataApi.getCandles.mockResolvedValueOnce({
      success: true,
      data: {
        candles: buildSequentialCandles(1, 100).map((candle) => ({
          timestamp: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      },
    });

    const { getByText } = render(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toHaveLength(100);
      expect(latestCall[0]).toEqual(expect.objectContaining({ time: 1, close: 1 }));
      expect(latestCall[99]).toEqual(expect.objectContaining({ time: 100, close: 100 }));
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 101,
          open: 100,
          high: 103,
          low: 99,
          close: 101,
          volume: 101,
        },
      });
    });

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toHaveLength(100);
      expect(latestCall[0]).toEqual(expect.objectContaining({ time: 2, close: 2 }));
      expect(latestCall[99]).toEqual(expect.objectContaining({ time: 101, close: 101 }));
    });

    expect(getByText('Last 100 candles')).toBeInTheDocument();
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

  test('keeps handoff fetch and live updates trimmed to the newest 100 candles with live duplicates winning', async () => {
    let resolveLiveFetch: ((value: unknown) => void) | undefined;

    dataApi.getCandles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLiveFetch = resolve;
        }),
    );

    const { rerender, getByText } = render(
      <PriceChart
        timeframe="5m"
        candles={buildSequentialCandles(1, 100)}
      />,
    );

    await waitFor(() => {
      const latestCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(latestCall).toHaveLength(100);
      expect(latestCall[0]).toEqual(expect.objectContaining({ time: 1, close: 1 }));
      expect(latestCall[99]).toEqual(expect.objectContaining({ time: 100, close: 100 }));
    });

    rerender(<PriceChart timeframe="5m" />);

    await waitFor(() => {
      expect(dataApi.getCandles).toHaveBeenCalledTimes(1);
    });

    act(() => {
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 100,
          open: 999,
          high: 1002,
          low: 998,
          close: 1000,
          volume: 1000,
        },
      });
      emitWebsocketEvent('CANDLE_CLOSED', {
        timeframe: '5m',
        candle: {
          timestamp: 101,
          open: 1009,
          high: 1012,
          low: 1008,
          close: 1010,
          volume: 1010,
        },
      });
    });

    await waitFor(() => {
      const liveCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(liveCall).toHaveLength(100);
      expect(liveCall[0]).toEqual(expect.objectContaining({ time: 2, close: 2 }));
      expect(liveCall[98]).toEqual(expect.objectContaining({ time: 100, close: 1000 }));
      expect(liveCall[99]).toEqual(expect.objectContaining({ time: 101, close: 1010 }));
    });

    act(() => {
      resolveLiveFetch?.({
        success: true,
        data: {
          candles: buildSequentialCandles(1, 100, -500).map((candle) => ({
            timestamp: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          })),
        },
      });
    });

    await waitFor(() => {
      const mergedCall = setCandlestickData.mock.calls[setCandlestickData.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        close: number;
      }>;

      expect(mergedCall).toHaveLength(100);
      expect(mergedCall[0]).toEqual(expect.objectContaining({ time: 2, close: 2 }));
      expect(mergedCall[98]).toEqual(expect.objectContaining({ time: 100, close: 1000 }));
      expect(mergedCall[99]).toEqual(expect.objectContaining({ time: 101, close: 1010 }));
    });

    expect(getByText('Last 100 candles')).toBeInTheDocument();
  });

  test('keeps mixed-unit timestamps consistent when websocket and fetch data merge during uncontrolled handoff', async () => {
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
            time: 1_710_000_000,
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
          time: 1710000000,
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
          timestamp: 1_710_000_000_000,
          open: 101,
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
        close: number;
      }>;

      expect(latestCall).toEqual([
        expect.objectContaining({
          time: 1710000000,
          close: 109,
        }),
      ]);
    });

    act(() => {
      resolveLiveFetch?.({
        success: true,
        data: {
          candles: [
            {
              timestamp: 1_710_000_000,
              open: 100,
              high: 105,
              low: 95,
              close: 101,
              volume: 8,
            },
            {
              timestamp: 1_710_000_060,
              open: 109,
              high: 112,
              low: 108,
              close: 110,
              volume: 9,
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
          time: 1710000000,
          close: 109,
        }),
        expect.objectContaining({
          time: 1710000060,
          close: 110,
        }),
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
        time: 2000,
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
          time: 2000,
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
          time: 2000,
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
          time: 2000,
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

  test('logs a malformed marker history response when the positions payload is missing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: undefined,
    });

    render(<PriceChart />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch position markers:',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  test('drops malformed marker entries when the payload has invalid side or entry timestamps', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: {
        positions: [
          {
            entryTime: 1_000,
            side: 'LONG',
            pnl: 5,
          },
          {
            entryTime: Number.NaN,
            side: 'SHORT',
            pnl: -7,
          },
          {
            entryTime: 3_000,
            side: 'FLAT',
            pnl: 0,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({
          time: 1000,
          text: 'LONG',
        }),
      ]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed position marker entry:',
      expect.any(Error),
      expect.objectContaining({
        entryTime: Number.NaN,
      }),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed position marker entry:',
      expect.any(Error),
      expect.objectContaining({
        entryTime: 3_000,
        side: 'FLAT',
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('drops malformed marker exit payloads while keeping the valid entry marker', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: {
        positions: [
          {
            entryTime: 1_000,
            exitTime: 'not-a-timestamp',
            side: 'SHORT',
            pnl: -7,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({
          time: 1000,
          text: 'SHORT',
        }),
      ]);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Dropped malformed position marker exit payload:',
      expect.any(Error),
      expect.objectContaining({
        entryTime: 1_000,
        exitTime: 'not-a-timestamp',
        side: 'SHORT',
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('normalizes mixed-unit marker timestamps with the same rules as candle timestamps', async () => {
    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: {
        positions: [
          {
            entryTime: 1_710_000_000,
            exitTime: 1_710_000_060_000,
            side: 'LONG',
            pnl: 5,
          },
          {
            entryTime: 1_710_000_120_000,
            side: 'SHORT',
            pnl: -7,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({
          time: 1710000000,
          text: 'LONG',
        }),
        expect.objectContaining({
          time: 1710000060,
          text: '+5.00 USDT',
        }),
        expect.objectContaining({
          time: 1710000120,
          text: 'SHORT',
        }),
      ]);
    });
  });

  test('sorts duplicate-timestamp markers deterministically before rendering', async () => {
    dataApi.getPositionHistory.mockResolvedValueOnce({
      success: true,
      data: {
        positions: [
          {
            entryTime: 1_000,
            exitTime: 1_000,
            side: 'SHORT',
            pnl: -3,
          },
          {
            entryTime: 1_000,
            exitTime: 1_000,
            side: 'LONG',
            pnl: 4,
          },
        ],
      },
    });

    render(<PriceChart />);

    await waitFor(() => {
      const latestMarkers = setMarkers.mock.calls[setMarkers.mock.calls.length - 1]?.[0] as Array<{
        time: number;
        shape: string;
        text: string;
      }>;

      expect(latestMarkers).toEqual([
        expect.objectContaining({ time: 1000, shape: 'arrowUp', text: 'LONG' }),
        expect.objectContaining({ time: 1000, shape: 'arrowDown', text: 'SHORT' }),
        expect.objectContaining({ time: 1000, shape: 'circle', text: '-3.00 USDT' }),
        expect.objectContaining({ time: 1000, shape: 'circle', text: '+4.00 USDT' }),
      ]);
    });
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
