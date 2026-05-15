/**
 * Price Chart Component
 *
 * Displays candlestick chart with Lightweight Charts library
 * Fetches real candle data from API and WebSocket for live updates
 */

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { CandlestickData, HistogramData, Time, ISeriesApi, SeriesMarker } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';
import { dataApi } from '../../services/api.service';
import type { PositionClosedPayload, PositionOpenedPayload } from '../../types';
import type { WebApiCandle, WebApiPositionHistoryEntry } from '@edison/contracts';
import { wsClient } from '../../services/websocket.service';

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PriceChartProps {
  candles?: Candle[];
  title?: string;
  height?: number;
  symbol?: string;
  timeframe?: string;
}

const EMPTY_CANDLES: Candle[] = [];
const PRICE_RANGE_PADDING_RATIO = 0.1;
const FLAT_PRICE_RANGE_PADDING_RATIO = 0.01;
const MIN_FLAT_PRICE_RANGE_PADDING = 1;
const MIN_CHART_WIDTH = 1;
const UNKNOWN_API_ERROR_MESSAGE = 'Unknown error';
const INVALID_CANDLE_PAYLOAD_MESSAGE = 'Missing candles payload';
const INVALID_POSITION_MARKER_PAYLOAD_MESSAGE = 'Invalid position history payload';
const INVALID_CANDLE_ENTRY_MESSAGE = 'Invalid candle payload entry';
const INVALID_CANDLE_VOLUME_MESSAGE = 'Invalid candle volume payload';
const INVALID_POSITION_MARKER_ENTRY_MESSAGE = 'Invalid position marker entry';
const INVALID_POSITION_MARKER_EXIT_MESSAGE = 'Invalid position marker exit payload';
const INVALID_WEBSOCKET_CANDLE_EVENT_MESSAGE = 'Invalid websocket candle event payload';
const INVALID_POSITION_OPENED_EVENT_MESSAGE = 'Invalid position opened event payload';
const INVALID_POSITION_CLOSED_EVENT_MESSAGE = 'Invalid position closed event payload';
const VALID_POSITION_SIDES = new Set(['LONG', 'SHORT']);
const MAX_RENDERED_CANDLES = 100;
type CandlePayload = Candle | WebApiCandle;
type UnknownRecord = Record<string, unknown>;

const getPnlDirection = (value: number): 'profit' | 'loss' | 'flat' =>
  value > 0 ? 'profit' : value < 0 ? 'loss' : 'flat';

const getCandleDirection = (open: number, close: number): 'up' | 'down' | 'flat' =>
  close > open ? 'up' : close < open ? 'down' : 'flat';

const getVolumeColor = (open: number, close: number): string => {
  const direction = getCandleDirection(open, close);

  return direction === 'up'
    ? 'rgba(34, 197, 94, 0.5)'
    : direction === 'down'
      ? 'rgba(239, 68, 68, 0.5)'
      : 'rgba(107, 114, 128, 0.5)';
};

const isFiniteCandleValue = (value: number | string | null | undefined): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  return Number.isFinite(Number(value));
};

const hasDefinedValue = <T,>(value: T | null | undefined): value is T =>
  value !== undefined && value !== null;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const normalizeCandleTime = (time: Candle['time']): number =>
  Number(time) > 10000000000 ? Math.floor(Number(time) / 1000) : Math.floor(Number(time));

const normalizeApiCandle = (candle: WebApiCandle): Candle => {
  const time = (candle as WebApiCandle & { time?: number | string }).time;

  return {
    ...candle,
    time: time ?? candle.timestamp,
  };
};

const buildApiError = (message?: string): Error =>
  new Error(message ?? UNKNOWN_API_ERROR_MESSAGE);

const logPayloadError = (scope: string, message: string, payload?: unknown) => {
  if (payload === undefined) {
    console.error(scope, buildApiError(message));
    return;
  }

  console.error(scope, buildApiError(message), payload);
};

const isValidPositionSide = (side: string): side is 'LONG' | 'SHORT' =>
  VALID_POSITION_SIDES.has(side);

const normalizeMarkerTime = (time: number): number =>
  Math.floor(Number(time) / 1000);

