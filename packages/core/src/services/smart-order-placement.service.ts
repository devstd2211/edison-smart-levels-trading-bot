/**
 * Smart Order Placement Service (Phase 10.1.3)
 *
 * Intelligent order placement to minimize slippage and maximize fill rates:
 * - Optimal order splitting for large sizes
 * - Liquidity-aware placement strategies
 * - Adaptive execution based on market conditions
 * - Fill probability estimation
 *
 * Error Handling:
 * - THROW: Config validation, input validation
 * - GRACEFUL_DEGRADE: Planning failures (return conservative plans)
 * - SKIP: Logger failures (non-blocking)
 */

import {
  SmartOrderPlacementConfig,
  SmartOrderPlan,
  SubOrder,
  LiquidityLevel,
  FillProbability,
  OrderSplit,
  Orderbook,
  LoggerService,
  SmartOrderPlacementStrategicConfig,
} from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  DEFAULT_SMART_ORDER_PLACEMENT,
  SMART_ORDER_PLACEMENT_TECHNICAL,
} from '../constants/phase-10-constants';
import {
  calculateAggressivenessFactor,
  calculateLiquidityFactor,
  calculateLiquidityScore,
  calculateSizeImpactFactor,
  calculateWeightedSplits,
  combineProbabilityFactors,
  estimateFillTime,
  estimateSplitImprovement,
  estimateVolatility,
} from './smart-order-placement/smart-order-placement-math.utils';
import {
  buildConservativeFillProbability,
  buildConservativePlan,
  buildMarketPriceLevel,
  buildSingleOrderSplit,
} from './smart-order-placement/smart-order-placement-fallback.utils';
import {
  validateSmartOrderbook,
  validateSmartOrderParams,
  validateSmartOrderPlacementConfig,
} from './smart-order-placement/smart-order-placement-validation.utils';
import {
  analyzeSmartMarketConditions,
  determineSmartOrderPriority,
} from './smart-order-placement/smart-order-placement-market.utils';
import {
  assessSmartOrderRisk,
  calculateSmartExpectedFill,
  calculateSmartExpectedSlippage,
} from './smart-order-placement/smart-order-placement-plan-metrics.utils';

/**
 * SmartOrderPlacementService - Intelligent order placement with ErrorHandler integration
 *
 * Modular Design:
 * - Each analysis can be used independently
 * - Config-driven feature enablement
 * - Backward compatible (works without ErrorHandler)
 */
export class SmartOrderPlacementService {
  private strategicConfig: SmartOrderPlacementStrategicConfig;

  constructor(
    private config: SmartOrderPlacementConfig,
    strategicConfig?: SmartOrderPlacementStrategicConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // Merge strategic config with defaults
    this.strategicConfig = { ...DEFAULT_SMART_ORDER_PLACEMENT, ...strategicConfig };

    // THROW: Config validation OUTSIDE try-catch
    validateSmartOrderPlacementConfig(config);

    // Safe logging (SKIP strategy)
    this.safeLog('info', 'SmartOrderPlacementService initialized', {
      maxOrderSize: config.maxOrderSize,
      maxSlippageBps: config.maxSlippageBps,
      minFillProbability: config.minFillProbability,
      strategicThresholds: this.strategicConfig,
    });
  }

  // ==========================================================================
  // PUBLIC API - MAIN METHODS
  // ==========================================================================

  /**
   * Plan optimal order execution
   * GRACEFUL_DEGRADE: Returns conservative plan on failure
   */
  async planOrderExecution(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
    targetPrice?: number,
  ): Promise<SmartOrderPlan> {
    // THROW: Input validation OUTSIDE try-catch
    validateSmartOrderbook(orderbook);
    validateSmartOrderParams(size, direction, targetPrice);

    return this.executeWithGracefulDegrade(
      async () =>
        this.planOrderExecutionInternal(
          orderbook,
          size,
          direction,
          targetPrice,
        ),
      () => this.getConservativePlan(orderbook, size, direction, targetPrice),
      {
        warnMessage: 'Order planning failed, using conservative plan',
        errorMessage: 'Order planning failed (no ErrorHandler)',
        meta: { size, direction },
      },
    );
  }

  /**
   * Calculate optimal order split
   * GRACEFUL_DEGRADE: Returns single order on failure
   */
  async calculateOptimalSplit(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
  ): Promise<OrderSplit> {
    // THROW: Input validation
    validateSmartOrderbook(orderbook);
    validateSmartOrderParams(size, direction);

    return this.executeWithGracefulDegrade(
      async () => this.calculateOptimalSplitInternal(orderbook, size, direction),
      () => this.getSingleOrderSplit(size),
      {
        warnMessage: 'Split calculation failed, using single order',
        errorMessage: 'Split calculation failed',
        meta: { size, direction },
      },
    );
  }

