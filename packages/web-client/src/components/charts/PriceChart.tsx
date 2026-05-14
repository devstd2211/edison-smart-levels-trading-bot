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

const PRICE_RANGE_PADDING_RATIO = 0.1;
const FLAT_PRICE_RANGE_PADDING_RATIO = 0.01;
const MIN_FLAT_PRICE_RANGE_PADDING = 1;

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

const normalizeCandleTime = (time: Candle['time']): number =>
  Number(time) > 10000000000 ? Math.floor(Number(time) / 1000) : Math.floor(Number(time));

const normalizeApiCandle = (candle: WebApiCandle): Candle => {
  const time = (candle as WebApiCandle & { time?: number | string }).time;

  return {
    ...candle,
    time: time ?? candle.timestamp,
  };
};

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

export function PriceChart({
  candles = [],
  title = 'Price Chart (Live)',
  height = 400,
  symbol = 'BTCUSDT',
  timeframe = '5m',
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [displayCandles, setDisplayCandles] = useState<Candle[]>(candles);
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const markerReloadInFlightRef = useRef<Promise<void> | null>(null);
  const markerReloadQueuedRef = useRef(false);

  // Fetch candles from API
  const fetchCandles = async (tf: string) => {
    try {
      setLoading(true);
      const response = await dataApi.getCandles(tf, 100);
      if (response.success && response.data?.candles) {
        const normalizedCandles = mergeCandlesByTime(
          response.data.candles.map((candle: WebApiCandle) => normalizeApiCandle(candle)),
          30,
        );

        setDisplayCandles(normalizedCandles);
      }
    } catch (error) {
      console.error('Failed to fetch candles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch position history and convert to markers
  const loadPositionMarkers = async () => {
    try {
      const response = await dataApi.getPositionHistory(50);
      if (response.success && response.data?.positions) {
        const newMarkers = response.data.positions
          .filter((pos: WebApiPositionHistoryEntry) => hasDefinedValue(pos.entryTime))
          .flatMap((pos: WebApiPositionHistoryEntry) => {
            const posMarkers: SeriesMarker<Time>[] = [];

            // Entry marker
            if (hasDefinedValue(pos.entryTime)) {
              posMarkers.push({
                time: Math.floor(pos.entryTime / 1000) as Time, // Convert to seconds
                position: pos.side === 'LONG' ? 'belowBar' : 'aboveBar',
                color: pos.side === 'LONG' ? '#22c55e' : '#ef4444',
                shape: pos.side === 'LONG' ? 'arrowUp' : 'arrowDown',
                text: `${pos.side}`,
                size: 2,
              });
            }

            // Exit marker (if position was closed)
            if (hasDefinedValue(pos.exitTime)) {
              const realizedPnl = pos.pnl ?? 0;
              const pnlDirection = getPnlDirection(realizedPnl);
              posMarkers.push({
                time: Math.floor(pos.exitTime / 1000) as Time,
                position: pos.side === 'LONG' ? 'aboveBar' : 'belowBar',
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

            return posMarkers;
          });

        setMarkers(newMarkers);
      }
    } catch (error) {
      console.error('Failed to fetch position markers:', error);
    }
  };

  function requestPositionMarkersReload() {
    if (markerReloadInFlightRef.current) {
      markerReloadQueuedRef.current = true;
      return;
    }

    const reloadPromise = (async () => {
      try {
        await loadPositionMarkers();
      } finally {
        markerReloadInFlightRef.current = null;

        if (markerReloadQueuedRef.current) {
          markerReloadQueuedRef.current = false;
          requestPositionMarkersReload();
        }
      }
    })();

    markerReloadInFlightRef.current = reloadPromise;
  }

  // Load initial candles and markers
  useEffect(() => {
    void fetchCandles(timeframe);
    requestPositionMarkersReload();
  }, [timeframe]);

  // Listen for new candles via WebSocket
  useEffect(() => {
    const handleCandleClosed = (data: { timeframe: string; candle: WebApiCandle }) => {
      if (data.timeframe === timeframe) {
        const candle = normalizeApiCandle(data.candle);
        setDisplayCandles((prev) => mergeCandlesByTime([...prev, candle], 100));
      }
    };

    const handlePositionOpened = (_data: PositionOpenedPayload) => {
      requestPositionMarkersReload();
    };

    const handlePositionClosed = (_data: PositionClosedPayload) => {
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
  }, [timeframe]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#d1d5db',
      },
      width: containerRef.current.clientWidth,
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

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candleSeriesRef.current = candlestickSeries;

    // Set data - IMPORTANT: Sort candles by time first before processing
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
      .map(c => {
        return {
          time: normalizeCandleTime(c.time) as Time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        };
      });

    if (formattedCandles.length > 0) {
      candlestickSeries.setData(formattedCandles);
      const visiblePriceRange = buildVisiblePriceRange(formattedCandles);
      candlestickSeries.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: visiblePriceRange,
        }),
      });

      // Add volume series
      if (displayCandles.some((c) => typeof c.volume === 'number')) {
        const volumeSeries = chart.addHistogramSeries({
          color: '#6366f1',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

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
      }

      // Add markers if available - MUST be sorted by time
      if (markers.length > 0 && candlestickSeries) {
        const sortedMarkers = [...markers].sort((a, b) => Number(a.time) - Number(b.time));
        candlestickSeries.setMarkers(sortedMarkers);
      }

      // Fit content to show all candles properly
      const timeScale = chart.timeScale();
      timeScale.fitContent();

      // Explicitly set price scale to show current price range
      const priceScale = candlestickSeries.priceScale();
      priceScale.applyOptions({
        autoScale: false,
      });
      // Set visible price range
      chart.timeScale().fitContent();
    }

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [displayCandles, height, markers]);

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
