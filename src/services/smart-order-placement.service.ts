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
  MarketConditions,
  OrderPriority,
} from '../types/smart-order-placement.interface';
import { Orderbook } from '../types/liquidity-heatmap.interface';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { LoggerService } from '../types';

/**
 * SmartOrderPlacementService - Intelligent order placement with ErrorHandler integration
 *
 * Modular Design:
 * - Each analysis can be used independently
 * - Config-driven feature enablement
 * - Backward compatible (works without ErrorHandler)
 */
export class SmartOrderPlacementService {
  constructor(
    private config: SmartOrderPlacementConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation OUTSIDE try-catch
    this.validateConfig(config);

    // Safe logging (SKIP strategy)
    this.safeLog('info', 'SmartOrderPlacementService initialized', {
      maxOrderSize: config.maxOrderSize,
      maxSlippageBps: config.maxSlippageBps,
      minFillProbability: config.minFillProbability,
    });
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate configuration (THROW strategy)
   */
  private validateConfig(config: SmartOrderPlacementConfig): void {
    if (!config) {
      throw new Error('SmartOrderPlacementConfig cannot be null or undefined');
    }

    if (!Number.isFinite(config.maxOrderSize) || config.maxOrderSize <= 0) {
      throw new Error(
        `Invalid maxOrderSize: ${config.maxOrderSize} (must be positive)`,
      );
    }

    if (!Number.isFinite(config.maxSlippageBps) || config.maxSlippageBps < 0) {
      throw new Error(
        `Invalid maxSlippageBps: ${config.maxSlippageBps} (must be >= 0)`,
      );
    }

    if (
      !Number.isFinite(config.minFillProbability) ||
      config.minFillProbability < 0 ||
      config.minFillProbability > 100
    ) {
      throw new Error(
        `Invalid minFillProbability: ${config.minFillProbability} (must be 0-100)`,
      );
    }

    if (!Number.isFinite(config.analyzeLevels) || config.analyzeLevels <= 0) {
      throw new Error(
        `Invalid analyzeLevels: ${config.analyzeLevels} (must be positive)`,
      );
    }

    if (
      !Number.isFinite(config.executionTimeHorizon) ||
      config.executionTimeHorizon <= 0
    ) {
      throw new Error(
        `Invalid executionTimeHorizon: ${config.executionTimeHorizon} (must be positive)`,
      );
    }
  }

  /**
   * Validate orderbook (THROW strategy)
   */
  private validateOrderbook(orderbook: Orderbook): void {
    if (!orderbook) {
      throw new Error('Orderbook cannot be null or undefined');
    }

    if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
      throw new Error('Orderbook must have bids and asks arrays');
    }
  }

