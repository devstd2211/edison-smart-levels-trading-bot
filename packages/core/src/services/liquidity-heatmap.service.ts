/**
 * Liquidity Heatmap Service (Phase 10.1.2)
 *
 * Analyzes orderbook liquidity distribution to identify:
 * - Support/Resistance levels based on order clustering
 * - Liquidity zones with strength scoring (0-100)
 * - Slippage estimation for different order sizes
 * - Execution cost calculation
 *
 * Error Handling:
 * - THROW: Config validation, orderbook validation
 * - GRACEFUL_DEGRADE: Calculation failures (return safe defaults)
 * - SKIP: Logger failures (non-blocking)
 */

import {
  LiquidityHeatmapConfig,
  Orderbook,
  LiquidityHeatmapOrderbookLevel as OrderbookLevel,
  LiquidityHeatmapZone as LiquidityZone,
  LiquidityHeatmap,
  SupportResistanceLevels,
  SlippageEstimate,
  ExecutionCost,
} from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { LoggerService, LiquidityAnalysisConfig } from '../types/legacy';
import {
  DEFAULT_LIQUIDITY_ANALYSIS,
  LIQUIDITY_HEATMAP_TECHNICAL,
} from '../constants/phase-10-constants';

/**
 * LiquidityHeatmapService - Orderbook liquidity analysis with ErrorHandler integration
 *
 * Modular Design:
 * - Each analysis can be used independently (buildHeatmap, findSupportResistance, etc.)
 * - Config-driven feature enablement
 * - Backward compatible (works without ErrorHandler)
 */
export class LiquidityHeatmapService {
  private strategicConfig: LiquidityAnalysisConfig;

  constructor(
    private config: LiquidityHeatmapConfig,
    strategicConfig?: LiquidityAnalysisConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // Merge strategic config with defaults
    this.strategicConfig = { ...DEFAULT_LIQUIDITY_ANALYSIS, ...strategicConfig };

    // THROW: Config validation OUTSIDE try-catch
    this.validateConfig(config);

    // Safe logging (SKIP strategy)
    this.safeLog('info', 'LiquidityHeatmapService initialized', {
      maxLevels: config.maxLevels,
      minStrengthThreshold: config.minStrengthThreshold,
      clusteringTolerance: config.clusteringTolerance,
      strategicThresholds: this.strategicConfig,
    });
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate configuration (THROW strategy)
   * Called during construction - validation errors bubble up
   */
  private validateConfig(config: LiquidityHeatmapConfig): void {
    // THROW: null/undefined config
    if (!config) {
      throw new Error('LiquidityHeatmapConfig cannot be null or undefined');
    }

    // THROW: Invalid maxLevels
    if (!Number.isFinite(config.maxLevels) || config.maxLevels <= 0) {
      throw new Error(
        `Invalid maxLevels: ${config.maxLevels} (must be positive number)`,
      );
    }

    // THROW: Invalid minStrengthThreshold
    if (
      !Number.isFinite(config.minStrengthThreshold) ||
      config.minStrengthThreshold < 0 ||
      config.minStrengthThreshold > 100
    ) {
      throw new Error(
        `Invalid minStrengthThreshold: ${config.minStrengthThreshold} (must be 0-100)`,
      );
    }

    // THROW: Invalid clusteringTolerance
    if (
      !Number.isFinite(config.clusteringTolerance) ||
      config.clusteringTolerance <= 0
    ) {
      throw new Error(
        `Invalid clusteringTolerance: ${config.clusteringTolerance} (must be positive)`,
      );
    }
  }

  /**
   * Validate orderbook data (THROW strategy)
   */
  private validateOrderbook(orderbook: Orderbook): void {
    // THROW: null/undefined orderbook
    if (!orderbook) {
      throw new Error('Orderbook cannot be null or undefined');
    }

    // THROW: Missing required fields
    if (!orderbook.symbol || typeof orderbook.symbol !== 'string') {
      throw new Error('Orderbook must have valid symbol');
    }

    if (!Number.isFinite(orderbook.timestamp)) {
      throw new Error('Orderbook must have valid timestamp');
    }

    // THROW: Missing bids/asks
    if (!Array.isArray(orderbook.bids)) {
      throw new Error('Orderbook must have bids array');
    }

    if (!Array.isArray(orderbook.asks)) {
      throw new Error('Orderbook must have asks array');
    }
  }

  /**
   * Validate orderbook data quality (THROW on corrupt data)
   * Called during calculation - throws on NaN/Infinity values
   */
  private validateOrderbookData(orderbook: Orderbook): void {
    // Check bid data quality
    let invalidBids = 0;
    for (const bid of orderbook.bids) {
      if (!Number.isFinite(bid.price) || !Number.isFinite(bid.volume)) {
        invalidBids++;
      }
    }

    // Check ask data quality
    let invalidAsks = 0;
    for (const ask of orderbook.asks) {
      if (!Number.isFinite(ask.price) || !Number.isFinite(ask.volume)) {
        invalidAsks++;
      }
    }

    // If more than 50% of data is corrupt, throw error
    const totalLevels = orderbook.bids.length + orderbook.asks.length;
    const invalidLevels = invalidBids + invalidAsks;

    if (totalLevels > 0 && invalidLevels / totalLevels > LIQUIDITY_HEATMAP_TECHNICAL.QUALITY.CORRUPT_DATA_THRESHOLD) {
      throw new Error(
        `Orderbook data is corrupt (${invalidLevels}/${totalLevels} invalid levels)`,
      );
    }
  }

  // ==========================================================================
  // PUBLIC API - MAIN ANALYSIS
  // ==========================================================================

  /**
   * Build complete liquidity heatmap from orderbook
   * GRACEFUL_DEGRADE: Returns safe default on calculation failure
   */
  async buildLiquidityHeatmap(
    orderbook: Orderbook,
  ): Promise<LiquidityHeatmap> {
    // THROW: Input validation OUTSIDE try-catch
    this.validateOrderbook(orderbook);

    // GRACEFUL_DEGRADE: Heatmap calculation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.buildHeatmapInternal(orderbook),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      // Fallback to safe default
      this.safeLog('warn', 'Heatmap calculation failed, using safe default', {
        symbol: orderbook.symbol,
      });
      return this.getSafeDefaultHeatmap(orderbook);
    }

    // Without ErrorHandler
    try {
      return await this.buildHeatmapInternal(orderbook);
    } catch (error) {
      this.safeLog('error', 'Heatmap calculation failed (no ErrorHandler)', {
        error,
      });
      return this.getSafeDefaultHeatmap(orderbook);
    }
  }

