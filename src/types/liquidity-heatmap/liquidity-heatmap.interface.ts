/**
 * Liquidity Heatmap Types (Phase 10.1.2)
 *
 * Analyzes orderbook liquidity distribution to identify:
 * - Support/Resistance levels based on order clustering
 * - Liquidity zones with strength scoring
 * - Slippage estimation for order sizes
 * - Execution cost calculation
 */

/**
 * Configuration for LiquidityHeatmapService
 */
export interface LiquidityHeatmapConfig {
  /**
   * Number of price levels to analyze (depth)
   * Default: 50
   */
  maxLevels: number;

  /**
   * Minimum strength threshold for a zone to be considered significant (0-100)
   * Default: 30
   */
  minStrengthThreshold: number;

  /**
   * Price clustering tolerance (percentage)
   * Orders within this % are considered same zone
   * Default: 0.1 (0.1%)
   */
  clusteringTolerance: number;

  /**
   * Enable support/resistance detection
   * Default: true
   */
  enableSupportResistance: boolean;

  /**
   * Enable slippage calculation
   * Default: true
   */
  enableSlippageCalc: boolean;

  /**
   * Enable execution cost estimation
   * Default: true
   */
  enableExecutionCost: boolean;
}

/**
 * Single price level in the orderbook
 */
export interface OrderbookLevel {
  price: number;
  volume: number;
  orderCount?: number; // Optional: number of orders at this level
}

/**
 * Full orderbook snapshot
 */
export interface Orderbook {
  symbol: string;
  timestamp: number;
  bids: OrderbookLevel[]; // Sorted descending by price
  asks: OrderbookLevel[]; // Sorted ascending by price
}

/**
 * Liquidity zone with strength metrics
 */
export interface LiquidityZone {
  /**
   * Price level (mid-point of cluster)
   */
  priceLevel: number;

  /**
   * Strength of liquidity (0-100)
   * Based on volume, order count, and depth
   */
  strength: number;

  /**
   * Total depth at this price level
   */
  depthAtPrice: number;

  /**
   * Number of orders clustered at this level
   */
  orderClusterSize: number;

  /**
   * Estimated time to move price through this zone (ms)
   * Based on average volume and current market conditions
   */
  timeToMove: number;

  /**
   * Side of the orderbook
   */
  side: 'bid' | 'ask';

  /**
   * Zone type classification
   */
  type: 'support' | 'resistance' | 'neutral';
}

/**
 * Support/Resistance levels identified from liquidity
 */
export interface SupportResistanceLevels {
  /**
   * Support levels (price levels with strong buying pressure)
   * Sorted by strength (strongest first)
   */
  support: number[];

  /**
   * Resistance levels (price levels with strong selling pressure)
   * Sorted by strength (strongest first)
   */
  resistance: number[];

  /**
   * Confidence in these levels (0-100)
   */
  confidence: number;
}

/**
 * Slippage calculation result
 */
export interface SlippageEstimate {
  /**
   * Order size being analyzed
   */
  orderSize: number;

  /**
   * Order direction
   */
  direction: 'buy' | 'sell';

  /**
   * Expected slippage (basis points)
   */
  slippageBps: number;

  /**
   * Average execution price
   */
  avgExecutionPrice: number;

  /**
   * Best price available (top of book)
   */
  bestPrice: number;

  /**
   * Worst price in execution path
   */
  worstPrice: number;

  /**
   * Percentage of order that can be filled at current liquidity
   */
  fillablePercent: number;
}

/**
 * Execution cost estimate
 */
export interface ExecutionCost {
  /**
   * Order size
   */
  orderSize: number;

  /**
   * Total cost in quote currency
   */
  totalCost: number;

  /**
   * Fee estimate
   */
  estimatedFee: number;

  /**
   * Slippage cost
   */
  slippageCost: number;

  /**
   * Market impact cost
   */
  marketImpactCost: number;

  /**
   * Total cost as percentage of order value
   */
  totalCostPercent: number;
}

/**
 * Complete liquidity heatmap analysis result
 */
export interface LiquidityHeatmap {
  /**
   * Symbol analyzed
   */
  symbol: string;

  /**
   * Analysis timestamp
   */
  timestamp: number;

  /**
   * All identified liquidity zones
   */
  zones: LiquidityZone[];

  /**
   * Support/Resistance levels
   */
  supportResistance: SupportResistanceLevels | null;

  /**
   * Current spread (bps)
   */
  spreadBps: number;

  /**
   * Total depth on bid side
   */
  totalBidDepth: number;

  /**
   * Total depth on ask side
   */
  totalAskDepth: number;

  /**
   * Bid/Ask imbalance ratio (-1 to 1)
   * Positive = more bid liquidity (bullish)
   * Negative = more ask liquidity (bearish)
   */
  imbalanceRatio: number;

  /**
   * Overall liquidity score (0-100)
   */
  liquidityScore: number;
}
