import { ICONS } from '../cli/cli-runtime';
import { LoggerService,
  Position,
  ExitType,
  BybitOrder,
} from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { ConfigurationError } from '../errors/DomainErrors';
import {
  detectLadderHitLevel,
  getFilledReduceOnlyOrders,
  getUpdatedTime,
  identifyClosestTpLevel,
  toBybitOrders,
} from './ladder-exit-detector/ladder-exit-detector-state.utils';

export class LadderExitDetectorService {
  constructor(
    private readonly logger: LoggerService,
    private readonly bybitService: IExchange,
    private readonly errorHandler?: ErrorHandler,
  ) {
  }

  public detectLadderTPHit(position: Position, currentPrice: number): number | undefined {
    this.validatePosition(position);
    this.validatePrice(currentPrice);

    this.logger.debug('Detecting ladder TP hit', {
      symbol: position.symbol,
      currentPrice,
      tpLevels: position.takeProfits?.length ?? 0,
    });

    if (!position.takeProfits || position.takeProfits.length === 0) {
      if (this.errorHandler) {
        const error = new Error('No TP levels defined in position');
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'LadderExitDetectorService.detectLadderTPHit.noTPLevels',
          onRecover: () => {
            this.logger.warn('No TP levels defined, cannot detect TP hit');
          },
        });
      }
      return undefined;
    }

    const detectedLevel = detectLadderHitLevel(position, currentPrice);
    if (detectedLevel !== undefined) {
      const tpLevel = position.takeProfits[detectedLevel - 1];
      this.logger.info(`${ICONS.target} Ladder TP level hit detected`, {
        symbol: position.symbol,
        level: detectedLevel,
        targetPrice: tpLevel?.price,
        currentPrice,
        direction: position.side,
      });
      return detectedLevel;
    }

    return undefined;
  }

  public identifyTPLevel(executionPrice: number, position: Position): number {
    this.validatePosition(position);
    this.validatePrice(executionPrice);

    this.logger.debug('Identifying TP level', {
      executionPrice,
      tpLevels: position.takeProfits?.length ?? 0,
    });

    if (!position.takeProfits || position.takeProfits.length === 0) {
      if (this.errorHandler) {
        const error = new Error('No TP levels defined in position');
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'LadderExitDetectorService.identifyTPLevel.noTPLevels',
          onRecover: () => {
            this.logger.warn('No TP levels defined, defaulting to TP1');
          },
        });
      }
      return 1;
    }

    return identifyClosestTpLevel(executionPrice, position);
  }

  public async analyzeExitExecution(position: Position): Promise<{
    exitType: ExitType;
    tpLevel?: number;
  }> {
    this.validatePosition(position);

    this.logger.debug('Analyzing exit execution', {
      symbol: position.symbol,
      positionId: position.id,
    });

    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => {
          if (!this.bybitService.getOrderHistory) {
            throw new Error('getOrderHistory method not available');
          }
          return await this.bybitService.getOrderHistory(100);
        },
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: {
            maxAttempts: 3,
            initialDelayMs: 100,
            backoffMultiplier: 2,
          },
          context: 'LadderExitDetectorService.analyzeExitExecution[fetch]',
        }
      );

      if (!result.success) {
        this.logger.warn('Failed to fetch order history, using fallback analysis', {
          error: result.error?.message,
        });
        return this.determineFallbackExitType(position);
      }

      const orderHistory = toBybitOrders(result.value);
      return this.determineExitTypeFromOrders(position, orderHistory);
    } else {
      try {
        if (!this.bybitService.getOrderHistory) {
          throw new Error('getOrderHistory method not available');
        }
        const orderHistory = toBybitOrders(await this.bybitService.getOrderHistory(100));
        return this.determineExitTypeFromOrders(position, orderHistory);
      } catch (error) {
        this.logger.warn('Failed to fetch order history', {
          error: (error as Error).message,
        });
        return this.determineFallbackExitType(position);
      }
    }
  }

  public async isCompleteLadderExecuted(position: Position, orderHistory?: BybitOrder[]): Promise<boolean> {
    this.validatePosition(position);

    if (!position.takeProfits || position.takeProfits.length < 3) {
      return false;
    }

    let orders = orderHistory;

    if (!orders) {
      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          async () => {
            if (!this.bybitService.getOrderHistory) {
              throw new Error('getOrderHistory method not available');
            }
            return await this.bybitService.getOrderHistory(100);
          },
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: {
              maxAttempts: 2,
              initialDelayMs: 100,
              backoffMultiplier: 2,
            },
            context: 'LadderExitDetectorService.isCompleteLadderExecuted[fetch]',
          }
        );

        if (!result.success) {
          this.logger.warn('Failed to fetch order history for ladder check', {
            error: result.error?.message,
          });
          return false;
        }
        orders = toBybitOrders(result.value);
      } else {
        try {
          if (!this.bybitService.getOrderHistory) {
            throw new Error('getOrderHistory method not available');
          }
          orders = toBybitOrders(await this.bybitService.getOrderHistory(100));
        } catch (error) {
          this.logger.warn('Failed to fetch order history', {
            error: (error as Error).message,
          });
          return false;
        }
      }
    }

    const filledOrders = getFilledReduceOnlyOrders(orders ?? [], position);

    if (filledOrders.length < 3) {
      return false;
    }

    return true;
  }

  private validatePosition(position: Position | undefined | null): void {
    if (!position) {
      const error = new ConfigurationError('Position object is required for exit detection', {
        configKey: 'position',
        issue: 'MISSING_POSITION',
      });

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'LadderExitDetectorService.validatePosition',
        });
      }
      throw error;
    }

    if (!position.symbol) {
      const error = new ConfigurationError('Position must have a symbol', {
        configKey: 'position.symbol',
        issue: 'MISSING_SYMBOL',
      });

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'LadderExitDetectorService.validatePosition.symbol',
        });
      }
      throw error;
    }
  }

  private validatePrice(price: number | undefined | null): void {
    if (price === undefined || price === null || isNaN(price)) {
      const error = new ConfigurationError('Price must be a valid number', {
        configKey: 'price',
        issue: 'INVALID_PRICE',
      });

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'LadderExitDetectorService.validatePrice',
        });
      }
      throw error;
    }
  }

  private determineExitTypeFromOrders(
    position: Position,
    orderHistory: BybitOrder[]
  ): { exitType: ExitType; tpLevel?: number } {
    const filledOrders = orderHistory
      .filter((o) => o.symbol === position.symbol && o.orderStatus === 'Filled')
      .sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a));

    if (filledOrders.length === 0) {
      if (this.errorHandler) {
        const error = new Error('No filled orders found in history');
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'LadderExitDetectorService.determineExitTypeFromOrders.noFilledOrders',
          onRecover: () => {
            this.logger.warn('No filled orders found, assuming MANUAL close');
          },
        });
      }
      this.logger.warn('No filled orders found, assuming MANUAL close');
      return { exitType: ExitType.MANUAL };
    }

    const lastOrder = filledOrders[0];

    if (lastOrder.stopOrderType === 'Stop' || lastOrder.stopOrderType === 'StopLoss') {
      return { exitType: ExitType.STOP_LOSS };
    }

    if (lastOrder.stopOrderType === 'TrailingStop') {
      return { exitType: ExitType.TRAILING_STOP };
    }

    if (lastOrder.orderType === 'Limit' && lastOrder.reduceOnly === true) {
      try {
        const executionPrice = parseFloat(lastOrder.price);
        const tpLevel = this.identifyTPLevel(executionPrice, position);

        const exitTypeMap: { [key: number]: ExitType } = {
          1: ExitType.TAKE_PROFIT_1,
          2: ExitType.TAKE_PROFIT_2,
          3: ExitType.TAKE_PROFIT_3,
        };

        return {
          exitType: exitTypeMap[tpLevel] || ExitType.TAKE_PROFIT_1,
          tpLevel,
        };
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error as Error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'LadderExitDetectorService.determineExitTypeFromOrders.parsePriceError',
            onRecover: () => {
              this.logger.warn('Failed to parse execution price, defaulting to TP1');
            },
          });
        }
        return { exitType: ExitType.TAKE_PROFIT_1, tpLevel: 1 };
      }
    }

    if (lastOrder.orderType === 'Market' && lastOrder.reduceOnly === true) {
      return { exitType: ExitType.MANUAL };
    }

    this.logger.warn('Could not determine exit type from order', {
      orderType: lastOrder.orderType,
      stopOrderType: lastOrder.stopOrderType,
      reduceOnly: lastOrder.reduceOnly,
    });

    return { exitType: ExitType.MANUAL };
  }

  private determineFallbackExitType(position: Position): { exitType: ExitType; tpLevel?: number } {
    try {
      this.logger.warn('Using fallback exit type determination', {
        symbol: position.symbol,
        reason: 'Order history unavailable',
      });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'LadderExitDetectorService.determineFallbackExitType[log]',
        });
      }
    }

    return { exitType: ExitType.MANUAL };
  }
}
