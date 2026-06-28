import { Candle, SwingPoint, SwingPointType, LoggerService } from '../types/legacy';
import { DECIMAL_PLACES } from '../constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { ICONS } from '../cli/cli-runtime';
import {
  IndicatorCalculationError,
  CandleDataMissingError,
  ValidationError,
} from '../errors/DomainErrors';

const DEFAULT_LOOKBACK_PERIOD = 2;
const MIN_CANDLES_REQUIRED = 5;

export class SwingPointDetectorService {
  private readonly lookbackPeriod: number;

  constructor(
    private readonly logger: LoggerService,
    lookbackPeriod: number = DEFAULT_LOOKBACK_PERIOD,
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.lookbackPeriod = lookbackPeriod;

    if (lookbackPeriod < 1) {
      const error = new ValidationError(
        `SwingPointDetectorService: Lookback period must be >= 1`,
        {
          field: 'lookbackPeriod',
          value: lookbackPeriod,
          reason: 'Lookback period must be at least 1',
        }
      );

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'SwingPointDetectorService.constructor',
        });
      }
      throw error;
    }

    this.safeLog('info', `${ICONS.success} SwingPointDetectorService initialized`, {
      lookbackPeriod: this.lookbackPeriod,
    });
  }

  private safeLog(
    level: 'info' | 'debug' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: `SwingPointDetectorService.${level}`,
        });
      }
    }
  }

  private isValidCandle(candle: Partial<Candle> | null | undefined, index: number): boolean {
    if (!candle) return false;

    const { high, low, timestamp } = candle;

    if (high === undefined || low === undefined || timestamp === undefined) {
      return false;
    }

    if (!Number.isFinite(high) || !Number.isFinite(low)) {
      this.safeLog('warn', 'Invalid candle price detected', {
        index,
        high,
        low,
        reason: 'NaN or Infinity',
      });
      return false;
    }

    if (high < low) {
      this.safeLog('warn', 'Invalid candle structure', {
        index,
        high,
        low,
        reason: 'high < low',
      });
      return false;
    }

    return true;
  }

  detectSwingPoints(candles: Candle[]): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    try {
      if (!candles || !Array.isArray(candles)) {
        const error = new ValidationError(
          'SwingPointDetectorService: Invalid candles input',
          {
            expectedType: 'Candle[]',
            receivedType: typeof candles,
            reason: 'Candles must be an array',
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'SwingPointDetectorService.detectSwingPoints',
            onRecover: () => {
              this.safeLog('warn', 'Invalid candles input - returning empty', {
                got: typeof candles,
              });
            },
          });
        } else {
          this.safeLog('warn', 'Invalid candles input', { got: typeof candles });
        }

        return { highs, lows };
      }

      if (candles.length < MIN_CANDLES_REQUIRED) {
        const error = new CandleDataMissingError(
          'SwingPointDetectorService: Insufficient candle data',
          {
            calculator: 'SwingPointDetector',
            minRequired: MIN_CANDLES_REQUIRED,
            available: candles.length,
            reason: `Need at least ${MIN_CANDLES_REQUIRED} candles`,
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'SwingPointDetectorService.detectSwingPoints',
            onRecover: () => {
              this.safeLog('debug', 'Not enough candles', {
                required: MIN_CANDLES_REQUIRED,
                got: candles.length,
              });
            },
          });
        } else {
          this.safeLog('debug', 'Not enough candles', {
            required: MIN_CANDLES_REQUIRED,
            got: candles.length,
          });
        }

        return { highs, lows };
      }

      for (let i = this.lookbackPeriod; i < candles.length - this.lookbackPeriod; i++) {
        const current = candles[i];

        if (!this.isValidCandle(current, i)) {
          continue;
        }

        let isSwingHigh = true;
        let isSwingLow = true;

        for (let j = 1; j <= this.lookbackPeriod; j++) {
          const prevCandle = candles[i - j];
          const nextCandle = candles[i + j];

          if (!this.isValidCandle(prevCandle, i - j) || !this.isValidCandle(nextCandle, i + j)) {
            continue;
          }

          if (prevCandle.high >= current.high || nextCandle.high >= current.high) {
            isSwingHigh = false;
          }

          if (prevCandle.low <= current.low || nextCandle.low <= current.low) {
            isSwingLow = false;
          }
        }

        if (isSwingHigh) {
          const swingHigh: SwingPoint = {
            price: current.high,
            timestamp: current.timestamp,
            type: SwingPointType.HIGH,
          };

          highs.push(swingHigh);

          this.safeLog('debug', `${ICONS.note} Swing high detected`, {
            candleIndex: i,
            price: current.high.toFixed(DECIMAL_PLACES.PRICE),
            timestamp: new Date(current.timestamp).toISOString(),
          });
        }

        if (isSwingLow) {
          const swingLow: SwingPoint = {
            price: current.low,
            timestamp: current.timestamp,
            type: SwingPointType.LOW,
          };

          lows.push(swingLow);

          this.safeLog('debug', `${ICONS.note} Swing low detected`, {
            candleIndex: i,
            price: current.low.toFixed(DECIMAL_PLACES.PRICE),
            timestamp: new Date(current.timestamp).toISOString(),
          });
        }
      }

      this.safeLog('debug', `${ICONS.chart} Swing point detection complete`, {
        totalCandles: candles.length,
        swingHighsDetected: highs.length,
        swingLowsDetected: lows.length,
        lookbackPeriod: this.lookbackPeriod,
      });

      return { highs, lows };
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Unexpected error during detection',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.detectSwingPoints',
          onRecover: () => {
            this.safeLog('error', 'Detection failed - returning empty', {
              error: (error as Error).message,
            });
          },
        });
      } else {
        this.safeLog('error', 'Detection failed', {
          error: (error as Error).message,
        });
      }

      return { highs, lows };
    }
  }

  getLatestHigh(highs: SwingPoint[]): SwingPoint | null {
    if (!highs || highs.length === 0) return null;
    return highs[highs.length - 1];
  }

  getLatestLow(lows: SwingPoint[]): SwingPoint | null {
    if (!lows || lows.length === 0) return null;
    return lows[lows.length - 1];
  }

  isHigherHigherLow(highs: SwingPoint[], lows: SwingPoint[]): boolean {
    try {
      if (highs.length < 2 || lows.length < 2) return false;

      const lastHigh = highs[highs.length - 1].price;
      const prevHigh = highs[highs.length - 2].price;
      const lastLow = lows[lows.length - 1].price;
      const prevLow = lows[lows.length - 2].price;

      if (
        !Number.isFinite(lastHigh) ||
        !Number.isFinite(prevHigh) ||
        !Number.isFinite(lastLow) ||
        !Number.isFinite(prevLow)
      ) {
        this.safeLog('warn', 'Invalid swing point prices in isHigherHigherLow', {
          lastHigh,
          prevHigh,
          lastLow,
          prevLow,
        });
        return false;
      }

      return lastHigh > prevHigh && lastLow > prevLow;
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Error in isHigherHigherLow pattern detection',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception in pattern detection',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.isHigherHigherLow',
        });
      } else {
        this.safeLog('error', 'Pattern detection failed', {
          error: (error as Error).message,
        });
      }

      return false;
    }
  }

  isLowerHigherLow(highs: SwingPoint[], lows: SwingPoint[]): boolean {
    try {
      if (highs.length < 2 || lows.length < 2) return false;

      const lastHigh = highs[highs.length - 1].price;
      const prevHigh = highs[highs.length - 2].price;
      const lastLow = lows[lows.length - 1].price;
      const prevLow = lows[lows.length - 2].price;

      if (
        !Number.isFinite(lastHigh) ||
        !Number.isFinite(prevHigh) ||
        !Number.isFinite(lastLow) ||
        !Number.isFinite(prevLow)
      ) {
        this.safeLog('warn', 'Invalid swing point prices in isLowerHigherLow', {
          lastHigh,
          prevHigh,
          lastLow,
          prevLow,
        });
        return false;
      }

      return lastHigh < prevHigh && lastLow < prevLow;
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Error in isLowerHigherLow pattern detection',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception in pattern detection',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.isLowerHigherLow',
        });
      } else {
        this.safeLog('error', 'Pattern detection failed', {
          error: (error as Error).message,
        });
      }

      return false;
    }
  }

  calculateStrengthFromSwingPoints(
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    highs: SwingPoint[],
    lows: SwingPoint[],
  ): number {
    try {
      if (!Array.isArray(highs) || !Array.isArray(lows)) {
        this.safeLog('warn', 'Invalid swing point arrays in calculateStrengthFromSwingPoints', {
          highsType: typeof highs,
          lowsType: typeof lows,
        });
        return 0.3; // Return NEUTRAL
      }

      if (bias === 'NEUTRAL') {
        return 0.3;
      }

      const swingPointCount = highs.length + lows.length;

      if (swingPointCount < 0) {
        this.safeLog('warn', 'Invalid swing point count', { count: swingPointCount });
        return 0.3;
      }

      if (swingPointCount <= 2) {
        return 0.5;
      }

      if (swingPointCount <= 5) {
        return 0.7;
      }

      return 0.9;
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Error calculating strength from swing points',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception in strength calculation',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.calculateStrengthFromSwingPoints',
          onRecover: () => {
            this.safeLog('error', 'Strength calculation failed - returning NEUTRAL', {
              error: (error as Error).message,
            });
          },
        });
      } else {
        this.safeLog('error', 'Strength calculation failed', {
          error: (error as Error).message,
        });
      }

      return 0.3; // Return NEUTRAL
    }
  }
}
