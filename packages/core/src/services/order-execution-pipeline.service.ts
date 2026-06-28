import { LoggerService } from './logger.service';
import { IExchange } from '../interfaces';
import {
  OrderExecutionConfig,
  OrderRequest,
  OrderResult,
  OrderStatus,
  SlippageAnalysis,
  ExecutionMetrics,
  IOrderExecutionPipeline,
} from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { ICONS } from '../cli/cli-runtime';

export class OrderExecutionPipeline implements IOrderExecutionPipeline {
  private config: OrderExecutionConfig;
  private exchangeService: IExchange;
  private logger: LoggerService;
  private metrics: ExecutionMetrics;

  constructor(config: OrderExecutionConfig, exchangeService: IExchange, logger: LoggerService) {
    this.config = config;
    this.exchangeService = exchangeService;
    this.logger = logger;
    this.metrics = {
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      averageExecutionTime: 0,
      averageSlippage: 0,
      averageRetries: 0,
      totalRetries: 0,
      lastUpdateTime: Date.now(),
    };
  }

  public async placeOrder(order: OrderRequest, config?: OrderExecutionConfig): Promise<OrderResult> {
    const executionConfig = config || this.config;
    const startTime = Date.now();
    let retryCount = 0;

    if (!order.orderId) {
      order.orderId = `order-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    this.logger.debug(`[OrderExecutionPipeline] Starting order placement: ${order.orderId}`, {
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      maxRetries: executionConfig.maxRetries,
    });

    const placeOrderResult = await ErrorHandler.executeAsync(
      async () => {
        return await this.exchangeService.placeOrder({
          symbol: order.symbol,
          side: order.side,
          orderType: order.orderType,
          quantity: order.quantity,
          price: order.price,
          timeInForce: order.timeInForce || 'GTC',
          clientOrderId: order.clientOrderId,
        });
      },
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: executionConfig.maxRetries,
          initialDelayMs: executionConfig.retryDelayMs,
          backoffMultiplier: 2,
          maxDelayMs: 10000,
        },
        logger: this.logger,
        context: `OrderExecutionPipeline.placeOrder[${order.orderId}]`,
        onRetry: (attempt, error, delayMs) => {
          retryCount++;
          this.logger.warn(`${ICONS.warning} Order placement retry ${attempt}`, {
            orderId: order.orderId,
            delayMs,
            error: error.message,
          });
        },
        onRecover: (strategy, attemptsUsed) => {
          this.logger.info(`${ICONS.success} Order placed after retry`, {
            orderId: order.orderId,
            attemptsUsed,
          });
        },
      }
    );

    if (!placeOrderResult.success) {
      const failureResult: OrderResult = {
        success: false,
        orderId: order.orderId,
        orderStatus: OrderStatus.FAILED,
        filledQuantity: 0,
        filledPrice: order.price,
        actualSlippage: 0,
        executionTime: Date.now() - startTime,
        error: placeOrderResult.error?.message || 'Order placement failed',
        retryCount,
        timestamp: Date.now(),
      };

      this.updateMetrics(false, failureResult.executionTime, 0, retryCount);

      this.logger.error(`[OrderExecutionPipeline] Order placement failed after retries: ${order.orderId}`, {
        error: placeOrderResult.error?.message,
        retries: retryCount,
      });

      return failureResult;
    }

    const result = placeOrderResult.value;

    if (!result || !result.orderId) {
      const failureResult: OrderResult = {
        success: false,
        orderId: order.orderId,
        orderStatus: OrderStatus.FAILED,
        filledQuantity: 0,
        filledPrice: order.price,
        actualSlippage: 0,
        executionTime: Date.now() - startTime,
        error: 'Order placement returned invalid result',
        retryCount,
        timestamp: Date.now(),
      };

      this.updateMetrics(false, failureResult.executionTime, 0, retryCount);
      return failureResult;
    }

    const executionTime = Date.now() - startTime;

    const finalStatus = await this.pollOrderStatus(result.orderId, 10);

    const slippageAnalysis = this.calculateSlippage(order.price, result.price || order.price);

    if (!this.validateSlippage(slippageAnalysis.slippagePercent, {
      slippagePercent: executionConfig.slippagePercent,
    })) {
      this.logger.warn(`[OrderExecutionPipeline] Slippage exceeds limits: ${slippageAnalysis.slippagePercent.toFixed(2)}%`, {
        orderId: result.orderId,
        expectedPrice: order.price,
        actualPrice: slippageAnalysis.actualPrice,
        maxAllowed: executionConfig.slippagePercent,
      });
    }

    const successResult: OrderResult = {
      success: true,
      orderId: result.orderId,
      orderStatus: finalStatus,
      filledQuantity: result.filledQuantity || order.quantity,
      filledPrice: result.price || order.price,
      actualSlippage: slippageAnalysis.slippagePercent,
      executionTime,
      retryCount,
      timestamp: Date.now(),
    };

    this.updateMetrics(true, executionTime, slippageAnalysis.slippagePercent, retryCount);

    this.logger.info(`[OrderExecutionPipeline] Order placed successfully: ${order.orderId}`, {
      status: finalStatus,
      slippage: slippageAnalysis.slippagePercent.toFixed(2) + '%',
      executionTime: executionTime + 'ms',
      retries: retryCount,
    });

    return successResult;
  }

  public async verifyOrderPlacement(orderId: string): Promise<OrderStatus> {
    try {
      const orderStatus = await this.exchangeService.getOrderStatus(orderId);
      return this.mapOrderStatus(orderStatus);
    } catch (error) {
      this.logger.error(`[OrderExecutionPipeline] Error verifying order: ${error}`);
      return OrderStatus.FAILED;
    }
  }

  public async pollOrderStatus(orderId: string, maxAttempts: number = 10): Promise<OrderStatus> {
    const pollIntervalMs = 500;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.verifyOrderPlacement(orderId);

        if (status === OrderStatus.FILLED || status === OrderStatus.CANCELLED || status === OrderStatus.FAILED) {
          return status;
        }

        if (attempts < maxAttempts - 1) {
          await this.delay(pollIntervalMs);
        }

        attempts++;
      } catch (error) {
        this.logger.warn(`[OrderExecutionPipeline] Error polling order status: ${error}`);
        await this.delay(pollIntervalMs);
        attempts++;
      }
    }

    this.logger.warn(`[OrderExecutionPipeline] Order status poll timeout: ${orderId}`);
    return OrderStatus.TIMEOUT;
  }

  public calculateSlippage(expectedPrice: number, actualPrice: number): SlippageAnalysis {
    const slippageAmount = Math.abs(actualPrice - expectedPrice);
    const slippagePercent = (slippageAmount / expectedPrice) * 100;

    return {
      expectedPrice,
      actualPrice,
      slippageAmount,
      slippagePercent,
      withinLimits: slippagePercent <= this.config.slippagePercent,
    };
  }

  public validateSlippage(slippagePercent: number, limits: { slippagePercent: number }): boolean {
    return slippagePercent <= limits.slippagePercent;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapOrderStatus(
    exchangeStatus: string | { orderId: string; status: string; filledQuantity: number; averagePrice: number }
  ): OrderStatus {
    const statusString = typeof exchangeStatus === 'string' ? exchangeStatus : exchangeStatus.status;

    const statusMap: Record<string, OrderStatus> = {
      'Created': OrderStatus.PENDING,
      'Rejected': OrderStatus.FAILED,
      'New': OrderStatus.PENDING,
      'PartiallyFilled': OrderStatus.PARTIALLY_FILLED,
      'Filled': OrderStatus.FILLED,
      'Cancelled': OrderStatus.CANCELLED,
      'PendingCancel': OrderStatus.PENDING,
      'Deactivated': OrderStatus.CANCELLED,
      'Triggered': OrderStatus.PENDING,
      'Active': OrderStatus.PENDING,
      'PENDING': OrderStatus.PENDING,
      'FILLED': OrderStatus.FILLED,
      'CANCELLED': OrderStatus.CANCELLED,
      'REJECTED': OrderStatus.FAILED,
    };

    return statusMap[statusString] || OrderStatus.PENDING;
  }

  private updateMetrics(success: boolean, executionTime: number, slippage: number, retries: number): void {
    this.metrics.totalOrders++;
    this.metrics.totalRetries += retries;
    this.metrics.averageRetries = this.metrics.totalRetries / this.metrics.totalOrders;

    if (success) {
      this.metrics.successfulOrders++;
      const prevTotal = (this.metrics.averageExecutionTime * (this.metrics.successfulOrders - 1)) || 0;
      this.metrics.averageExecutionTime = (prevTotal + executionTime) / this.metrics.successfulOrders;

      const prevSlippageTotal = (this.metrics.averageSlippage * (this.metrics.successfulOrders - 1)) || 0;
      this.metrics.averageSlippage = (prevSlippageTotal + slippage) / this.metrics.successfulOrders;
    } else {
      this.metrics.failedOrders++;
    }

    this.metrics.lastUpdateTime = Date.now();
  }

  public getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      averageExecutionTime: 0,
      averageSlippage: 0,
      averageRetries: 0,
      totalRetries: 0,
      lastUpdateTime: Date.now(),
    };
    this.logger.info('[OrderExecutionPipeline] Metrics reset');
  }
}

