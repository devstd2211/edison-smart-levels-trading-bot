/**
 * Candle Aggregator Service
 *
 * Aggregates 1-minute candles into higher timeframes (5m, 15m, 1h, etc.)
 * Used for multi-timeframe feature extraction and analysis.
 */

import { Candle } from '../types';
import { TIME_INTERVALS } from '../constants/technical.constants';

export class CandleAggregatorService {
  /**
   * Aggregate candles to a specific timeframe
   * @param candles - 1-minute candles
   * @param timeframeMinutes - Target timeframe in minutes (5, 15, 60, etc.)
   * @returns Aggregated candles
   */
  aggregateCandles(candles: Candle[], timeframeMinutes: number): Candle[] {
    if (candles.length === 0) return [];
    if (timeframeMinutes <= 1) return candles; // Return as-is for 1m

    const aggregated: Candle[] = [];
    const timeframeMs = timeframeMinutes * TIME_INTERVALS.MS_PER_MINUTE;

    let currentBatch: Candle[] = [];
    let currentPeriodStart = Math.floor(candles[0].timestamp / timeframeMs) * timeframeMs;

    for (const candle of candles) {
      const candlePeriod = Math.floor(candle.timestamp / timeframeMs) * timeframeMs;

      if (candlePeriod !== currentPeriodStart && currentBatch.length > 0) {
        // Finalize current period
        aggregated.push(this.createAggregatedCandle(currentBatch, currentPeriodStart));
        currentBatch = [];
        currentPeriodStart = candlePeriod;
      }

      currentBatch.push(candle);
    }

    // Finalize last batch
    if (currentBatch.length > 0) {
      aggregated.push(this.createAggregatedCandle(currentBatch, currentPeriodStart));
    }

    return aggregated;
  }

  /**
   * Create aggregated candle from batch of 1-minute candles
   */
  private createAggregatedCandle(batch: Candle[], periodStart: number): Candle {
    const opens = batch.map((c) => c.open);
    const highs = batch.map((c) => c.high);
    const lows = batch.map((c) => c.low);
    const closes = batch.map((c) => c.close);
    const volumes = batch.map((c) => c.volume);

    return {
      timestamp: batch[batch.length - 1].timestamp, // Use last candle's timestamp
      open: opens[0], // First open
      high: Math.max(...highs), // Highest high
      low: Math.min(...lows), // Lowest low
      close: closes[closes.length - 1], // Last close
      volume: volumes.reduce((a, b) => a + b, 0), // Sum of volumes
    };
  }

  /**
   * Get aggregated 5-minute candles
   */
  getCandles5m(candles1m: Candle[]): Candle[] {
    return this.aggregateCandles(candles1m, 5);
  }

  /**
   * Get aggregated 15-minute candles
   */
  getCandles15m(candles1m: Candle[]): Candle[] {
    return this.aggregateCandles(candles1m, 15);
  }

  /**
   * Get aggregated 1-hour candles
   */
  getCandles1h(candles1m: Candle[]): Candle[] {
    return this.aggregateCandles(candles1m, 60);
  }

  /**
   * Get last N candles at specific timeframe
   */
  getLastCandles(candles1m: Candle[], timeframeMinutes: number, count: number): Candle[] {
    const aggregated = this.aggregateCandles(candles1m, timeframeMinutes);
    return aggregated.slice(Math.max(0, aggregated.length - count));
  }
}
