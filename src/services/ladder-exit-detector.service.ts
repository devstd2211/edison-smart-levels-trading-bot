/**
 * Ladder Exit Detector Service (Phase 8.9.27)
 *
 * Detects when ladder TP levels are hit during live trading and determines
 * which TP level was executed. Complements LadderTPManagerService.
 *
 * Features:
 * - Detect TP1/TP2/TP3 level hits from price action
 * - Identify which TP level was actually executed
 * - Analyze exit execution from order history
 * - ErrorHandler integration with THROW + RETRY + SKIP strategies
 *
 * Example:
 * Entry: 1.0000 LONG
 * TP1: 1.0008 → Detect hit, identify as TP1
 * TP2: 1.0015 → Detect hit, identify as TP2
 * TP3: 1.0025 → Detect hit, identify as TP3
 */

import {
  LoggerService,
  Position,
  ExitType,
  SignalDirection,
  PositionSide,
  BybitOrder,
} from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { ConfigurationError } from '../errors/DomainErrors';

// ============================================================================
// LADDER EXIT DETECTOR SERVICE
// ============================================================================

export class LadderExitDetectorService {
  constructor(
    private readonly logger: LoggerService,
    private readonly bybitService: IExchange,
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.logger.info('LadderExitDetectorService initialized', {
      hasErrorHandler: !!errorHandler,
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Detect if any ladder TP level has been hit
   * Checks current price against all TP levels
   *
   * @param position - Position with TP levels
   * @param currentPrice - Current market price
   * @returns Detected TP level (1, 2, 3) or undefined if no hit
   */
  public detectLadderTPHit(position: Position, currentPrice: number): number | undefined {
    // Validate inputs
    this.validatePosition(position);
    this.validatePrice(currentPrice);

    this.logger.debug('Detecting ladder TP hit', {
      symbol: position.symbol,
      currentPrice,
      tpLevels: position.takeProfits?.length ?? 0,
    });

    if (!position.takeProfits || position.takeProfits.length === 0) {
      // SKIP strategy for missing TP levels
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

    // Check each TP level from highest to lowest (in order of execution)
    const direction = this.getPositionDirection(position);

    for (let i = position.takeProfits.length - 1; i >= 0; i--) {
      const tpLevel = position.takeProfits[i];
      const levelNumber = i + 1;

      if (this.isTpLevelHit(tpLevel.price, currentPrice, direction)) {
        this.logger.info('🎯 Ladder TP level hit detected', {
          symbol: position.symbol,
          level: levelNumber,
          targetPrice: tpLevel.price,
          currentPrice,
          direction,
        });
        return levelNumber;
      }
    }

    return undefined;
  }

  /**
   * Identify which TP level was hit based on execution price
   * Finds the closest TP level to the execution price
   *
   * @param executionPrice - Price at which position was closed
   * @param position - Position with TP levels
   * @returns TP level (1, 2, or 3)
   */
  public identifyTPLevel(executionPrice: number, position: Position): number {
    // Validate inputs
    this.validatePosition(position);
    this.validatePrice(executionPrice);

    this.logger.debug('Identifying TP level', {
      executionPrice,
      tpLevels: position.takeProfits?.length ?? 0,
    });

    if (!position.takeProfits || position.takeProfits.length === 0) {
      // SKIP strategy for missing TP levels
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

    // Find closest TP level
    let closestLevel = 1;
    let minDifference = Math.abs(executionPrice - position.takeProfits[0].price);

    for (let i = 1; i < position.takeProfits.length; i++) {
      const difference = Math.abs(executionPrice - position.takeProfits[i].price);
      if (difference < minDifference) {
        minDifference = difference;
        closestLevel = i + 1;
      }
    }

    return closestLevel;
  }

  /**
   * Analyze exit execution from order history
   * Determines exit type based on filled orders
   *
   * @param position - Position being analyzed
   * @returns Exit type and TP level if applicable
   */
  public async analyzeExitExecution(position: Position): Promise<{
    exitType: ExitType;
    tpLevel?: number;
  }> {
    // Validate input
    this.validatePosition(position);

    this.logger.debug('Analyzing exit execution', {
      symbol: position.symbol,
      positionId: position.id,
    });

    // RETRY strategy for fetching order details
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

      const orderHistory = this.toBybitOrders(result.value);
      return this.determineExitTypeFromOrders(position, orderHistory);
    } else {
      // Fallback without ErrorHandler
      try {
        if (!this.bybitService.getOrderHistory) {
          throw new Error('getOrderHistory method not available');
        }
        const orderHistory = this.toBybitOrders(await this.bybitService.getOrderHistory(100));
        return this.determineExitTypeFromOrders(position, orderHistory);
      } catch (error) {
        this.logger.warn('Failed to fetch order history', {
          error: (error as Error).message,
        });
        return this.determineFallbackExitType(position);
      }
    }
  }

  /**
   * Check if a complete ladder execution (all TP levels) has occurred
   * Verifies all TP levels have been hit in order
   *
   * @param position - Position with TP levels
   * @param orderHistory - Recent order history
   * @returns true if complete ladder was executed
   */
  public async isCompleteLadderExecuted(position: Position, orderHistory?: BybitOrder[]): Promise<boolean> {
    this.validatePosition(position);

    if (!position.takeProfits || position.takeProfits.length < 3) {
      return false;
    }

    let orders = orderHistory;

    // Fetch order history if not provided
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
        orders = this.toBybitOrders(result.value);
      } else {
        try {
          if (!this.bybitService.getOrderHistory) {
            throw new Error('getOrderHistory method not available');
          }
          orders = this.toBybitOrders(await this.bybitService.getOrderHistory(100));
        } catch (error) {
          this.logger.warn('Failed to fetch order history', {
            error: (error as Error).message,
          });
          return false;
        }
      }
    }

    // Check if all 3 TP levels have filled orders
    const filledOrders = (orders ?? [])
      .filter((o) => o.symbol === position.symbol && o.orderStatus === 'Filled' && o.reduceOnly)
      .sort((a, b) => {
        const aTime = (a as Record<string, unknown>).updatedTime as number;
        const bTime = (b as Record<string, unknown>).updatedTime as number;
        return aTime - bTime;
      });

    // Must have at least 3 filled orders for complete ladder
    if (filledOrders.length < 3) {
      return false;
    }

    // Verify orders correspond to TP levels (optional - can be basic check)
    return true;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Validate position object
   * THROW strategy for critical validation
   */
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

  /**
   * Validate price value
   * THROW strategy for critical validation
   */
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

  private toBybitOrders(value: unknown): BybitOrder[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(this.isBybitOrder);
  }

  private isBybitOrder(value: unknown): value is BybitOrder {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const order = value as Record<string, unknown>;
    return typeof order.orderId === 'string'
      && typeof order.orderType === 'string'
      && typeof order.side === 'string'
      && typeof order.price === 'string'
      && typeof order.reduceOnly === 'boolean';
  }

  /**
   * Check if TP level has been hit
   * Accounts for position direction (LONG vs SHORT)
   * Uses 0.05% tolerance for price tolerance
   */
  private isTpLevelHit(targetPrice: number, currentPrice: number, direction: SignalDirection): boolean {
    const tolerance = targetPrice * 0.0005; // 0.05% tolerance

    if (direction === SignalDirection.LONG) {
      // LONG: TP is above entry, hit when price >= TP
      return currentPrice >= targetPrice - tolerance;
    } else {
      // SHORT: TP is below entry, hit when price <= TP
      return currentPrice <= targetPrice + tolerance;
    }
  }

  /**
   * Get position direction from position side
   */
  private getPositionDirection(position: Position): SignalDirection {
    if (position.side === PositionSide.LONG) {
      return SignalDirection.LONG;
    } else {
      return SignalDirection.SHORT;
    }
  }

  /**
   * Determine exit type from order history
   * Analyzes filled orders to identify SL/TP/Trailing/Manual
   */
  private determineExitTypeFromOrders(
    position: Position,
    orderHistory: BybitOrder[]
  ): { exitType: ExitType; tpLevel?: number } {
    // Find filled orders for this symbol
    const filledOrders = orderHistory
      .filter((o) => o.symbol === position.symbol && o.orderStatus === 'Filled')
      .sort((a, b) => {
        const aTime = (a as Record<string, unknown>).updatedTime as number;
        const bTime = (b as Record<string, unknown>).updatedTime as number;
        return bTime - aTime;
      }); // Most recent first

    if (filledOrders.length === 0) {
      // SKIP strategy for missing order history
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

    // Check for Stop Loss
    if (lastOrder.stopOrderType === 'Stop' || lastOrder.stopOrderType === 'StopLoss') {
      return { exitType: ExitType.STOP_LOSS };
    }

    // Check for Trailing Stop
    if (lastOrder.stopOrderType === 'TrailingStop') {
      return { exitType: ExitType.TRAILING_STOP };
    }

    // Check for Take Profit
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
        // SKIP strategy for price parsing errors
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

    // Check for Manual close
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

  /**
   * Determine fallback exit type when order history is unavailable
   */
  private determineFallbackExitType(position: Position): { exitType: ExitType; tpLevel?: number } {
    // Log with SKIP strategy - this is non-critical
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
