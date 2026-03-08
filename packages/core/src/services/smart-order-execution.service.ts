/** Smart order execution facade (behavior-preserving thin service). */

import { LoggerService } from './logger.service';
import { ErrorHandler } from '../errors';
import {
  calculateSlippageBps,
  roundToDecimals,
} from './smart-order-execution/smart-order-execution-calculations.utils';
import {
  calculateOptimalSplitInternal,
  estimateMarketImpactInternal,
} from './smart-order-execution/smart-order-execution-split-impact.utils';
import {
  validateSmartOrderConfig,
  validateSmartOrderRequest,
} from './smart-order-execution/smart-order-execution-validation.utils';
import {
  assertNonNegativeFilledSize,
  assertPositiveFiniteNumber,
  assertRequiredOrderId,
  assertValidOrderSide,
} from './smart-order-execution/smart-order-execution-guards.utils';
import {
  cleanupTrackedOrder,
  clearTrackedOrders,
  getTrackedOrderState,
} from './smart-order-execution/smart-order-execution-state.utils';
import {
  buildSmartOrderFailureReport,
  createSmartOrderExecutionId,
} from './smart-order-execution/smart-order-execution-report.utils';
import {
  executeSyncWithGracefulDegrade as executeSyncWithGracefulDegradeUtil,
  executeWithGracefulDegrade as executeWithGracefulDegradeUtil,
} from './smart-order-execution/smart-order-execution-resilience.utils';
import { safeLogWithRecovery } from './smart-order-execution/smart-order-execution-logging.utils';
import { executeNamedStrategyWithFallback } from './smart-order-execution/smart-order-execution-strategy-entry.utils';
import {
  buildFacadeWorkflowDeps,
  shouldAdjustPriceByStrategy,
  simulateMarketPriceFromBase,
} from './smart-order-execution/smart-order-execution-seams.utils';
import {
  executeSmartOrderWorkflow,
  executeTwapWorkflow,
  executeVwapWorkflow,
  handlePartialFillsWorkflow,
  monitorAndAdjustWorkflow,
} from './smart-order-execution/smart-order-execution-workflows.orchestrator';
import type {
  ExecutionReport,
  OrderSide,
  SmartOrderConfig,
  SmartOrderRequest,
} from './smart-order-execution/smart-order-execution.types';
export type {
  AdjustmentReason,
  ExecutionReport,
  OrderSide,
  OrderStatus,
  PriceAdjustment,
  SmartOrderConfig,
  SmartOrderRequest,
} from './smart-order-execution/smart-order-execution.types';

export class SmartOrderExecutionService {
  private readonly safeLogBound = this.safeLog.bind(this);
  private readonly roundToDecimalsBound = this.roundToDecimals.bind(this);
  private readonly activeOrders = new Map<string, ExecutionReport>();
  private readonly orderStartTimes = new Map<string, number>();

  constructor(
    private readonly config: SmartOrderConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler
  ) {
    validateSmartOrderConfig(config);
  }

