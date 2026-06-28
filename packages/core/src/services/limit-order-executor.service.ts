import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
import {
  LoggerService,
  SignalDirection,
  PositionSide,
  LimitOrderExecutorConfig,
  LimitOrderResult,
  MarketOrderResult,
} from '../types/legacy';
import { BybitService } from './bybit/bybit.service';
import { MAKER_FEE_PERCENT, TAKER_FEE_PERCENT, ORDER_CHECK_INTERVAL_MS } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy, RetryConfig } from '../errors/ErrorHandler';
import {
  LimitOrderPlacementError,
  LimitOrderFillTimeoutError,
  MarketOrderFallbackError,
  ExchangeConnectionError,
  ExchangeAPIError,
} from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';

const BYBIT_SUCCESS_CODE = INTEGER_MULTIPLIERS.ZERO;
const POSITION_IDX_ONE_WAY = INTEGER_MULTIPLIERS.ZERO;
const MARKET_FALLBACK_MAX_ATTEMPTS = 2;
const ORDER_STATUS_MAX_ATTEMPTS = 3;
const PLACEMENT_BACKOFF_BASE_MS = 500;
const PLACEMENT_BACKOFF_MAX_MS = 2000;
const STATUS_BACKOFF_BASE_MS = 50;
const STATUS_BACKOFF_MAX_MS = 200;

export class LimitOrderExecutorService {
  constructor(
    private config: LimitOrderExecutorConfig,
    private bybitService: BybitService,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
  }

  calculateLimitPrice(
    direction: SignalDirection,
    currentPrice: number,
    slippagePercent: number,
  ): number {
    if (direction === SignalDirection.LONG) {
      return currentPrice * (1 - slippagePercent / PERCENT_MULTIPLIER);
    } else {
      return currentPrice * (1 + slippagePercent / PERCENT_MULTIPLIER);
    }
  }

  async placeLimitOrder(
    direction: SignalDirection,
    quantity: number,
    limitPrice: number,
    leverage: number,
  ): Promise<LimitOrderResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    this.logger.info(`${ICONS.note} Placing limit order`, {
      direction,
      quantity,
      limitPrice,
      leverage,
    });

    await this.bybitService.setLeverage(leverage);

    const orderQty = this.bybitService.roundQuantity(quantity);
    const orderPrice = this.bybitService.roundPrice(limitPrice);

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        this.logger.info(`${ICONS.note} Placing limit order (attempt)`, {
          attempt,
          maxAttempts: this.config.maxRetries + 1,
        });

        const response = await this.bybitService.getRestClient().submitOrder({
          category: 'linear',
          symbol: this.bybitService.getSymbol(),
          side: direction === SignalDirection.LONG ? 'Buy' : 'Sell',
          orderType: 'Limit',
          qty: orderQty,
          price: orderPrice,
          timeInForce: 'GTC',
          positionIdx: POSITION_IDX_ONE_WAY,
        });

        if (response.retCode !== BYBIT_SUCCESS_CODE) {
          const placementError = new LimitOrderPlacementError(
            `Failed to place limit order: ${response.retMsg}`,
            {
              symbol: this.bybitService.getSymbol(),
              side: direction === SignalDirection.LONG ? 'Buy' : 'Sell',
              quantity,
              limitPrice,
              reason: response.retMsg,
            },
          );

          if (this.errorHandler) {
            await this.errorHandler.handle(placementError, {
              strategy: RecoveryStrategy.RETRY,
              context: 'LimitOrderExecutorService.placeLimitOrder',
            });
          }

          throw placementError;
        }

        const orderId = response.result.orderId;
        const executionTime = Date.now() - startTime;

        this.logger.info(`${ICONS.success} Limit order placed successfully`, {
          orderId,
          direction,
          quantity: orderQty,
          limitPrice: orderPrice,
          executionTime,
        });

