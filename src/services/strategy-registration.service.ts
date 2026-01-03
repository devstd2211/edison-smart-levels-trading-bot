/**
 * Strategy Registration Service (Week 13 Phase 5a Extract)
 *
 * Extracted from trading-orchestrator.service.ts constructor
 * Responsible for all strategy registration and initialization
 *
 * Responsibilities:
 * - Traditional strategy registration (TrendFollowing, LevelBased, CounterTrend)
 * - Whale detection strategies (WhaleHunter, WhaleHunterFollow)
 * - Scalping strategies (MicroWall, TickDelta, LadderTP, LimitOrder, OrderFlow)
 * - Advanced strategies (FractalBreakoutRetest)
 * - Weight matrix calculator initialization
 */

import {
  LoggerService,
  OrchestratorConfig,
  DailyLevelTracker,
  BreakoutDetector,
  RetestPhaseAnalyzer,
  MarketStructureAnalyzer,
  VolumeAnalyzer,
  EntryRefinementAnalyzer,
} from '../types';
import { StrategyCoordinator } from './strategy-coordinator.service';
import { WeightMatrixCalculatorService } from './weight-matrix-calculator.service';
import { LevelBasedStrategy } from '../strategies/level-based.strategy';
import { WhaleHunterStrategy } from '../strategies/whale-hunter.strategy';
import { WhaleHunterFollowStrategy } from '../strategies/whale-hunter-follow.strategy';
import { WhaleDetectorService } from './whale-detector.service';
import { WhaleDetectorFollowService } from './whale-detector-follow.service';
import { OrderBookAnalyzer } from '../analyzers/orderbook.analyzer';
import { VolatilityRegimeService } from './volatility-regime.service';
import { ScalpingMicroWallStrategy } from '../strategies/scalping-micro-wall.strategy';
import { MicroWallDetectorService } from './micro-wall-detector.service';
import { ScalpingLimitOrderStrategy } from '../strategies/scalping-limit-order.strategy';
import { ScalpingLadderTpStrategy } from '../strategies/scalping-ladder-tp.strategy';
import { ScalpingTickDeltaStrategy } from '../strategies/scalping-tick-delta.strategy';
import { ScalpingOrderFlowStrategy } from '../strategies/scalping-order-flow.strategy';
import { FractalBreakoutRetestStrategy } from '../strategies/fractal-breakout-retest.strategy';
import { BybitService } from './bybit/bybit.service';
import {
  INTEGER_MULTIPLIERS,
  THRESHOLD_VALUES,
  MULTIPLIERS,
} from '../constants';
import { FractalSmcWeightingService } from './fractal-smc-weighting.service';
import { MarketHealthMonitor } from './market-health.monitor';

/**
 * Strategy Registration Service
 * Encapsulates all strategy initialization and registration logic
 */
export class StrategyRegistrationService {
  constructor(
    private strategyCoordinator: StrategyCoordinator,
    private config: OrchestratorConfig,
    private bybitService: BybitService,
    private logger: LoggerService,
  ) {}

  /**
   * Register all enabled strategies
   */
  registerAllStrategies(): void {
    // Initialize Weight Matrix Calculator (Phase 2)
    let weightMatrixCalculator: WeightMatrixCalculatorService | undefined;
    if (this.config.weightMatrix?.enabled) {
      weightMatrixCalculator = new WeightMatrixCalculatorService(
        this.config.weightMatrix,
        this.logger,
      );
      this.logger.info('✅ Weight Matrix Calculator initialized', {
        enabled: this.config.weightMatrix.enabled,
        minConfidenceToEnter: this.config.weightMatrix.minConfidenceToEnter,
        minConfidenceForReducedSize: this.config.weightMatrix.minConfidenceForReducedSize,
      });
    }

    // Load strategy configs from config
    const strategiesConfig = this.config.strategiesConfig!;

    // ============================================================================
    // TRADITIONAL STRATEGIES (LevelBased, TrendFollowing, CounterTrend)
    // ============================================================================
    this.registerTraditionalStrategies(strategiesConfig, weightMatrixCalculator);

    // ============================================================================
    // WHALE STRATEGIES (WhaleHunter, WhaleHunterFollow)
    // ============================================================================
    this.registerWhaleStrategies();

    // ============================================================================
    // SCALPING STRATEGIES (MicroWall, TickDelta, LadderTp, LimitOrder, OrderFlow)
    // ============================================================================
    this.registerScalpingStrategies(strategiesConfig);

    // ============================================================================
    // FRACTAL BREAKOUT-RETEST STRATEGY
    // ============================================================================
    this.registerFractalStrategy();

    this.logger.info('✅ Strategy Coordinator initialized', {
      strategies: this.strategyCoordinator.getStrategies().map(s => s.name),
    });
  }