const normalizeIncomingCandle = (
  candle: CandlePayload,
  logScope: string,
  entryLabel: string,
): Candle | null => {
  const normalizedCandle = 'timestamp' in candle ? normalizeApiCandle(candle) : candle;

  if (
    !isFiniteCandleValue(normalizedCandle.time)
    || !isFiniteCandleValue(normalizedCandle.open)
    || !isFiniteCandleValue(normalizedCandle.high)
    || !isFiniteCandleValue(normalizedCandle.low)
    || !isFiniteCandleValue(normalizedCandle.close)
  ) {
    logPayloadError(
      logScope,
      `${INVALID_CANDLE_ENTRY_MESSAGE} at ${entryLabel}`,
      candle,
    );
    return null;
  }

  if (hasDefinedValue(normalizedCandle.volume) && !isFiniteCandleValue(normalizedCandle.volume)) {
    logPayloadError(
      'Dropped malformed candle volume payload:',
      `${INVALID_CANDLE_VOLUME_MESSAGE} at ${entryLabel}`,
      candle,
    );

    return {
      time: normalizeCandleTime(normalizedCandle.time),
      open: Number(normalizedCandle.open),
      high: Number(normalizedCandle.high),
      low: Number(normalizedCandle.low),
      close: Number(normalizedCandle.close),
    };
  }

  return {
    time: normalizeCandleTime(normalizedCandle.time),
    open: Number(normalizedCandle.open),
    high: Number(normalizedCandle.high),
    low: Number(normalizedCandle.low),
    close: Number(normalizedCandle.close),
    ...(hasDefinedValue(normalizedCandle.volume)
      ? { volume: Number(normalizedCandle.volume) }
      : {}),
  };
};

const normalizeIncomingCandles = (
  candles: CandlePayload[],
  logScope: string,
  entryLabelPrefix: string,
  maxCandles = MAX_RENDERED_CANDLES,
): Candle[] =>
  mergeCandlesByTime(
    candles.flatMap((candle, index) => {
      const normalizedCandle = normalizeIncomingCandle(candle, logScope, `${entryLabelPrefix}[${index}]`);
      return normalizedCandle ? [normalizedCandle] : [];
    }),
    maxCandles,
  );

const normalizeFetchedCandleEntry = (
  candle: WebApiCandle,
  index: number,
): Candle | null =>
  normalizeIncomingCandle(candle, 'Dropped malformed candle payload entry:', `fetched candles[${index}]`);

const normalizeControlledCandles = (candles: Candle[]): Candle[] =>
  normalizeIncomingCandles(candles, 'Dropped malformed controlled candle payload entry:', 'controlled candles');

const normalizeFetchedResponseCandles = (
  candles: WebApiCandle[],
): Candle[] =>
  mergeCandlesByTime(
    candles.flatMap((candle: WebApiCandle, index: number) => {
      const normalizedCandle = normalizeFetchedCandleEntry(candle, index);
      return normalizedCandle ? [normalizedCandle] : [];
    }),
    30,
  );

const normalizeWebsocketCandle = (candle: WebApiCandle): Candle | null =>
  normalizeIncomingCandle(candle, 'Dropped malformed websocket candle payload:', 'websocket update');

const normalizeWebsocketCandleEvent = (
  payload: unknown,
): { timeframe: string; candle: WebApiCandle } | null => {
  if (!isRecord(payload)) {
    logPayloadError(
      'Ignored malformed websocket candle event:',
      INVALID_WEBSOCKET_CANDLE_EVENT_MESSAGE,
      payload,
    );
    return null;
  }

  const timeframe = payload.timeframe;
  const candle = payload.candle;

  if (typeof timeframe !== 'string' || !isRecord(candle)) {
    logPayloadError(
      'Ignored malformed websocket candle event:',
      INVALID_WEBSOCKET_CANDLE_EVENT_MESSAGE,
      payload,
    );
    return null;
  }

  return {
    timeframe,
    candle: candle as unknown as WebApiCandle,
  };
};