        return {
          orderId,
          filled: false,
          feePaid: 0,
          executionTime,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${ICONS.warning} Limit order placement failed`, {
          attempt,
          error: getErrorMessage(error),
        });

        if (attempt < this.config.maxRetries + 1) {
          const delayMs = Math.min(PLACEMENT_BACKOFF_BASE_MS * attempt, PLACEMENT_BACKOFF_MAX_MS);
          await this.sleep(delayMs);
        }
      }
    }

    const finalError = new LimitOrderPlacementError(
      `Failed to place limit order after ${this.config.maxRetries + 1} attempts`,
      {
        symbol: this.bybitService.getSymbol(),
        side: direction === SignalDirection.LONG ? 'Buy' : 'Sell',
        quantity,
        limitPrice,
        reason: lastError?.message || 'Unknown error',
      },
      lastError,
    );

    if (this.errorHandler) {
      await this.errorHandler.handle(finalError, {
        strategy: RecoveryStrategy.THROW,
        context: 'LimitOrderExecutorService.placeLimitOrder',
      });
    }

    throw finalError;
  }

  async waitForFill(orderId: string, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    const endTime = startTime + timeoutMs;

    this.logger.debug(`${ICONS.hourglass} Waiting for limit order fill`, {
      orderId,
      timeoutMs,
    });

    while (Date.now() < endTime) {
      try {
        const filled = await this.checkOrderStatusWithRetry(orderId);

        if (filled !== null) {
          const executionTime = Date.now() - startTime;
          if (filled) {
            this.logger.info(`${ICONS.success} Limit order filled`, {
              orderId,
              executionTime,
            });
          } else {
            this.logger.info(`${ICONS.error} Limit order not filled`, {
              orderId,
              status: 'Cancelled',
              executionTime,
            });
          }
          return filled;
        }

        await this.sleep(ORDER_CHECK_INTERVAL_MS);
      } catch (error) {
        this.logger.warn('Error checking order status', {
          orderId,
          error: getErrorMessage(error),
        });
        await this.sleep(ORDER_CHECK_INTERVAL_MS);
      }
    }

    const executionTime = Date.now() - startTime;
    this.logger.warn(`${ICONS.stopwatch} Limit order fill timeout`, {
      orderId,
      timeoutMs,
      executionTime,
    });

    throw new LimitOrderFillTimeoutError(
      `Limit order not filled within ${timeoutMs}ms timeout`,
      {
        orderId,
        symbol: this.bybitService.getSymbol(),
        limitPrice: 0,
        timeoutMs,
      },
    );
  }

  private async checkOrderStatusWithRetry(orderId: string): Promise<boolean | null> {
    let lastError: Error | undefined;
    const maxAttempts = ORDER_STATUS_MAX_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.bybitService.getRestClient().getActiveOrders({
          category: 'linear',
          symbol: this.bybitService.getSymbol(),
          orderId,
        });

        if (response.retCode !== BYBIT_SUCCESS_CODE) {
          const checkError = new Error(`Failed to check order status: ${response.retMsg}`);

          if (this.errorHandler) {
            await this.errorHandler.handle(checkError, {
              strategy: RecoveryStrategy.RETRY,
              context: 'LimitOrderExecutorService.checkOrderStatus',
            });
          }

          throw checkError;
        }

        const orders = response.result?.list || [];

        if (orders.length === 0) {
          const historyResponse = await this.bybitService.getRestClient().getHistoricOrders({
            category: 'linear',
            symbol: this.bybitService.getSymbol(),
            orderId,
          });

          if (historyResponse.retCode !== BYBIT_SUCCESS_CODE) {
            throw new Error(`Failed to check order history: ${historyResponse.retMsg}`);
          }

          const historicOrders = historyResponse.result?.list || [];
          if (historicOrders.length > 0) {
            const order = historicOrders[0];
            return order.orderStatus === 'Filled';
          }

          return null;
        }

        return null;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          const delayMs = Math.min(STATUS_BACKOFF_BASE_MS * attempt, STATUS_BACKOFF_MAX_MS);
          await this.sleep(delayMs);
        }
      }
    }

    this.logger.warn(`${ICONS.warning} Order status check failed after retries`, {
      orderId,
      error: lastError?.message,
    });

    return null;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      this.logger.info(`${ICONS.no_entry} Cancelling unfilled limit order`, { orderId });

      const response = await this.bybitService.getRestClient().cancelOrder({
        category: 'linear',
        symbol: this.bybitService.getSymbol(),
        orderId,
      });

      if (response.retCode !== BYBIT_SUCCESS_CODE) {
        if (response.retMsg.includes('not exists') || response.retMsg.includes('too late')) {
          this.logger.warn(`${ICONS.warning} Order already filled or cancelled`, {
            orderId,
            reason: response.retMsg,
          });
          return false;
        }

        const cancelError = new Error(`Failed to cancel order: ${response.retMsg}`);

        if (this.errorHandler) {
          await this.errorHandler.handle(cancelError, {
            strategy: RecoveryStrategy.SKIP,
            context: 'LimitOrderExecutorService.cancelOrder',
          });
        }

        throw cancelError;
      }

      this.logger.info(`${ICONS.success} Order cancelled successfully`, { orderId });
      return true;
    } catch (error) {
      this.logger.warn(`${ICONS.warning} Order cancellation failed - continuing`, {
        orderId,
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  async fallbackToMarket(
    direction: SignalDirection,
    quantity: number,
    leverage: number,
  ): Promise<MarketOrderResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    this.logger.info(`${ICONS.refresh} Falling back to market order`, {
      direction,
      quantity,
      leverage,
    });

    for (let attempt = 1; attempt <= MARKET_FALLBACK_MAX_ATTEMPTS; attempt++) {
      try {
        const side = direction === SignalDirection.LONG ? PositionSide.LONG : PositionSide.SHORT;

        const orderId = await this.bybitService.openPosition({
          side,
          quantity,
          leverage,
        });

        const response = await this.bybitService.getRestClient().getHistoricOrders({
          category: 'linear',
          symbol: this.bybitService.getSymbol(),
          orderId,
          limit: 1,
        });

        let fillPrice = 0;
        if (response.retCode === BYBIT_SUCCESS_CODE && response.result?.list?.length > 0) {
          const order = response.result.list[0];
          fillPrice = parseFloat(order.avgPrice || '0');
        }

        const executionTime = Date.now() - startTime;
        const feePaid = (quantity * fillPrice * TAKER_FEE_PERCENT) / PERCENT_MULTIPLIER;

        this.logger.info(`${ICONS.success} Market order executed`, {
          orderId,
          fillPrice,
          feePaid,
          executionTime,
        });

        return {
          orderId: orderId || 'unknown',
          filled: true as const,
          fillPrice,
          feePaid,
          executionTime,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${ICONS.warning} Market order attempt failed`, {
          attempt,
          error: getErrorMessage(error),
        });

