import { CandleProvider } from '../providers/candle.provider';
import {
  Candle,
  IIndicatorCache,
  IIndicatorCalculator,
  IIndicatorPreCalculationService,
  TimeframeRole,
} from '../types/legacy';
import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  IndicatorCalculationError,
  IndicatorCacheSyncError,
  CandleDataMissingError,
} from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';
import {
  buildInvalidationKeys,
  collectTimeframeRequirements,
  countUpdatedEntries,
  createCalculationContext,
  findAffectedCalculators,
  partitionPendingCloses,
  shouldNotifyIndicatorsReady,
  type IndicatorPrecalculationPendingClose,
} from './indicator-precalculation/indicator-precalculation.utils';

/**
 * Pre-calculates indicators on every candle close
 *
 * Architecture:
 * 1. Called by TradingOrchestrator on candle close
 * 2. Queues close events (handles race conditions from multiple timeframes)
 * 3. Processes queue sequentially (ensures proper order)
 * 4. Batches same-timestamp closes together
 * 5. Recalculates affected indicators
 * 6. Updates cache (invalidate old → calculate → store)
 * 7. Calls onIndicatorsReady callback when done
 *
 * Does NOT know about:
 * - Specific indicators (RSI, EMA, etc)
 * - Analyzers
 * - Logger dependencies
 *
 * Only knows about:
 * - IIndicatorCalculator interface
 * - IIndicatorCache interface
 * - CandleProvider
 */
export class IndicatorPreCalculationService implements IIndicatorPreCalculationService {
  private isCalculating = false;
  private pendingCloses: IndicatorPrecalculationPendingClose[] = [];
  private onIndicatorsReadyCallback?: (
    timeframe: TimeframeRole,
    closeTime: number
  ) => Promise<void>;

  // Configuration
  private config = {
    timeframes: {
      entry: 'ENTRY' as TimeframeRole,
    },
  };

  constructor(
    private candleProvider: CandleProvider,
    private cache: IIndicatorCache,
    private calculators: IIndicatorCalculator[],
    private logger: LoggerService,
    private errorHandler?: ErrorHandler, // Phase 8.9.16: Optional for backward compatibility
  ) {}

  /**
   * Register callback to be called when indicators are ready
   * Called by TradingOrchestrator during initialization
   */
  setOnIndicatorsReady(
    callback: (timeframe: TimeframeRole, closeTime: number) => Promise<void>
  ): void {
    this.onIndicatorsReadyCallback = callback;
  }

  /**
   * Set entry timeframe (should be called from config)
   */
  setEntryTimeframe(timeframe: TimeframeRole): void {
    this.config.timeframes.entry = timeframe;
  }

  /**
   * Handle candle close - called by TradingOrchestrator
   * Queues the close and starts processing if not already processing
   */
  async onCandleClosed(timeframe: TimeframeRole, closeTime: number): Promise<void> {
    // Add to queue
    this.pendingCloses.push({
      timeframe,
      closeTime,
    });

    // If already calculating, let it finish (and process queue)
    if (this.isCalculating) {
      return;
    }

    // Process queue
    await this.processQueue();
  }

  /**
   * Process all pending closes in queue
   * Groups closes at same timestamp and processes them together
   */
  private async processQueue(): Promise<void> {
    while (this.pendingCloses.length > 0 && !this.isCalculating) {
      this.isCalculating = true;

      try {
        const { currentTime, sameTimeBatch, remainingCloses } =
          partitionPendingCloses(this.pendingCloses);
        this.pendingCloses = remainingCloses;

        // Recalculate for each timeframe
        for (const item of sameTimeBatch) {
          await this.recalculate(item.timeframe);
        }

        // === Call callback if entry timeframe is in batch ===
        if (
          this.onIndicatorsReadyCallback &&
          shouldNotifyIndicatorsReady(sameTimeBatch, this.config.timeframes.entry)
        ) {
          try {
            await this.onIndicatorsReadyCallback(
              this.config.timeframes.entry,
              currentTime
            );
          } catch (error) {
            this.logger.error(
              'Error in onIndicatorsReady callback:',
              error instanceof Error ? { message: error.message } : {}
            );
          }
        }
      } catch (error) {
        this.logger.error(
          'Error processing candle close:',
          error instanceof Error ? { message: error.message } : {}
        );
        // Continue processing queue even on error
      } finally {
        this.isCalculating = false;
      }
    }
  }