  /**
   * Find best liquidity level for order placement
   * GRACEFUL_DEGRADE: Returns market price on failure
   */
  async findBestLiquidityLevel(
    orderbook: Orderbook,
    direction: 'buy' | 'sell',
  ): Promise<LiquidityLevel> {
    // THROW: Input validation
    validateSmartOrderbook(orderbook);

    if (direction !== 'buy' && direction !== 'sell') {
      throw new Error(`Invalid direction: ${direction}`);
    }

    return this.executeWithGracefulDegrade(
      async () => this.findBestLiquidityLevelInternal(orderbook, direction),
      () => this.getMarketPriceLevel(orderbook, direction),
      {
        warnMessage: 'Liquidity level search failed, using market price',
        errorMessage: 'Liquidity level search failed',
        meta: { direction },
      },
    );
  }

  /**
   * Estimate fill probability for specific price and size
   * GRACEFUL_DEGRADE: Returns conservative estimate on failure
   */
  async estimateFillProbability(
    orderbook: Orderbook,
    price: number,
    size: number,
    direction: 'buy' | 'sell',
  ): Promise<FillProbability> {
    // THROW: Input validation
    validateSmartOrderbook(orderbook);
    validateSmartOrderParams(size, direction, price);

    return this.executeWithGracefulDegrade(
      async () =>
        this.estimateFillProbabilityInternal(orderbook, price, size, direction),
      () => this.getConservativeFillProbability(price, size),
      {
        warnMessage: 'Fill probability estimation failed',
        errorMessage: 'Fill probability estimation failed',
        meta: { price, size, direction },
      },
    );
  }

  private async executeWithGracefulDegrade<T>(
    operation: () => Promise<T>,
    fallback: () => T,
    logContext: {
      warnMessage: string;
      errorMessage: string;
      meta?: Record<string, unknown>;
    },
  ): Promise<T> {
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        operation,
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', logContext.warnMessage, logContext.meta);
      return fallback();
    }