        if (attempt < MARKET_FALLBACK_MAX_ATTEMPTS) {
          const delayMs = 100 * attempt;
          await this.sleep(delayMs);
        }
      }
    }

    const fallbackError = new MarketOrderFallbackError(
      'Failed to execute fallback market order after retries',
      {
        symbol: this.bybitService.getSymbol(),
        fallbackReason: 'limit_order_timeout',
        primaryError: lastError?.message || 'Unknown error',
      },
      lastError,
    );

    if (this.errorHandler) {
      await this.errorHandler.handle(fallbackError, {
        strategy: RecoveryStrategy.THROW,
        context: 'LimitOrderExecutorService.fallbackToMarket',
      });
    }

    throw fallbackError;
  }

  async executeEntry(
    direction: SignalDirection,
    quantity: number,
    currentPrice: number,
    leverage: number,
  ): Promise<LimitOrderResult | MarketOrderResult> {
    if (!this.config.enabled) {
      this.logger.warn(`${ICONS.warning} Limit order execution disabled - using market order`);
      return await this.fallbackToMarket(direction, quantity, leverage);
    }

    try {
      const limitPrice = this.calculateLimitPrice(
        direction,
        currentPrice,
        this.config.slippagePercent,
      );

      this.logger.info(`${ICONS.chart} Limit order execution started`, {
        direction,
        quantity,
        currentPrice,
        limitPrice,
        slippage: this.config.slippagePercent,
      });

      const limitResult = await this.placeLimitOrder(direction, quantity, limitPrice, leverage);

      let filled = false;
      try {
        filled = await this.waitForFill(limitResult.orderId, this.config.timeoutMs);
      } catch (timeoutError) {
        // LimitOrderFillTimeoutError thrown - continue to cancel and fallback
        this.logger.warn(`${ICONS.warning} Limit order fill timeout - proceeding to cancel and fallback`, {
          orderId: limitResult.orderId,
          error: getErrorMessage(timeoutError),
        });
        filled = false;
      }

      if (filled) {
        const feePaid = (quantity * limitPrice * MAKER_FEE_PERCENT) / PERCENT_MULTIPLIER;

        this.logger.info(`${ICONS.money} Limit order filled successfully - Fee savings achieved!`, {
          orderId: limitResult.orderId,
          fillPrice: limitPrice,
          feePaid,
          feeSavings: `${(TAKER_FEE_PERCENT - MAKER_FEE_PERCENT).toFixed(DECIMAL_PLACES.PERCENT)}%`,
        });

        return {
          ...limitResult,
          filled: true,
          fillPrice: limitPrice,
          feePaid,
        };
      }

      this.logger.warn(`${ICONS.warning} Limit order not filled - attempting cancellation`, {
        orderId: limitResult.orderId,
        timeoutMs: this.config.timeoutMs,
      });

      await this.cancelOrder(limitResult.orderId);

      if (this.config.fallbackToMarket) {
        this.logger.info(`${ICONS.refresh} Fallback to market order enabled`, {
          orderId: limitResult.orderId,
        });
        return await this.fallbackToMarket(direction, quantity, leverage);
      }

      this.logger.warn(`${ICONS.no_entry} Fallback to market disabled - entry failed`);
      return {
        ...limitResult,
        filled: false,
      };
    } catch (error) {
      this.logger.error(`${ICONS.error} Limit order execution failed`, {
        error: getErrorMessage(error),
      });

      if (this.config.fallbackToMarket) {
        this.logger.info(`${ICONS.refresh} Attempting market order fallback due to execution error`);
        try {
          return await this.fallbackToMarket(direction, quantity, leverage);
        } catch (fallbackError) {
          this.logger.error(`${ICONS.error} Market order fallback also failed`, {
            error: getErrorMessage(fallbackError),
          });
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
