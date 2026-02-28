/**
 * Phase 13.1: Smart Order Execution Service
 *
 * Executes orders with optimal timing to minimize slippage and maximize fill probability.
 * Features:
 * - Adaptive execution based on real-time market conditions
 * - Order splitting to minimize market impact
 * - TWAP (Time-Weighted Average Price) execution
 * - VWAP (Volume-Weighted Average Price) execution
 * - Intelligent partial fill handling
 * - Market impact estimation
 *
 * Recovery Strategies:
 * - THROW: Invalid config, invalid order inputs (null, NaN, negative values)
 * - GRACEFUL_DEGRADE: Execution failures → retry with adjusted price, timeout → cancel remaining
 * - SKIP: Logging failures
 *
 * Created: 2026-02-09 (Session 97)
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import {
  MAX_ORDER_SPLITS,
  MIN_SUB_ORDER_SIZE_USD,
  MARKET_IMPACT_COEFFICIENT,
  SIGNIFICANT_ORDER_THRESHOLD_PERCENT,
  LARGE_ORDER_THRESHOLD_PERCENT,
  MAX_ACCEPTABLE_IMPACT_BPS,
  MIN_DAILY_VOLUME_USD,
  PRICE_DECIMALS,
  SIZE_DECIMALS,
  SLIPPAGE_DECIMALS,
  IMPACT_DECIMALS,
  MIN_SIZE_DIFFERENCE,
  MIN_PRICE_DIFFERENCE,
  SUB_ORDER_ID_PREFIX,
  ADJUSTMENT_ID_PREFIX,
  FALLBACK_EXECUTION_REPORT,
  MIN_PRICE_MOVEMENT_BPS,
  MAX_PRICE_ADJUSTMENTS,
  ADJUSTMENT_DELAY_MS,
  AGGRESSIVE_ADJUSTMENT_MULTIPLIER,
  PASSIVE_ADJUSTMENT_MULTIPLIER,
  MIN_PARTIAL_FILL_PERCENT,
  PARTIAL_FILL_CONTINUE_THRESHOLD,
  MAX_PARTIAL_FILL_RETRIES,
  MIN_TWAP_INTERVAL_MS,
  MIN_VWAP_LOOKBACK,
  MAX_VWAP_LOOKBACK,
} from '../constants/phase-13-constants';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ExecutionStrategy =
  | 'aggressive' // Fill immediately, accept slippage
  | 'passive' // Wait for optimal price, may not fill
  | 'adaptive' // Adjust strategy based on market conditions
  | 'twap' // Time-weighted average price
  | 'vwap'; // Volume-weighted average price

export type OrderSide = 'Buy' | 'Sell';

export type OrderStatus =
  | 'pending' // Created, not yet submitted
  | 'executing' // In progress
  | 'completed' // Fully filled
  | 'partial' // Partially filled
  | 'failed'; // Execution failed

export type AdjustmentReason =
  | 'market_moved' // Price moved away from target
  | 'low_fill_probability' // Unlikely to fill at current price
  | 'timeout' // Execution timeout
  | 'partial_fill'; // Partial fill, adjusting remainder

export interface SmartOrderConfig {
  maxSlippagePercent: number; // e.g., 0.1 = 0.1% max slippage
  maxOrderSplits: number; // Maximum number of sub-orders
  minFillProbability: number; // Minimum acceptable fill probability (0-1)
  adaptiveExecution: boolean; // Enable real-time price adjustment
  executionStrategy: ExecutionStrategy; // Default execution strategy
  twapInterval: number; // TWAP: interval between orders (ms)
  vwapLookback: number; // VWAP: lookback period (candles)
  executionTimeout: number; // Max time to execute order (ms)
}

export interface SmartOrderRequest {
  symbol: string; // e.g., 'BTCUSDT'
  side: OrderSide; // 'Buy' or 'Sell'
  size: number; // Order size (contracts/coins)
  price: number; // Target price
  strategy?: ExecutionStrategy; // Override default strategy
  maxSlippage?: number; // Override default max slippage
}

export interface SubOrder {
  id: string; // Unique sub-order ID
  size: number; // Sub-order size
  price: number; // Sub-order price
  status: 'pending' | 'submitted' | 'filled' | 'cancelled';
  fillPrice?: number; // Actual fill price (if filled)
  timestamp: number; // Creation timestamp
}

export interface PriceAdjustment {
  timestamp: number; // When adjustment was made
  oldPrice: number; // Previous price
  newPrice: number; // New price
  reason: AdjustmentReason; // Why we adjusted
}

export interface ExecutionReport {
  orderId: string; // Unique order ID
  status: OrderStatus; // Current order status

  // Order details
  symbol: string;
  side: OrderSide;
  requestedSize: number; // Originally requested
  filledSize: number; // Actually filled
  remainingSize: number; // Still pending

  // Price metrics
  requestedPrice: number; // Target price
  averageFillPrice: number; // Actual average fill price
  slippage: number; // Actual slippage (bps)

  // Performance
  executionTime: number; // Total execution time (ms)
  numberOfSplits: number; // How many sub-orders created
  marketImpact: number; // Estimated price impact (bps)

  // Details
  subOrders: SubOrder[]; // All sub-orders
  adjustments: PriceAdjustment[]; // All price adjustments
  reasoning: string; // Human-readable explanation
}

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
    // THROW validation - must be BEFORE try-catch
    if (!config) {
      throw new Error('SmartOrderExecutionService: config is required');
    }
    if (
      config.maxSlippagePercent == null ||
      config.maxSlippagePercent < 0
    ) {
      throw new Error(
        'SmartOrderExecutionService: maxSlippagePercent must be >= 0'
      );
    }
    if (config.maxOrderSplits == null || config.maxOrderSplits < 1) {
      throw new Error(
        'SmartOrderExecutionService: maxOrderSplits must be >= 1'
      );
    }
    if (
      config.minFillProbability == null ||
      config.minFillProbability < 0 ||
      config.minFillProbability > 1
    ) {
      throw new Error(
        'SmartOrderExecutionService: minFillProbability must be between 0 and 1'
      );
    }
    if (config.executionTimeout == null || config.executionTimeout <= 0) {
      throw new Error(
        'SmartOrderExecutionService: executionTimeout must be > 0'
      );
    }
    if (config.twapInterval == null || config.twapInterval <= 0) {
      throw new Error('SmartOrderExecutionService: twapInterval must be > 0');
    }
    if (config.vwapLookback == null || config.vwapLookback <= 0) {
      throw new Error('SmartOrderExecutionService: vwapLookback must be > 0');
    }
    if (!config.executionStrategy) {
      throw new Error(
        'SmartOrderExecutionService: executionStrategy is required'
      );
    }

    this.config = config;
  }

  /**
   * Execute smart order with adaptive strategy
   *
   * @param order - Order request
   * @returns Execution report with fill details
   *
   * Recovery:
   * - THROW: Invalid order (null, NaN prices, negative size)
   * - GRACEFUL_DEGRADE: Execution failures → return failed report with details
   */
  async executeSmartOrder(
    order: SmartOrderRequest
  ): Promise<ExecutionReport> {
    // Input validation (THROW)
    if (!order) {
      throw new Error('SmartOrderExecutionService.executeSmartOrder: order is required');
    }
    if (!order.symbol) {
      throw new Error('SmartOrderExecutionService.executeSmartOrder: symbol is required');
    }
    if (!order.side || (order.side !== 'Buy' && order.side !== 'Sell')) {
      throw new Error('SmartOrderExecutionService.executeSmartOrder: valid side is required');
    }
    if (order.size == null || order.size <= 0 || isNaN(order.size)) {
      throw new Error('SmartOrderExecutionService.executeSmartOrder: size must be > 0');
    }
    if (order.price == null || order.price <= 0 || isNaN(order.price)) {
      throw new Error('SmartOrderExecutionService.executeSmartOrder: price must be > 0');
    }

    const startTime = Date.now();
    const orderId = `order_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

    this.safeLog('info', 'Executing smart order', {
      orderId,
      symbol: order.symbol,
      side: order.side,
      size: order.size,
      price: order.price,
      strategy: order.strategy || this.config.executionStrategy,
    });

    // Use ErrorHandler for GRACEFUL_DEGRADE
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.doExecuteSmartOrder(orderId, order, startTime),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      if (result.success && result.value) {
        return result.value;
      }

      // GRACEFUL_DEGRADE: Execution failed → return failed report
      this.safeLog('error', 'executeSmartOrder failed, returning failed report', {
        orderId,
        error: result.error,
      });

      return {
        ...FALLBACK_EXECUTION_REPORT,
        orderId,
        symbol: order.symbol,
        side: order.side,
        requestedSize: order.size,
        remainingSize: order.size,
        requestedPrice: order.price,
        executionTime: Date.now() - startTime,
        reasoning: `Execution failed: ${result.error?.message || 'Unknown error'}`,
      };
    }

    // No ErrorHandler: execute directly
    try {
      return await this.doExecuteSmartOrder(orderId, order, startTime);
    } catch (error) {
      this.safeLog('error', 'executeSmartOrder failed (no ErrorHandler), returning failed report', {
        orderId,
        error,
      });

      return {
        ...FALLBACK_EXECUTION_REPORT,
        orderId,
        symbol: order.symbol,
        side: order.side,
        requestedSize: order.size,
        remainingSize: order.size,
        requestedPrice: order.price,
        executionTime: Date.now() - startTime,
        reasoning: `Execution failed: ${(error as Error).message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Internal implementation of smart order execution
   */
  private async doExecuteSmartOrder(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    const strategy = order.strategy || this.config.executionStrategy;
    const targetPrice = order.price;
    const totalSize = order.size;

    // Step 1: Estimate market impact
    const marketImpact = this.estimateMarketImpact(totalSize, order.side);

    this.safeLog('info', 'Market impact estimated', {
      orderId,
      marketImpact,
    });

    // Step 2: Calculate optimal order split
    const splits = this.calculateOptimalSplit(totalSize, targetPrice);
    const numberOfSplits = splits.length;

    this.safeLog('info', 'Order splits calculated', {
      orderId,
      numberOfSplits,
      splits,
    });

    // Step 3: Create sub-orders
    const subOrders: SubOrder[] = [];
    let subOrderCounter = 0;

    for (const splitSize of splits) {
      const subOrderId = `${SUB_ORDER_ID_PREFIX}${orderId}_${subOrderCounter++}`;

      subOrders.push({
        id: subOrderId,
        size: splitSize,
        price: targetPrice,
        status: 'pending',
        timestamp: Date.now(),
      });
    }

    // Step 4: Simulate execution (in production, this would submit to exchange)
    // For now, we'll simulate immediate fills
    const filledSubOrders: SubOrder[] = [];
    let totalFilled = 0;
    let totalFillValue = 0;

    for (const subOrder of subOrders) {
      // Simulate fill at target price (in production: submit to exchange)
      const fillPrice = this.calculateFillPrice(targetPrice, order.side, marketImpact);

      filledSubOrders.push({
        ...subOrder,
        status: 'filled',
        fillPrice,
      });

      totalFilled += subOrder.size;
      totalFillValue += subOrder.size * fillPrice;
    }

    // Step 5: Calculate execution metrics
    const averageFillPrice = totalFilled > 0 ? totalFillValue / totalFilled : 0;
    const slippage = this.calculateSlippage(targetPrice, averageFillPrice);
    const executionTime = Date.now() - startTime;

    // Step 6: Build execution report
    const report: ExecutionReport = {
      orderId,
      status: totalFilled >= totalSize ? 'completed' : 'partial',
      symbol: order.symbol,
      side: order.side,
      requestedSize: totalSize,
      filledSize: this.roundToDecimals(totalFilled, SIZE_DECIMALS),
      remainingSize: this.roundToDecimals(totalSize - totalFilled, SIZE_DECIMALS),
      requestedPrice: this.roundToDecimals(targetPrice, PRICE_DECIMALS),
      averageFillPrice: this.roundToDecimals(averageFillPrice, PRICE_DECIMALS),
      slippage: this.roundToDecimals(slippage, SLIPPAGE_DECIMALS),
      executionTime,
      numberOfSplits,
      marketImpact: this.roundToDecimals(marketImpact, IMPACT_DECIMALS),
      subOrders: filledSubOrders,
      adjustments: [],
      reasoning: this.buildReasoningMessage(
        strategy,
        numberOfSplits,
        marketImpact,
        slippage,
        totalFilled >= totalSize
      ),
    };

    // Step 7: Store in active orders for monitoring
    this.activeOrders.set(orderId, report);
    this.orderStartTimes.set(orderId, startTime);

    this.safeLog('info', 'Smart order execution completed', {
      orderId,
      status: report.status,
      filledSize: report.filledSize,
      averageFillPrice: report.averageFillPrice,
      slippage: report.slippage,
      executionTime: report.executionTime,
    });

    return report;
  }

  /**
   * Calculate expected fill price based on market impact
   */
  private calculateFillPrice(
    targetPrice: number,
    side: OrderSide,
    marketImpactBps: number
  ): number {
    // Convert bps to decimal (10 bps = 0.001 = 0.1%)
    const impactDecimal = marketImpactBps / 10000;

    // For Buy: price increases (worse fill)
    // For Sell: price decreases (worse fill)
    const priceAdjustment = side === 'Buy'
      ? targetPrice * impactDecimal
      : -targetPrice * impactDecimal;

    const fillPrice = targetPrice + priceAdjustment;
    return this.roundToDecimals(fillPrice, PRICE_DECIMALS);
  }

  /**
   * Calculate slippage in basis points
   */
  private calculateSlippage(targetPrice: number, actualPrice: number): number {
    if (targetPrice === 0) return 0;

    const slippageDecimal = Math.abs((actualPrice - targetPrice) / targetPrice);
    const slippageBps = slippageDecimal * 10000;

    return slippageBps;
  }

  /**
   * Build human-readable reasoning message
   */
  private buildReasoningMessage(
    strategy: ExecutionStrategy,
    numberOfSplits: number,
    marketImpact: number,
    slippage: number,
    fullyFilled: boolean
  ): string {
    const parts: string[] = [];

    parts.push(`Executed using ${strategy} strategy.`);

    if (numberOfSplits > 1) {
      parts.push(`Split into ${numberOfSplits} sub-orders to minimize market impact.`);
    } else {
      parts.push('No split required (low market impact).');
    }

    parts.push(`Estimated market impact: ${marketImpact.toFixed(1)} bps.`);
    parts.push(`Actual slippage: ${slippage.toFixed(1)} bps.`);

    if (fullyFilled) {
      parts.push('Order fully filled.');
    } else {
      parts.push('Order partially filled.');
    }

    return parts.join(' ');
  }

  /**
   * Monitor and adjust order execution in real-time
   *
   * @param orderId - Order to monitor
   * @returns Updated execution report
   *
   * Recovery:
   * - GRACEFUL_DEGRADE: Monitoring failures → continue with current state
   */
  async monitorAndAdjust(orderId: string): Promise<ExecutionReport | null> {
    // Input validation (THROW)
    if (!orderId) {
      throw new Error('SmartOrderExecutionService.monitorAndAdjust: orderId is required');
    }

    // Use ErrorHandler for GRACEFUL_DEGRADE
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.doMonitorAndAdjust(orderId),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      if (result.success) {
        return result.value || null;
      }

      // GRACEFUL_DEGRADE: Monitoring failed → return current state
      this.safeLog('warn', 'monitorAndAdjust failed, returning current state', {
        orderId,
        error: result.error,
      });

      return this.activeOrders.get(orderId) || null;
    }

    // No ErrorHandler: execute directly
    try {
      return await this.doMonitorAndAdjust(orderId);
    } catch (error) {
      this.safeLog('warn', 'monitorAndAdjust failed (no ErrorHandler), returning current state', {
        orderId,
        error,
      });

      return this.activeOrders.get(orderId) || null;
    }
  }

  /**
   * Internal implementation of monitoring and adjustment
   */
  private async doMonitorAndAdjust(orderId: string): Promise<ExecutionReport | null> {
    // Get current order state
    const currentReport = this.activeOrders.get(orderId);
    if (!currentReport) {
      this.safeLog('warn', 'Order not found in active orders', { orderId });
      return null;
    }

    // Check if order is still active
    if (currentReport.status === 'completed' || currentReport.status === 'failed') {
      this.safeLog('info', 'Order already in terminal state', {
        orderId,
        status: currentReport.status,
      });
      return currentReport;
    }

    const startTime = this.orderStartTimes.get(orderId) || Date.now();
    const elapsedTime = Date.now() - startTime;

    // Check for timeout
    if (elapsedTime > this.config.executionTimeout) {
      this.safeLog('warn', 'Order execution timeout', {
        orderId,
        elapsedTime,
        timeout: this.config.executionTimeout,
      });

      // Mark as failed due to timeout
      const updatedReport: ExecutionReport = {
        ...currentReport,
        status: 'failed',
        executionTime: elapsedTime,
        reasoning: `${currentReport.reasoning} Execution timeout after ${elapsedTime}ms.`,
      };

      this.activeOrders.set(orderId, updatedReport);
      return updatedReport;
    }

    // Simulate market price movement (in production: fetch real market price)
    const currentMarketPrice = this.simulateMarketPrice(
      currentReport.requestedPrice,
      currentReport.side
    );

    // Check if price adjustment is needed
    const priceMovementBps = this.calculateSlippage(
      currentReport.requestedPrice,
      currentMarketPrice
    );

    if (priceMovementBps > MIN_PRICE_MOVEMENT_BPS) {
      this.safeLog('info', 'Significant price movement detected', {
        orderId,
        requestedPrice: currentReport.requestedPrice,
        currentMarketPrice,
        movementBps: priceMovementBps,
      });

      // Check if we can still adjust
      if (currentReport.adjustments.length < MAX_PRICE_ADJUSTMENTS) {
        // Should we adjust based on strategy?
        const shouldAdjust = this.shouldAdjustPrice(
          currentReport,
          currentMarketPrice,
          priceMovementBps
        );

        if (shouldAdjust) {
          return await this.adjustOrderPrice(currentReport, currentMarketPrice);
        }
      } else {
        this.safeLog('warn', 'Maximum price adjustments reached', {
          orderId,
          adjustments: currentReport.adjustments.length,
        });
      }
    }

    // No adjustment needed
    this.safeLog('info', 'Order monitoring: no adjustment needed', {
      orderId,
      priceMovementBps,
    });

    return currentReport;
  }

  /**
   * Determine if price should be adjusted based on strategy
   */
  private shouldAdjustPrice(
    report: ExecutionReport,
    currentMarketPrice: number,
    priceMovementBps: number
  ): boolean {
    const strategy = this.config.executionStrategy;

    // Aggressive: adjust quickly to chase the market
    if (strategy === 'aggressive') {
      return priceMovementBps > MIN_PRICE_MOVEMENT_BPS;
    }

    // Passive: only adjust if movement is very significant
    if (strategy === 'passive') {
      return priceMovementBps > MIN_PRICE_MOVEMENT_BPS * 2;
    }

    // Adaptive: adjust based on market conditions
    if (strategy === 'adaptive') {
      // If we haven't filled anything yet, be more willing to adjust
      if (report.filledSize === 0) {
        return priceMovementBps > MIN_PRICE_MOVEMENT_BPS * 1.5;
      }
      // If partially filled, less aggressive
      return priceMovementBps > MIN_PRICE_MOVEMENT_BPS * 2;
    }

    // TWAP/VWAP: generally don't adjust (stick to schedule)
    return false;
  }

  /**
   * Adjust order price based on market movement
   */
  private async adjustOrderPrice(
    currentReport: ExecutionReport,
    newMarketPrice: number
  ): Promise<ExecutionReport> {
    const strategy = this.config.executionStrategy;

    // Calculate new price based on strategy
    let adjustmentMultiplier = 1.0;

    if (strategy === 'aggressive') {
      adjustmentMultiplier = AGGRESSIVE_ADJUSTMENT_MULTIPLIER;
    } else if (strategy === 'passive') {
      adjustmentMultiplier = PASSIVE_ADJUSTMENT_MULTIPLIER;
    } else {
      adjustmentMultiplier = 1.0; // Adaptive: neutral adjustment
    }

    // Calculate new price with slippage tolerance
    const maxSlippageDecimal = (this.config.maxSlippagePercent / 100) * adjustmentMultiplier;
    const maxPriceChange = currentReport.requestedPrice * maxSlippageDecimal;

    let newPrice: number;
    if (currentReport.side === 'Buy') {
      // For Buy: willing to pay up to maxSlippage more
      newPrice = Math.min(
        newMarketPrice,
        currentReport.requestedPrice + maxPriceChange
      );
    } else {
      // For Sell: willing to accept up to maxSlippage less
      newPrice = Math.max(
        newMarketPrice,
        currentReport.requestedPrice - maxPriceChange
      );
    }

    newPrice = this.roundToDecimals(newPrice, PRICE_DECIMALS);

    // Create price adjustment record
    const adjustment: PriceAdjustment = {
      timestamp: Date.now(),
      oldPrice: currentReport.requestedPrice,
      newPrice,
      reason: 'market_moved',
    };

    this.safeLog('info', 'Adjusting order price', {
      orderId: currentReport.orderId,
      oldPrice: adjustment.oldPrice,
      newPrice: adjustment.newPrice,
      strategy,
    });

    // Update report with new price
    const updatedReport: ExecutionReport = {
      ...currentReport,
      requestedPrice: newPrice,
      adjustments: [...currentReport.adjustments, adjustment],
      reasoning: `${currentReport.reasoning} Price adjusted from ${adjustment.oldPrice} to ${adjustment.newPrice}.`,
    };

    this.activeOrders.set(currentReport.orderId, updatedReport);

    return updatedReport;
  }

  /**
   * Simulate market price movement (in production: fetch real market data)
   */
  private simulateMarketPrice(basePrice: number, side: OrderSide): number {
    // Simulate random price movement +/- 0.1%
    const randomMovement = (Math.random() - 0.5) * 0.002; // -0.1% to +0.1%
    const newPrice = basePrice * (1 + randomMovement);

    return this.roundToDecimals(newPrice, PRICE_DECIMALS);
  }

  /**
   * Handle partial fill and decide on continuation
   *
   * @param orderId - Order ID
   * @param filledSize - Amount filled so far
   * @returns Continuation action
   *
   * Recovery:
   * - GRACEFUL_DEGRADE: Continuation failures → cancel remaining
   */
  async handlePartialFills(
    orderId: string,
    filledSize: number
  ): Promise<'continue' | 'cancel' | 'adjust'> {
    // Input validation (THROW)
    if (!orderId) {
      throw new Error('SmartOrderExecutionService.handlePartialFills: orderId is required');
    }
    if (filledSize == null || filledSize < 0 || isNaN(filledSize)) {
      throw new Error('SmartOrderExecutionService.handlePartialFills: filledSize must be >= 0');
    }

    // Use ErrorHandler for GRACEFUL_DEGRADE
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.doHandlePartialFills(orderId, filledSize),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      if (result.success && result.value) {
        return result.value;
      }

      // GRACEFUL_DEGRADE: Handling failed → cancel remaining
      this.safeLog('warn', 'handlePartialFills failed, cancelling remaining', {
        orderId,
        filledSize,
        error: result.error,
      });

      return 'cancel';
    }

    // No ErrorHandler: execute directly
    try {
      return await this.doHandlePartialFills(orderId, filledSize);
    } catch (error) {
      this.safeLog('warn', 'handlePartialFills failed (no ErrorHandler), cancelling remaining', {
        orderId,
        filledSize,
        error,
      });

      return 'cancel';
    }
  }

  /**
   * Internal implementation of partial fill handling
   */
  private async doHandlePartialFills(
    orderId: string,
    filledSize: number
  ): Promise<'continue' | 'cancel' | 'adjust'> {
    // Get current order state
    const currentReport = this.activeOrders.get(orderId);
    if (!currentReport) {
      this.safeLog('warn', 'Order not found in active orders (partial fill)', { orderId });
      return 'cancel';
    }

    const requestedSize = currentReport.requestedSize;
    const fillPercent = (filledSize / requestedSize) * 100;

    this.safeLog('info', 'Processing partial fill', {
      orderId,
      filledSize,
      requestedSize,
      fillPercent: this.roundToDecimals(fillPercent, 1),
    });

    // Decision 1: If fill is too small, cancel (liquidity too low)
    if (fillPercent < MIN_PARTIAL_FILL_PERCENT) {
      this.safeLog('warn', 'Partial fill too small, cancelling', {
        orderId,
        fillPercent,
        minPercent: MIN_PARTIAL_FILL_PERCENT,
      });

      // Update report status
      const updatedReport: ExecutionReport = {
        ...currentReport,
        status: 'failed',
        filledSize,
        remainingSize: requestedSize - filledSize,
        reasoning: `${currentReport.reasoning} Partial fill too small (${fillPercent.toFixed(1)}%), cancelled.`,
      };

      this.activeOrders.set(orderId, updatedReport);
      return 'cancel';
    }

    // Decision 2: If already filled enough, continue
    if (fillPercent >= PARTIAL_FILL_CONTINUE_THRESHOLD) {
      this.safeLog('info', 'Good partial fill, continuing with remainder', {
        orderId,
        fillPercent,
      });

      // Update report
      const updatedReport: ExecutionReport = {
        ...currentReport,
        status: 'partial',
        filledSize,
        remainingSize: requestedSize - filledSize,
      };

      this.activeOrders.set(orderId, updatedReport);
      return 'continue';
    }

    // Decision 3: Check retry count
    const adjustmentCount = currentReport.adjustments.length;
    if (adjustmentCount >= MAX_PARTIAL_FILL_RETRIES) {
      this.safeLog('warn', 'Maximum partial fill retries reached, cancelling', {
        orderId,
        adjustmentCount,
        maxRetries: MAX_PARTIAL_FILL_RETRIES,
      });

      // Update report status
      const updatedReport: ExecutionReport = {
        ...currentReport,
        status: 'partial',
        filledSize,
        remainingSize: requestedSize - filledSize,
        reasoning: `${currentReport.reasoning} Max retries reached, partial fill at ${fillPercent.toFixed(1)}%.`,
      };

      this.activeOrders.set(orderId, updatedReport);
      return 'cancel';
    }

    // Decision 4: Medium fill - adjust price and continue
    this.safeLog('info', 'Medium partial fill, adjusting price', {
      orderId,
      fillPercent,
      adjustmentCount,
    });

    // Create adjustment for partial fill
    const adjustment: PriceAdjustment = {
      timestamp: Date.now(),
      oldPrice: currentReport.requestedPrice,
      newPrice: currentReport.requestedPrice, // Will be adjusted by monitorAndAdjust
      reason: 'partial_fill',
    };

    // Update report
    const updatedReport: ExecutionReport = {
      ...currentReport,
      status: 'partial',
      filledSize,
      remainingSize: requestedSize - filledSize,
      adjustments: [...currentReport.adjustments, adjustment],
      reasoning: `${currentReport.reasoning} Partial fill at ${fillPercent.toFixed(1)}%, adjusting.`,
    };

    this.activeOrders.set(orderId, updatedReport);
    return 'adjust';
  }

  /**
   * Calculate optimal order split to minimize market impact
   *
   * @param totalSize - Total order size
   * @param currentPrice - Current market price
   * @returns Array of sub-order sizes
   *
   * Recovery:
   * - GRACEFUL_DEGRADE: Calculation failures → return single order (no split)
   */
  calculateOptimalSplit(
    totalSize: number,
    currentPrice: number
  ): number[] {
    // Input validation (THROW)
    if (totalSize == null || totalSize <= 0 || isNaN(totalSize)) {
      throw new Error('SmartOrderExecutionService.calculateOptimalSplit: totalSize must be > 0');
    }
    if (currentPrice == null || currentPrice <= 0 || isNaN(currentPrice)) {
      throw new Error('SmartOrderExecutionService.calculateOptimalSplit: currentPrice must be > 0');
    }

    // Synchronous method: use try-catch pattern
    try {
      return this.doCalculateOptimalSplit(totalSize, currentPrice);
    } catch (error) {
      // Use ErrorHandler for GRACEFUL_DEGRADE
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }

      // GRACEFUL_DEGRADE: Calculation failed → return single order (no split)
      this.safeLog('warn', 'calculateOptimalSplit failed, returning single order', {
        totalSize,
        currentPrice,
        error,
      });
      return [totalSize];
    }
  }

  /**
   * Internal implementation of optimal split calculation
   */
  private doCalculateOptimalSplit(
    totalSize: number,
    currentPrice: number
  ): number[] {
    const totalValueUSD = totalSize * currentPrice;
    const minSubOrderValueUSD = MIN_SUB_ORDER_SIZE_USD;

    // If total order is smaller than minimum sub-order size, don't split
    if (totalValueUSD < minSubOrderValueUSD * 2) {
      this.safeLog('info', 'Order too small to split', { totalValueUSD, minSubOrderValueUSD });
      return [totalSize];
    }

    // Calculate maximum number of splits based on config and min size
    const maxSplitsByValue = Math.floor(totalValueUSD / minSubOrderValueUSD);
    const maxSplits = Math.min(
      this.config.maxOrderSplits,
      maxSplitsByValue,
      MAX_ORDER_SPLITS
    );

    // If we can't split even once, return single order
    if (maxSplits <= 1) {
      this.safeLog('info', 'Cannot split order (maxSplits <= 1)', { maxSplits });
      return [totalSize];
    }

    // Estimate market impact
    const estimatedImpact = this.estimateMarketImpact(totalSize, 'Buy'); // Side doesn't matter for split decision

    // Decision: Split based on estimated impact
    let numberOfSplits = 1;

    if (estimatedImpact > MAX_ACCEPTABLE_IMPACT_BPS) {
      // High impact: split into maximum splits
      numberOfSplits = maxSplits;
      this.safeLog('info', 'High market impact detected, splitting into max splits', {
        estimatedImpact,
        numberOfSplits,
      });
    } else if (estimatedImpact > MAX_ACCEPTABLE_IMPACT_BPS / 2) {
      // Medium impact: split into half of max
      numberOfSplits = Math.max(2, Math.floor(maxSplits / 2));
      this.safeLog('info', 'Medium market impact detected, splitting order', {
        estimatedImpact,
        numberOfSplits,
      });
    } else {
      // Low impact: no split needed
      this.safeLog('info', 'Low market impact, no split needed', {
        estimatedImpact,
      });
      return [totalSize];
    }

    // Create splits with equal sizing
    const subOrderSize = this.roundToDecimals(totalSize / numberOfSplits, SIZE_DECIMALS);
    const splits: number[] = [];

    for (let i = 0; i < numberOfSplits; i++) {
      splits.push(subOrderSize);
    }

    // Adjust last split to account for rounding errors
    const totalAllocated = subOrderSize * numberOfSplits;
    const remainder = totalSize - totalAllocated;

    if (Math.abs(remainder) > MIN_SIZE_DIFFERENCE) {
      splits[splits.length - 1] = this.roundToDecimals(
        splits[splits.length - 1] + remainder,
        SIZE_DECIMALS
      );
    }

    this.safeLog('info', 'Order split calculated', {
      totalSize,
      numberOfSplits: splits.length,
      splits,
    });

    return splits;
  }

  /**
   * Estimate market impact of order
   *
   * @param size - Order size
   * @param side - Buy or Sell
   * @returns Estimated price impact (bps)
   *
   * Recovery:
   * - GRACEFUL_DEGRADE: Estimation failures → return 0 (no impact)
   */
  estimateMarketImpact(size: number, side: OrderSide): number {
    // Input validation (THROW)
    if (size == null || size <= 0 || isNaN(size)) {
      throw new Error('SmartOrderExecutionService.estimateMarketImpact: size must be > 0');
    }
    if (!side || (side !== 'Buy' && side !== 'Sell')) {
      throw new Error('SmartOrderExecutionService.estimateMarketImpact: valid side is required');
    }

    // Synchronous method: use try-catch pattern
    try {
      return this.doEstimateMarketImpact(size, side);
    } catch (error) {
      // Use ErrorHandler for GRACEFUL_DEGRADE
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }

      // GRACEFUL_DEGRADE: Estimation failed → return 0 (no impact)
      this.safeLog('warn', 'estimateMarketImpact failed, returning 0', {
        size,
        side,
        error,
      });
      return 0;
    }
  }

  /**
   * Internal implementation of market impact estimation
   *
   * Formula: impact = sqrt(orderSize / avgVolume) * coefficient * 10000 (bps)
   * This is a simplified square-root market impact model
   */
  private doEstimateMarketImpact(size: number, side: OrderSide): number {
    // Simplified estimation without real volume data
    // In production, this would fetch actual orderbook and volume data

    // Assume a default daily volume (this would come from real market data)
    // For now, use a conservative estimate
    const assumedDailyVolume = MIN_DAILY_VOLUME_USD * 10; // $10M daily volume

    // Calculate order size as percentage of daily volume
    const orderAsPercentOfVolume = (size / assumedDailyVolume) * 100;

    // Apply square-root impact model
    // impact (bps) = sqrt(orderPercent) * coefficient * 10000
    const rawImpact = Math.sqrt(orderAsPercentOfVolume / 100) * MARKET_IMPACT_COEFFICIENT * 10000;

    // Add multiplier based on order size thresholds
    let impactMultiplier = 1.0;

    if (orderAsPercentOfVolume > LARGE_ORDER_THRESHOLD_PERCENT) {
      // Large order: 2x impact
      impactMultiplier = 2.0;
    } else if (orderAsPercentOfVolume > SIGNIFICANT_ORDER_THRESHOLD_PERCENT) {
      // Significant order: 1.5x impact
      impactMultiplier = 1.5;
    }

    const finalImpact = rawImpact * impactMultiplier;
    const roundedImpact = this.roundToDecimals(finalImpact, IMPACT_DECIMALS);

    this.safeLog('info', 'Market impact estimated', {
      size,
      side,
      orderAsPercentOfVolume: this.roundToDecimals(orderAsPercentOfVolume, 2),
      rawImpact: this.roundToDecimals(rawImpact, IMPACT_DECIMALS),
      impactMultiplier,
      finalImpact: roundedImpact,
    });

    return roundedImpact;
  }

  /**
   * Execute TWAP (Time-Weighted Average Price) strategy
   *
   * @param order - Order request
   * @returns Execution report
   *
   * Recovery:
   * - GRACEFUL_DEGRADE: TWAP failures → fallback to regular execution
   */
  async executeTWAP(order: SmartOrderRequest): Promise<ExecutionReport> {
    // Input validation (same as executeSmartOrder)
    if (!order) {
      throw new Error('SmartOrderExecutionService.executeTWAP: order is required');
    }
    if (!order.symbol) {
      throw new Error('SmartOrderExecutionService.executeTWAP: symbol is required');
    }
    if (!order.side || (order.side !== 'Buy' && order.side !== 'Sell')) {
      throw new Error('SmartOrderExecutionService.executeTWAP: valid side is required');
    }
    if (order.size == null || order.size <= 0 || isNaN(order.size)) {
      throw new Error('SmartOrderExecutionService.executeTWAP: size must be > 0');
    }
    if (order.price == null || order.price <= 0 || isNaN(order.price)) {
      throw new Error('SmartOrderExecutionService.executeTWAP: price must be > 0');
    }

    const startTime = Date.now();
    const orderId = `twap_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

    this.safeLog('info', 'Executing TWAP strategy', {
      orderId,
      symbol: order.symbol,
      size: order.size,
      interval: this.config.twapInterval,
    });

    // Use ErrorHandler for GRACEFUL_DEGRADE
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.doExecuteTWAP(orderId, order, startTime),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      if (result.success && result.value) {
        return result.value;
      }

      // GRACEFUL_DEGRADE: TWAP failed → fallback to regular execution
      this.safeLog('warn', 'TWAP execution failed, falling back to regular execution', {
        orderId,
        error: result.error,
      });

      return this.executeSmartOrder(order);
    }

    // No ErrorHandler: execute directly
    try {
      return await this.doExecuteTWAP(orderId, order, startTime);
    } catch (error) {
      this.safeLog('warn', 'TWAP execution failed (no ErrorHandler), falling back to regular execution', {
        orderId,
        error,
      });

      return this.executeSmartOrder(order);
    }
  }

  /**
   * Internal implementation of TWAP execution
   */
  private async doExecuteTWAP(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    const totalSize = order.size;
    const targetPrice = order.price;
    const interval = Math.max(this.config.twapInterval, MIN_TWAP_INTERVAL_MS);

    // Calculate number of slices based on config
    const maxSlices = Math.min(this.config.maxOrderSplits, MAX_ORDER_SPLITS);

    // For TWAP: distribute evenly over time
    const sliceSize = this.roundToDecimals(totalSize / maxSlices, SIZE_DECIMALS);

    this.safeLog('info', 'TWAP: Creating time slices', {
      orderId,
      totalSize,
      slices: maxSlices,
      sliceSize,
      interval,
    });

    // Create sub-orders with scheduled execution times
    const subOrders: SubOrder[] = [];
    let subOrderCounter = 0;

    for (let i = 0; i < maxSlices; i++) {
      const subOrderId = `${SUB_ORDER_ID_PREFIX}${orderId}_twap_${subOrderCounter++}`;
      const scheduledTime = startTime + (i * interval);

      // Adjust last slice for rounding errors
      const size = i === maxSlices - 1
        ? this.roundToDecimals(totalSize - (sliceSize * (maxSlices - 1)), SIZE_DECIMALS)
        : sliceSize;

      subOrders.push({
        id: subOrderId,
        size,
        price: targetPrice,
        status: 'pending',
        timestamp: scheduledTime,
      });
    }

    // Execute sub-orders with time delays
    const filledSubOrders: SubOrder[] = [];
    let totalFilled = 0;
    let totalFillValue = 0;

    for (const subOrder of subOrders) {
      // Wait until scheduled time (in production: actual scheduling)
      const now = Date.now();
      const waitTime = subOrder.timestamp - now;

      if (waitTime > 0) {
        this.safeLog('info', 'TWAP: Waiting for next slice', {
          orderId,
          subOrderId: subOrder.id,
          waitTime,
        });

        // Simulate waiting (in production: actual delay or scheduler)
        // For now, we'll execute immediately for demonstration
      }

      // Execute sub-order at market price
      const currentMarketPrice = this.simulateMarketPrice(targetPrice, order.side);
      const fillPrice = this.calculateFillPrice(currentMarketPrice, order.side, 0); // TWAP has minimal impact per slice

      filledSubOrders.push({
        ...subOrder,
        status: 'filled',
        fillPrice,
      });

      totalFilled += subOrder.size;
      totalFillValue += subOrder.size * fillPrice;

      this.safeLog('info', 'TWAP: Slice executed', {
        orderId,
        subOrderId: subOrder.id,
        size: subOrder.size,
        fillPrice,
      });
    }

    // Calculate final metrics
    const averageFillPrice = totalFilled > 0 ? totalFillValue / totalFilled : 0;
    const slippage = this.calculateSlippage(targetPrice, averageFillPrice);
    const executionTime = Date.now() - startTime;

    // Estimate market impact (TWAP spreads over time, so lower impact)
    const marketImpact = this.estimateMarketImpact(sliceSize, order.side); // Impact per slice, not total

    const report: ExecutionReport = {
      orderId,
      status: totalFilled >= totalSize ? 'completed' : 'partial',
      symbol: order.symbol,
      side: order.side,
      requestedSize: totalSize,
      filledSize: this.roundToDecimals(totalFilled, SIZE_DECIMALS),
      remainingSize: this.roundToDecimals(totalSize - totalFilled, SIZE_DECIMALS),
      requestedPrice: this.roundToDecimals(targetPrice, PRICE_DECIMALS),
      averageFillPrice: this.roundToDecimals(averageFillPrice, PRICE_DECIMALS),
      slippage: this.roundToDecimals(slippage, SLIPPAGE_DECIMALS),
      executionTime,
      numberOfSplits: maxSlices,
      marketImpact: this.roundToDecimals(marketImpact, IMPACT_DECIMALS),
      subOrders: filledSubOrders,
      adjustments: [],
      reasoning: `TWAP execution: ${maxSlices} slices over ${executionTime}ms intervals. ` +
        `Average fill price: ${averageFillPrice.toFixed(2)}, slippage: ${slippage.toFixed(1)} bps.`,
    };

    // Store in active orders
    this.activeOrders.set(orderId, report);
    this.orderStartTimes.set(orderId, startTime);

    this.safeLog('info', 'TWAP execution completed', {
      orderId,
      filledSize: report.filledSize,
      averageFillPrice: report.averageFillPrice,
      slippage: report.slippage,
    });

    return report;
  }

  /**
   * Execute VWAP (Volume-Weighted Average Price) strategy
   *
   * @param order - Order request
   * @returns Execution report
   *
   * Recovery:
   * - GRACEFUL_DEGRADE: VWAP failures → fallback to regular execution
   */
  async executeVWAP(order: SmartOrderRequest): Promise<ExecutionReport> {
    // Input validation (same as executeSmartOrder)
    if (!order) {
      throw new Error('SmartOrderExecutionService.executeVWAP: order is required');
    }
    if (!order.symbol) {
      throw new Error('SmartOrderExecutionService.executeVWAP: symbol is required');
    }
    if (!order.side || (order.side !== 'Buy' && order.side !== 'Sell')) {
      throw new Error('SmartOrderExecutionService.executeVWAP: valid side is required');
    }
    if (order.size == null || order.size <= 0 || isNaN(order.size)) {
      throw new Error('SmartOrderExecutionService.executeVWAP: size must be > 0');
    }
    if (order.price == null || order.price <= 0 || isNaN(order.price)) {
      throw new Error('SmartOrderExecutionService.executeVWAP: price must be > 0');
    }

    const startTime = Date.now();
    const orderId = `vwap_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

    this.safeLog('info', 'Executing VWAP strategy', {
      orderId,
      symbol: order.symbol,
      size: order.size,
      lookback: this.config.vwapLookback,
    });

    // Use ErrorHandler for GRACEFUL_DEGRADE
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.doExecuteVWAP(orderId, order, startTime),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      if (result.success && result.value) {
        return result.value;
      }

      // GRACEFUL_DEGRADE: VWAP failed → fallback to regular execution
      this.safeLog('warn', 'VWAP execution failed, falling back to regular execution', {
        orderId,
        error: result.error,
      });

      return this.executeSmartOrder(order);
    }

    // No ErrorHandler: execute directly
    try {
      return await this.doExecuteVWAP(orderId, order, startTime);
    } catch (error) {
      this.safeLog('warn', 'VWAP execution failed (no ErrorHandler), falling back to regular execution', {
        orderId,
        error,
      });

      return this.executeSmartOrder(order);
    }
  }

  /**
   * Internal implementation of VWAP execution
   */
  private async doExecuteVWAP(
    orderId: string,
    order: SmartOrderRequest,
    startTime: number
  ): Promise<ExecutionReport> {
    const totalSize = order.size;
    const targetPrice = order.price;

    // Validate lookback period
    const lookback = Math.max(
      MIN_VWAP_LOOKBACK,
      Math.min(this.config.vwapLookback, MAX_VWAP_LOOKBACK)
    );

    // Get volume profile (in production: fetch real historical volume data)
    const volumeProfile = this.generateVolumeProfile(lookback);

    this.safeLog('info', 'VWAP: Generated volume profile', {
      orderId,
      lookback,
      totalVolume: volumeProfile.reduce((sum, v) => sum + v, 0),
    });

    // Distribute order size based on volume profile
    const subOrders = this.distributeByVolume(
      orderId,
      totalSize,
      targetPrice,
      volumeProfile
    );

    this.safeLog('info', 'VWAP: Created volume-weighted slices', {
      orderId,
      totalSize,
      slices: subOrders.length,
    });

    // Execute sub-orders
    const filledSubOrders: SubOrder[] = [];
    let totalFilled = 0;
    let totalFillValue = 0;

    for (const subOrder of subOrders) {
      // Execute sub-order at market price
      const currentMarketPrice = this.simulateMarketPrice(targetPrice, order.side);
      const fillPrice = this.calculateFillPrice(currentMarketPrice, order.side, 0); // VWAP matches volume, minimal impact

      filledSubOrders.push({
        ...subOrder,
        status: 'filled',
        fillPrice,
      });

      totalFilled += subOrder.size;
      totalFillValue += subOrder.size * fillPrice;

      this.safeLog('info', 'VWAP: Slice executed', {
        orderId,
        subOrderId: subOrder.id,
        size: subOrder.size,
        fillPrice,
      });
    }

    // Calculate final metrics
    const averageFillPrice = totalFilled > 0 ? totalFillValue / totalFilled : 0;
    const slippage = this.calculateSlippage(targetPrice, averageFillPrice);
    const executionTime = Date.now() - startTime;

    // Estimate market impact (VWAP matches volume pattern, very low impact)
    const avgSliceSize = totalSize / subOrders.length;
    const marketImpact = this.estimateMarketImpact(avgSliceSize, order.side);

    const report: ExecutionReport = {
      orderId,
      status: totalFilled >= totalSize ? 'completed' : 'partial',
      symbol: order.symbol,
      side: order.side,
      requestedSize: totalSize,
      filledSize: this.roundToDecimals(totalFilled, SIZE_DECIMALS),
      remainingSize: this.roundToDecimals(totalSize - totalFilled, SIZE_DECIMALS),
      requestedPrice: this.roundToDecimals(targetPrice, PRICE_DECIMALS),
      averageFillPrice: this.roundToDecimals(averageFillPrice, PRICE_DECIMALS),
      slippage: this.roundToDecimals(slippage, SLIPPAGE_DECIMALS),
      executionTime,
      numberOfSplits: subOrders.length,
      marketImpact: this.roundToDecimals(marketImpact, IMPACT_DECIMALS),
      subOrders: filledSubOrders,
      adjustments: [],
      reasoning: `VWAP execution: ${subOrders.length} slices matching ${lookback}-period volume profile. ` +
        `Average fill price: ${averageFillPrice.toFixed(2)}, slippage: ${slippage.toFixed(1)} bps.`,
    };

    // Store in active orders
    this.activeOrders.set(orderId, report);
    this.orderStartTimes.set(orderId, startTime);

    this.safeLog('info', 'VWAP execution completed', {
      orderId,
      filledSize: report.filledSize,
      averageFillPrice: report.averageFillPrice,
      slippage: report.slippage,
    });

    return report;
  }

  /**
   * Generate simulated volume profile
   * In production: fetch real historical volume data
   */
  private generateVolumeProfile(periods: number): number[] {
    const profile: number[] = [];

    // Simulate realistic volume pattern with:
    // - Higher volume at market open/close
    // - Lower volume in middle hours
    // - Random variations

    for (let i = 0; i < periods; i++) {
      // Simulate U-shaped volume curve
      const periodRatio = i / (periods - 1); // 0 to 1
      const distanceFromMiddle = Math.abs(periodRatio - 0.5) * 2; // 0 (middle) to 1 (edges)

      // Higher volume at edges (open/close)
      const baseVolume = 0.5 + (distanceFromMiddle * 0.5); // 0.5 to 1.0

      // Add random variation +/- 20%
      const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2

      const volume = baseVolume * randomFactor;
      profile.push(volume);
    }

    return profile;
  }

  /**
   * Distribute order size based on volume profile
   */
  private distributeByVolume(
    orderId: string,
    totalSize: number,
    targetPrice: number,
    volumeProfile: number[]
  ): SubOrder[] {
    const totalVolume = volumeProfile.reduce((sum, v) => sum + v, 0);
    const subOrders: SubOrder[] = [];

    let allocatedSize = 0;

    for (let i = 0; i < volumeProfile.length; i++) {
      const volumeRatio = volumeProfile[i] / totalVolume;

      // Calculate size for this slice
      let sliceSize: number;
      if (i === volumeProfile.length - 1) {
        // Last slice: allocate all remaining to avoid rounding errors
        sliceSize = totalSize - allocatedSize;
      } else {
        sliceSize = totalSize * volumeRatio;
      }

      sliceSize = this.roundToDecimals(sliceSize, SIZE_DECIMALS);

      // Skip tiny slices
      if (sliceSize < MIN_SIZE_DIFFERENCE) {
        continue;
      }

      const subOrderId = `${SUB_ORDER_ID_PREFIX}${orderId}_vwap_${i}`;

      subOrders.push({
        id: subOrderId,
        size: sliceSize,
        price: targetPrice,
        status: 'pending',
        timestamp: Date.now() + (i * 1000), // Stagger by 1 second
      });

      allocatedSize += sliceSize;
    }

    return subOrders;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Safe logging with SKIP error handling
   */
  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: any
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

  /**
   * Round number to specified decimal places
   */
  private roundToDecimals(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Get current state of an order
   *
   * @param orderId - Order ID
   * @returns Execution report or null if not found
   */
  getOrderState(orderId: string): ExecutionReport | null {
    if (!orderId) {
      throw new Error('SmartOrderExecutionService.getOrderState: orderId is required');
    }

    return this.activeOrders.get(orderId) || null;
  }

  /**
   * Remove completed or failed orders from active tracking
   *
   * @param orderId - Order ID to clean up
   * @returns True if order was removed, false if not found or still active
   */
  cleanupOrder(orderId: string): boolean {
    if (!orderId) {
      throw new Error('SmartOrderExecutionService.cleanupOrder: orderId is required');
    }

    const report = this.activeOrders.get(orderId);
    if (!report) {
      return false;
    }

    // Only cleanup terminal states
    if (report.status === 'completed' || report.status === 'failed') {
      this.activeOrders.delete(orderId);
      this.orderStartTimes.delete(orderId);

      this.safeLog('info', 'Order cleaned up from active tracking', {
        orderId,
        status: report.status,
      });

      return true;
    }

    return false;
  }

  /**
   * Get count of active orders being tracked
   */
  getActiveOrderCount(): number {
    return this.activeOrders.size;
  }

  /**
   * Clear all order tracking (useful for testing or reset)
   */
  clearAllOrders(): void {
    const count = this.activeOrders.size;
    this.activeOrders.clear();
    this.orderStartTimes.clear();

    this.safeLog('info', 'All orders cleared from tracking', { count });
  }
}
