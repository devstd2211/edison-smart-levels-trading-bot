/**
 * Candle Aggregator Service
 *
 * Aggregates 1-minute candles into higher timeframes (5m, 15m, 1h, etc.)
 * Used for multi-timeframe feature extraction and analysis.
 *
 * Error Handling Strategy:
 * - THROW: Invalid input validation (null/invalid candles, invalid timeframe)
 * - GRACEFUL_DEGRADE: Aggregation failures (NaN/Infinity prices/volumes) → return empty array
 * - SKIP: Logging errors (silent fail for non-critical logging)
 */

import { Candle } from '../types/legacy';
import { TIME_INTERVALS } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { getErrorMessage } from '../utils/error.utils';

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export class CandleAggregatorService {
  constructor(private logger?: Logger, private errorHandler?: ErrorHandler) {}
  /**
   * Aggregate candles to a specific timeframe
   * @param candles - 1-minute candles
   * @param timeframeMinutes - Target timeframe in minutes (5, 15, 60, etc.)
   * @returns Aggregated candles
   * @throws On null/invalid candles or invalid timeframe
   */
  aggregateCandles(candles: Candle[], timeframeMinutes: number): Candle[] {
    // THROW: Input validation
    if (candles === null || candles === undefined) {
      const error = new Error('Candles array cannot be null or undefined');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!Array.isArray(candles)) {
      const error = new Error('Candles must be an array');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (timeframeMinutes === null || timeframeMinutes === undefined || !Number.isFinite(timeframeMinutes)) {
      const error = new Error('Timeframe minutes must be a valid finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (timeframeMinutes <= 0) {
      const error = new Error('Timeframe minutes must be greater than 0');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (candles.length === 0) return [];
    if (timeframeMinutes <= 1) return candles; // Return as-is for 1m

    try {
      const aggregated: Candle[] = [];
      const timeframeMs = timeframeMinutes * TIME_INTERVALS.MS_PER_MINUTE;

      let currentBatch: Candle[] = [];
      let currentPeriodStart = Math.floor(candles[0].timestamp / timeframeMs) * timeframeMs;

      for (const candle of candles) {
        const candlePeriod = Math.floor(candle.timestamp / timeframeMs) * timeframeMs;

        if (candlePeriod !== currentPeriodStart && currentBatch.length > 0) {
          // Finalize current period
          const aggregatedCandle = this.createAggregatedCandle(currentBatch, currentPeriodStart);
          if (aggregatedCandle) {
            aggregated.push(aggregatedCandle);
          }
          currentBatch = [];
          currentPeriodStart = candlePeriod;
        }

        currentBatch.push(candle);
      }

      // Finalize last batch
      if (currentBatch.length > 0) {
        const aggregatedCandle = this.createAggregatedCandle(currentBatch, currentPeriodStart);
        if (aggregatedCandle) {
          aggregated.push(aggregatedCandle);
        }
      }

      return aggregated;
    } catch (error) {
      // GRACEFUL_DEGRADE: Aggregation failures
      this.safeLog('error', `Aggregation failed: ${getErrorMessage(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return [];
    }
  }

  /**
   * Create aggregated candle from batch of 1-minute candles
   * Returns null if candle data is invalid (NaN/Infinity)
   */
  private createAggregatedCandle(batch: Candle[], periodStart: number): Candle | null {
    try {
      const opens = batch.map((c) => c.open);
      const highs = batch.map((c) => c.high);
      const lows = batch.map((c) => c.low);
      const closes = batch.map((c) => c.close);
      const volumes = batch.map((c) => c.volume);

      // Validate values before aggregation
      for (const candle of batch) {
        if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high) || !Number.isFinite(candle.low) ||
            !Number.isFinite(candle.close) || !Number.isFinite(candle.volume)) {
          throw new Error('Invalid candle data: NaN or Infinity detected');
        }
      }

      const high = Math.max(...highs);
      const low = Math.min(...lows);
      const volume = volumes.reduce((a, b) => a + b, 0);

      // Validate aggregated values
      if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(volume)) {
        throw new Error('Aggregation resulted in invalid values');
      }

      return {
        timestamp: batch[batch.length - 1].timestamp, // Use last candle's timestamp
        open: opens[0], // First open
        high, // Highest high
        low, // Lowest low
        close: closes[closes.length - 1], // Last close
        volume, // Sum of volumes
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: Return null on aggregation failure
      this.safeLog('warn', `Failed to create aggregated candle: ${getErrorMessage(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return null;
    }
  }

  /**
   * Safe logging wrapper - SKIP strategy for logging errors
   */
  private safeLog(level: keyof Logger, message: string): void {
    try {
      if (this.logger) {
        this.logger[level](message);
      }
    } catch (error) {
      // SKIP: Logging failures never block execution
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
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
   * @throws On invalid timeframe or count
   */
  getLastCandles(candles1m: Candle[], timeframeMinutes: number, count: number): Candle[] {
    // THROW: Input validation for count
    if (!Number.isFinite(count) || count < 0) {
      const error = new Error('Count must be a non-negative finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    const aggregated = this.aggregateCandles(candles1m, timeframeMinutes);
    const startIdx = Math.max(0, aggregated.length - count);

    return aggregated.slice(startIdx);
  }

  /**
   * Validate candles array
   * Returns true if valid, false otherwise
   */
  private validateCandles(candles: Candle[]): boolean {
    if (!Array.isArray(candles) || candles.length === 0) {
      return false;
    }

    for (const candle of candles) {
      if (!candle || !Number.isFinite(candle.timestamp) || !Number.isFinite(candle.open) ||
          !Number.isFinite(candle.high) || !Number.isFinite(candle.low) ||
          !Number.isFinite(candle.close) || !Number.isFinite(candle.volume)) {
        return false;
      }
    }

    return true;
  }
}