  /**
   * Recalculate indicators affected by closing of specific timeframe
   */
  private async recalculate(closedTimeframe: TimeframeRole): Promise<void> {
    const affectedCalculators = findAffectedCalculators(
      this.calculators,
      closedTimeframe
    );

    if (affectedCalculators.length === 0) {
      // No one cares about this timeframe
      return;
    }

    try {
      const tfRequirements = collectTimeframeRequirements(affectedCalculators);

      // Get candles for all required timeframes
      const candlesByTf = new Map<string, Candle[]>();
      for (const [tf, minCount] of tfRequirements) {
        try {
          // Try to get candles - TF string might be different format
          const candles = await this.candleProvider.getCandles(
            tf as TimeframeRole,
            minCount
          );
          if (!candles || candles.length === 0) {
            this.logger.warn(`No candles available for ${tf}`);
            continue;
          }
          candlesByTf.set(tf, candles);
        } catch (err) {
          this.logger.warn(`Failed to get candles for ${tf}:`,
            err instanceof Error ? { message: err.message } : {});
          continue;
        }
      }

      for (const cacheKey of buildInvalidationKeys(affectedCalculators, closedTimeframe)) {
        if (this.errorHandler) {
          try {
            this.cache.invalidate(cacheKey);
          } catch (error) {
            this.errorHandler.handle(
              new IndicatorCacheSyncError(
                `Failed to invalidate cache for ${cacheKey}`,
                {
                  cacheKey,
                  operation: 'invalidate',
                  reason: 'cache_invalidate_failed',
                },
                error instanceof Error ? error : undefined
              ),
              {
                strategy: RecoveryStrategy.SKIP,
                context: 'IndicatorPreCalculationService.invalidateCache',
              }
            );
            this.logger.warn(`Skipped cache invalidation for ${cacheKey}`);
          }
        } else {
          this.cache.invalidate(cacheKey);
        }
      }

      // === CALCULATE ===
      const promises = affectedCalculators.map((calc) => {
        const context = createCalculationContext(candlesByTf, Date.now());
        if (this.errorHandler) {
          // Phase 8.9.16: Calculator execution with SKIP strategy
          return calc
            .calculate(context)
            .catch((error: unknown) => {
              // SKIP - log error and continue with other calculators
              const classified = this.classifyCalculationError(error, calc);
              this.errorHandler!.handle(classified, {
                strategy: RecoveryStrategy.SKIP,
                context: `IndicatorPreCalculationService.calculate[${calc.constructor.name}]`,
              });
              this.logger.warn(
                `Skipped failed calculator: ${calc.constructor.name}`
              );
              return new Map<string, number>(); // Return empty, don't block others
            });
        } else {
          // Original behavior without ErrorHandler
          return calc
            .calculate(context)
            .catch((error) => {
              this.logger.error(
                `Calculator ${calc.constructor.name} failed:`,
                error instanceof Error ? { message: error.message } : {}
              );
              return new Map(); // Return empty, don't block others
            });
        }
      });

      const allResults = await Promise.all(promises);

      // === STORE in cache ===
      for (const results of allResults) {
        results.forEach((value: unknown, key: string) => {
          if (this.errorHandler) {
            // Phase 8.9.16: Cache storage with SKIP strategy
            try {
              this.cache.set(key, value as number);
            } catch (error) {
              // SKIP - log and continue, don't block other caches
              this.errorHandler.handle(
                new IndicatorCacheSyncError(
                  `Failed to cache indicator: ${key}`,
                  { cacheKey: key, value, operation: 'set', reason: 'cache_set_failed' },
                  error instanceof Error ? error : undefined
                ),
                {
                  strategy: RecoveryStrategy.SKIP,
                  context: 'IndicatorPreCalculationService.setCache',
                }
              );
              this.logger.warn(`Skipped cache storage for ${key}`);
            }
          } else {
            // Original behavior without ErrorHandler
            this.cache.set(key, value as number);
          }
        });
      }

      this.logger.debug(`Recalculated indicators for ${closedTimeframe}`, {
        calculatorsRun: affectedCalculators.length,
        entriesUpdated: countUpdatedEntries(allResults),
      });
    } catch (error) {
      this.logger.error(
        `Recalculation failed for ${closedTimeframe}:`,
        error instanceof Error ? { message: error.message } : {}
      );
    }
  }

  /**
   * Phase 8.9.16: Classify calculation errors for proper recovery strategy
   * Maps error types to domain-specific error classes
   */
  private classifyCalculationError(
    error: unknown,
    calculator: IIndicatorCalculator
  ): Error {
    const errorMessage = getErrorMessage(error);
    const calculatorName = calculator.constructor.name;

    // NaN or Infinity results
    if (
      errorMessage.includes('NaN') ||
      errorMessage.includes('Infinity')
    ) {
      return new IndicatorCalculationError(
        `Invalid calculation result from ${calculatorName}`,
        {
          calculator: calculatorName,
          reason: 'invalid_number',
          error: errorMessage,
        },
        error instanceof Error ? error : undefined
      );
    }

    // Insufficient data
    if (
      errorMessage.includes('not enough candles') ||
      errorMessage.includes('insufficient')
    ) {
      return new CandleDataMissingError(
        `Insufficient candles for ${calculatorName}`,
        {
          calculator: calculatorName,
          reason: 'insufficient_data',
          minRequired: 100, // Default, could be extracted from error
        },
        error instanceof Error ? error : undefined
      );
    }

    // Default - unknown calculation error
    return new IndicatorCalculationError(
      `Calculation failed: ${calculatorName}`,
      {
        calculator: calculatorName,
        reason: 'unknown',
        error: errorMessage,
      },
      error instanceof Error ? error : undefined
    );
  }
}