const isValidPositionOpenedEvent = (payload: unknown): payload is PositionOpenedPayload => {
  if (!isRecord(payload)) {
    return false;
  }

  return (!hasDefinedValue(payload.position) || isRecord(payload.position))
    && (!hasDefinedValue(payload.signal) || isRecord(payload.signal));
};

const isValidPositionClosedEvent = (payload: unknown): payload is PositionClosedPayload => {
  if (!isRecord(payload)) {
    return false;
  }

  const pnl = payload.pnl;
  const exitType = payload.exitType;

  return (!hasDefinedValue(pnl) || isFiniteCandleValue(pnl as number | string | null | undefined))
    && (!hasDefinedValue(exitType) || typeof exitType === 'string');
};

const shouldReloadMarkersForPositionOpenedEvent = (payload: unknown): payload is PositionOpenedPayload => {
  if (isValidPositionOpenedEvent(payload)) {
    return true;
  }

  logPayloadError(
    'Ignored malformed position opened event:',
    INVALID_POSITION_OPENED_EVENT_MESSAGE,
    payload,
  );

  return false;
};

const shouldReloadMarkersForPositionClosedEvent = (payload: unknown): payload is PositionClosedPayload => {
  if (isValidPositionClosedEvent(payload)) {
    return true;
  }

  logPayloadError(
    'Ignored malformed position closed event:',
    INVALID_POSITION_CLOSED_EVENT_MESSAGE,
    payload,
  );

  return false;
};

const normalizeFetchedCandles = (
  response: Awaited<ReturnType<typeof dataApi.getCandles>>,
): Candle[] | null => {
  if (!response.success) {
    logPayloadError('Failed to fetch candles:', response.error ?? UNKNOWN_API_ERROR_MESSAGE);
    return null;
  }

  if (!Array.isArray(response.data?.candles)) {
    logPayloadError('Failed to fetch candles:', INVALID_CANDLE_PAYLOAD_MESSAGE);
    return null;
  }

  return normalizeFetchedResponseCandles(response.data.candles);
};

const buildPositionMarkers = (
  positions: WebApiPositionHistoryEntry[],
): SeriesMarker<Time>[] =>
  positions.flatMap((position, index) => {
    if (!isFiniteCandleValue(position.entryTime) || !isValidPositionSide(position.side)) {
      logPayloadError(
        'Dropped malformed position marker entry:',
        `${INVALID_POSITION_MARKER_ENTRY_MESSAGE} at index ${index}`,
        position,
      );
      return [];
    }

    const side = position.side;
    const markersForPosition: SeriesMarker<Time>[] = [
      {
        time: normalizeMarkerTime(position.entryTime) as Time,
        position: side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: side === 'LONG' ? '#22c55e' : '#ef4444',
        shape: side === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: side,
        size: 2,
      },
    ];

    const hasExitMarkerPayload = hasDefinedValue(position.exitTime);

    if (
      hasExitMarkerPayload
      && (!isFiniteCandleValue(position.exitTime) || !isFiniteCandleValue(position.pnl))
    ) {
      logPayloadError(
        'Dropped malformed position marker exit payload:',
        `${INVALID_POSITION_MARKER_EXIT_MESSAGE} at index ${index}`,
        position,
      );
      return markersForPosition;
    }

    if (isFiniteCandleValue(position.exitTime) && isFiniteCandleValue(position.pnl)) {
      const realizedPnl = Number(position.pnl);
      const pnlDirection = getPnlDirection(realizedPnl);
      markersForPosition.push({
        time: normalizeMarkerTime(Number(position.exitTime)) as Time,
        position: side === 'LONG' ? 'aboveBar' : 'belowBar',
        color:
          pnlDirection === 'profit'
            ? '#22c55e'
            : pnlDirection === 'loss'
              ? '#ef4444'
              : '#6b7280',
        shape: 'circle',
        text: `${pnlDirection === 'profit' ? '+' : ''}${realizedPnl.toFixed(2)} USDT`,
        size: 1,
      });
    }

    return markersForPosition;
  });