  /**
   * Register traditional strategies (TrendFollowing, LevelBased, CounterTrend)
   */
  private registerTraditionalStrategies(
    strategiesConfig: any,
    weightMatrixCalculator: WeightMatrixCalculatorService | undefined,
  ): void {
    if (strategiesConfig?.levelBased?.enabled) {
      // zigzagDepth comes from indicators.zigzagDepth via entryConfig
      const levelBasedConfig = {
        ...strategiesConfig.levelBased,
        zigzagDepth: this.config.entryConfig.zigzagDepth,
      };

      // Create VolatilityRegimeService if enabled in config
      let volatilityRegimeService: VolatilityRegimeService | undefined;
      const vrConfig = (this.config as any).volatilityRegime;
      const thresholdsRegimes = (this.config as any).thresholds?.regimes;
      if (vrConfig?.enabled) {
        // Merge thresholds.regimes if available (new hierarchical config)
        const mergedConfig = thresholdsRegimes
          ? { ...vrConfig, regimes: thresholdsRegimes }
          : vrConfig;
        volatilityRegimeService = new VolatilityRegimeService(this.logger, mergedConfig);
        this.logger.info('📊 LevelBased Strategy: Volatility Regime enabled');
      }

      // Create OrderBookAnalyzer for orderbook validation (if enabled in config)
      let orderbookAnalyzer: OrderBookAnalyzer | undefined;
      const obValidation = (strategiesConfig.levelBased.levelClustering as any)?.orderbookValidation;
      if (obValidation?.enabled) {
        const orderbookConfig = {
          enabled: true,
          depth: 50,
          wallThreshold: obValidation.minWallPercent ?? 5,
          imbalanceThreshold: 1.3,
          updateIntervalMs: 5000,
        };
        orderbookAnalyzer = new OrderBookAnalyzer(orderbookConfig, this.logger);
        this.logger.info('📊 LevelBased Strategy: Orderbook validation enabled');
      }

      this.strategyCoordinator.registerStrategy(
        new LevelBasedStrategy(
          levelBasedConfig,
          this.logger,
          weightMatrixCalculator,
          volatilityRegimeService,
          orderbookAnalyzer,
        ),
      );
      this.logger.info('📊 Level Based Strategy registered');
    }
  }

  /**
   * Register whale detection strategies
   */
  private registerWhaleStrategies(): void {
    if (this.config.whaleHunter?.enabled) {
      const whaleDetector = new WhaleDetectorService(
        this.config.whaleHunter.detector,
        this.logger,
      );

      const orderbookConfig = {
        enabled: true,
        depth: INTEGER_MULTIPLIERS.FIFTY,
        wallThreshold: THRESHOLD_VALUES.TEN_PERCENT,
        imbalanceThreshold: MULTIPLIERS.ONE_AND_HALF,
        updateIntervalMs: INTEGER_MULTIPLIERS.FIVE_THOUSAND,
      };
      const orderbookAnalyzer = new OrderBookAnalyzer(orderbookConfig, this.logger);

      this.strategyCoordinator.registerStrategy(
        new WhaleHunterStrategy(
          {
            ...this.config.whaleHunter,
            sessionBasedSL: this.config.sessionBasedSL,
          },
          whaleDetector,
          orderbookAnalyzer,
          this.logger,
        ),
      );

      this.logger.info('🐋 Whale Hunter Strategy registered', {
        priority: this.config.whaleHunter.priority,
        minConfidence: this.config.whaleHunter.minConfidence,
      });
    }

    if (this.config.whaleHunterFollow?.enabled) {
      const whaleDetectorFollow = new WhaleDetectorFollowService(
        this.config.whaleHunterFollow.detector,
        this.logger,
      );

      const orderbookConfig = {
        enabled: true,
        depth: INTEGER_MULTIPLIERS.FIFTY,
        wallThreshold: THRESHOLD_VALUES.TEN_PERCENT,
        imbalanceThreshold: MULTIPLIERS.ONE_AND_HALF,
        updateIntervalMs: INTEGER_MULTIPLIERS.FIVE_THOUSAND,
      };
      const orderbookAnalyzer = new OrderBookAnalyzer(orderbookConfig, this.logger);

      this.strategyCoordinator.registerStrategy(
        new WhaleHunterFollowStrategy(
          {
            ...this.config.whaleHunterFollow,
            sessionBasedSL: this.config.sessionBasedSL,
          },
          whaleDetectorFollow,
          orderbookAnalyzer,
          this.logger,
        ),
      );

      this.logger.info('🐋 Whale Hunter Follow Strategy registered', {
        priority: this.config.whaleHunterFollow.priority,
        minConfidence: this.config.whaleHunterFollow.minConfidence,
      });
    }
  }