    try {
      return await operation();
    } catch (error) {
      this.safeLog('error', logContext.errorMessage, {
        ...logContext.meta,
        error,
      });
      return fallback();
    }
  }

  // ==========================================================================
  // INTERNAL CALCULATION METHODS
  // ==========================================================================

  private async planOrderExecutionInternal(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
    targetPrice?: number,
  ): Promise<SmartOrderPlan> {
    // Analyze market conditions
    const conditions = analyzeSmartMarketConditions(orderbook, direction);

    // Determine if order should be split
    const shouldSplit = size > this.config.maxOrderSize;

    let orders: SubOrder[];
    let strategy: SmartOrderPlan['strategy'];

    if (shouldSplit) {
      // Calculate optimal split
      const split = await this.calculateOptimalSplitInternal(
        orderbook,
        size,
        direction,
      );
      orders = await this.createSubOrders(
        orderbook,
        split.subOrderSizes,
        direction,
        targetPrice,
      );
      strategy = 'split';
    } else {
      // Single order
      const bestLevel = await this.findBestLiquidityLevelInternal(
        orderbook,
        direction,
      );
      const fillProb = await this.estimateFillProbabilityInternal(
        orderbook,
        targetPrice || bestLevel.price,
        size,
        direction,
      );

      orders = [
        {
          price: targetPrice || bestLevel.price,
          size,
          priority: determineSmartOrderPriority(
            conditions,
            fillProb.probability,
            this.config.enableAdaptive,
            this.strategicConfig,
          ),
          fillProbability: fillProb.probability,
          estimatedFillTime: fillProb.expectedFillTime,
        },
      ];
      strategy = 'single';
    }

    // Calculate aggregated metrics
    const expectedFill = calculateSmartExpectedFill(orders);
    const expectedSlippage = calculateSmartExpectedSlippage(
      direction === 'buy' ? orderbook.asks : orderbook.bids,
      orders,
    );
    const estimatedTime = Math.max(...orders.map((o) => o.estimatedFillTime));
    const risk = assessSmartOrderRisk(
      expectedSlippage,
      expectedFill,
      conditions,
      this.config.maxSlippageBps,
      this.config.minFillProbability,
      this.strategicConfig.highRiskSlippageMultiplier,
      this.strategicConfig.highRiskFillMultiplier,
    );

    return {
      totalSize: size,
      targetPrice: targetPrice || null,
      direction,
      orders,
      expectedFill,
      expectedSlippage,
      estimatedTime,
      strategy,
      risk,
    };
  }

  private async calculateOptimalSplitInternal(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
  ): Promise<OrderSplit> {
    // If size is below threshold, don't split
    if (size <= this.config.maxOrderSize) {
      return this.getSingleOrderSplit(size);
    }

    // Calculate number of sub-orders based on available liquidity
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
    // Determine optimal number of splits
    const numSplits = Math.min(
      Math.ceil(size / this.config.maxOrderSize),
      levels.length,
      SMART_ORDER_PLACEMENT_TECHNICAL.SPLITTING.MAX_SPLITS, // Max splits to avoid over-fragmentation
    );

    // Calculate sub-order sizes (weighted by liquidity)
    const subOrderSizes = calculateWeightedSplits(
      size,
      numSplits,
      levels,
    );

    // Estimate improvement
    const improvement = estimateSplitImprovement(size, subOrderSizes);

    return {
      originalSize: size,
      subOrderSizes,
      reason: size > this.config.maxOrderSize * 2 ? 'size' : 'liquidity',
      improvement,
    };
  }

  private async findBestLiquidityLevelInternal(
    orderbook: Orderbook,
    direction: 'buy' | 'sell',
  ): Promise<LiquidityLevel> {
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
    const marketPrice = levels.length > 0 ? levels[0].price : 0;

    // Analyze top N levels
    const analyzeLevels = Math.min(levels.length, this.config.analyzeLevels);
    let bestLevel: LiquidityLevel | null = null;
    let bestScore = -1;

    for (let i = 0; i < analyzeLevels; i++) {
      const level = levels[i];

      // Skip invalid levels
      if (!Number.isFinite(level.price) || !Number.isFinite(level.volume)) {
        continue;
      }

      // Calculate liquidity score
      const score = calculateLiquidityScore(level, levels, i);
      const distanceBps =
        marketPrice > 0
          ? (Math.abs(level.price - marketPrice) / marketPrice) * 10000
          : 0;

      const liquidityLevel: LiquidityLevel = {
        price: level.price,
        volume: level.volume,
        score,
        distanceBps,
        isOptimal: false,
      };

      if (score > bestScore) {
        bestScore = score;
        bestLevel = liquidityLevel;
      }
    }

    if (bestLevel) {
      bestLevel.isOptimal = true;
      return bestLevel;
    }

    // Fallback to market price
    return this.getMarketPriceLevel(orderbook, direction);
  }

  private async estimateFillProbabilityInternal(
    orderbook: Orderbook,
    price: number,
    size: number,
    direction: 'buy' | 'sell',
  ): Promise<FillProbability> {
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
    const marketPrice = levels.length > 0 ? levels[0].price : price;

    // Calculate factors
    const liquidity = calculateLiquidityFactor(levels, price, size);
    const aggressiveness = calculateAggressivenessFactor(
      price,
      marketPrice,
      direction,
    );
    const volatility = estimateVolatility(orderbook);
    const sizeImpact = calculateSizeImpactFactor(size, levels);

    // Combine factors to estimate probability
    const probability = combineProbabilityFactors(
      liquidity,
      aggressiveness,
      volatility,
      sizeImpact,
    );

    // Estimate fill time based on probability and market conditions
    const expectedFillTime = estimateFillTime(
      probability,
      size,
      levels,
      this.config.executionTimeHorizon,
    );

    return {
      orderSize: size,
      price,
      probability,
      factors: {
        liquidity,
        aggressiveness,
        volatility,
        sizeImpact,
      },
      expectedFillTime,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async createSubOrders(
    orderbook: Orderbook,
    sizes: number[],
    direction: 'buy' | 'sell',
    targetPrice?: number,
  ): Promise<SubOrder[]> {
    const subOrders: SubOrder[] = [];
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      const levelIndex = Math.min(i, levels.length - 1);
      const price = targetPrice || levels[levelIndex]?.price || 0;

      const fillProb = await this.estimateFillProbabilityInternal(
        orderbook,
        price,
        size,
        direction,
      );

      subOrders.push({
        price,
        size,
        priority: 'adaptive',
        fillProbability: fillProb.probability,
        estimatedFillTime: fillProb.expectedFillTime,
      });
    }

    return subOrders;
  }

  // ==========================================================================
  // SAFE DEFAULTS
  // ==========================================================================

  private getConservativePlan(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
    targetPrice?: number,
  ): SmartOrderPlan {
    return buildConservativePlan({
      orderbook,
      size,
      direction,
      targetPrice,
      executionTimeHorizon: this.config.executionTimeHorizon,
      maxSlippageBps: this.config.maxSlippageBps,
    });
  }

  private getSingleOrderSplit(size: number): OrderSplit {
    return buildSingleOrderSplit(size);
  }

  private getMarketPriceLevel(
    orderbook: Orderbook,
    direction: 'buy' | 'sell',
  ): LiquidityLevel {
    return buildMarketPriceLevel(orderbook, direction);
  }

  private getConservativeFillProbability(
    price: number,
    size: number,
  ): FillProbability {
    return buildConservativeFillProbability(
      price,
      size,
      this.config.executionTimeHorizon,
    );
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  /**
   * Safe logging wrapper (SKIP strategy)
   */
  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    if (!this.logger) return;
    if (this.errorHandler) {
      this.errorHandler.handle(
        () => {
          if (level === 'error') this.logger!.error(message, meta);
          else if (level === 'warn') this.logger!.warn(message, meta);
          else this.logger!.info(message, meta);
        },
        { strategy: RecoveryStrategy.SKIP },
      );
    } else {
      try {
        if (level === 'error') this.logger.error(message, meta);
        else if (level === 'warn') this.logger.warn(message, meta);
        else this.logger.info(message, meta);
      } catch {
        // Silent failure (SKIP strategy)
      }
    }
  }
}