  /**
   * Validate order parameters (THROW strategy)
   */
  private validateOrderParams(
    size: number,
    direction: 'buy' | 'sell',
    targetPrice?: number,
  ): void {
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid order size: ${size} (must be positive)`);
    }

    if (direction !== 'buy' && direction !== 'sell') {
      throw new Error(
        `Invalid direction: ${direction} (must be 'buy' or 'sell')`,
      );
    }

    if (targetPrice !== undefined && targetPrice !== null) {
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        throw new Error(
          `Invalid targetPrice: ${targetPrice} (must be positive or null)`,
        );
      }
    }
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
    this.validateOrderbook(orderbook);
    this.validateOrderParams(size, direction, targetPrice);

    // GRACEFUL_DEGRADE: Planning calculation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () =>
          this.planOrderExecutionInternal(
            orderbook,
            size,
            direction,
            targetPrice,
          ),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Order planning failed, using conservative plan', {
        size,
        direction,
      });
      return this.getConservativePlan(orderbook, size, direction, targetPrice);
    }

    // Without ErrorHandler
    try {
      return await this.planOrderExecutionInternal(
        orderbook,
        size,
        direction,
        targetPrice,
      );
    } catch (error) {
      this.safeLog('error', 'Order planning failed (no ErrorHandler)', {
        error,
      });
      return this.getConservativePlan(orderbook, size, direction, targetPrice);
    }
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
    this.validateOrderbook(orderbook);
    this.validateOrderParams(size, direction);

    // GRACEFUL_DEGRADE: Split calculation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.calculateOptimalSplitInternal(orderbook, size, direction),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Split calculation failed, using single order', {
        size,
        direction,
      });
      return this.getSingleOrderSplit(size);
    }

    // Without ErrorHandler
    try {
      return await this.calculateOptimalSplitInternal(orderbook, size, direction);
    } catch (error) {
      this.safeLog('error', 'Split calculation failed', { error });
      return this.getSingleOrderSplit(size);
    }
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
    this.validateOrderbook(orderbook);

    if (direction !== 'buy' && direction !== 'sell') {
      throw new Error(`Invalid direction: ${direction}`);
    }

    // GRACEFUL_DEGRADE: Liquidity analysis
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.findBestLiquidityLevelInternal(orderbook, direction),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Liquidity level search failed, using market price', {
        direction,
      });
      return this.getMarketPriceLevel(orderbook, direction);
    }

    // Without ErrorHandler
    try {
      return await this.findBestLiquidityLevelInternal(orderbook, direction);
    } catch (error) {
      this.safeLog('error', 'Liquidity level search failed', { error });
      return this.getMarketPriceLevel(orderbook, direction);
    }
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
    this.validateOrderbook(orderbook);
    this.validateOrderParams(size, direction, price);

    // GRACEFUL_DEGRADE: Probability estimation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () =>
          this.estimateFillProbabilityInternal(orderbook, price, size, direction),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Fill probability estimation failed', {
        price,
        size,
        direction,
      });
      return this.getConservativeFillProbability(price, size);
    }

    // Without ErrorHandler
    try {
      return await this.estimateFillProbabilityInternal(
        orderbook,
        price,
        size,
        direction,
      );
    } catch (error) {
      this.safeLog('error', 'Fill probability estimation failed', { error });
      return this.getConservativeFillProbability(price, size);
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
    const conditions = this.analyzeMarketConditions(orderbook, direction);

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
          priority: this.determinePriority(conditions, fillProb.probability),
          fillProbability: fillProb.probability,
          estimatedFillTime: fillProb.expectedFillTime,
        },
      ];
      strategy = 'single';
    }

    // Calculate aggregated metrics
    const expectedFill = this.calculateExpectedFill(orders);
    const expectedSlippage = this.calculateExpectedSlippage(
      orderbook,
      orders,
      direction,
    );
    const estimatedTime = Math.max(...orders.map((o) => o.estimatedFillTime));
    const risk = this.assessRisk(expectedSlippage, expectedFill, conditions);

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
    const availableLiquidity = this.calculateAvailableLiquidity(levels);

    // Determine optimal number of splits
    const numSplits = Math.min(
      Math.ceil(size / this.config.maxOrderSize),
      levels.length,
      5, // Max 5 splits to avoid over-fragmentation
    );

    // Calculate sub-order sizes (weighted by liquidity)
    const subOrderSizes = this.calculateWeightedSplits(
      size,
      numSplits,
      levels,
    );

    // Estimate improvement
    const improvement = this.estimateSplitImprovement(
      size,
      subOrderSizes,
      availableLiquidity,
    );

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
      const score = this.calculateLiquidityScore(level, levels, i);
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
    const liquidity = this.calculateLiquidityFactor(levels, price, size);
    const aggressiveness = this.calculateAggressivenessFactor(
      price,
      marketPrice,
      direction,
    );
    const volatility = this.estimateVolatility(orderbook);
    const sizeImpact = this.calculateSizeImpactFactor(size, levels);

    // Combine factors to estimate probability
    const probability = this.combineProbabilityFactors(
      liquidity,
      aggressiveness,
      volatility,
      sizeImpact,
    );

    // Estimate fill time based on probability and market conditions
    const expectedFillTime = this.estimateFillTime(
      probability,
      size,
      levels,
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

  private analyzeMarketConditions(
    orderbook: Orderbook,
    direction: 'buy' | 'sell',
  ): MarketConditions {
    const bestBid =
      orderbook.bids.length > 0 ? orderbook.bids[0].price : 0;
    const bestAsk =
      orderbook.asks.length > 0 ? orderbook.asks[0].price : 0;
    const midPrice = (bestBid + bestAsk) / 2;

    const spreadBps =
      midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 10000 : 10000;

    const totalBidVolume = orderbook.bids.reduce(
      (sum, b) => sum + (Number.isFinite(b.volume) ? b.volume : 0),
      0,
    );
    const totalAskVolume = orderbook.asks.reduce(
      (sum, a) => sum + (Number.isFinite(a.volume) ? a.volume : 0),
      0,
    );

    const totalVolume = totalBidVolume + totalAskVolume;
    const imbalanceRatio =
      totalVolume > 0 ? (totalBidVolume - totalAskVolume) / totalVolume : 0;

    const liquidityScore = Math.min(
      100,
      Math.log10(totalVolume + 1) * 20,
    );

    const volatility = this.estimateVolatility(orderbook);

    const isFavorable =
      direction === 'buy' ? imbalanceRatio > 0.1 : imbalanceRatio < -0.1;

    return {
      spreadBps: Number.isFinite(spreadBps) ? spreadBps : 10000,
      volatility: Number.isFinite(volatility) ? volatility : 50,
      liquidityScore: Number.isFinite(liquidityScore) ? liquidityScore : 0,
      imbalanceRatio: Number.isFinite(imbalanceRatio) ? imbalanceRatio : 0,
      isFavorable,
    };
  }

  private determinePriority(
    conditions: MarketConditions,
    fillProbability: number,
  ): OrderPriority {
    if (!this.config.enableAdaptive) {
      return 'immediate';
    }

    // High probability + favorable conditions = patient
    if (fillProbability > 80 && conditions.isFavorable) {
      return 'patient';
    }

    // Low probability or unfavorable = immediate
    if (fillProbability < 50 || !conditions.isFavorable) {
      return 'immediate';
    }

    // Otherwise adaptive
    return 'adaptive';
  }

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

  private calculateExpectedFill(orders: SubOrder[]): number {
    if (orders.length === 0) return 0;

    const avgProbability =
      orders.reduce((sum, o) => sum + o.fillProbability, 0) / orders.length;

    return Math.min(100, avgProbability);
  }

  private calculateExpectedSlippage(
    orderbook: Orderbook,
    orders: SubOrder[],
    direction: 'buy' | 'sell',
  ): number {
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
    const marketPrice = levels.length > 0 ? levels[0].price : 0;

    if (marketPrice === 0 || orders.length === 0) return 1000; // High slippage estimate

    const totalSize = orders.reduce((sum, o) => sum + o.size, 0);
    let weightedSlippage = 0;

    for (const order of orders) {
      const slippageBps =
        (Math.abs(order.price - marketPrice) / marketPrice) * 10000;
      const weight = order.size / totalSize;
      weightedSlippage += slippageBps * weight;
    }

    return Number.isFinite(weightedSlippage) ? weightedSlippage : 1000;
  }

  private assessRisk(
    slippage: number,
    fillProbability: number,
    conditions: MarketConditions,
  ): 'low' | 'medium' | 'high' {
    // High slippage or low fill probability = high risk
    if (
      slippage > this.config.maxSlippageBps * 1.5 ||
      fillProbability < this.config.minFillProbability * 0.7
    ) {
      return 'high';
    }

    // Medium conditions
    if (
      slippage > this.config.maxSlippageBps ||
      fillProbability < this.config.minFillProbability ||
      conditions.volatility > 70
    ) {
      return 'medium';
    }

    return 'low';
  }

  private calculateAvailableLiquidity(
    levels: { price: number; volume: number }[],
  ): number {
    return levels.reduce(
      (sum, level) => sum + (Number.isFinite(level.volume) ? level.volume : 0),
      0,
    );
  }

  private calculateWeightedSplits(
    totalSize: number,
    numSplits: number,
    levels: { price: number; volume: number }[],
  ): number[] {
    if (numSplits <= 1) return [totalSize];

    const sizes: number[] = [];
    const topLevels = levels.slice(0, numSplits);
    const totalLiquidity = topLevels.reduce(
      (sum, l) => sum + (Number.isFinite(l.volume) ? l.volume : 0),
      0,
    );

    if (totalLiquidity === 0) {
      // Equal splits if no liquidity info
      const equalSize = totalSize / numSplits;
      return Array(numSplits).fill(equalSize);
    }

    // Weighted by available liquidity
    let remaining = totalSize;
    for (let i = 0; i < numSplits - 1; i++) {
      const volume = Number.isFinite(topLevels[i].volume)
        ? topLevels[i].volume
        : 0;
      const weight = volume / totalLiquidity;
      const size = Math.min(totalSize * weight, remaining);
      sizes.push(size);
      remaining -= size;
    }

    // Last split gets remainder
    sizes.push(Math.max(0, remaining));

    return sizes;
  }

  private estimateSplitImprovement(
    originalSize: number,
    subOrderSizes: number[],
    availableLiquidity: number,
  ): OrderSplit['improvement'] {
    // Simple heuristic: smaller orders = less slippage
    const avgSubOrderSize =
      subOrderSizes.reduce((sum, s) => sum + s, 0) / subOrderSizes.length;
    const sizeRatio = avgSubOrderSize / originalSize;

    const slippageReduction = (1 - sizeRatio) * 50; // Up to 50 bps reduction
    const fillProbabilityIncrease = (1 - sizeRatio) * 20; // Up to 20% increase
    const impactReduction = (1 - sizeRatio) * 30; // Up to 30% impact reduction

    return {
      slippageReduction: Math.max(0, slippageReduction),
      fillProbabilityIncrease: Math.max(0, fillProbabilityIncrease),
      impactReduction: Math.max(0, impactReduction),
    };
  }

  private calculateLiquidityScore(
    level: { price: number; volume: number },
    allLevels: { price: number; volume: number }[],
    index: number,
  ): number {
    const totalVolume = this.calculateAvailableLiquidity(allLevels);
    if (totalVolume === 0) return 0;

    const volumeScore = (level.volume / totalVolume) * 100;
    const depthPenalty = index * 2; // Penalty for deeper levels

    const finalScore = Math.max(0, volumeScore - depthPenalty);
    return Number.isFinite(finalScore) ? Math.min(100, finalScore) : 0;
  }

  private calculateLiquidityFactor(
    levels: { price: number; volume: number }[],
    targetPrice: number,
    orderSize: number,
  ): number {
    // Find available volume at or better than target price
    let availableVolume = 0;
    for (const level of levels) {
      if (level.price <= targetPrice) {
        availableVolume += Number.isFinite(level.volume) ? level.volume : 0;
      }
    }

    if (orderSize === 0) return 100;

    const ratio = availableVolume / orderSize;
    return Math.min(100, ratio * 100);
  }

  private calculateAggressivenessFactor(
    orderPrice: number,
    marketPrice: number,
    direction: 'buy' | 'sell',
  ): number {
    if (marketPrice === 0) return 50;

    const priceDiff = direction === 'buy'
      ? orderPrice - marketPrice
      : marketPrice - orderPrice;

    const diffBps = (priceDiff / marketPrice) * 10000;

    // More aggressive (better price) = higher score
    // 0 bps = 0 (at market), 100 bps = 50, 500 bps = 100
    const score = Math.min(100, Math.max(0, diffBps / 5));

    return Number.isFinite(score) ? score : 50;
  }

  private estimateVolatility(orderbook: Orderbook): number {
    // Simple volatility estimate based on spread
    const bestBid =
      orderbook.bids.length > 0 ? orderbook.bids[0].price : 0;
    const bestAsk =
      orderbook.asks.length > 0 ? orderbook.asks[0].price : 0;
    const midPrice = (bestBid + bestAsk) / 2;

    if (midPrice === 0) return 50;

    const spreadBps = ((bestAsk - bestBid) / midPrice) * 10000;

    // Wider spread = higher volatility
    // 10 bps = 20, 50 bps = 50, 100 bps = 70, 200+ bps = 100
    const volatility = Math.min(100, 20 + spreadBps / 2);

    return Number.isFinite(volatility) ? volatility : 50;
  }

  private calculateSizeImpactFactor(
    orderSize: number,
    levels: { price: number; volume: number }[],
  ): number {
    const availableLiquidity = this.calculateAvailableLiquidity(levels);

    if (availableLiquidity === 0) return 0;

    const ratio = orderSize / availableLiquidity;

    // Smaller ratio = higher score (less impact)
    // 0.01 = 100, 0.1 = 75, 0.5 = 50, 1.0+ = 0
    const score = Math.max(0, 100 - ratio * 100);

    return Number.isFinite(score) ? score : 50;
  }

  private combineProbabilityFactors(
    liquidity: number,
    aggressiveness: number,
    volatility: number,
    sizeImpact: number,
  ): number {
    // Weighted combination
    const weights = {
      liquidity: 0.4,
      aggressiveness: 0.2,
      volatility: 0.2,
      sizeImpact: 0.2,
    };

    // Lower volatility = higher probability
    const volatilityScore = 100 - volatility;

    const probability =
      liquidity * weights.liquidity +
      aggressiveness * weights.aggressiveness +
      volatilityScore * weights.volatility +
      sizeImpact * weights.sizeImpact;

    return Number.isFinite(probability) ? Math.min(100, Math.max(0, probability)) : 50;
  }

  private estimateFillTime(
    probability: number,
    size: number,
    levels: { price: number; volume: number }[],
  ): number {
    // Base time from config
    const baseTime = this.config.executionTimeHorizon;

    // Adjust by probability: lower probability = longer time
    const probabilityFactor = 100 / Math.max(1, probability);

    // Adjust by size: larger orders take longer
    const totalLiquidity = this.calculateAvailableLiquidity(levels);
    const sizeFactor = totalLiquidity > 0 ? size / totalLiquidity : 1;

    const estimatedTime = baseTime * probabilityFactor * (1 + sizeFactor);

    return Number.isFinite(estimatedTime) ? Math.min(estimatedTime, baseTime * 10) : baseTime;
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
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
    const marketPrice =
      levels.length > 0 && Number.isFinite(levels[0].price)
        ? levels[0].price
        : targetPrice || 0;

    return {
      totalSize: size,
      targetPrice: targetPrice || null,
      direction,
      orders: [
        {
          price: targetPrice || marketPrice,
          size,
          priority: 'immediate',
          fillProbability: 50, // Conservative estimate
          estimatedFillTime: this.config.executionTimeHorizon,
        },
      ],
      expectedFill: 50,
      expectedSlippage: this.config.maxSlippageBps * 2, // Conservative
      estimatedTime: this.config.executionTimeHorizon,
      strategy: 'single',
      risk: 'high',
    };
  }

  private getSingleOrderSplit(size: number): OrderSplit {
    return {
      originalSize: size,
      subOrderSizes: [size],
      reason: 'size',
      improvement: {
        slippageReduction: 0,
        fillProbabilityIncrease: 0,
        impactReduction: 0,
      },
    };
  }

  private getMarketPriceLevel(
    orderbook: Orderbook,
    direction: 'buy' | 'sell',
  ): LiquidityLevel {
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
    const marketPrice =
      levels.length > 0 && Number.isFinite(levels[0].price)
        ? levels[0].price
        : 0;
    const volume =
      levels.length > 0 && Number.isFinite(levels[0].volume)
        ? levels[0].volume
        : 0;

    return {
      price: marketPrice,
      volume,
      score: 50,
      distanceBps: 0,
      isOptimal: true,
    };
  }

  private getConservativeFillProbability(
    price: number,
    size: number,
  ): FillProbability {
    return {
      orderSize: size,
      price,
      probability: 50, // Conservative estimate
      factors: {
        liquidity: 50,
        aggressiveness: 50,
        volatility: 50,
        sizeImpact: 50,
      },
      expectedFillTime: this.config.executionTimeHorizon,
    };
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
    meta?: any,
  ): void {
    if (this.errorHandler) {
      this.errorHandler.handle(
        () => {
          if (level === 'error') this.logger.error(message, meta);
          else if (level === 'warn') this.logger.warn(message, meta);
          else this.logger.info(message, meta);
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
