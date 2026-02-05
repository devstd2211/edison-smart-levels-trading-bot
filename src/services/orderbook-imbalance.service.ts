import { PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Orderbook Imbalance Service (PHASE 4 Feature 4) + Phase 8.9.49 ErrorHandler Integration
 *
 * Analyzes bid/ask volume ratio in orderbook to detect buying/selling pressure.
 *
 * Imbalance = (bidVolume - askVolume) / totalVolume * PERCENT_MULTIPLIER
 *
 * Error Handling Strategies:
 * - THROW: Config validation (levels, minImbalancePercent)
 * - THROW: Input validation (null/undefined orderbook)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity) → return neutral analysis
 * - SKIP: Logging failures (non-blocking)
 *
 * Use Cases:
 * - Entry timing (enter when imbalance matches direction)
 * - Reversal signals (sudden imbalance flip)
 * - Confirmation filter (strong BID imbalance confirms LONG)
 *
 * Data Source: Orderbook depth (top N levels from OrderbookManagerService)
 */

import { OrderbookImbalanceConfig, ImbalanceAnalysis, LoggerService } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

// ============================================================================
// ORDERBOOK IMBALANCE SERVICE
// ============================================================================

export class OrderbookImbalanceService {
  constructor(
    private config: OrderbookImbalanceConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // Constructor validation: THROW on invalid config
    this.validateConfig(config);

    this.safeLog(() =>
      this.logger.info('OrderbookImbalanceService initialized', {
        enabled: config.enabled,
        levels: config.levels,
        minImbalancePercent: config.minImbalancePercent,
      }),
    );
  }

  /**
   * Validate configuration at construction time
   * THROW strategy for config errors
   */
  private validateConfig(config: OrderbookImbalanceConfig): void {
    if (typeof config.levels !== 'number' || config.levels < 1) {
      throw new Error('OrderbookImbalanceService: config.levels must be >= 1');
    }
    if (typeof config.minImbalancePercent !== 'number' || config.minImbalancePercent < 0 || config.minImbalancePercent > 100) {
      throw new Error('OrderbookImbalanceService: config.minImbalancePercent must be between 0 and 100');
    }
    if (typeof config.enabled !== 'boolean') {
      throw new Error('OrderbookImbalanceService: config.enabled must be boolean');
    }
  }

  /**
   * Safe logging wrapper: SKIP strategy for logging failures
   */
  private safeLog(logFn: () => void): void {
    if (!this.errorHandler) {
      try {
        logFn();
      } catch {
        // Silently ignore logging errors
      }
    } else {
      try {
        logFn();
      } catch (error) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Analyze orderbook imbalance from bids/asks
   * THROW on input validation, GRACEFUL_DEGRADE on calculation failures
   *
   * @param orderbook - Orderbook with bids [[price, size]] and asks [[price, size]]
   * @returns Imbalance analysis with direction and strength
   * @throws Error if orderbook is null/undefined or invalid
   */
  analyze(orderbook: { bids: [number, number][]; asks: [number, number][] }): ImbalanceAnalysis {
    // THROW strategy: Input validation
    if (!orderbook) {
      throw new Error('OrderbookImbalanceService.analyze: orderbook is required');
    }
    if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
      throw new Error('OrderbookImbalanceService.analyze: bids and asks must be arrays');
    }

    if (!this.config.enabled) {
      // Disabled - return neutral
      return this.getNeutralAnalysis();
    }

    const levels = this.config.levels;

    try {
      // Get top N levels
      const bids = orderbook.bids.slice(0, levels);
      const asks = orderbook.asks.slice(0, levels);

      // Calculate volumes with NaN/Infinity validation
      let bidVolume = 0;
      let askVolume = 0;

      for (const [_, qty] of bids) {
        if (!Number.isFinite(qty)) {
          // GRACEFUL_DEGRADE: Invalid quantity, use neutral
          this.safeLog(() => this.logger.warn('Invalid bid quantity detected', { qty }));
          return this.getNeutralAnalysis();
        }
        bidVolume += qty;
      }

      for (const [_, qty] of asks) {
        if (!Number.isFinite(qty)) {
          // GRACEFUL_DEGRADE: Invalid quantity, use neutral
          this.safeLog(() => this.logger.warn('Invalid ask quantity detected', { qty }));
          return this.getNeutralAnalysis();
        }
        askVolume += qty;
      }

      if (!Number.isFinite(bidVolume) || !Number.isFinite(askVolume)) {
        // GRACEFUL_DEGRADE: Volume calculation failed
        this.safeLog(() => this.logger.warn('Volume calculation resulted in non-finite value'));
        return this.getNeutralAnalysis();
      }

      const totalVolume = bidVolume + askVolume;

      // Calculate imbalance
      const imbalance = totalVolume > 0 ? ((bidVolume - askVolume) / totalVolume) * PERCENT_MULTIPLIER : 0;

      if (!Number.isFinite(imbalance)) {
        // GRACEFUL_DEGRADE: Imbalance calculation failed
        this.safeLog(() => this.logger.warn('Imbalance calculation resulted in non-finite value'));
        return this.getNeutralAnalysis();
      }

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

      this.safeLog(() =>
        this.logger.debug('Orderbook imbalance analyzed', {
          bidVol: bidVolume.toFixed(0),
          askVol: askVolume.toFixed(0),
          imbalance: imbalance.toFixed(1) + '%',
          direction,
          strength: strength.toFixed(0),
        }),
      );

      return analysis;
    } catch (error) {
      // GRACEFUL_DEGRADE: Unexpected calculation error, return neutral
      this.safeLog(() => this.logger.error('Orderbook imbalance calculation failed', { error }));
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return this.getNeutralAnalysis();
    }
  }

  /**
   * Get neutral analysis (no imbalance) - safe default for GRACEFUL_DEGRADE
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

  /**
   * Helper to get config for testing
   */
  getConfig(): OrderbookImbalanceConfig {
    return this.config;
  }

  /**
   * Helper to check if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
