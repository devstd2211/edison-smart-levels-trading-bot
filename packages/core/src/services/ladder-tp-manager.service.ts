import { PERCENT_MULTIPLIER, PRICE_TOLERANCE, INTEGER_MULTIPLIERS } from '../constants';
import {
  LoggerService,
  SignalDirection,
  PositionSide,
  LadderTpManagerConfig,
  LadderTpLevel,
  Position,
} from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { ConfigurationError } from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';

const MIN_PARTIAL_CLOSE_QUANTITY = 0.01;
const PARTIAL_CLOSE_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 200,
  backoffMultiplier: 2,
} as const;
const STOP_LOSS_UPDATE_RETRY_CONFIG = {
  maxAttempts: 2,
  initialDelayMs: 100,
  backoffMultiplier: 2,
} as const;

export class LadderTpManagerService {
  constructor(
    private config: LadderTpManagerConfig,
    private bybitService: IExchange,
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.validateConfig();
  }

  createLadderLevels(entry: number, direction: SignalDirection): LadderTpLevel[] {
    this.logger.debug('Creating ladder TP levels', {
      entry,
      direction,
      levelsCount: this.config.levels.length,
    });

    const levels: LadderTpLevel[] = this.config.levels.map((levelConfig, index) => {
      let targetPrice: number;
      if (direction === SignalDirection.LONG) {
        targetPrice = entry * (1 + levelConfig.pricePercent / PERCENT_MULTIPLIER);
      } else {
        targetPrice = entry * (1 - levelConfig.pricePercent / PERCENT_MULTIPLIER);
      }

      return {
        level: index + 1,
        pricePercent: levelConfig.pricePercent,
        closePercent: levelConfig.closePercent,
        targetPrice,
        hit: false,
      };
    });

    this.logger.info(`${ICONS.success} Ladder TP levels created`, {
      direction,
      levels: levels.map((l) => ({
        level: l.level,
        price: l.targetPrice,
        closePercent: l.closePercent,
      })),
    });

    return levels;
  }

  checkTpHit(level: LadderTpLevel, currentPrice: number, direction: SignalDirection): boolean {
    if (level.hit) {
      return false;
    }

    const tolerance = level.targetPrice * (PRICE_TOLERANCE.TP_HIT_DETECTION_PERCENT / PERCENT_MULTIPLIER);

    let isHit: boolean;
    if (direction === SignalDirection.LONG) {
      isHit = currentPrice >= level.targetPrice - tolerance;
    } else {
      isHit = currentPrice <= level.targetPrice + tolerance;
    }

    if (isHit) {
      this.logger.info(`${ICONS.target} TP${level.level} HIT!`, {
        targetPrice: level.targetPrice,
        currentPrice,
        closePercent: level.closePercent,
      });
    }

    return isHit;
  }

  async executePartialClose(level: LadderTpLevel, position: Position): Promise<boolean> {
    try {
      const closeQty = position.quantity * (level.closePercent / PERCENT_MULTIPLIER);

      if (closeQty < 0.01) {
        this.logger.warn(`${ICONS.warning} Close quantity too small - skipping partial close`, {
          level: level.level,
          closeQty,
          minQty: MIN_PARTIAL_CLOSE_QUANTITY,
        });
        return false;
      }

      this.logger.info(`${ICONS.money} Executing TP${level.level} partial close`, {
        level: level.level,
        closePercent: level.closePercent,
        closeQty,
        targetPrice: level.targetPrice,
      });

      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          () =>
            this.bybitService.closePosition({
              positionId: position.id,
              percentage: level.closePercent,
            }),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: PARTIAL_CLOSE_RETRY_CONFIG,
            context: `LadderTpManager.executePartialClose[TP${level.level}]`,
          },
        );