  async executeSmartOrder(
    order: SmartOrderRequest
  ): Promise<ExecutionReport> {
    validateSmartOrderRequest(order, 'executeSmartOrder');

    const startTime = Date.now();
    const orderId = createSmartOrderExecutionId('order');

    this.safeLog('info', 'Executing smart order', {
      orderId,
      symbol: order.symbol,
      side: order.side,
      size: order.size,
      price: order.price,
      strategy: order.strategy || this.config.executionStrategy,
    });

    return executeWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doExecuteSmartOrder(orderId, order, startTime),
      safeLog: this.safeLogBound,
      options: {
        failureLogLevel: 'error',
        directFailureLogLevel: 'error',
        requireValue: true,
        failureLogMessage: 'executeSmartOrder failed, returning failed report',
        directFailureLogMessage: 'executeSmartOrder failed (no ErrorHandler), returning failed report',
        onFailure: error => buildSmartOrderFailureReport({
          orderId,
          order,
          executionTime: Date.now() - startTime,
          error,
        }),
        failureMetadata: error => ({ orderId, error }),
      }
    });
  }

  private async doExecuteSmartOrder(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    return executeSmartOrderWorkflow({ deps: this.getWorkflowDeps(), orderId, order, startTime });
  }

  private calculateSlippage(targetPrice: number, actualPrice: number): number {
    return calculateSlippageBps(targetPrice, actualPrice);
  }

  async monitorAndAdjust(orderId: string): Promise<ExecutionReport | null> {
    assertRequiredOrderId('monitorAndAdjust', orderId);

    return executeWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doMonitorAndAdjust(orderId),
      safeLog: this.safeLogBound,
      options: {
        requireValue: false,
        resolveSuccess: value => value ?? null,
        failureLogMessage: 'monitorAndAdjust failed, returning current state',
        directFailureLogMessage: 'monitorAndAdjust failed (no ErrorHandler), returning current state',
        onFailure: () => this.activeOrders.get(orderId) || null,
        failureMetadata: error => ({ orderId, error }),
      }
    });
  }

  private async doMonitorAndAdjust(orderId: string): Promise<ExecutionReport | null> {
    return monitorAndAdjustWorkflow({ deps: this.getWorkflowDeps(), orderId });
  }

  private shouldAdjustPrice(
    report: ExecutionReport,
    _currentMarketPrice: number,
    priceMovementBps: number
  ): boolean {
    return shouldAdjustPriceByStrategy(
      this.config.executionStrategy,
      report,
      priceMovementBps
    );
  }

  private simulateMarketPrice(basePrice: number, _side: OrderSide): number {
    return simulateMarketPriceFromBase(basePrice, this.roundToDecimalsBound);
  }

  async handlePartialFills(
    orderId: string,
    filledSize: number
  ): Promise<'continue' | 'cancel' | 'adjust'> {
    assertRequiredOrderId('handlePartialFills', orderId);
    assertNonNegativeFilledSize('handlePartialFills', filledSize);

    return executeWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doHandlePartialFills(orderId, filledSize),
      safeLog: this.safeLogBound,
      options: {
        requireValue: true,
        failureLogMessage: 'handlePartialFills failed, cancelling remaining',
        directFailureLogMessage: 'handlePartialFills failed (no ErrorHandler), cancelling remaining',
        onFailure: () => 'cancel',
        failureMetadata: error => ({ orderId, filledSize, error }),
      }
    });
  }

  private async doHandlePartialFills(
    orderId: string,
    filledSize: number
  ): Promise<'continue' | 'cancel' | 'adjust'> {
    return handlePartialFillsWorkflow({ deps: this.getWorkflowDeps(), orderId, filledSize });
  }

  calculateOptimalSplit(
    totalSize: number,
    currentPrice: number
  ): number[] {
    assertPositiveFiniteNumber('calculateOptimalSplit', 'totalSize', totalSize);
    assertPositiveFiniteNumber('calculateOptimalSplit', 'currentPrice', currentPrice);

    return executeSyncWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doCalculateOptimalSplit(totalSize, currentPrice),
      safeLog: this.safeLogBound,
      options: {
        failureLogMessage: 'calculateOptimalSplit failed, returning single order',
        onFailure: () => [totalSize],
        failureMetadata: error => ({ totalSize, currentPrice, error }),
      }
    });
  }

  private doCalculateOptimalSplit(
    totalSize: number,
    currentPrice: number
  ): number[] {
    return calculateOptimalSplitInternal({
      totalSize,
      currentPrice,
      maxOrderSplits: this.config.maxOrderSplits,
      estimateMarketImpact: this.estimateMarketImpact.bind(this),
      roundToDecimals: this.roundToDecimalsBound,
      safeLog: this.safeLogBound,
    });
  }

  estimateMarketImpact(size: number, side: OrderSide): number {
    assertPositiveFiniteNumber('estimateMarketImpact', 'size', size);
    assertValidOrderSide('estimateMarketImpact', side);

    return executeSyncWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doEstimateMarketImpact(size, side),
      safeLog: this.safeLogBound,
      options: {
        failureLogMessage: 'estimateMarketImpact failed, returning 0',
        onFailure: () => 0,
        failureMetadata: error => ({ size, side, error }),
      }
    });
  }

  private doEstimateMarketImpact(size: number, side: OrderSide): number {
    return estimateMarketImpactInternal({
      size,
      side,
      roundToDecimals: this.roundToDecimalsBound,
      safeLog: this.safeLogBound,
    });
  }

  async executeTWAP(order: SmartOrderRequest): Promise<ExecutionReport> {
    return this.executeNamedStrategy(order, 'twap', (orderId, startTime) =>
      this.doExecuteTWAP(orderId, order, startTime)
    );
  }

  async executeVWAP(order: SmartOrderRequest): Promise<ExecutionReport> {
    return this.executeNamedStrategy(order, 'vwap', (orderId, startTime) =>
      this.doExecuteVWAP(orderId, order, startTime)
    );
  }

  private executeNamedStrategy(
    order: SmartOrderRequest,
    strategy: 'twap' | 'vwap',
    operation: (orderId: string, startTime: number) => Promise<ExecutionReport>
  ): Promise<ExecutionReport> {
    return executeNamedStrategyWithFallback({
      order,
      strategy,
      twapInterval: this.config.twapInterval,
      vwapLookback: this.config.vwapLookback,
      operation,
      executeSmartOrderFallback: () => this.executeSmartOrder(order),
      errorHandler: this.errorHandler,
      safeLog: this.safeLogBound,
    });
  }

  private async doExecuteTWAP(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    return executeTwapWorkflow({ deps: this.getWorkflowDeps(), orderId, order, startTime });
  }

  private async doExecuteVWAP(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    return executeVwapWorkflow({ deps: this.getWorkflowDeps(), orderId, order, startTime });
  }

  private getWorkflowDeps() {
    return buildFacadeWorkflowDeps({
      config: this.config,
      activeOrders: this.activeOrders,
      orderStartTimes: this.orderStartTimes,
      safeLog: this.safeLogBound,
      estimateMarketImpact: this.estimateMarketImpact.bind(this),
      calculateOptimalSplit: this.calculateOptimalSplit.bind(this),
      calculateSlippage: this.calculateSlippage.bind(this),
      roundToDecimals: this.roundToDecimalsBound,
      simulateMarketPrice: this.simulateMarketPrice.bind(this),
      shouldAdjustPrice: this.shouldAdjustPrice.bind(this),
    });
  }

  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    safeLogWithRecovery({
      logger: this.logger,
      errorHandler: this.errorHandler,
      level,
      message,
      metadata,
    });
  }

  private roundToDecimals(value: number, decimals: number): number {
    return roundToDecimals(value, decimals);
  }

  getOrderState(orderId: string): ExecutionReport | null {
    assertRequiredOrderId('getOrderState', orderId);
    return getTrackedOrderState(this.activeOrders, orderId);
  }

  cleanupOrder(orderId: string): boolean {
    assertRequiredOrderId('cleanupOrder', orderId);
    return cleanupTrackedOrder({ activeOrders: this.activeOrders, orderStartTimes: this.orderStartTimes, orderId, safeLog: this.safeLogBound });
  }

  getActiveOrderCount(): number {
    return this.activeOrders.size;
  }

  clearAllOrders(): void {
    clearTrackedOrders({ activeOrders: this.activeOrders, orderStartTimes: this.orderStartTimes, safeLog: this.safeLogBound });
  }
}

