/**
 * External Analysis Service (Week 13 Phase 3 Extract)
 *
 * Extracted from trading-orchestrator.service.ts
 * Responsible for analyzing external data sources
 *
 * Responsibilities:
 * - Analyze BTC for correlation and trend confirmation
 * - Check funding rate filters (block high positive/negative rates)
 * - Detect flat market conditions
 * - Provide unified external data checks for signal filtering
 */

import {
  LoggerService,
  SignalDirection,
  TimeframeRole,
  Candle,
  BTCAnalysis,
  TradingContext,
  BTCAnalyzer,
  FlatMarketDetector,
} from '../types';
import { BybitService } from './bybit/bybit.service';
import { CandleProvider } from '../providers/candle.provider';
import { FundingRateFilterService } from './funding-rate-filter.service';
import {
  INTEGER_MULTIPLIERS,
  DECIMAL_PLACES,
  PERCENT_MULTIPLIER,
} from '../constants';

/**
 * BTC Configuration interface
 * Used for BTC analysis setup
 */
interface BTCConfig {
  symbol: string;
  timeframe: string;
  enabled: boolean;
  candleLimit?: number;
  lookbackCandles?: number;
  useCorrelation?: boolean;
  correlationPeriod?: number;
}

/**
 * Funding Rate Configuration interface
 * Used for funding rate filter setup
 */
interface FundingRateConfig {
  enabled: boolean;
  blockLongThreshold?: number;
  blockShortThreshold?: number;
}

/**
 * Flat Market Detection Configuration interface
 */
interface FlatMarketConfig {
  enabled: boolean;
  [key: string]: any;
}

/**
 * External Analysis Service
 *
 * Manages external data analysis from Bybit and market conditions.
 * Filters trading signals based on BTC correlation, funding rates, and market flatness.
 */
export class ExternalAnalysisService {
  constructor(
    private bybitService: BybitService,
    private candleProvider: CandleProvider,
    private btcAnalyzer: BTCAnalyzer | null,
    private fundingRateFilter: FundingRateFilterService | null,
    private flatMarketDetector: FlatMarketDetector | null,
    private logger: LoggerService,
    private btcConfig?: BTCConfig,
    private fundingRateConfig?: FundingRateConfig,
    private flatMarketConfig?: FlatMarketConfig,
  ) {}

  /**
   * Analyze BTC for correlation and trend confirmation
   * @param signalDirection - Direction of the signal (LONG/SHORT)
   * @returns BTC analysis result or null if not available
   */
  async analyzeBTC(signalDirection: SignalDirection): Promise<BTCAnalysis | null> {
    if (!this.btcAnalyzer || !this.btcConfig?.enabled) {
      return null;
    }

    try {
      const btcConfig = this.btcConfig;

      // Fetch BTC candles directly from Bybit
      const btcCandles = await this.bybitService.getCandles(
        btcConfig.symbol,
        btcConfig.timeframe,
        btcConfig.candleLimit || INTEGER_MULTIPLIERS.FIFTY,
      );

      if (!btcCandles || btcCandles.length < (btcConfig.lookbackCandles || INTEGER_MULTIPLIERS.TEN)) {
        this.logger.warn('Not enough BTC candles for analysis', {
          available: btcCandles?.length || 0,
          required: btcConfig.lookbackCandles || INTEGER_MULTIPLIERS.TEN,
        });
        return null;
      }

      // Get altcoin candles for correlation (optional)
      let altCandles: Candle[] | undefined;
      if (btcConfig.useCorrelation) {
        altCandles = await this.candleProvider.getCandles(
          TimeframeRole.ENTRY,
          btcConfig.correlationPeriod || INTEGER_MULTIPLIERS.FIFTY,
        );
      }

      // Analyze BTC
      const analysis = this.btcAnalyzer.analyze(btcCandles, signalDirection, altCandles);

      return analysis;
    } catch (error) {
      this.logger.error('BTC analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check BTC confirmation for a signal
   * @param signalDirection - Direction of the signal
   * @param btcAnalysis - Pre-computed BTC analysis (optional - will analyze if not provided)
   * @returns true if BTC confirms the signal, false otherwise
   */
  async checkBTCConfirmation(
    signalDirection: SignalDirection,
    btcAnalysis?: BTCAnalysis,
  ): Promise<boolean> {
    if (!this.btcAnalyzer || !this.btcConfig?.enabled) {
      return true; // Pass if BTC analysis not enabled
    }

    const analysis = btcAnalysis || (await this.analyzeBTC(signalDirection));

    if (analysis && !this.btcAnalyzer.shouldConfirm(analysis)) {
      this.logger.info('❌ BTC confirmation FAILED - signal blocked', {
        direction: signalDirection,
        btcDirection: analysis.direction,
        btcMomentum: analysis.momentum.toFixed(DECIMAL_PLACES.PERCENT),
        isAligned: analysis.isAligned,
        reason: analysis.reason,
      });
      return false;
    }

    if (analysis) {
      this.logger.info('✅ BTC confirmation PASSED', {
        direction: signalDirection,
        btcDirection: analysis.direction,
        btcMomentum: analysis.momentum.toFixed(DECIMAL_PLACES.PERCENT),
        isAligned: analysis.isAligned,
      });
    }

    return true;
  }

  /**
   * Check funding rate filter for a signal
   * @param signalDirection - Direction of the signal
   * @returns true if funding rate allows the signal, false otherwise
   */
  async checkFundingRate(signalDirection: SignalDirection): Promise<boolean> {
    if (!this.fundingRateFilter || !this.fundingRateConfig?.enabled) {
      return true; // Pass if funding rate filter not enabled
    }

    try {
      const filterResult = await this.fundingRateFilter.checkSignal(signalDirection);

      if (!filterResult.allowed) {
        this.logger.warn('🚫 Funding Rate Filter BLOCKED signal', {
          direction: signalDirection,
          reason: filterResult.reason,
          fundingRate: filterResult.fundingRate
            ? (filterResult.fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PERCENT) + '%'
            : 'N/A',
        });
        return false;
      }

      this.logger.debug('✅ Funding rate check PASSED', {
        direction: signalDirection,
        fundingRate: filterResult.fundingRate
          ? (filterResult.fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PERCENT) + '%'
          : 'N/A',
      });

      return true;
    } catch (error) {
      this.logger.error('Funding rate check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return true; // Pass on error (prefer false positives over false negatives)
    }
  }

  /**
   * Detect if market is flat (low volatility, consolidation)
   * @param primaryCandles - Primary timeframe candles
   * @param context - Current trading context
   * @param primaryEmaFast - Primary EMA fast value
   * @param primaryEmaSlow - Primary EMA slow value
   * @returns Object with isFlat flag and confidence score
   */
  detectFlatMarket(
    primaryCandles: Candle[],
    context: TradingContext | null | undefined,
    primaryEmaFast: number,
    primaryEmaSlow: number,
  ): { isFlat: boolean; confidence: number } | null {
    if (!this.flatMarketDetector || !this.flatMarketConfig?.enabled) {
      return null;
    }

    try {
      if (!context) {
        this.logger.debug('No context available for flat market detection');
        return null;
      }

      return this.flatMarketDetector.detect(primaryCandles, context, primaryEmaFast, primaryEmaSlow);
    } catch (error) {
      this.logger.warn('Flat market detection failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