const mergeCandlesByTime = (candles: Candle[], maxCandles?: number): Candle[] => {
  const uniqueByTime = new Map<number, Candle>();

  candles.forEach((candle) => {
    uniqueByTime.set(normalizeCandleTime(candle.time), candle);
  });

  const mergedCandles = Array.from(uniqueByTime.entries())
    .sort(([leftTime], [rightTime]) => leftTime - rightTime)
    .map(([, candle]) => candle);

  if (maxCandles !== undefined && mergedCandles.length > maxCandles) {
    return mergedCandles.slice(-maxCandles);
  }

  return mergedCandles;
};

const buildVisiblePriceRange = (candles: CandlestickData[]) => {
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  candles.forEach((candle) => {
    minPrice = Math.min(minPrice, candle.low);
    maxPrice = Math.max(maxPrice, candle.high);
  });

  const priceSpan = maxPrice - minPrice;
  const padding = priceSpan > 0
    ? priceSpan * PRICE_RANGE_PADDING_RATIO
    : Math.max(Math.abs(maxPrice) * FLAT_PRICE_RANGE_PADDING_RATIO, MIN_FLAT_PRICE_RANGE_PADDING);

  return {
    minValue: minPrice - padding,
    maxValue: maxPrice + padding,
  };
};

const getSafeChartWidth = (container: HTMLDivElement): number =>
  Math.max(container.clientWidth, MIN_CHART_WIDTH);

const applyChartSize = (
  chart: ReturnType<typeof createChart>,
  container: HTMLDivElement,
  nextHeight?: number,
) => {
  const measuredWidth = container.clientWidth;

  if (measuredWidth <= 0) {
    if (nextHeight !== undefined) {
      chart.applyOptions({ height: nextHeight });
    }

    return;
  }

  chart.applyOptions({
    width: measuredWidth,
    ...(nextHeight !== undefined ? { height: nextHeight } : {}),
  });
};

