/**
 * Filter Initialization Service (Week 13 Phase 5c Extract)
 *
 * Extracted from trading-orchestrator.service.ts constructor
 * Responsible for initializing all market filters and detectors
 *
 * Responsibilities:
 * - Initialize BTC confirmation filter
 * - Initialize funding rate filter
 * - Initialize flat market detector
 * - Initialize trend confirmation filter
 */

import {
  LoggerService,
  OrchestratorConfig,
  BTCAnalyzer,
  FlatMarketDetector,
} from '../types';
import {
  DECIMAL_PLACES,
  PERCENT_MULTIPLIER,
} from '../constants';
import { CandleProvider } from '../providers/candle.provider';
import { BybitService } from './bybit';
import { FundingRateFilterService } from './funding-rate-filter.service';
import { TrendConfirmationService } from './trend-confirmation.service';

/**
 * Result of filter initialization
 */
export interface InitializedFilters {
  btcAnalyzer: BTCAnalyzer | null;
  fundingRateFilter: FundingRateFilterService | null;
  flatMarketDetector: FlatMarketDetector | null;
  trendConfirmationService: TrendConfirmationService | null;
}

/**
 * Filter Initialization Service
 * Encapsulates all filter and detector initialization logic
 */
export class FilterInitializationService {
  constructor(
    private config: OrchestratorConfig,
    private candleProvider: CandleProvider,
    private bybitService: BybitService,
    private logger: LoggerService,
  ) {}

  /**
   * Initialize all filters and detectors
   */
  initializeAllFilters(): InitializedFilters {
    // Initialize BTC confirmation filter
    let btcAnalyzer: BTCAnalyzer | null = null;
    if (this.config.btcConfirmation?.enabled) {
      btcAnalyzer = new BTCAnalyzer(this.config.btcConfirmation, this.logger);
      this.logger.info('BTC confirmation filter enabled', {
        symbol: this.config.btcConfirmation.symbol,
        timeframe: this.config.btcConfirmation.timeframe,
      });
    }

    // Initialize funding rate filter
    let fundingRateFilter: FundingRateFilterService | null = null;
    if (this.config.fundingRateFilter?.enabled) {
      fundingRateFilter = new FundingRateFilterService(
        this.config.fundingRateFilter,
        async () => await this.bybitService.getFundingRate(),
        this.logger,
      );
      this.logger.info('💰 Funding Rate Filter enabled', {
        blockLongThreshold: (
          this.config.fundingRateFilter.blockLongThreshold * PERCENT_MULTIPLIER
        ).toFixed(DECIMAL_PLACES.PRICE) + '%',
        blockShortThreshold: (
          this.config.fundingRateFilter.blockShortThreshold * PERCENT_MULTIPLIER
        ).toFixed(DECIMAL_PLACES.PRICE) + '%',
        cacheTimeMs: this.config.fundingRateFilter.cacheTimeMs,
      });
    }

    // Initialize flat market detector
    let flatMarketDetector: FlatMarketDetector | null = null;
    if (this.config.flatMarketDetection?.enabled) {
      flatMarketDetector = new FlatMarketDetector(
        this.config.flatMarketDetection,
        this.logger,
      );
      this.logger.info('📊 Flat Market Detector enabled', {
        flatThreshold: this.config.flatMarketDetection.flatThreshold,
        emaThreshold: this.config.flatMarketDetection.emaThreshold,
        atrThreshold: this.config.flatMarketDetection.atrThreshold,
      });
    }

    // Initialize trend confirmation filter (secondary signal validation)
    let trendConfirmationService: TrendConfirmationService | null = null;
    if (this.config.trendConfirmation?.enabled) {
      trendConfirmationService = new TrendConfirmationService(
        this.config.trendConfirmation,
        this.candleProvider,
        this.logger,
      );
      this.logger.info('🔄 Trend Confirmation Filter enabled', {
        mode: this.config.trendConfirmation.filterMode || 'CONDITIONAL',
        criticalScore: this.config.trendConfirmation.criticalMisalignmentScore ?? 30,
        warningScore: this.config.trendConfirmation.warningMisalignmentScore ?? 60,
      });
    }

    return {
      btcAnalyzer,
      fundingRateFilter,
      flatMarketDetector,
      trendConfirmationService,
    };
  }
}
