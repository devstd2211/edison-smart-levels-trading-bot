/**
 * Smart Order Placement Types (Phase 10.1.3)
 *
 * Intelligent order placement to minimize slippage and maximize fill rates:
 * - Optimal order splitting for large sizes
 * - Liquidity-aware placement strategies
 * - Adaptive execution based on market conditions
 * - Fill probability estimation
 */

import type { Orderbook } from '../liquidity-heatmap';

/**
 * Configuration for SmartOrderPlacementService
 */
export interface SmartOrderPlacementConfig {
  /**
   * Maximum order size before splitting (in base currency)
   * Orders larger than this will be split into smaller chunks
   * Default: 10.0
   */
  maxOrderSize: number;

  /**
   * Maximum acceptable slippage (basis points)
   * Default: 50 (0.5%)
   */
  maxSlippageBps: number;

  /**
   * Minimum fill probability threshold (0-100)
   * Orders with lower probability won't be placed
   * Default: 80
   */
  minFillProbability: number;

  /**
   * Number of price levels to analyze for placement
   * Default: 20
   */
  analyzeLevels: number;

  /**
   * Enable adaptive execution strategies
   * Default: true
   */
  enableAdaptive: boolean;

  /**
   * Time horizon for execution (ms)
   * Default: 60000 (1 minute)
   */
  executionTimeHorizon: number;
}

/**
 * Order execution priority level
 */
export type OrderPriority = 'immediate' | 'patient' | 'adaptive';

/**
 * Individual sub-order in a split order plan
 */
export interface SubOrder {
  /**
   * Price level for this sub-order
   */
  price: number;

  /**
   * Size of this sub-order
   */
  size: number;

  /**
   * Execution priority
   */
  priority: OrderPriority;

  /**
   * Expected fill probability (0-100)
   */
  fillProbability: number;

  /**
   * Estimated time to fill (ms)
   */
  estimatedFillTime: number;
}

/**
 * Complete smart order execution plan
 */
export interface SmartOrderPlan {
  /**
   * Original order size
   */
  totalSize: number;

  /**
   * Target price (can be null for market orders)
   */
  targetPrice: number | null;

  /**
   * Order direction
   */
  direction: 'buy' | 'sell';

  /**
   * Split sub-orders
   */
  orders: SubOrder[];

  /**
   * Expected overall fill percentage
   */
  expectedFill: number;

  /**
   * Expected overall slippage (basis points)
   */
  expectedSlippage: number;

  /**
   * Estimated total execution time (ms)
   */
  estimatedTime: number;

  /**
   * Recommended execution strategy
   */
  strategy: 'single' | 'split' | 'iceberg' | 'twap' | 'vwap';

  /**
   * Risk assessment
   */
  risk: 'low' | 'medium' | 'high';
}

/**
 * Liquidity level analysis result
 */
export interface LiquidityLevel {
  /**
   * Price at this level
   */
  price: number;

  /**
   * Available volume at this level
   */
  volume: number;

  /**
   * Liquidity score (0-100)
   */
  score: number;

  /**
   * Distance from current market price (bps)
   */
  distanceBps: number;

  /**
   * Is this level considered optimal for placement?
   */
  isOptimal: boolean;
}

/**
 * Fill probability estimate
 */
export interface FillProbability {
  /**
   * Order size being analyzed
   */
  orderSize: number;

  /**
   * Price level
   */
  price: number;

  /**
   * Fill probability (0-100)
   */
  probability: number;

  /**
   * Factors affecting probability
   */
  factors: {
    /**
     * Liquidity factor (0-100)
     */
    liquidity: number;

    /**
     * Price aggressiveness factor (0-100)
     * 100 = very aggressive (far from market), 0 = passive (at market)
     */
    aggressiveness: number;

    /**
     * Market volatility factor (0-100)
     */
    volatility: number;

    /**
     * Order size factor (0-100)
     * 100 = small order, 0 = very large order
     */
    sizeImpact: number;
  };

  /**
   * Expected time to fill (ms)
   */
  expectedFillTime: number;
}

/**
 * Order splitting recommendation
 */
export interface OrderSplit {
  /**
   * Original order size
   */
  originalSize: number;

  /**
   * Recommended sub-order sizes
   */
  subOrderSizes: number[];

  /**
   * Reason for splitting
   */
  reason: 'size' | 'liquidity' | 'slippage' | 'risk';

  /**
   * Expected improvement vs single order
   */
  improvement: {
    /**
     * Slippage reduction (bps)
     */
    slippageReduction: number;

    /**
     * Fill probability increase (percentage points)
     */
    fillProbabilityIncrease: number;

    /**
     * Market impact reduction (percentage)
     */
    impactReduction: number;
  };
}

/**
 * Market conditions snapshot
 */
export interface MarketConditions {
  /**
   * Current spread (bps)
   */
  spreadBps: number;

  /**
   * Estimated volatility (based on recent price movement)
   */
  volatility: number;

  /**
   * Liquidity depth score (0-100)
   */
  liquidityScore: number;

  /**
   * Bid/ask imbalance ratio (-1 to 1)
   */
  imbalanceRatio: number;

  /**
   * Is market favorable for this order direction?
   */
  isFavorable: boolean;
}