  /**
   * Find support and resistance levels
   * GRACEFUL_DEGRADE: Returns empty levels on failure
   */
  async findSupportResistance(
    orderbook: Orderbook,
  ): Promise<SupportResistanceLevels> {
    // THROW: Input validation
    this.validateOrderbook(orderbook);

    if (!this.config.enableSupportResistance) {
      return { support: [], resistance: [], confidence: 0 };
    }

    // GRACEFUL_DEGRADE: Calculation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.findSupportResistanceInternal(orderbook),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Support/Resistance detection failed', {
        symbol: orderbook.symbol,
      });
      return { support: [], resistance: [], confidence: 0 };
    }

    // Without ErrorHandler
    try {
      return await this.findSupportResistanceInternal(orderbook);
    } catch (error) {
      this.safeLog('error', 'Support/Resistance detection failed', { error });
      return { support: [], resistance: [], confidence: 0 };
    }
  }

  /**
   * Calculate slippage for given order size and direction
   * GRACEFUL_DEGRADE: Returns pessimistic estimate on failure
   */
  async calculateSlippageForSize(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
  ): Promise<SlippageEstimate> {
    // THROW: Input validation
    this.validateOrderbook(orderbook);

    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid order size: ${size} (must be positive)`);
    }

    if (direction !== 'buy' && direction !== 'sell') {
      throw new Error(`Invalid direction: ${direction} (must be 'buy' or 'sell')`);
    }

    if (!this.config.enableSlippageCalc) {
      return this.getSafeDefaultSlippage(orderbook, size, direction);
    }

    // GRACEFUL_DEGRADE: Calculation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.calculateSlippageInternal(orderbook, size, direction),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Slippage calculation failed', {
        symbol: orderbook.symbol,
        size,
        direction,
      });
      return this.getSafeDefaultSlippage(orderbook, size, direction);
    }

    // Without ErrorHandler
    try {
      return await this.calculateSlippageInternal(orderbook, size, direction);
    } catch (error) {
      this.safeLog('error', 'Slippage calculation failed', { error });
      return this.getSafeDefaultSlippage(orderbook, size, direction);
    }
  }

  /**
   * Estimate execution cost for order
   * GRACEFUL_DEGRADE: Returns conservative estimate on failure
   */
  async estimateExecutionCost(
    orderbook: Orderbook,
    size: number,
  ): Promise<ExecutionCost> {
    // THROW: Input validation
    this.validateOrderbook(orderbook);

    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid order size: ${size} (must be positive)`);
    }

    if (!this.config.enableExecutionCost) {
      return this.getSafeDefaultExecutionCost(size);
    }

    // GRACEFUL_DEGRADE: Calculation
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => this.estimateExecutionCostInternal(orderbook, size),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Execution cost estimation failed', {
        symbol: orderbook.symbol,
        size,
      });
      return this.getSafeDefaultExecutionCost(size);
    }

    // Without ErrorHandler
    try {
      return await this.estimateExecutionCostInternal(orderbook, size);
    } catch (error) {
      this.safeLog('error', 'Execution cost estimation failed', { error });
      return this.getSafeDefaultExecutionCost(size);
    }
  }

  // ==========================================================================
  // INTERNAL CALCULATION METHODS
  // ==========================================================================

  private async buildHeatmapInternal(
    orderbook: Orderbook,
  ): Promise<LiquidityHeatmap> {
    // Validate orderbook data quality (throw on corrupt data)
    this.validateOrderbookData(orderbook);

    // Analyze liquidity zones
    const bidZones = this.analyzeLiquidityZones(orderbook.bids, 'bid');
    const askZones = this.analyzeLiquidityZones(orderbook.asks, 'ask');
    const allZones = [...bidZones, ...askZones];

    // Calculate support/resistance if enabled
    let supportResistance: SupportResistanceLevels | null = null;
    if (this.config.enableSupportResistance) {
      supportResistance = await this.findSupportResistanceInternal(orderbook);
    }

    // Calculate metrics
    const totalBidDepth = this.calculateTotalDepth(orderbook.bids);
    const totalAskDepth = this.calculateTotalDepth(orderbook.asks);
    const imbalanceRatio = this.calculateImbalanceRatio(
      totalBidDepth,
      totalAskDepth,
    );
    const spreadBps = this.calculateSpread(orderbook);
    const liquidityScore = this.calculateLiquidityScore(
      totalBidDepth,
      totalAskDepth,
      spreadBps,
      allZones.length,
    );

    return {
      symbol: orderbook.symbol,
      timestamp: orderbook.timestamp,
      zones: allZones,
      supportResistance,
      spreadBps,
      totalBidDepth,
      totalAskDepth,
      imbalanceRatio,
      liquidityScore,
    };
  }

  private analyzeLiquidityZones(
    levels: OrderbookLevel[],
    side: 'bid' | 'ask',
  ): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    const maxLevels = Math.min(levels.length, this.config.maxLevels);

    for (let i = 0; i < maxLevels; i++) {
      const level = levels[i];

      // Calculate strength (0-100)
      const strength = this.calculateZoneStrength(level, levels, i);

      // Only include zones above threshold
      if (strength >= this.config.minStrengthThreshold) {
        zones.push({
          priceLevel: level.price,
          strength,
          depthAtPrice: level.volume,
          orderClusterSize: level.orderCount || 1,
          timeToMove: this.estimateTimeToMove(level.volume),
          side,
          type: this.classifyZoneType(strength, side),
        });
      }
    }

    return zones;
  }

  private calculateZoneStrength(
    level: OrderbookLevel,
    allLevels: OrderbookLevel[],
    index: number,
  ): number {
    // Filter valid volumes and calculate total
    const totalVolume = allLevels.reduce((sum, l) => {
      const vol = Number.isFinite(l.volume) ? l.volume : 0;
      return sum + vol;
    }, 0);

    if (totalVolume === 0) return 0;

    // Safe level volume
    const safeVolume = Number.isFinite(level.volume) ? level.volume : 0;

    // Base strength from volume percentage
    const volumeStrength = (safeVolume / totalVolume) * 100;

    // Bonus for order clustering (increased multiplier for stronger zones)
    const clusterBonus = level.orderCount ? Math.min(level.orderCount * LIQUIDITY_HEATMAP_TECHNICAL.STRENGTH.CLUSTER_BONUS_MULTIPLIER, LIQUIDITY_HEATMAP_TECHNICAL.STRENGTH.MAX_CLUSTER_BONUS) : 0;

    // Penalty for being far from top of book (reduced penalty)
    const distancePenalty = index * LIQUIDITY_HEATMAP_TECHNICAL.STRENGTH.DISTANCE_PENALTY_PER_LEVEL;

    const rawStrength = volumeStrength + clusterBonus - distancePenalty;

    // Ensure result is not NaN
    const finalStrength = Number.isFinite(rawStrength) ? rawStrength : 0;
    return Math.max(0, Math.min(100, finalStrength));
  }

  private classifyZoneType(
    strength: number,
    side: 'bid' | 'ask',
  ): 'support' | 'resistance' | 'neutral' {
    // Lowered threshold to allow more zones to be classified
    if (strength < this.strategicConfig.neutralZoneThreshold) return 'neutral';
    return side === 'bid' ? 'support' : 'resistance';
  }

  private estimateTimeToMove(volume: number): number {
    // Simple estimate: 1ms per unit of volume
    // In reality, this would use historical trade velocity
    return Math.max(100, volume * 10);
  }

  private async findSupportResistanceInternal(
    orderbook: Orderbook,
  ): Promise<SupportResistanceLevels> {
    const bidZones = this.analyzeLiquidityZones(orderbook.bids, 'bid');
    const askZones = this.analyzeLiquidityZones(orderbook.asks, 'ask');

    // Find strongest support levels (bids)
    const support = bidZones
      .filter((z) => z.type === 'support')
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5)
      .map((z) => z.priceLevel);

    // Find strongest resistance levels (asks)
    const resistance = askZones
      .filter((z) => z.type === 'resistance')
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5)
      .map((z) => z.priceLevel);

    // Calculate confidence based on strength of identified levels
    const allZones = [...bidZones, ...askZones];
    const totalZones = allZones.length;

    let avgStrength = 0;
    if (totalZones > 0) {
      const totalStrength = allZones.reduce((sum, z) => sum + z.strength, 0);
      avgStrength = totalStrength / totalZones;
    }

    const finalConfidence = Number.isFinite(avgStrength) ? avgStrength : 0;

    return {
      support,
      resistance,
      confidence: Math.min(100, finalConfidence),
    };
  }

  private async calculateSlippageInternal(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
  ): Promise<SlippageEstimate> {
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;

    if (levels.length === 0) {
      throw new Error('No liquidity available in orderbook');
    }

    // Validate data quality
    const validLevels = levels.filter(
      (l) => Number.isFinite(l.price) && Number.isFinite(l.volume),
    );

    if (validLevels.length === 0) {
      throw new Error('No valid price/volume data in orderbook');
    }

    const bestPrice = validLevels[0].price;
    let remainingSize = size;
    let totalCost = 0;
    let worstPrice = bestPrice;
    let fillablePercent = 0;

    // Walk through valid orderbook levels
    for (const level of validLevels) {
      const fillSize = Math.min(remainingSize, level.volume);
      totalCost += fillSize * level.price;
      remainingSize -= fillSize;
      worstPrice = level.price;

      if (remainingSize <= 0) {
        fillablePercent = 100;
        break;
      }
    }

    // Calculate fillable percentage
    if (remainingSize > 0) {
      fillablePercent = ((size - remainingSize) / size) * 100;
    }

    // Avoid division by zero: if no size was filled, use bestPrice as fallback
    const filledSize = size - remainingSize;
    const avgExecutionPrice = filledSize > 0 ? totalCost / filledSize : bestPrice;
    const slippageBps =
      bestPrice > 0 ? ((Math.abs(avgExecutionPrice - bestPrice) / bestPrice) * 10000) : 0;

    return {
      orderSize: size,
      direction,
      slippageBps,
      avgExecutionPrice,
      bestPrice,
      worstPrice,
      fillablePercent,
    };
  }

  private async estimateExecutionCostInternal(
    orderbook: Orderbook,
    size: number,
  ): Promise<ExecutionCost> {
    // Use buy slippage as conservative estimate
    const slippage = await this.calculateSlippageInternal(
      orderbook,
      size,
      'buy',
    );

    const totalCost = slippage.avgExecutionPrice * size;
    const estimatedFee = totalCost * 0.0006; // 0.06% typical maker/taker fee
    const slippageCost = (slippage.slippageBps / 10000) * totalCost;
    const marketImpactCost = slippageCost * 0.5; // 50% of slippage attributed to impact

    return {
      orderSize: size,
      totalCost,
      estimatedFee,
      slippageCost,
      marketImpactCost,
      totalCostPercent: ((estimatedFee + slippageCost) / totalCost) * 100,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private calculateTotalDepth(levels: OrderbookLevel[]): number {
    return levels.reduce((sum, level) => {
      // Filter out NaN/Infinity values
      const volume = Number.isFinite(level.volume) ? level.volume : 0;
      return sum + volume;
    }, 0);
  }

  private calculateImbalanceRatio(
    bidDepth: number,
    askDepth: number,
  ): number {
    const total = bidDepth + askDepth;
    if (total === 0) return 0;
    return (bidDepth - askDepth) / total;
  }

  private calculateSpread(orderbook: Orderbook): number {
    if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return LIQUIDITY_HEATMAP_TECHNICAL.SPREAD.VERY_WIDE_SPREAD_BPS; // Very wide spread
    }

    const bestBid = orderbook.bids[0].price;
    const bestAsk = orderbook.asks[0].price;

    // Handle NaN/Infinity prices
    if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
      return LIQUIDITY_HEATMAP_TECHNICAL.SPREAD.VERY_WIDE_SPREAD_BPS; // Very wide spread
    }

    const midPrice = (bestBid + bestAsk) / 2;
    if (midPrice === 0) return LIQUIDITY_HEATMAP_TECHNICAL.SPREAD.VERY_WIDE_SPREAD_BPS;

    const spread = ((bestAsk - bestBid) / midPrice) * 10000;

    return Number.isFinite(spread) ? spread : LIQUIDITY_HEATMAP_TECHNICAL.SPREAD.VERY_WIDE_SPREAD_BPS;
  }

  private calculateLiquidityScore(
    bidDepth: number,
    askDepth: number,
    spreadBps: number,
    zoneCount: number,
  ): number {
    // Handle NaN/Infinity in inputs
    const safeBidDepth = Number.isFinite(bidDepth) ? bidDepth : 0;
    const safeAskDepth = Number.isFinite(askDepth) ? askDepth : 0;
    const safeSpreadBps = Number.isFinite(spreadBps) ? spreadBps : LIQUIDITY_HEATMAP_TECHNICAL.SPREAD.VERY_WIDE_SPREAD_BPS;
    const safeZoneCount = Number.isFinite(zoneCount) ? zoneCount : 0;

    const totalDepth = safeBidDepth + safeAskDepth;

    // Higher depth = higher score
    const depthScore = Math.min(50, Math.log10(totalDepth + 1) * 10);

    // Tighter spread = higher score
    const spreadScore = Math.max(0, 30 - safeSpreadBps / 10);

    // More zones = higher score
    const zoneScore = Math.min(20, safeZoneCount * 2);

    const finalScore = depthScore + spreadScore + zoneScore;

    // Ensure result is not NaN
    return Number.isFinite(finalScore) ? Math.min(100, finalScore) : 0;
  }

  // ==========================================================================
  // SAFE DEFAULTS
  // ==========================================================================

  private getSafeDefaultHeatmap(orderbook: Orderbook): LiquidityHeatmap {
    return {
      symbol: orderbook.symbol,
      timestamp: orderbook.timestamp,
      zones: [],
      supportResistance: null,
      spreadBps: LIQUIDITY_HEATMAP_TECHNICAL.SPREAD.VERY_WIDE_SPREAD_BPS,
      totalBidDepth: 0,
      totalAskDepth: 0,
      imbalanceRatio: 0,
      liquidityScore: 0,
    };
  }

  private getSafeDefaultSlippage(
    orderbook: Orderbook,
    size: number,
    direction: 'buy' | 'sell',
  ): SlippageEstimate {
    const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;

    // Find first valid price
    let bestPrice = 0;
    for (const level of levels) {
      if (Number.isFinite(level.price) && level.price > 0) {
        bestPrice = level.price;
        break;
      }
    }

    return {
      orderSize: size,
      direction,
      slippageBps: 1000, // 10% pessimistic estimate
      avgExecutionPrice: bestPrice,
      bestPrice,
      worstPrice: bestPrice,
      fillablePercent: 0,
    };
  }

  private getSafeDefaultExecutionCost(size: number): ExecutionCost {
    return {
      orderSize: size,
      totalCost: 0,
      estimatedFee: 0,
      slippageCost: 0,
      marketImpactCost: 0,
      totalCostPercent: 100, // Conservative 100% cost estimate
    };
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  /**
   * Safe logging wrapper (SKIP strategy)
   * Logging failures are non-blocking
   */
  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: any,
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
      // Fallback: try-catch for backward compatibility
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