export function PriceChart({
  candles: controlledCandles,
  title = 'Price Chart (Live)',
  height = 400,
  symbol = 'BTCUSDT',
  timeframe = '5m',
}: PriceChartProps) {
  const candles = controlledCandles ?? EMPTY_CANDLES;
  const hasControlledCandles = controlledCandles !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [displayCandles, setDisplayCandles] = useState<Candle[]>(candles);
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const markerReloadInFlightRef = useRef<Promise<void> | null>(null);
  const markerReloadQueuedRef = useRef(false);
  const isMountedRef = useRef(false);
  const latestCandleRequestIdRef = useRef(0);
  const latestMarkerRequestIdRef = useRef(0);
  const activeMarkerRequestIdRef = useRef(0);
  const isControlledCandlesRef = useRef(hasControlledCandles);
  const wasControlledCandlesRef = useRef(hasControlledCandles);
  const pendingUncontrolledHandoffRef = useRef(false);
  const handoffReceivedLiveUpdatesRef = useRef(false);
  const timeframeRef = useRef(timeframe);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      markerReloadInFlightRef.current = null;
      markerReloadQueuedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const wasControlledCandles = wasControlledCandlesRef.current;
    isControlledCandlesRef.current = hasControlledCandles;

    if (hasControlledCandles) {
      pendingUncontrolledHandoffRef.current = false;
      handoffReceivedLiveUpdatesRef.current = false;
      const nextCandles = normalizeControlledCandles(candles);
      setDisplayCandles((prev) => {
        if (
          prev.length === nextCandles.length
          && prev.every((candle, index) => candle === nextCandles[index])
        ) {
          return prev;
        }

        return nextCandles;
      });
      setLoading(false);
    } else if (wasControlledCandles) {
      pendingUncontrolledHandoffRef.current = true;
      handoffReceivedLiveUpdatesRef.current = false;
    }

    wasControlledCandlesRef.current = hasControlledCandles;
  }, [candles, hasControlledCandles]);

  // Fetch candles from API
  const fetchCandles = async (tf: string) => {
    const requestId = ++latestCandleRequestIdRef.current;

    if (isControlledCandlesRef.current) {
      if (isMountedRef.current && latestCandleRequestIdRef.current === requestId) {
        setLoading(false);
      }
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const response = await dataApi.getCandles(tf, 100);

      if (
        !isMountedRef.current
        || latestCandleRequestIdRef.current !== requestId
        || isControlledCandlesRef.current
      ) {
        return;
      }

      const normalizedCandles = normalizeFetchedCandles(response);
      if (normalizedCandles) {
        setDisplayCandles((prev) => {
          if (pendingUncontrolledHandoffRef.current && handoffReceivedLiveUpdatesRef.current) {
            return mergeCandlesByTime([...normalizedCandles, ...prev], MAX_RENDERED_CANDLES);
          }

          return normalizedCandles;
        });
      }

      pendingUncontrolledHandoffRef.current = false;
      handoffReceivedLiveUpdatesRef.current = false;
    } catch (error) {
      if (isMountedRef.current && latestCandleRequestIdRef.current === requestId) {
        console.error('Failed to fetch candles:', error);
      }

      pendingUncontrolledHandoffRef.current = false;
      handoffReceivedLiveUpdatesRef.current = false;
    } finally {
      if (isMountedRef.current && latestCandleRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  // Fetch position history and convert to markers
  const loadPositionMarkers = async (requestId: number) => {
    try {
      const response = await dataApi.getPositionHistory(50);
      if (!isMountedRef.current || activeMarkerRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.success) {
        logPayloadError('Failed to fetch position markers:', response.error ?? UNKNOWN_API_ERROR_MESSAGE);
        return;
      }

      if (!Array.isArray(response.data?.positions)) {
        logPayloadError('Failed to fetch position markers:', INVALID_POSITION_MARKER_PAYLOAD_MESSAGE);
        return;
      }

      const newMarkers = buildPositionMarkers(response.data.positions);

      setMarkers(newMarkers);
    } catch (error) {
      if (isMountedRef.current && activeMarkerRequestIdRef.current === requestId) {
        console.error('Failed to fetch position markers:', error);
      }
    }
  };

  function finishMarkerReloadCycle() {
    markerReloadInFlightRef.current = null;

    if (isMountedRef.current && markerReloadQueuedRef.current) {
      markerReloadQueuedRef.current = false;
      requestPositionMarkersReload();
    }
  }

  function requestPositionMarkersReload() {
    if (!isMountedRef.current) {
      return;
    }

    if (markerReloadInFlightRef.current) {
      markerReloadQueuedRef.current = true;
      return;
    }

    const requestId = ++latestMarkerRequestIdRef.current;
    activeMarkerRequestIdRef.current = requestId;

    const reloadPromise = (async () => {
      try {
        await loadPositionMarkers(requestId);
      } finally {
        finishMarkerReloadCycle();
      }
    })();

    markerReloadInFlightRef.current = reloadPromise;
  }

  // Load candles when timeframe changes while uncontrolled.
  useEffect(() => {
    if (!hasControlledCandles) {
      void fetchCandles(timeframe);
    }
  }, [timeframe, hasControlledCandles]);

  useEffect(() => {
    requestPositionMarkersReload();
  }, [timeframe]);

  // Keep WebSocket subscriptions stable while reading the latest props from refs.
  useEffect(() => {
    const handleCandleClosed = (payload: unknown) => {
      const data = normalizeWebsocketCandleEvent(payload);

      if (!data) {
        return;
      }

      if (
        data.timeframe !== timeframeRef.current
        || isControlledCandlesRef.current
      ) {
        return;
      }

      const candle = normalizeWebsocketCandle(data.candle);
      if (!candle) {
        return;
      }

      if (pendingUncontrolledHandoffRef.current) {
        handoffReceivedLiveUpdatesRef.current = true;
      }
      setDisplayCandles((prev) => mergeCandlesByTime([...prev, candle], MAX_RENDERED_CANDLES));
    };

    const handlePositionOpened = (payload: unknown) => {
      if (!shouldReloadMarkersForPositionOpenedEvent(payload)) {
        return;
      }

      requestPositionMarkersReload();
    };

    const handlePositionClosed = (payload: unknown) => {
      if (!shouldReloadMarkersForPositionClosedEvent(payload)) {
        return;
      }

      requestPositionMarkersReload();
    };

    wsClient.on('CANDLE_CLOSED', handleCandleClosed);
    wsClient.on('POSITION_OPENED', handlePositionOpened);
    wsClient.on('POSITION_CLOSED', handlePositionClosed);

    return () => {
      wsClient.off('CANDLE_CLOSED', handleCandleClosed);
      wsClient.off('POSITION_OPENED', handlePositionOpened);
      wsClient.off('POSITION_CLOSED', handlePositionClosed);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#d1d5db',
      },
      width: getSafeChartWidth(containerRef.current),
      height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        autoScale: true,
        mode: 0, // Auto scale mode
      },
    });

    chartRef.current = chart;
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candleSeriesRef.current = candlestickSeries;
    const volumeSeries = chart.addHistogramSeries({
      color: '#6366f1',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    volumeSeriesRef.current = volumeSeries;

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        if (containerRef.current) {
          applyChartSize(chart, containerRef.current);
        }
      })
      : null;

    resizeObserver?.observe(containerRef.current);

    return () => {
      resizeObserver?.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && containerRef.current) {
      applyChartSize(chartRef.current, containerRef.current, height);
    }
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    const candlestickSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (!chart || !candlestickSeries || !volumeSeries) {
      return;
    }

    const sortedCandles = mergeCandlesByTime(displayCandles);
    const formattedCandles: CandlestickData[] = sortedCandles
      .filter(
        (c): c is Candle =>
          Boolean(c)
          && hasDefinedValue(c.time)
          && hasDefinedValue(c.open)
          && hasDefinedValue(c.high)
          && hasDefinedValue(c.low)
          && hasDefinedValue(c.close),
      )
      .filter(
        (c) =>
          isFiniteCandleValue(c.time)
          && isFiniteCandleValue(c.open)
          && isFiniteCandleValue(c.high)
          && isFiniteCandleValue(c.low)
          && isFiniteCandleValue(c.close),
      )
      .map((c) => ({
        time: normalizeCandleTime(c.time) as Time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

    candlestickSeries.setData(formattedCandles);

    if (formattedCandles.length > 0) {
      const visiblePriceRange = buildVisiblePriceRange(formattedCandles);
      candlestickSeries.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: visiblePriceRange,
        }),
      });
    }

    const volumeByTime = new Map<number, Candle>();
    sortedCandles.forEach((candle) => {
      volumeByTime.set(normalizeCandleTime(candle.time), candle);
    });

    const volumeData: HistogramData[] = formattedCandles.map((c) => {
      const originalCandle = volumeByTime.get(Number(c.time));
      const close = originalCandle?.close ?? 0;
      const open = originalCandle?.open ?? 0;

      return {
        time: c.time,
        value: originalCandle?.volume ?? 0,
        color: getVolumeColor(open, close),
      };
    });

    volumeSeries.setData(volumeData);

    if (formattedCandles.length > 0) {
      chart.timeScale().fitContent();
      candlestickSeries.priceScale().applyOptions({
        autoScale: false,
      });
    } else {
      candlestickSeries.applyOptions({
        autoscaleInfoProvider: undefined,
      });
      candlestickSeries.priceScale().applyOptions({
        autoScale: true,
      });
    }
  }, [displayCandles]);

  useEffect(() => {
    const candlestickSeries = candleSeriesRef.current;

    if (!candlestickSeries) {
      return;
    }

    const sortedMarkers = [...markers].sort((a, b) => Number(a.time) - Number(b.time));
    candlestickSeries.setMarkers(sortedMarkers);
  }, [markers]);

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">Real-time candlestick chart ({timeframe})</p>
        </div>
        <TrendingUp className="w-6 h-6 text-blue-600" />
      </div>

      {/* Loading indicator */}
      {loading && <div className="mb-4 text-xs text-gray-500">Loading candles...</div>}

      <div
        ref={containerRef}
        style={{
          height: `${height}px`,
          width: '100%',
        }}
        className="rounded-lg overflow-hidden bg-gray-50 border border-gray-200"
      />

      {/* Info Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>Up</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>Down</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-500"></div>
            <span>Volume</span>
          </div>
        </div>
        <span>Last {displayCandles.length} candles</span>
      </div>
    </div>
  );
}
