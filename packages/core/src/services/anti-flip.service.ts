import {
  SignalDirection,
  LoggerService,
  Candle,
} from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { ICONS } from '../cli/cli-runtime';

export interface AntiFlipConfig {
  enabled: boolean;
  cooldownCandles: number;
  cooldownMs: number;
  requiredConfirmationCandles: number;
  overrideConfidenceThreshold: number;
  strongReversalRsiThreshold: number;
}

export interface LastSignalInfo {
  direction: SignalDirection;
  timestamp: number;
  candleCount: number;
  price: number;
}

export interface AntiFlipStateSnapshot {
  lastSignal: LastSignalInfo | null;
  candlesSinceSignal: number;
  isInCooldown: boolean;
}

const DEFAULT_CONFIG: AntiFlipConfig = {
  enabled: true,
  cooldownCandles: 3,
  cooldownMs: 300000,
  requiredConfirmationCandles: 2,
  overrideConfidenceThreshold: 85,
  strongReversalRsiThreshold: 25,
};

export class AntiFlipService {
  private config: AntiFlipConfig;
  private lastSignal: LastSignalInfo | null = null;
  private candlesSinceSignal: number = 0;

  constructor(
    private logger: LoggerService,
    config?: Partial<AntiFlipConfig>,
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  shouldBlockSignal(
    newDirection: SignalDirection,
    confidence: number,
    currentPrice: number,
    rsi?: number,
    recentCandles?: Candle[],
  ): { blocked: boolean; reason: string } {
    if (!this.config.enabled) {
      return { blocked: false, reason: 'Anti-flip disabled' };
    }

    if (!this.lastSignal) {
      return { blocked: false, reason: 'No previous signal' };
    }

    if (this.lastSignal.direction === newDirection) {
      return { blocked: false, reason: 'Same direction as last signal' };
    }

    if (newDirection === SignalDirection.HOLD) {
      return { blocked: false, reason: 'HOLD signal - no flip' };
    }

    const now = Date.now();
    const timeSinceSignal = now - this.lastSignal.timestamp;

    if (timeSinceSignal < this.config.cooldownMs) {
      if (this.candlesSinceSignal < this.config.cooldownCandles) {
        if (confidence >= this.config.overrideConfidenceThreshold) {
          try {
            this.logger.info(`${ICONS.note} Anti-flip override | High confidence signal`, {
              confidence,
              threshold: this.config.overrideConfidenceThreshold,
              newDirection,
              lastDirection: this.lastSignal.direction,
            });
          } catch (error) {
            if (this.errorHandler) {
              this.errorHandler.handle(error, {
                strategy: RecoveryStrategy.SKIP,
                context: 'AntiFlipService.shouldBlockSignal.highConfidenceOverrideLog',
              });
            }
          }
          return { blocked: false, reason: `High confidence override (${confidence}% >= ${this.config.overrideConfidenceThreshold}%)` };
        }

        if (this.isStrongReversal(newDirection, rsi)) {
          try {
            this.logger.info(`${ICONS.note} Anti-flip override | Strong RSI reversal`, {
              rsi,
              newDirection,
              threshold: this.config.strongReversalRsiThreshold,
            });
          } catch (error) {
            if (this.errorHandler) {
              this.errorHandler.handle(error, {
                strategy: RecoveryStrategy.SKIP,
                context: 'AntiFlipService.shouldBlockSignal.rsiReversalLog',
              });
            }
          }
          return { blocked: false, reason: `Strong RSI reversal (RSI: ${rsi?.toFixed(1)})` };
        }

        if (recentCandles && this.hasConfirmationCandles(newDirection, recentCandles)) {
          try {
            this.logger.info(`${ICONS.note} Anti-flip override | Candle confirmation`, {
              confirmationCandles: this.config.requiredConfirmationCandles,
              newDirection,
            });
          } catch (error) {
            if (this.errorHandler) {
              this.errorHandler.handle(error, {
                strategy: RecoveryStrategy.SKIP,
                context: 'AntiFlipService.shouldBlockSignal.candleConfirmationLog',
              });
            }
          }
          return { blocked: false, reason: `${this.config.requiredConfirmationCandles} confirmation candles` };
        }

        const remainingCooldown = this.config.cooldownMs - timeSinceSignal;
        const remainingCandles = this.config.cooldownCandles - this.candlesSinceSignal;

        try {
          this.logger.warn(`${ICONS.warning} Anti-flip BLOCKED | Signal flip too soon`, {
            newDirection,
            lastDirection: this.lastSignal.direction,
            candlesSince: this.candlesSinceSignal,
            requiredCandles: this.config.cooldownCandles,
            msSince: timeSinceSignal,
            requiredMs: this.config.cooldownMs,
            confidence,
          });
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handle(error, {
              strategy: RecoveryStrategy.SKIP,
              context: 'AntiFlipService.shouldBlockSignal.blockedWarningLog',
            });
          }
        }

        return {
          blocked: true,
          reason: `Flip blocked: wait ${remainingCandles} more candles or ${Math.round(remainingCooldown / 1000)}s`,
        };
      }
    }

    return { blocked: false, reason: 'Cooldown period passed' };
  }

  private isStrongReversal(direction: SignalDirection, rsi?: number): boolean {
    if (rsi === undefined) {
      return false;
    }

    if (direction === SignalDirection.LONG && rsi <= this.config.strongReversalRsiThreshold) {
      return true;
    }

    if (direction === SignalDirection.SHORT && rsi >= (100 - this.config.strongReversalRsiThreshold)) {
      return true;
    }

    return false;
  }

  private hasConfirmationCandles(direction: SignalDirection, candles: Candle[]): boolean {
    if (candles.length < this.config.requiredConfirmationCandles) {
      return false;
    }

    const recentCandles = candles.slice(-this.config.requiredConfirmationCandles);

    let confirmCount = 0;
    for (const candle of recentCandles) {
      const isBullish = candle.close > candle.open;
      const isBearish = candle.close < candle.open;

      if (direction === SignalDirection.LONG && isBullish) {
        confirmCount++;
      } else if (direction === SignalDirection.SHORT && isBearish) {
        confirmCount++;
      }
    }

    return confirmCount >= this.config.requiredConfirmationCandles;
  }

  recordSignal(direction: SignalDirection, price: number): void {
    if (direction === SignalDirection.HOLD) {
      return;
    }

    this.lastSignal = {
      direction,
      timestamp: Date.now(),
      candleCount: 0,
      price,
    };
    this.candlesSinceSignal = 0;

    try {
      this.logger.debug(`${ICONS.note} Anti-flip | Signal recorded`, {
        direction,
        price: price.toFixed(4),
        cooldownCandles: this.config.cooldownCandles,
        cooldownMs: this.config.cooldownMs,
      });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'AntiFlipService.recordSignal.debugLog',
        });
      }
    }
  }

  onNewCandle(): void {
    this.candlesSinceSignal++;
  }

  getStateSnapshot(): AntiFlipStateSnapshot {
    const isInCooldown = this.lastSignal !== null &&
      (Date.now() - this.lastSignal.timestamp < this.config.cooldownMs ||
       this.candlesSinceSignal < this.config.cooldownCandles);

    return {
      lastSignal: this.lastSignal,
      candlesSinceSignal: this.candlesSinceSignal,
      isInCooldown,
    };
  }

  reset(): void {
    this.lastSignal = null;
    this.candlesSinceSignal = 0;
  }

  updateConfig(config: Partial<AntiFlipConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AntiFlipConfig {
    return { ...this.config };
  }
}
