/**
 * Price Chart Component
 *
 * Displays candlestick chart with Lightweight Charts library
 * Fetches real candle data from API and WebSocket for live updates
 */

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';
import { dataApi } from '../../services/api.service';
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

export function PriceChart({
  candles = [],
  title = 'Price Chart (Live)',
  height = 400,
  symbol = 'BTCUSDT',
  timeframe = '5m',
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const [displayCandles, setDisplayCandles] = useState<Candle[]>(candles);
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<any[]>([]);

  // Fetch candles from API
  const fetchCandles = async (tf: string) => {
    try {
      setLoading(true);
      const response = await dataApi.getCandles(tf, 100) as any;
      if (response?.success && response?.data?.candles) {
        // Normalize candles: API returns 'timestamp' but component expects 'time'
        let normalizedCandles = response.data.candles.map((c: any) => ({
          ...c,
          time: c.time || c.timestamp, // Support both 'time' and 'timestamp' field names
        })) as Candle[];

        // Remove duplicates - keep last occurrence of each timestamp
        const uniqueByTime = new Map<number, Candle>();
        normalizedCandles.forEach(c => {
          const timeKey = typeof c.time === 'number' ? c.time : Math.floor(Number(c.time));
          uniqueByTime.set(timeKey, c); // Last one wins
        });
        normalizedCandles = Array.from(uniqueByTime.values());

        // Keep only last 30 candles for best display (tight price range)
        if (normalizedCandles.length > 30) {
          normalizedCandles = normalizedCandles.slice(-30);
        }

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
      const response = await dataApi.getPositionHistory(50) as any;
      if (response?.success && response?.data?.positions) {
        const newMarkers = (response.data.positions as any[])
          .filter((pos: any) => pos.entryTime) // Only positions with entry time
          .flatMap((pos: any) => {
            const posMarkers = [];

            // Entry marker
            if (pos.entryTime) {
              posMarkers.push({
                time: Math.floor(pos.entryTime / 1000), // Convert to seconds
                position: pos.side === 'LONG' ? 'belowBar' : 'aboveBar',
                color: pos.side === 'LONG' ? '#22c55e' : '#ef4444',
                shape: pos.side === 'LONG' ? 'arrowUp' : 'arrowDown',
                text: `${pos.side}`,
                size: 2,
              });
            }

            // Exit marker (if position was closed)
            if (pos.exitTime) {
              posMarkers.push({
                time: Math.floor(pos.exitTime / 1000),
                position: pos.side === 'LONG' ? 'aboveBar' : 'belowBar',
                color: pos.pnl >= 0 ? '#22c55e' : '#ef4444',
                shape: 'circle',
                text: `${pos.pnl >= 0 ? '+' : ''}${pos.pnl?.toFixed(2) || '0.00'} USDT`,
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

  // Load initial candles and markers
  useEffect(() => {
    void fetchCandles(timeframe);
    void loadPositionMarkers();
  }, [timeframe]);

  // Listen for new candles via WebSocket
  useEffect(() => {
    wsClient.on('CANDLE_CLOSED', (data: any) => {
      if (data.timeframe === timeframe) {
        setDisplayCandles((prev) => [...prev.slice(-99), data.candle]);
      }
    });

    // Listen for new positions
    wsClient.on('POSITION_OPENED', (data: any) => {
      void loadPositionMarkers();
    });

    wsClient.on('POSITION_CLOSED', (data: any) => {
      void loadPositionMarkers();
    });

    return () => {
      wsClient.off('CANDLE_CLOSED', () => {});
      wsClient.off('POSITION_OPENED', () => {});
      wsClient.off('POSITION_CLOSED', () => {});
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
    const sortedCandles = [...displayCandles].sort((a, b) => {
      const timeA = Number(a.time) > 10000000000 ? Number(a.time) / 1000 : Number(a.time);
      const timeB = Number(b.time) > 10000000000 ? Number(b.time) / 1000 : Number(b.time);
      return timeA - timeB;
    });

    const formattedCandles = sortedCandles
      .filter(c => c && c.time && c.open && c.close)
      .map(c => {
        const timeInSeconds = Number(c.time) > 10000000000
          ? Math.floor(Number(c.time) / 1000)
          : Math.floor(Number(c.time));
        return {
          time: timeInSeconds,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        };
      })
      // Remove duplicates - keep last occurrence of each timestamp
      .reduce((acc: any[], c) => {
        const lastIdx = acc.findIndex(x => x.time === c.time);
        if (lastIdx >= 0) {
          acc[lastIdx] = c; // Replace with newer data
        } else {
          acc.push(c);
        }
        return acc;
      }, [])
      // Sort by time again after deduplication
      .sort((a, b) => a.time - b.time);

    if (formattedCandles.length > 0) {
      candlestickSeries.setData(formattedCandles as any);

      // Calculate min and max prices from candles
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      formattedCandles.forEach(c => {
        minPrice = Math.min(minPrice, c.low);
        maxPrice = Math.max(maxPrice, c.high);
      });

      // Add padding to price range (10% above and below)
      const padding = (maxPrice - minPrice) * 0.1;
      const priceRangeMin = minPrice - padding;
      const priceRangeMax = maxPrice + padding;

      // Add volume series
      if (displayCandles.some((c) => c?.volume)) {
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

        const volumeData = formattedCandles.map((c, idx) => {
          const originalCandle = displayCandles[idx];
          return {
            time: c.time as any,
            value: originalCandle?.volume || 0,
            color:
              originalCandle?.close >= originalCandle?.open
                ? 'rgba(34, 197, 94, 0.5)'
                : 'rgba(239, 68, 68, 0.5)',
          };
        });

        volumeSeries.setData(volumeData as any);
      }

      // Add markers if available - MUST be sorted by time
      if (markers.length > 0 && candlestickSeries) {
        const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);
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
