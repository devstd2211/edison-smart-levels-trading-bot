/** Smart order execution facade (behavior-preserving thin service). */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import {
  PRICE_DECIMALS,
  SIZE_DECIMALS,
  MIN_SIZE_DIFFERENCE,
  SUB_ORDER_ID_PREFIX,
} from '../constants/phase-13-constants';
import {
  buildExecutionReasoningMessage,
  calculateFillPriceFromImpact,
  calculateSlippageBps,
  distributeSizeByVolumeProfile,
  generateSimulatedVolumeProfile,
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
import { executeStrategyWithFallback } from './smart-order-execution/smart-order-execution-strategy-entry.utils';
import {
  buildWorkflowDeps,
  shouldAdjustPriceByStrategy,
  simulateMarketPriceFromBase,
} from './smart-order-execution/smart-order-execution-seams.utils';
import {
  executeSmartOrderWorkflow,
  executeTwapWorkflow,
  executeVwapWorkflow,
  handlePartialFillsWorkflow,
  monitorAndAdjustWorkflow,
  type SmartOrderExecutionWorkflowDeps,
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

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class SmartOrderExecutionService {
  private readonly config: SmartOrderConfig;

  // Internal state tracking for active orders
  private readonly activeOrders: Map<string, ExecutionReport> = new Map();
  private readonly orderStartTimes: Map<string, number> = new Map();

  constructor(
    config: SmartOrderConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler
  ) {
    validateSmartOrderConfig(config);
    this.config = config;
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
      safeLog: this.safeLog.bind(this),
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
    return executeSmartOrderWorkflow({
      deps: this.getWorkflowDeps(),
      orderId,
      order,
      startTime,
    });
  }

  private calculateSlippage(targetPrice: number, actualPrice: number): number {
    return calculateSlippageBps(targetPrice, actualPrice);
  }

  async monitorAndAdjust(orderId: string): Promise<ExecutionReport | null> {
    assertRequiredOrderId('monitorAndAdjust', orderId);

    return executeWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doMonitorAndAdjust(orderId),
      safeLog: this.safeLog.bind(this),
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
    return monitorAndAdjustWorkflow({
      deps: this.getWorkflowDeps(),
      orderId,
    });
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
    return simulateMarketPriceFromBase(basePrice, this.roundToDecimals.bind(this));
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
      safeLog: this.safeLog.bind(this),
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
    return handlePartialFillsWorkflow({
      deps: this.getWorkflowDeps(),
      orderId,
      filledSize,
    });
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
      safeLog: this.safeLog.bind(this),
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
      roundToDecimals: this.roundToDecimals.bind(this),
      safeLog: this.safeLog.bind(this),
    });
  }

  estimateMarketImpact(size: number, side: OrderSide): number {
    assertPositiveFiniteNumber('estimateMarketImpact', 'size', size);
    assertValidOrderSide('estimateMarketImpact', side);

    return executeSyncWithGracefulDegradeUtil({
      errorHandler: this.errorHandler,
      operation: () => this.doEstimateMarketImpact(size, side),
      safeLog: this.safeLog.bind(this),
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
      roundToDecimals: this.roundToDecimals.bind(this),
      safeLog: this.safeLog.bind(this),
    });
  }

  async executeTWAP(order: SmartOrderRequest): Promise<ExecutionReport> {
    return executeStrategyWithFallback({
      order,
      methodName: 'executeTWAP',
      orderIdPrefix: 'twap',
      startLogMessage: 'Executing TWAP strategy',
      startLogMetadata: id => ({
        orderId: id,
        symbol: order.symbol,
        size: order.size,
        interval: this.config.twapInterval,
      }),
      operation: (orderId, startTime) => this.doExecuteTWAP(orderId, order, startTime),
      failureLogMessage: 'TWAP execution failed, falling back to regular execution',
      directFailureLogMessage: 'TWAP execution failed (no ErrorHandler), falling back to regular execution',
      executeSmartOrderFallback: () => this.executeSmartOrder(order),
      errorHandler: this.errorHandler,
      safeLog: this.safeLog.bind(this),
    });
  }

  private async doExecuteTWAP(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    return executeTwapWorkflow({
      deps: this.getWorkflowDeps(),
      orderId,
      order,
      startTime,
    });
  }

  async executeVWAP(order: SmartOrderRequest): Promise<ExecutionReport> {
    return executeStrategyWithFallback({
      order,
      methodName: 'executeVWAP',
      orderIdPrefix: 'vwap',
      startLogMessage: 'Executing VWAP strategy',
      startLogMetadata: id => ({
        orderId: id,
        symbol: order.symbol,
        size: order.size,
        lookback: this.config.vwapLookback,
      }),
      operation: (orderId, startTime) => this.doExecuteVWAP(orderId, order, startTime),
      failureLogMessage: 'VWAP execution failed, falling back to regular execution',
      directFailureLogMessage: 'VWAP execution failed (no ErrorHandler), falling back to regular execution',
      executeSmartOrderFallback: () => this.executeSmartOrder(order),
      errorHandler: this.errorHandler,
      safeLog: this.safeLog.bind(this),
    });
  }

  private async doExecuteVWAP(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    return executeVwapWorkflow({
      deps: this.getWorkflowDeps(),
      orderId,
      order,
      startTime,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getWorkflowDeps(): SmartOrderExecutionWorkflowDeps {
    return buildWorkflowDeps({
      config: this.config,
      activeOrders: this.activeOrders,
      orderStartTimes: this.orderStartTimes,
      safeLog: this.safeLog.bind(this),
      estimateMarketImpact: this.estimateMarketImpact.bind(this),
      calculateOptimalSplit: this.calculateOptimalSplit.bind(this),
      calculateFillPrice: (targetPrice, side, marketImpactBps) =>
        calculateFillPriceFromImpact(targetPrice, side, marketImpactBps, PRICE_DECIMALS),
      calculateSlippage: this.calculateSlippage.bind(this),
      buildReasoningMessage: (
        strategy,
        numberOfSplits,
        marketImpact,
        slippage,
        fullyFilled
      ) => buildExecutionReasoningMessage(
        strategy,
        numberOfSplits,
        marketImpact,
        slippage,
        fullyFilled
      ),
      roundToDecimals: this.roundToDecimals.bind(this),
      simulateMarketPrice: this.simulateMarketPrice.bind(this),
      shouldAdjustPrice: this.shouldAdjustPrice.bind(this),
      generateVolumeProfile: generateSimulatedVolumeProfile,
      distributeByVolume: (orderId, totalSize, targetPrice, volumeProfile) =>
        distributeSizeByVolumeProfile({
          orderId,
          totalSize,
          targetPrice,
          volumeProfile,
          sizeDecimals: SIZE_DECIMALS,
          minSizeDifference: MIN_SIZE_DIFFERENCE,
          subOrderIdPrefix: SUB_ORDER_ID_PREFIX,
        }),
    });
  }

  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    try {
      if (this.logger) {
        this.logger[level](message, metadata);
      }
    } catch (error) {
      // SKIP: Logging failures should not crash the service
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.SKIP,
        });
      }
    }
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

    return cleanupTrackedOrder({
      activeOrders: this.activeOrders,
      orderStartTimes: this.orderStartTimes,
      orderId,
      safeLog: this.safeLog.bind(this),
    });
  }

  getActiveOrderCount(): number {
    return this.activeOrders.size;
  }

  clearAllOrders(): void {
    clearTrackedOrders({
      activeOrders: this.activeOrders,
      orderStartTimes: this.orderStartTimes,
      safeLog: this.safeLog.bind(this),
    });
  }
}

