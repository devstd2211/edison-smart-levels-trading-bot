/**
 * Market Condition Analyzer Service (Week 13 Phase 4b Extract)
 *
 * Extracted from SignalProcessingService.ts
 * Responsible for adjusting trading parameters based on market conditions.
 *
 * Single Responsibility: Adapt take profit levels to market conditions (FLAT vs TRENDING)
 */

import {
  LoggerService,
  TakeProfit,
} from '../types/legacy';
import {
  DECIMAL_PLACES,
  FIXED_EXIT_PERCENTAGES,
} from '../constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

/**
 * Market Condition Analyzer Service
 *
 * Adjusts trading parameters based on market conditions:
 * - FLAT market: Use single TP at 100% size (reduce risk in sideways movement)
 * - TRENDING market: Keep multi-TP strategy (maximize profit in trending markets)
 */
export class MarketConditionAnalyzerService {
  private errorHandler: ErrorHandler;

  constructor(
    private logger: LoggerService,
    errorHandler?: ErrorHandler,
  ) {
    this.errorHandler = errorHandler || new ErrorHandler(logger);
  }

  /**
   * Safe logging wrapper - SKIP strategy for all logger errors
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    try {
      this.logger[level](message, data);
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
    }
  }

  /**
   * Adjust take profits based on market condition
   * THROW: Invalid input validation (null TPs, invalid confidence)
   * GRACEFUL_DEGRADE: Processing failures (return original TPs)
   * SKIP: Logging failures
   * - FLAT MARKET: Convert to single TP at 100% close on TP1 price
   * - TRENDING MARKET: Keep multi-TP strategy for better profit scaling
   * @param takeProfits - Original take profit levels
   * @param flatResult - Flat market detection result with confidence
   * @returns Adjusted take profit levels
   */
  public adjustTakeProfitsForMarketCondition(
    takeProfits: TakeProfit[],
    flatResult: { isFlat: boolean; confidence: number } | null,
  ): TakeProfit[] {
    // THROW: Validate input takeProfits
    if (!takeProfits || !Array.isArray(takeProfits) || takeProfits.length === 0) {
      return this.errorHandler.handle(
        new Error('TakeProfits must be a non-empty array'),
        { strategy: RecoveryStrategy.THROW }
      ) as any;
    }

    // Validate each TP has required fields
    for (const tp of takeProfits) {
      if (!tp || typeof tp.price !== 'number' || !isFinite(tp.price) || tp.price <= 0) {
        return this.errorHandler.handle(
          new Error('Invalid TakeProfit price: must be positive finite number'),
          { strategy: RecoveryStrategy.THROW }
        ) as any;
      }
      if (typeof tp.sizePercent !== 'number' || tp.sizePercent < 0 || tp.sizePercent > 100) {
        return this.errorHandler.handle(
          new Error('Invalid TakeProfit sizePercent: must be 0-100'),
          { strategy: RecoveryStrategy.THROW }
        ) as any;
      }
    }

    if (!flatResult) {
      return takeProfits;
    }

    // THROW: Validate flatResult confidence
    if (typeof flatResult.confidence !== 'number' || !isFinite(flatResult.confidence)) {
      return this.errorHandler.handle(
        new Error('Invalid market condition confidence: must be finite number'),
        { strategy: RecoveryStrategy.THROW }
      ) as any;
    }

    if (flatResult.confidence < 0 || flatResult.confidence > 100) {
      return this.errorHandler.handle(
        new Error('Invalid market condition confidence: must be 0-100'),
        { strategy: RecoveryStrategy.THROW }
      ) as any;
    }

    try {
      if (flatResult.isFlat) {
        // FLAT MARKET: Adjust to single TP (100% close at TP1 price)
        const firstTP = takeProfits[0];
        const adjustedTP: TakeProfit[] = [{
          level: 1,
          price: firstTP.price,
          sizePercent: FIXED_EXIT_PERCENTAGES.FULL, // Close 100% on TP1
          percent: firstTP.percent,
          hit: false,
        }];

        this.safeLog('info', '⚡ FLAT market - adjusted to single TP', {
          confidence: flatResult.confidence.toFixed(1) + '%',
          tpPrice: firstTP.price.toFixed(DECIMAL_PLACES.PRICE),
          tpPercent: firstTP.percent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        });

        return adjustedTP;
      }

      // TRENDING MARKET: Keep multi-TP strategy
      this.safeLog('info', '📈 TRENDING market - keeping multi-TP strategy', {
        confidence: flatResult.confidence.toFixed(1) + '%',
        tpCount: takeProfits.length,
      });

      return takeProfits;
    } catch (error) {
      // GRACEFUL_DEGRADE: Processing error, return original TPs
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', 'Market condition adjustment failed, returning original TPs');
      return takeProfits;
    }
  }
}
