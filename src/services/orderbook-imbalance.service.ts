import { PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Orderbook Imbalance Service (PHASE 4 Feature 4)
 *
 * Analyzes bid/ask volume ratio in orderbook to detect buying/selling pressure.
 *
 * Imbalance = (bidVolume - askVolume) / totalVolume * PERCENT_MULTIPLIER
 *
 * Use Cases:
 * - Entry timing (enter when imbalance matches direction)
 * - Reversal signals (sudden imbalance flip)
 * - Confirmation filter (strong BID imbalance confirms LONG)
 *
 * Data Source: Orderbook depth (top N levels from OrderbookManagerService)
 */

import { OrderbookImbalanceConfig, ImbalanceAnalysis, LoggerService } from '../types';

// ============================================================================
// ORDERBOOK IMBALANCE SERVICE
// ============================================================================

export class OrderbookImbalanceService {
  constructor(
    private config: OrderbookImbalanceConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('OrderbookImbalanceService initialized', {
      enabled: config.enabled,
      levels: config.levels,
      minImbalancePercent: config.minImbalancePercent,
    });
  }

  /**
   * Analyze orderbook imbalance from bids/asks
   *
   * @param orderbook - Orderbook with bids [[price, size]] and asks [[price, size]]
   * @returns Imbalance analysis with direction and strength
   */
  analyze(orderbook: { bids: [number, number][]; asks: [number, number][] }): ImbalanceAnalysis {
    if (!this.config.enabled) {
      // Disabled - return neutral
      return this.getNeutralAnalysis();
    }

    const levels = this.config.levels;

    // Get top N levels
    const bids = orderbook.bids.slice(0, levels);
    const asks = orderbook.asks.slice(0, levels);

    // Calculate volumes
    const bidVolume = bids.reduce((sum, [_, qty]) => sum + qty, 0);
    const askVolume = asks.reduce((sum, [_, qty]) => sum + qty, 0);
    const totalVolume = bidVolume + askVolume;

    // Calculate imbalance
    const imbalance = totalVolume > 0 ? ((bidVolume - askVolume) / totalVolume) * PERCENT_MULTIPLIER : 0;

    // Determine direction
    let direction: 'BID' | 'ASK' | 'NEUTRAL';
    if (Math.abs(imbalance) < this.config.minImbalancePercent) {
      direction = 'NEUTRAL';
    } else if (imbalance > 0) {
      direction = 'BID'; // More bid volume → bullish pressure
    } else {
      direction = 'ASK'; // More ask volume → bearish pressure
    }

    // Calculate strength (0-100)
    const strength = Math.min(Math.abs(imbalance), INTEGER_MULTIPLIERS.ONE_HUNDRED);

    const analysis: ImbalanceAnalysis = {
      timestamp: Date.now(),
      bidVolume,
      askVolume,
      totalVolume,
      imbalance,
      direction,
      strength,
    };

    /* this.logger.debug('Orderbook imbalance analyzed', {
      bidVol: bidVolume.toFixed(0),
      askVol: askVolume.toFixed(0),
      imbalance: imbalance.toFixed(1) + '%',
      direction,
      strength: strength.toFixed(0),
    });
*/
    return analysis;
  }

  /**
   * Get neutral analysis (no imbalance)
   */
  private getNeutralAnalysis(): ImbalanceAnalysis {
    return {
      timestamp: Date.now(),
      bidVolume: 0,
      askVolume: 0,
      totalVolume: 0,
      imbalance: 0,
      direction: 'NEUTRAL',
      strength: 0,
    };
  }
}
