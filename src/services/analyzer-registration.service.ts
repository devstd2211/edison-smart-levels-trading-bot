/**
 * Analyzer Registration Service (REFACTORED)
 *
 * Coordinates registration of all 45+ analyzers across 9 specialized modules
 * Each module handles registration of analyzers in its category
 *
 * Purpose:
 * - Separate concerns by analyzer category
 * - Keep each module focused and testable
 * - Reduce file size from 1500 lines to ~150 lines
 */

import {
  LoggerService,
  ATRIndicator,
  StochasticIndicator,
  BollingerBandsIndicator,
  LiquidityDetector,
  DivergenceDetector,
  BreakoutPredictor,
  BTCAnalyzer,
  FlatMarketDetector,
} from '../types';
import { LevelAnalyzer } from '../analyzers/level.analyzer';
import { VolumeProfileAnalyzer } from '../analyzers/volume-profile.analyzer';
import { AnalyzerRegistry } from './analyzer-registry.service';
import { MultiTimeframeRSIAnalyzer } from '../analyzers/multi-timeframe-rsi.analyzer';
import { MultiTimeframeEMAAnalyzer } from '../analyzers/multi-timeframe-ema.analyzer';
import { PriceMomentumAnalyzer } from '../analyzers/price-momentum.analyzer';
// ===== Import new analyzer classes =====
import { RSISignalAnalyzer } from '../analyzers/rsi-signal.analyzer';
import { ChochBosSignalAnalyzer } from '../analyzers/choch-bos-signal.analyzer';
import { FootprintSignalAnalyzer } from '../analyzers/footprint-signal.analyzer';
import { HiddenDivergenceSignalAnalyzer } from '../analyzers/hidden-divergence-signal.analyzer';
import { WickSignalAnalyzer } from '../analyzers/wick-signal.analyzer';
// ===== Import new validator classes =====
import { TrendConflictDetector } from './signal-validators/trend-conflict-detector';
// ===== Import registration modules =====
import { TechnicalIndicatorsRegistration } from './analyzer-registration/technical-indicators.registration';
import { AdvancedAnalysisRegistration } from './analyzer-registration/advanced-analysis.registration';
import { StructureAnalysisRegistration } from './analyzer-registration/structure-analysis.registration';
import { LevelAnalysisRegistration } from './analyzer-registration/level-analysis.registration';
import { LiquidityAnalysisRegistration } from './analyzer-registration/liquidity-analysis.registration';
import { SmcAnalysisRegistration } from './analyzer-registration/smc-analysis.registration';
import { FiltersProtectionRegistration } from './analyzer-registration/filters-protection.registration';
import { DeltaScalpingRegistration } from './analyzer-registration/delta-scalping.registration';
import { WhaleDetectionRegistration } from './analyzer-registration/whale-detection.registration';
import { DeltaAnalyzerService } from './delta-analyzer.service';
import { OrderbookImbalanceService } from './orderbook-imbalance.service';

/**
 * Main analyzer registration service
 * Coordinates sub-services for each analyzer category
 */
export class AnalyzerRegistrationService {
  private levelAnalyzer: LevelAnalyzer;
  private volumeProfileAnalyzer: VolumeProfileAnalyzer;
  private btcCandlesStore?: { btcCandles1m: any[] };

  // Registration modules
  private technicalIndicatorsReg: TechnicalIndicatorsRegistration;
  private advancedAnalysisReg: AdvancedAnalysisRegistration;
  private structureAnalysisReg: StructureAnalysisRegistration;
  private levelAnalysisReg: LevelAnalysisRegistration;
  private liquidityAnalysisReg: LiquidityAnalysisRegistration;
  private smcAnalysisReg: SmcAnalysisRegistration;
  private filtersProtectionReg: FiltersProtectionRegistration;
  private deltaScalpingReg: DeltaScalpingRegistration;
  private whaleDetectionReg: WhaleDetectionRegistration;