  /**
   * Register scalping strategies (MicroWall, TickDelta, LadderTP, LimitOrder, OrderFlow)
   */
  private registerScalpingStrategies(strategiesConfig: any): void {
    if (this.config.scalpingMicroWall?.enabled) {
      this.logger.info('📊 Registering Scalping Micro Wall Strategy...');

      const microWallDetector = new MicroWallDetectorService(
        this.config.scalpingMicroWall.detector,
        this.logger,
      );

      this.strategyCoordinator.registerStrategy(
        new ScalpingMicroWallStrategy(
          this.config.scalpingMicroWall,
          microWallDetector,
          this.logger,
        ),
      );

      this.logger.info('📊 Scalping Micro Wall Strategy registered', {
        priority: this.config.scalpingMicroWall.priority,
        minConfidence: this.config.scalpingMicroWall.minConfidence,
        takeProfitPercent: this.config.scalpingMicroWall.takeProfitPercent,
        stopLossPercent: this.config.scalpingMicroWall.stopLossPercent,
      });
    }

    if (this.config.scalpingLimitOrder?.enabled) {
      this.logger.info('💰 Registering Scalping Limit Order Strategy (fee optimization wrapper)...');

      this.strategyCoordinator.registerStrategy(
        new ScalpingLimitOrderStrategy(
          this.config.scalpingLimitOrder,
          this.logger,
        ),
      );

      this.logger.info('💰 Scalping Limit Order Strategy registered', {
        priority: this.config.scalpingLimitOrder.priority,
        baseSignalSource: this.config.scalpingLimitOrder.baseSignalSource,
        timeoutMs: this.config.scalpingLimitOrder.executor.timeoutMs,
        slippagePercent: this.config.scalpingLimitOrder.executor.slippagePercent,
        feeSavings: '0.05% per trade',
      });
    }

    if (this.config.scalpingLadderTp?.enabled) {
      this.logger.info('🎯 Registering Scalping Ladder TP Strategy (multi-level exit wrapper)...');

      this.strategyCoordinator.registerStrategy(
        new ScalpingLadderTpStrategy(
          this.config.scalpingLadderTp,
          this.bybitService,
          this.logger,
        ),
      );

      this.logger.info('🎯 Scalping Ladder TP Strategy registered', {
        priority: this.config.scalpingLadderTp.priority,
        baseSignalSource: this.config.scalpingLadderTp.baseSignalSource,
        levels: this.config.scalpingLadderTp.ladderManager.levels.length,
        tpLevels: this.config.scalpingLadderTp.ladderManager.levels
          .map((l: { pricePercent: number; closePercent: number }) => `${l.pricePercent}%`)
          .join(', '),
        rrRatio: '~1.26:1',
      });
    }

    if (this.config.scalpingTickDelta?.enabled) {
      this.logger.info('📊 Registering Scalping Tick Delta Strategy...');

      this.strategyCoordinator.registerStrategy(
        new ScalpingTickDeltaStrategy(
          this.config.scalpingTickDelta,
          this.logger,
        ),
      );

      this.logger.info('📊 Scalping Tick Delta Strategy registered', {
        priority: this.config.scalpingTickDelta.priority,
        minDeltaRatio: this.config.scalpingTickDelta.analyzer.minDeltaRatio,
        takeProfitPercent: this.config.scalpingTickDelta.takeProfitPercent,
        stopLossPercent: this.config.scalpingTickDelta.stopLossPercent,
        rrRatio: '2:1',
      });
    }

    if (this.config.scalpingOrderFlow?.enabled) {
      this.logger.info('📊 Registering Scalping Order Flow Strategy...');

      this.strategyCoordinator.registerStrategy(
        new ScalpingOrderFlowStrategy(
          this.config.scalpingOrderFlow,
          this.logger,
        ),
      );

      this.logger.info('📊 Scalping Order Flow Strategy registered', {
        priority: this.config.scalpingOrderFlow.priority,
        aggressiveBuyThreshold: this.config.scalpingOrderFlow.analyzer.aggressiveBuyThreshold,
        takeProfitPercent: this.config.scalpingOrderFlow.takeProfitPercent,
        stopLossPercent: this.config.scalpingOrderFlow.stopLossPercent,
        rrRatio: '2:1',
      });
    }
  }

