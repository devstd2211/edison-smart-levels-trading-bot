/**
 * Orderbook Imbalance Service (PHASE 4 Feature 4) + Phase 8.9.49 ErrorHandler Integration
 *
 * Analyzes bid/ask volume ratio in orderbook to detect buying/selling pressure.
 *
 * Error Handling Strategies:
 * - THROW: Config validation (levels, minImbalancePercent)
 * - THROW: Input validation (null/undefined orderbook)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity) -> return neutral analysis
 * - SKIP: Logging failures (non-blocking)
 */

import { OrderbookImbalanceConfig, ImbalanceAnalysis, LoggerService } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  analyzeOrderbookImbalance,
  createNeutralImbalanceAnalysis,
  type OrderbookSnapshot,
  validateOrderbookImbalanceConfig,
  validateOrderbookSnapshot,
} from './orderbook-imbalance/orderbook-imbalance-state.utils';

export class OrderbookImbalanceService {
  constructor(
    private config: OrderbookImbalanceConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    this.validateConfig(config);
  }

  private validateConfig(config: OrderbookImbalanceConfig): void {
    validateOrderbookImbalanceConfig(config);
  }

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
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  analyze(orderbook: OrderbookSnapshot): ImbalanceAnalysis {
    validateOrderbookSnapshot(orderbook);

    if (!this.config.enabled) {
      return this.getNeutralAnalysis();
    }

    try {
      const analysis = analyzeOrderbookImbalance(orderbook, this.config);
      if (!analysis) {
        this.safeLog(() => this.logger.warn('Imbalance calculation resulted in non-finite value'));
        return this.getNeutralAnalysis();
      }

      this.safeLog(() =>
        this.logger.debug('Orderbook imbalance analyzed', {
          bidVol: analysis.bidVolume.toFixed(0),
          askVol: analysis.askVolume.toFixed(0),
          imbalance: analysis.imbalance.toFixed(1) + '%',
          direction: analysis.direction,
          strength: analysis.strength.toFixed(0),
        }),
      );

      return analysis;
    } catch (error) {
      this.safeLog(() => this.logger.error('Orderbook imbalance calculation failed', { error }));
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return this.getNeutralAnalysis();
    }
  }

  private getNeutralAnalysis(): ImbalanceAnalysis {
    return createNeutralImbalanceAnalysis();
  }

  getConfigSnapshot(): OrderbookImbalanceConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}