  constructor(
    private analyzerRegistry: AnalyzerRegistry,
    private logger: LoggerService,
    private config: any,
    // Dependencies
    private rsiAnalyzer: MultiTimeframeRSIAnalyzer,
    private emaAnalyzer: MultiTimeframeEMAAnalyzer,
    private priceMomentumAnalyzer: PriceMomentumAnalyzer,
    private atrIndicator: ATRIndicator,
    private liquidityDetector: LiquidityDetector,
    private divergenceDetector: DivergenceDetector,
    private breakoutPredictor: BreakoutPredictor,
    private btcAnalyzer?: BTCAnalyzer | null,
    private stochasticIndicator?: StochasticIndicator,
    private bollingerIndicator?: BollingerBandsIndicator,
    private flatMarketDetector?: FlatMarketDetector | null,
    private deltaAnalyzerService?: DeltaAnalyzerService | null,
    private orderbookImbalanceService?: OrderbookImbalanceService | null,
  ) {
    // Initialize core analyzers
    const levelConfig = this.config?.strategies?.levelBased?.levelClustering || {};
    this.levelAnalyzer = new LevelAnalyzer(this.logger, {
      clusterThresholdPercent: levelConfig.clusterThresholdPercent ?? 0.5,
      minTouchesRequired: this.config?.strategies?.levelBased?.minTouchesRequired ?? 3,
      minTouchesForStrong: levelConfig.minTouchesForStrong ?? 5,
      maxDistancePercent: this.config?.strategies?.levelBased?.maxDistancePercent ?? 1.0,
      veryCloseDistancePercent: 0.3,
      recencyDecayDays: 7,
      volumeBoostThreshold: 1.5,
      baseConfidence: levelConfig.baseConfidence ?? 60,
      maxConfidence: 90,
    });

    const volumeProfileConfig = this.config?.volumeProfile || {};
    this.volumeProfileAnalyzer = new VolumeProfileAnalyzer(this.logger, {
      lookbackCandles: volumeProfileConfig.lookbackCandles ?? 200,
      valueAreaPercent: volumeProfileConfig.valueAreaPercent ?? 70,
      priceTickSize: volumeProfileConfig.priceTickSize ?? 0.1,
      hvnThreshold: 1.5,
      lvnThreshold: 0.5,
      maxDistancePercent: this.config?.strategies?.levelBased?.maxDistancePercent ?? 1.0,
      baseConfidence: 60,
      maxConfidence: 85,
    });

    // Initialize new analyzers (FIX #1-5)
    const rsiSignalAnalyzer = new RSISignalAnalyzer(this.logger, this.config?.analyzerStrategic?.rsiAnalyzer);
    const chochBosSignalAnalyzer = new ChochBosSignalAnalyzer(this.logger, this.config?.analyzerStrategic?.chochBosDetector);
    const footprintSignalAnalyzer = new FootprintSignalAnalyzer(this.logger, this.config?.analyzerStrategic?.footprintAnalyzer);
    const hiddenDivergenceAnalyzer = new HiddenDivergenceSignalAnalyzer(this.logger, this.config?.analyzerStrategic?.hiddenDivergence);
    const wickSignalAnalyzer = new WickSignalAnalyzer(this.logger, this.config?.analyzerStrategic?.wickAnalyzer);

    // Initialize registration modules
    this.technicalIndicatorsReg = new TechnicalIndicatorsRegistration(
      rsiSignalAnalyzer,
      rsiAnalyzer,
      emaAnalyzer,
      atrIndicator,
      stochasticIndicator,
      bollingerIndicator,
    );

    this.advancedAnalysisReg = new AdvancedAnalysisRegistration(
      hiddenDivergenceAnalyzer,
      wickSignalAnalyzer,
      priceMomentumAnalyzer,
      breakoutPredictor,
    );

    const trendConflictDetector = new TrendConflictDetector(this.logger, this.config?.analyzerStrategic?.trendConflictDetector);
    this.structureAnalysisReg = new StructureAnalysisRegistration(
      chochBosSignalAnalyzer,
      trendConflictDetector,
    );

    this.levelAnalysisReg = new LevelAnalysisRegistration(
      this.levelAnalyzer,
      this.volumeProfileAnalyzer,
    );

    this.liquidityAnalysisReg = new LiquidityAnalysisRegistration();
    this.smcAnalysisReg = new SmcAnalysisRegistration(footprintSignalAnalyzer);

    this.filtersProtectionReg = new FiltersProtectionRegistration(btcAnalyzer, this.btcCandlesStore);

    this.deltaScalpingReg = new DeltaScalpingRegistration(deltaAnalyzerService, orderbookImbalanceService);
    this.whaleDetectionReg = new WhaleDetectionRegistration();
  }

  /**
   * Set the BTC candles store (used to access pre-loaded BTC candles)
   */
  setBtcCandlesStore(store: { btcCandles1m: any[] }): void {
    this.btcCandlesStore = store;
    this.filtersProtectionReg?.setBtcCandlesStore(store);
    if (this.config?.btcConfirmation?.enabled) {
      this.logger.debug('🔗 BTC candles store configured for AnalyzerRegistrationService');
    }
  }

  /**
   * Register all analyzers by delegating to specialized modules
   * Called during TradingOrchestrator initialization
   */
  registerAllAnalyzers(): void {
    this.logger.info('📊 Starting analyzer registration across 9 modules...');

    // Register analyzers by category
    this.technicalIndicatorsReg.register(this.analyzerRegistry, this.logger, this.config);
    this.advancedAnalysisReg.register(this.analyzerRegistry, this.logger, this.config);
    this.structureAnalysisReg.register(this.analyzerRegistry, this.logger, this.config);
    this.levelAnalysisReg.register(this.analyzerRegistry, this.logger, this.config);
    this.liquidityAnalysisReg.register(this.analyzerRegistry, this.logger, this.config);
    this.smcAnalysisReg.register(this.analyzerRegistry, this.logger, this.config);
    this.filtersProtectionReg.register(this.analyzerRegistry, this.logger, this.config);
    this.deltaScalpingReg.register(this.analyzerRegistry, this.logger, this.config);
    this.whaleDetectionReg.register(this.analyzerRegistry, this.logger, this.config);

    this.logger.info('✅ All 45+ analyzers registered in unified voting system', {
      totalRegistered: this.analyzerRegistry.getCount(),
      enabledCount: this.analyzerRegistry.getEnabledCount(),
    });
  }
}