  /**
   * Register fractal breakout-retest strategy
   */
  private registerFractalStrategy(): void {
    if (this.config.fractalBreakoutRetest?.enabled) {
      this.logger.info('🔆 Registering Fractal Breakout-Retest Strategy...');

      const dailyLevelTracker = new DailyLevelTracker(
        this.config.fractalBreakoutRetest.dailyLevelConfig,
        this.logger,
      );

      const breakoutDetector = new BreakoutDetector(
        this.config.fractalBreakoutRetest.dailyLevelConfig,
        this.logger,
      );

      const retestAnalyzer = new RetestPhaseAnalyzer(
        this.config.fractalBreakoutRetest.dailyLevelConfig,
        this.logger,
      );

      const marketStructureConfig = (this.config.analysisConfig as any)?.marketStructure || {
        chochAlignedBoost: 1.3,
        chochAgainstPenalty: 0.5,
        bosAlignedBoost: 1.1,
        noModification: 1.0,
      };
      const marketStructureAnalyzer = new MarketStructureAnalyzer(
        marketStructureConfig,
        this.logger,
      );

      const volumeAnalyzer = new VolumeAnalyzer();

      const entryRefinement = new EntryRefinementAnalyzer(
        this.config.fractalBreakoutRetest.entryRefinementConfig || {
          minVolumeConfirmationRatio: 0.9,
          pinBarBodyRatioThreshold: 0.3,
          wickRatioThreshold: 0.5,
          structureAlignmentMargin: 0.95,
          volatilityCheckRatio: 0.5,
          strongCandleBodyRatio: 0.6,
          minConditionsToConfirm: 2,
          localHighLowBars: 10,
        },
        marketStructureAnalyzer,
        volumeAnalyzer,
        this.logger,
      );

      const weightingConfig = {
        threshold: this.config.fractalBreakoutRetest.minCombinedScore,
        highConfidenceThreshold: this.config.fractalBreakoutRetest.highConfidenceThreshold,
        maxFractalScore: 125,
        maxSmcScore: 110,
      };

      const weightingService = new FractalSmcWeightingService(
        weightingConfig,
        this.logger,
      );

      const marketHealthConfig = this.config.marketHealth || {
        enabled: true,
        minWinRate: 0.4,
        minProfitFactor: 1.2,
        maxConsecutiveLosses: 5,
        maxDrawdown: 0.15,
      };

      const healthMonitor = new MarketHealthMonitor(
        marketHealthConfig,
        this.logger,
      );

      this.strategyCoordinator.registerStrategy(
        new FractalBreakoutRetestStrategy(
          this.config.fractalBreakoutRetest,
          dailyLevelTracker,
          breakoutDetector,
          retestAnalyzer,
          entryRefinement,
          volumeAnalyzer,
          weightingService,
          healthMonitor,
          this.logger,
        ),
      );

      this.logger.info('🔆 Fractal Breakout-Retest Strategy registered', {
        priority: this.config.fractalBreakoutRetest.priority,
        minCombinedScore: this.config.fractalBreakoutRetest.minCombinedScore,
        highConfidenceThreshold: this.config.fractalBreakoutRetest.highConfidenceThreshold,
        rrRatio: `${this.config.fractalBreakoutRetest.rrRatio.tp1}:${this.config.fractalBreakoutRetest.rrRatio.tp2}:${this.config.fractalBreakoutRetest.rrRatio.tp3}`,
      });
    }
  }
}
