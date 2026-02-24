/**
 * Order book types
 */

/**
 * Order book price level - Unified type for all formats
 * Discriminated union that supports both:
 * - Tuple format: [price, size] from exchange API
 * - Object format: {price, size, format: 'object'} for type safety
 */
export type OrderbookLevel =
  | {
      price: number;
      size: number;
      format?: 'object'; // Discriminator for object format
    }
  | readonly [price: number, size: number]; // Tuple with labeled indices

/**
 * Order book snapshot
 * Contains bid/ask levels with normalized OrderbookLevel type
 */
export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: OrderbookLevel[]; // Sorted descending by price
  asks: OrderbookLevel[]; // Sorted ascending by price
  updateId: number; // Sequential update ID
}

/**
 * Order book wall (large order) - Unified type from analyzer
 */
export interface OrderBookWall {
  side: 'BID' | 'ASK';
  price: number;
  quantity: number; // Order quantity
  percentOfTotal: number; // % of total volume
  distance: number; // Distance from current price (%)
}

/**
 * Order book imbalance
 */
export interface OrderBookImbalance {
  bidVolume: number; // Total bid volume
  askVolume: number; // Total ask volume
  ratio: number; // Bid / Ask ratio
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // Market pressure
  strength: number; // 0-1 (strength of imbalance)
}

/**
 * Order book analysis result
 */
export interface OrderBookAnalysis {
  timestamp: number;
  orderBook: OrderBook;
  imbalance: OrderBookImbalance;
  walls: OrderBookWall[]; // Detected walls
  strongestBid: OrderbookLevel | null; // Strongest bid level
  strongestAsk: OrderbookLevel | null; // Strongest ask level
  spread: number; // Best bid - best ask (%)
  depth: {
    bid: number; // Number of bid levels
    ask: number; // Number of ask levels
  };
}