        if (!result.success) {
          this.logger.error(`${ICONS.error} Failed to execute TP${level.level} partial close`, {
            level: level.level,
            error: result.error?.message || 'Unknown error',
          });
          return false;
        }
      } else {
        await this.bybitService.closePosition({
          positionId: position.id,
          percentage: level.closePercent,
        });
      }

      this.logger.info(`${ICONS.success} TP${level.level} partial close executed`, {
        level: level.level,
        closedQty: closeQty,
      });

      return true;
    } catch (error) {
      this.logger.error(`${ICONS.error} Failed to execute TP${level.level} partial close`, {
        level: level.level,
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  async moveToBreakeven(position: Position): Promise<boolean> {
    if (!this.config.moveToBreakevenAfterTP1) {
      return false;
    }

    try {
      const breakeven = position.entryPrice;

      this.logger.info(`${ICONS.balance} Moving SL to breakeven after TP1`, {
        oldSl: position.stopLoss?.price || 'unknown',
        newSl: breakeven,
        entry: position.entryPrice,
      });

      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          () =>
            this.bybitService.updateStopLoss({
              positionId: position.id,
              newPrice: breakeven,
            }),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: STOP_LOSS_UPDATE_RETRY_CONFIG,
            context: 'LadderTpManager.moveToBreakeven[retry]',
          },
        );

        if (!result.success) {
          this.logger.warn(`${ICONS.warning} Failed to move SL to breakeven - keeping current SL`, {
            error: result.error?.message || 'Unknown error',
          });
          return false;
        }
      } else {
        await this.bybitService.updateStopLoss({
          positionId: position.id,
          newPrice: breakeven,
        });
      }

      this.logger.info(`${ICONS.success} SL moved to breakeven`, {
        slPrice: breakeven,
      });

      return true;
    } catch (error) {
      this.logger.error(`${ICONS.error} Failed to move SL to breakeven`, {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  async moveTrailing(position: Position, currentPrice: number): Promise<boolean> {
    if (!this.config.trailingAfterTP2) {
      return false;
    }

    try {
      let newSlPrice: number;
      if (position.side === PositionSide.LONG) {
        newSlPrice = currentPrice * (1 - this.config.trailingDistancePercent / PERCENT_MULTIPLIER);
      } else {
        newSlPrice = currentPrice * (1 + this.config.trailingDistancePercent / PERCENT_MULTIPLIER);
      }

      const shouldMove =
        position.side === PositionSide.LONG
          ? newSlPrice > (position.stopLoss?.price || 0)
          : newSlPrice < (position.stopLoss?.price || Infinity);

      if (!shouldMove) {
        this.logger.debug(`${ICONS.note} Trailing SL not better than current SL - skipping`, {
          currentSl: position.stopLoss?.price || 'unknown',
          newSl: newSlPrice,
        });
        return false;
      }

      this.logger.info(`${ICONS.chart_up} Moving SL to trailing price after TP2`, {
        oldSl: position.stopLoss?.price || 'unknown',
        newSl: newSlPrice,
        currentPrice,
        trailingDistance: this.config.trailingDistancePercent,
      });

      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          () =>
            this.bybitService.updateStopLoss({
              positionId: position.id,
              newPrice: newSlPrice,
            }),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: STOP_LOSS_UPDATE_RETRY_CONFIG,
            context: 'LadderTpManager.moveTrailing[retry]',
          },
        );

        if (!result.success) {
          this.logger.warn(`${ICONS.warning} Failed to move trailing SL - keeping current SL`, {
            error: result.error?.message || 'Unknown error',
          });
          return false;
        }
      } else {
        await this.bybitService.updateStopLoss({
          positionId: position.id,
          newPrice: newSlPrice,
        });
      }

      this.logger.info(`${ICONS.success} Trailing SL updated`, {
        slPrice: newSlPrice,
      });

      return true;
    } catch (error) {
      this.logger.error(`${ICONS.error} Failed to move trailing SL`, {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  private validateConfig(): void {
    if (this.config.levels.length === 0) {
      throw new ConfigurationError(
        'LadderTpManagerConfig must have at least 1 level',
        {
          configKey: 'levels',
          issue: 'EMPTY_LEVELS',
        },
      );
    }

    for (const level of this.config.levels) {
      if (level.pricePercent <= 0) {
        throw new ConfigurationError(
          `Invalid pricePercent: ${level.pricePercent} (must be > 0)`,
          {
            configKey: 'levels.pricePercent',
            issue: 'INVALID_PRICE_PERCENT',
            value: level.pricePercent,
          },
        );
      }

      if (level.closePercent < this.config.minPartialClosePercent || level.closePercent > this.config.maxPartialClosePercent) {
        throw new ConfigurationError(
          `Invalid closePercent: ${level.closePercent} (must be ${this.config.minPartialClosePercent}-${this.config.maxPartialClosePercent}%)`,
          {
            configKey: 'levels.closePercent',
            issue: 'INVALID_CLOSE_PERCENT',
            value: level.closePercent,
            min: this.config.minPartialClosePercent,
            max: this.config.maxPartialClosePercent,
          },
        );
      }
    }

    if (this.config.trailingAfterTP2 && this.config.trailingDistancePercent <= 0) {
      throw new ConfigurationError(
        `Invalid trailingDistancePercent: ${this.config.trailingDistancePercent} (must be > 0)`,
        {
          configKey: 'trailingDistancePercent',
          issue: 'INVALID_TRAILING_DISTANCE',
          value: this.config.trailingDistancePercent,
        },
      );
    }
  }

  getConfig(): LadderTpManagerConfig {
    return this.config;
  }
}
