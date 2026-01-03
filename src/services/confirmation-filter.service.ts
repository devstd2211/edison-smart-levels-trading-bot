import { PERCENT_MULTIPLIER } from '../constants';
/**
 * Confirmation Filter Service
 *
 * Filters signals based on BTC confirmation:
 * - Fetches BTC candles
 * - Analyzes BTC direction/momentum
 * - Checks alignment with signal direction
 * - Returns confirmation result
 *
 * Extracted from SignalGeneratorService for better testability.
 */

import {
  SignalDirection,
  Config,
  Candle,
  LoggerService,
  ConfirmationResult,
  BTCAnalysis,
  BTCAnalyzer,
} from '../types';
import { BybitService } from './bybit';

// ============================================================================
// CONFIRMATION FILTER SERVICE
// ============================================================================

export class ConfirmationFilter {
  private btcAnalyzer: BTCAnalyzer | null = null;
  private btcCandlesStore?: { btcCandles1m: Candle[] }; // Reference to pre-loaded BTC candles

  constructor(
    private bybitService: BybitService,
    private config: Config,
    private logger: LoggerService,
  ) {
    // Initialize BTC analyzer if enabled
    if (this.config.btcConfirmation?.enabled) {
      this.btcAnalyzer = new BTCAnalyzer(
        this.config.btcConfirmation,
        this.logger,
      );
      this.logger.info('BTC confirmation filter enabled', {
        symbol: this.config.btcConfirmation.symbol,
        timeframe: this.config.btcConfirmation.timeframe,
      });
    }
  }

  /**
   * Set the BTC candles store (used to access pre-loaded BTC candles)
   * Called by BotServices after initialization
   */
  setBtcCandlesStore(store: { btcCandles1m: Candle[] }): void {
    this.btcCandlesStore = store;
    if (this.btcAnalyzer) {
      this.logger.debug('🔗 BTC candles store configured for ConfirmationFilter');
    }
  }

  /**
   * Confirm signal based on BTC analysis
   *
   * @param direction - Signal direction (LONG/SHORT)
   * @param altSymbol - Altcoin symbol for correlation
   * @returns Confirmation result with BTC analysis
   */
  async confirm(
    direction: SignalDirection,
    altSymbol: string,
  ): Promise<ConfirmationResult> {
    // If BTC confirmation disabled, always confirm
    if (!this.btcAnalyzer || !this.config.btcConfirmation?.enabled) {
      return {
        shouldConfirm: true,
        reason: 'BTC confirmation disabled',
      };
    }

    try {
      // Analyze BTC
      const btcAnalysis = await this.analyzeBTC(direction, altSymbol);

      if (!btcAnalysis) {
        // If BTC analysis fails, fail-open (allow signal)
        this.logger.warn('BTC analysis failed, allowing signal (fail-open)');
        return {
          shouldConfirm: true,
          reason: 'BTC analysis failed (fail-open)',
        };
      }

      // Check if BTC confirms the signal
      const shouldConfirm = this.btcAnalyzer.shouldConfirm(btcAnalysis);

      if (shouldConfirm) {
        this.logger.info('✅ BTC confirmation PASSED', {
          direction,
          btcDirection: btcAnalysis.direction,
          btcMomentum: `${(btcAnalysis.momentum * PERCENT_MULTIPLIER).toFixed(0)}%`,
          isAligned: btcAnalysis.isAligned,
        });
      } else {
        this.logger.info('❌ BTC confirmation FAILED - signal blocked', {
          direction,
          btcDirection: btcAnalysis.direction,
          btcMomentum: `${(btcAnalysis.momentum * PERCENT_MULTIPLIER).toFixed(0)}%`,
          isAligned: btcAnalysis.isAligned,
          reason: btcAnalysis.reason,
        });
      }

      return {
        shouldConfirm,
        btcAnalysis,
        reason: btcAnalysis.reason,
      };
    } catch (error) {
      this.logger.error('Error in confirmation filter', { error });
      // Fail-open on error
      return {
        shouldConfirm: true,
        reason: 'Error in BTC confirmation (fail-open)',
      };
    }
  }

  /**
   * Analyze BTC movement for signal confirmation
   *
   * @param signalDirection - Direction of the altcoin signal
   * @param altSymbol - Altcoin symbol for correlation
   * @returns BTC analysis or null if failed
   */
  private async analyzeBTC(
    signalDirection: SignalDirection,
    altSymbol: string,
  ): Promise<BTCAnalysis | null> {
    if (!this.btcAnalyzer || !this.config.btcConfirmation) {
      return null;
    }

    try {
      const btcConfig = this.config.btcConfirmation;

      // Use pre-loaded BTC candles if available (more efficient)
      let btcCandles: Candle[];
      if (this.btcCandlesStore && this.btcCandlesStore.btcCandles1m.length > 0) {
        btcCandles = this.btcCandlesStore.btcCandles1m;
        this.logger.debug('Using pre-loaded BTC candles', {
          count: btcCandles.length,
        });
      } else {
        // Fallback: Fetch BTC candles from API if not pre-loaded
        const candleLimit = btcConfig.candleLimit || btcConfig.lookbackCandles || 50;
        this.logger.debug('Fetching BTC candles from API', {
          symbol: btcConfig.symbol,
          timeframe: btcConfig.timeframe,
          limit: candleLimit,
        });

        btcCandles = await this.bybitService.getCandles(
          btcConfig.symbol,
          btcConfig.timeframe,
          candleLimit,
        );

        if (!btcCandles || btcCandles.length === 0) {
          this.logger.warn('Failed to fetch BTC candles');
          return null;
        }
      }

      // Fetch altcoin candles for correlation (if enabled)
      let altCandles: Candle[] | undefined;
      if (btcConfig.useCorrelation) {
        try {
          const correlationPeriod = btcConfig.correlationPeriod || 50;
          altCandles = await this.bybitService.getCandles(
            altSymbol,
            btcConfig.timeframe,
            correlationPeriod,
          );
        } catch (error) {
          this.logger.warn('Failed to fetch altcoin candles for correlation', { error });
        }
      }

      // Analyze BTC
      const analysis = this.btcAnalyzer.analyze(btcCandles, signalDirection, altCandles);

      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing BTC', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
