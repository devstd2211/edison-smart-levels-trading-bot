import { DECIMAL_PLACES, INTEGER_MULTIPLIERS, BACKTEST_CONSTANTS } from '../constants';
/**
 * Trading Orchestrator
 *
 * The "brain" of the trading system. Coordinates:
 * - Context analysis (PRIMARY/TREND timeframes)
 * - Entry scanning (ENTRY timeframe)
 * - Trade execution
 *
 * Flow:
 * 1. PRIMARY candle closes → Update context
 * 2. ENTRY candle closes → Scan for entries using context
 * 3. Entry found → Execute trade
 */

import {
  TradingContext,
  TimeframeRole,
  Candle,
  LoggerService,
  IStrategy,
  OrderBook,
  TrendAnalysis,
  OrchestratorConfig,
  ExitType,
  Position,
} from '../types/legacy';
import { TrendBias, SignalDirection } from '../types/legacy';
// PHASE 4: ContextAnalyzer archived to src/archive/phase4-integration/
// Replaced by TrendAnalyzer (PRIMARY component)
import { CandleProvider } from '../providers/candle.provider';
import type { IExchange } from '../interfaces/IExchange';
import { PositionLifecycleService } from './position-lifecycle.service';
import { TelegramService } from './telegram.service';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { RiskManager } from './risk-manager.service';
import { ExitOrchestrator } from '../orchestrators/exit.orchestrator';
import { EntryOrchestrator } from '../orchestrators/entry.orchestrator';
import { PositionExitingService } from './position-exiting.service';
import { SwingPointDetectorService } from './swing-point-detector.service';
import { MultiTimeframeTrendService } from './multi-timeframe-trend.service';
import { TimeframeWeightingService } from './timeframe-weighting.service';
import { AnalyzerRegistryService } from './analyzer-registry.service';
import { AnalyzerEngineService } from './analyzer-engine.service';
import { FilterOrchestrator } from '../orchestrators/filter.orchestrator';
import { MTFSnapshotGate } from './mtf-snapshot-gate.service';
import { IndicatorRegistry } from './indicator-registry.service';
import { IndicatorLoader } from '../loaders/indicator.loader';
import { IndicatorType, ActionType, IActionHandler, OpenPositionAction, ClosePercentAction, UpdateStopLossAction, ActivateTrailingAction } from '../types/legacy';
import { ActionQueueService } from './action-queue.service';
import { OpenPositionHandler } from '../action-handlers/open-position.handler';
import { ClosePercentHandler } from '../action-handlers/close-percent.handler';
import { UpdateStopLossHandler } from '../action-handlers/update-stop-loss.handler';
import { ActivateTrailingHandler } from '../action-handlers/activate-trailing.handler';
import { IndicatorPreCalculationService } from './indicator-precalculation.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import type { ILifecycle } from '../interfaces/ILifecycle';
import { aggregateSignalsWeighted, buildAggregationConfig } from '../decision-engine/signal-aggregation';
import { Signal } from '../types/signal';
import { getErrorMessage } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';
import {
  asRecord,
  buildAnalyzerExecutionConfig,
  buildAnalyzerRegistryConfig,
  getAnalyzerDefaultsFromRuntimeConfig,
  getConfiguredAnalyzersFromRuntimeConfig,
  getIndicatorsConfigFromRuntimeConfig,
  isEnabledAnalyzerConfig,
  type AnalyzerConfigInput,
} from './trading-orchestrator/trading-orchestrator-config.utils';

// ============================================================================
// TYPES
// ============================================================================

interface SignalTakeProfit {
  price: number;
  percent: number;
  level?: number;
}

interface EnrichedSignal {
  type?: string;
  source?: string;
  direction: SignalDirection | 'LONG' | 'SHORT';
  confidence?: number;
  signalCount?: number;
  aggregationContext?: {
    signalCount: number;
    longSignalCount: number;
    shortSignalCount: number;
    originalSignals: Signal[];
  };
  price?: number;
  stopLoss?: number;
  entryPrice?: number;
  takeProfits?: SignalTakeProfit[];
  leverage?: number;
  symbol?: string;
  reason?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface PendingEntryDecision {
  decision: 'ENTER';
  signal: EnrichedSignal;
  timestamp: number;
  primaryCandle: Candle;
  snapshotId?: string;
}

type RuntimeOrchestratorConfig = OrchestratorConfig & {
  minSignals?: number;
  analyzerDefaults?: Record<string, Record<string, unknown>>;
  analyzers?: Record<string, unknown> | unknown[];
  filters?: unknown;
};

interface IndicatorPreCalcCacheStats {
  hitRate: number;
  hits: number;
  misses: number;
  size: number;
  capacity: number;
  evictions: number;
}

interface IndicatorPreCalcCache {
  getStats?: () => IndicatorPreCalcCacheStats;
}

interface IndicatorPreCalcWithCache {
  cache?: IndicatorPreCalcCache;
}

// ============================================================================
// TRADING ORCHESTRATOR
// ============================================================================

export class TradingOrchestrator implements ILifecycle {
  // Core services
  private indicatorRegistry: IndicatorRegistry | null = null;
  private indicatorLoader: IndicatorLoader | null = null;
  private analyzerRegistry: AnalyzerRegistryService | null = null;
  private analyzerEngine: AnalyzerEngineService | null = null;
  private filterOrchestrator: FilterOrchestrator | null = null;
  private currentContext: TradingContext | null = null;
  private currentOrderbook: OrderBook | null = null;

  // Orchestrators
  private entryOrchestrator: EntryOrchestrator | null = null;
  private exitOrchestrator: ExitOrchestrator | null = null;
  private positionExitingService: PositionExitingService | null = null;

  // Action Queue (Phase 0.4)
  private actionQueue: ActionQueueService | null = null;
  private actionHandlers: IActionHandler[] = [];

  // Entry decision tracking (for PRIMARY->ENTRY refinement)
  private pendingEntryDecision: PendingEntryDecision | null = null;

  // MTF Snapshot Gate (fixes race condition between HTF bias changes and ENTRY execution)
  private snapshotGate: MTFSnapshotGate | null = null;

  // Pre-calculation Service (Phase 0.2 Integration - optional)
  private indicatorPreCalc: IndicatorPreCalculationService | null = null;

  // DEBUG: Allow testing without real signals
  private testModeEnabled: boolean = false;
  private testModeSignalCount: number = 0;
  private started = false;

  constructor(
    private config: OrchestratorConfig,
    private candleProvider: CandleProvider,
    private timeframeProvider: TimeframeProvider,
    private bybitService: IExchange,
    private positionManager: PositionLifecycleService,
    private telegram: TelegramService | null,
    private logger: LoggerService,
    private riskManager: RiskManager,
    private positionExitingServiceInject?: PositionExitingService | null,
  ) {
  }

  /**
   * Start orchestrator services (lifecycle)
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    // Initialize indicator loading infrastructure
    this.indicatorRegistry = new IndicatorRegistry();
    this.registerAllIndicators();
    this.indicatorLoader = new IndicatorLoader(this.indicatorRegistry, this.logger);

    // Initialize new black-box services
    this.analyzerRegistry = new AnalyzerRegistryService(this.logger);
    this.analyzerEngine = new AnalyzerEngineService(this.analyzerRegistry, this.logger);
    const filterConfig = this.getRuntimeConfig().filters || {};
    this.filterOrchestrator = new FilterOrchestrator(this.logger, filterConfig);

    // Load indicators from config and pass to analyzer registry
    await this.loadIndicatorsAndInitializeAnalyzers();

    // Initialize MTF Snapshot Gate (fixes race condition)
    this.snapshotGate = new MTFSnapshotGate(this.logger);
    this.snapshotGate.start();

    // Initialize EntryOrchestrator with FilterOrchestrator
    this.entryOrchestrator = new EntryOrchestrator(
      this.riskManager,
      this.logger,
      this.filterOrchestrator,
    );

    // Initialize Action Queue (Phase 0.4)
    this.actionQueue = new ActionQueueService();
    this.initializeActionHandlers();

    // Initialize context on startup (async)
    await this.initializeContext();
  }

  /**
   * Stop orchestrator services (lifecycle)
   */
  stop(): void {
    if (!this.started) {
      return;
    }
    this.snapshotGate?.stop();
    this.started = false;
  }

  /**
   * Initialize action handlers for the queue
   * Called during construction to set up handlers
   */
  private initializeActionHandlers(): void {
    if (!this.actionQueue || !this.positionManager) return;

    // Use injected PositionExitingService if provided
    if (this.positionExitingServiceInject) {
      this.positionExitingService = this.positionExitingServiceInject;
    }

    // If no PositionExitingService is available, handlers will be created without exit handlers
    if (!this.positionExitingService) {
      this.logger.warn(`${ICONS.warning} PositionExitingService not available - exit handlers will not work`);
    }

    // Create and register all action handlers
    this.actionHandlers = [
      new OpenPositionHandler(this.positionManager, this.logger),
    ];

    // Only add exit handlers if PositionExitingService is available
    if (this.positionExitingService) {
      this.actionHandlers.push(
        new ClosePercentHandler(this.positionExitingService, this.positionManager, this.logger),
        new UpdateStopLossHandler(this.positionExitingService, this.positionManager, this.logger),
        new ActivateTrailingHandler(this.positionExitingService, this.positionManager, this.logger),
      );
    }

    this.logger.debug(`${ICONS.success} Action handlers initialized`, {
      handlerCount: this.actionHandlers.length,
      handlers: this.actionHandlers.map(h => h.name),
    });
  }

  /**
   * Set the pre-calculation service for indicator caching
   * Called by services builder during initialization (Phase 0.2 Integration)
   */
  setIndicatorPreCalculationService(preCalc: IndicatorPreCalculationService): void {
    this.indicatorPreCalc = preCalc;
    this.logger.debug('🔗 Pre-calculation service wired to TradingOrchestrator');
  }

  /**
   * Log cache statistics (for monitoring)
   * Can be called periodically by services or bot.ts
   */
  logCacheStats(): void {
    const cache = this.getPreCalcCache();
    if (cache?.getStats) {
        const stats = cache.getStats();
        this.logger.info(`${ICONS.chart} Indicator Cache Statistics`, {
          hitRate: `${stats.hitRate.toFixed(2)}%`,
          hits: stats.hits,
          misses: stats.misses,
          entries: `${stats.size}/${stats.capacity}`,
          evictions: stats.evictions,
        });
      }
  }

  /**
   * Enable test mode - allows opening positions without real signals
   * Used for debugging/testing position opening workflow
   */
  enableTestMode(): void {
    this.testModeEnabled = true;
    this.logger.info(`${ICONS.test} TEST MODE ENABLED - Positions will open without real signals`);
  }

  /**
   * Disable test mode
   */
  disableTestMode(): void {
    this.testModeEnabled = false;
    this.testModeSignalCount = 0;
    this.logger.info(`${ICONS.test} TEST MODE DISABLED - Normal mode restored`);
  }

  /**
   * Initialize context on startup
   */
  private async initializeContext(): Promise<void> {
    // PHASE 4: Context initialization removed
    // ContextAnalyzer is archived - replaced by TrendAnalyzer
    // currentContext is now populated by updateTrendContext() on PRIMARY candle close
    this.logger.info(`${ICONS.note} Trading context will be initialized on first PRIMARY candle close (TrendAnalyzer)`);
  }

  /**
   * Register all available indicator types in the registry
   * Called during construction to populate the IndicatorRegistry
   */
  private registerAllIndicators(): void {
    if (!this.indicatorRegistry) return;

    this.indicatorRegistry.register(IndicatorType.EMA, {
      type: IndicatorType.EMA,
      name: 'Exponential Moving Average',
      description: 'Fast and slow EMA for trend analysis',
      enabled: true,
    });

    this.indicatorRegistry.register(IndicatorType.RSI, {
      type: IndicatorType.RSI,
      name: 'Relative Strength Index',
      description: 'RSI for overbought/oversold conditions',
      enabled: true,
    });

    this.indicatorRegistry.register(IndicatorType.ATR, {
      type: IndicatorType.ATR,
      name: 'Average True Range',
      description: 'ATR for volatility measurement',
      enabled: true,
    });

    this.indicatorRegistry.register(IndicatorType.VOLUME, {
      type: IndicatorType.VOLUME,
      name: 'Volume',
      description: 'Volume analysis',
      enabled: true,
    });

    this.indicatorRegistry.register(IndicatorType.STOCHASTIC, {
      type: IndicatorType.STOCHASTIC,
      name: 'Stochastic Oscillator',
      description: 'Stochastic for momentum analysis',
      enabled: true,
    });

    this.indicatorRegistry.register(IndicatorType.BOLLINGER_BANDS, {
      type: IndicatorType.BOLLINGER_BANDS,
      name: 'Bollinger Bands',
      description: 'Bollinger Bands for volatility and support/resistance',
      enabled: true,
    });

    this.logger.debug(`${ICONS.note} Indicator Registry initialized with 6 indicators`);
  }

  /**
   * Load indicators from config and pass to AnalyzerRegistry
   * This ensures analyzers have access to all loaded indicators through DI
   */
  private async loadIndicatorsAndInitializeAnalyzers(): Promise<void> {
    try {
      if (!this.indicatorLoader || !this.analyzerRegistry) {
        this.logger.warn('Indicator loading skipped - loader or registry not initialized');
        return;
      }

      const indicatorsConfig = this.getIndicatorsConfig();
      this.logger.info(`${ICONS.chart} Loading indicators from config`, {
        configKeys: Object.keys(indicatorsConfig),
      });

      // DEBUG: Log enabled status for each indicator
      const enabledStatus: Record<string, boolean> = {};
      Object.entries(indicatorsConfig).forEach(([key, val]) => {
        enabledStatus[key] = this.isEnabledAnalyzerConfig(val);
      });
      this.logger.debug(`${ICONS.note} Indicator enabled status in TradingOrchestrator:`, enabledStatus);

      const indicators = await this.indicatorLoader.loadIndicators(
        indicatorsConfig as unknown as Parameters<IndicatorLoader['loadIndicators']>[0],
      );

      // Pass loaded indicators to AnalyzerRegistry so analyzers can receive them
      this.analyzerRegistry.setIndicators(indicators);

      this.logger.info(`${ICONS.success} Indicators loaded and passed to AnalyzerRegistry`, {
        count: indicators.size,
        types: Array.from(indicators.keys()),
      });
    } catch (error) {
      this.logger.error(`${ICONS.error} Failed to load indicators:`, {
        error: getErrorMessage(error),
      });
      // Don't throw - allow bot to continue without indicators
      // Analyzers will handle missing indicators gracefully
    }
  }

  /**
   * Set the BTC candles store (used to access pre-loaded BTC candles)
   * Called by services after initialization
   */
  setBtcCandlesStore(store: { btcCandles1m: Candle[] }): void {
    this.logger.info(`${ICONS.plug} BTC candles store linked to TradingOrchestrator`);
  }

  /**
   * Initialize trend analysis from loaded candles
   * Called by services after candles are loaded
   */
  async initializeTrendAnalysis(): Promise<void> {
    // Trend analysis is initialized by market data preparation on candle close
    this.logger.info(`${ICONS.note} Trend analysis will be initialized on first market data update`);
  }

  /**
   * Handle candle close event
   * Called by Bot when candle closes on any timeframe
   * Week 13 Phase 5d: Thin dispatcher - delegates to specialized services
   */
  async onCandleClosed(role: TimeframeRole, candle: Candle): Promise<void> {
    try {
      // Phase 0.2 Integration: Trigger pre-calculation of indicators on candle close
      // This ensures indicators are cached before analyzers need them
      if (this.indicatorPreCalc) {
        try {
          await this.indicatorPreCalc.onCandleClosed(role, candle.timestamp);
        } catch (err) {
          this.logger.debug('Pre-calculation service error (non-critical)', {
            error: getErrorMessage(err),
          });
        }
      }

      // PRIMARY (5m) closed → MAIN ENTRY SIGNAL ANALYSIS
      // This is the DECIDING timeframe where analyzers generate entry signals
      if (role === TimeframeRole.PRIMARY) {
        // CRITICAL: Skip analysis if position already open
        // No point running expensive analyzer calculations when we can't enter anyway
        const currentPosition = this.positionManager.getCurrentPosition();
        if (currentPosition) {
          this.logger.info(`${ICONS.chart} PRIMARY (5m) candle closed - SKIP ANALYSIS (already in position)`, {
            positionId: currentPosition.id,
            side: currentPosition.side,
            ageMins: Math.floor((Date.now() - currentPosition.openedAt) / 1000 / 60),
          });
          return; // ← EXIT EARLY - Don't run expensive analyzers
        }

        this.logger.info(`${ICONS.chart} PRIMARY (5m) candle closed - ANALYZING ENTRY SIGNALS (main timeframe)`);

        try {
          // Get PRIMARY candles for analysis (this is the decision timeframe)
          const primaryCandles = await this.candleProvider.getCandles(TimeframeRole.PRIMARY, 100);
          if (!primaryCandles || primaryCandles.length < 20) {
            this.logger.debug('Not enough PRIMARY candles for entry analysis', {
              available: primaryCandles?.length || 0,
            });
            return;
          }

          // Run strategy analysis on PRIMARY timeframe (the deciding timeframe)
          const signals = await this.runStrategyAnalysis(primaryCandles);

          if (signals && signals.length > 0) {
            this.logger.info(`${ICONS.chart} Entry signals generated on PRIMARY (5m): ${signals.length}`, {
              signals: signals
                .map((s) => {
                  const signal = s as { source?: unknown; direction?: unknown; confidence?: unknown };
                  const source = typeof signal.source === 'string' ? signal.source : 'UNKNOWN';
                  const direction = typeof signal.direction === 'string' ? signal.direction : 'UNKNOWN';
                  const confidenceValue = typeof signal.confidence === 'number' ? signal.confidence : 0;
                  return `${source}(${direction}:${confidenceValue.toFixed(0)}%)`;
                })
                .join(', '),
            });

            // Evaluate signals with EntryOrchestrator
            if (this.entryOrchestrator) {
              const aggregatedSignal = this.buildAggregatedSignal(
                signals,
                primaryCandles[primaryCandles.length - 1].close,
              );
              if (!aggregatedSignal) {
                this.pendingEntryDecision = null;
                this.snapshotGate?.clearActiveSnapshot();
                this.logger.debug('Weighted aggregation rejected PRIMARY signals');
                return;
              }

              const sameDirectionBlock = this.getSameDirectionReentryBlock(
                aggregatedSignal.direction as SignalDirection,
                primaryCandles[primaryCandles.length - 1].timestamp,
              );
              if (sameDirectionBlock) {
                this.pendingEntryDecision = null;
                this.snapshotGate?.clearActiveSnapshot();
                this.logger.info('ðŸš« PRIMARY entry blocked by same-direction re-entry guard', {
                  reason: sameDirectionBlock,
                  direction: aggregatedSignal.direction,
                });
                return;
              }

              const degradationBlock = this.getDegradationBlock(
                aggregatedSignal.direction as SignalDirection,
              );
              if (degradationBlock) {
                this.pendingEntryDecision = null;
                this.snapshotGate?.clearActiveSnapshot();
                this.logger.info(`${ICONS.warning} PRIMARY entry blocked by degradation guard`, {
                  reason: degradationBlock,
                  direction: aggregatedSignal.direction,
                });
                return;
              }

              // NOTE: No position can exist here (already checked and returned above)
              // Get account balance (use configured position size as fallback)
              const runtimeRiskManager = this.getRuntimeConfig()
                .riskManager as unknown as { accountBalance?: number } | undefined;
              const configBalance = runtimeRiskManager?.accountBalance || 1000;
              const currentBalance = configBalance > 0 ? configBalance : 1000;
              const openPositions: Position[] = []; // Empty - no position exists at this point

              try {
                // Get trend bias from context
                // currentContext.trend is a TrendBias enum value, not a TrendAnalysis object
                const htfBiasValue: TrendBias = this.currentContext?.trend ?? TrendBias.NEUTRAL;

                // Create a minimal TrendAnalysis object for the entry orchestrator
                const trendAnalysis: TrendAnalysis = {
                  bias: htfBiasValue,
                  strength: 0.5,
                  timeframe: '4h',
                  reasoning: ['Context bias'],
                  restrictedDirections:
                    htfBiasValue === TrendBias.BULLISH
                      ? [SignalDirection.SHORT]
                      : htfBiasValue === TrendBias.BEARISH
                        ? [SignalDirection.LONG]
                        : [],
                };

                // Get funding rate for entry filters (optional)
                let fundingRate: number | undefined;
                try {
                  if (this.bybitService.getFundingRate) {
                    const symbol = this.candleProvider.getSymbol();
                    fundingRate = await this.bybitService.getFundingRate(symbol);
                  }
                } catch (error) {
                  // Funding rate is optional, continue without it
                  this.logger.debug('Could not fetch funding rate, continuing without it', {
                    error: getErrorMessage(error),
                  });
                }

                const entryDecision = await this.entryOrchestrator.evaluateEntry(
                  [aggregatedSignal as unknown as Signal],
                  currentBalance,
                  openPositions,
                  trendAnalysis,
                  undefined, // flatMarketAnalysis
                  fundingRate,
                  undefined, // lastTPTimestamp - TODO: wire up from session stats
                );

                this.logger.info(`${ICONS.note} EntryOrchestrator decision (PRIMARY)`, {
                  decision: entryDecision.decision,
                  reason: entryDecision.reason,
                  signal: entryDecision.signal?.type,
                });

                // Store decision for ENTRY timeframe to use for entry point refinement
                // FIXED: Use MTF Snapshot Gate to prevent race condition
                if (entryDecision.decision === 'ENTER') {
                  // CRITICAL: Enrich signal early to ensure all required fields are present
                  const signalToEnrich = (entryDecision.signal ||
                    ({
                      type: 'UNKNOWN',
                      source: 'UNKNOWN',
                      direction: SignalDirection.LONG,
                      confidence: 0,
                      price: 0,
                      stopLoss: 0,
                      takeProfits: [],
                      reason: 'Fallback signal',
                      timestamp: Date.now(),
                      symbol: this.candleProvider.getSymbol(),
                    } as unknown)) as EnrichedSignal;
                  const protectedSignal = this.enrichSignalWithProtection(signalToEnrich);
                  this.logAggregatedSignalSummary(protectedSignal);
                  const enrichedSignal = this.stripOriginalSignalsFromAggregationContext(protectedSignal);

                  // Create snapshot of trading context at PRIMARY close
                  // This prevents HTF bias changes from affecting ENTRY execution
                  if (this.snapshotGate) {
                    const riskRules = this.getRuntimeConfig()
                      .riskManager as unknown as {
                        maxRiskPercent?: number;
                        maxPositionSize?: number;
                      } | undefined;
                    const entrySnapshot = this.snapshotGate.createSnapshot(
                      htfBiasValue,
                      trendAnalysis,
                      enrichedSignal as unknown as Signal,
                      primaryCandles[primaryCandles.length - 1],
                      currentBalance,
                      {
                        maxRiskPercent: riskRules?.maxRiskPercent,
                        maxPositionSize: riskRules?.maxPositionSize,
                        minSignals: this.getRuntimeConfig().minSignals,
                      }
                    );

                    // LEGACY: Also store in pendingEntryDecision for backward compatibility
                    // (some code may still reference this)
                    this.pendingEntryDecision = {
                      decision: entryDecision.decision,
                      signal: enrichedSignal,
                      timestamp: Date.now(),
                      primaryCandle: primaryCandles[primaryCandles.length - 1],
                      snapshotId: entrySnapshot.id,
                    };

                    this.logger.info(`${ICONS.note} Snapshot created for ENTRY timeframe (HTF bias frozen)`, {
                      signalType: enrichedSignal?.type,
                      htfBias: htfBiasValue,
                      snapshotId: entrySnapshot.id.substring(0, 8),
                    });
                  }
                } else if (entryDecision.decision === 'SKIP') {
                  this.pendingEntryDecision = null;
                  if (this.snapshotGate) {
                    this.snapshotGate.clearActiveSnapshot();
                  }
                  this.logger.debug(`${ICONS.error} Entry decision skipped - clearing pending decision`);
                }
              } catch (orchestratorError) {
                // Phase 8: ErrorHandler integration - SKIP on entry evaluation failure
                const handled = await ErrorHandler.handle(orchestratorError, {
                  strategy: RecoveryStrategy.SKIP,
                  logger: this.logger,
                  context: 'TradingOrchestrator.entryOrchestrator.evaluateEntry',
                  onRecover: () => {
                    this.pendingEntryDecision = null;
                    if (this.snapshotGate) {
                      this.snapshotGate.clearActiveSnapshot();
                    }
                    this.logger.warn(`${ICONS.warning} Entry evaluation failed, skipping entry decision`);
                  }
                });

                if (!handled.success && handled.error) {
                  this.logger.error(`${ICONS.error} Critical entry orchestration failure`, {
                    code: handled.error.metadata?.code,
                    message: handled.error.message,
                    diagnostic: handled.error.toDiagnosticString?.()
                  });
                }
              }
            }
          } else {
            // Check if position exists - if yes, that's why we're not looking for signals
            const currentPosition = this.positionManager.getCurrentPosition();
            if (currentPosition) {
              this.logger.debug(`${ICONS.note} SKIP SIGNAL SCAN - Already in position`, {
                positionId: currentPosition.id,
                age: Math.floor((Date.now() - currentPosition.openedAt) / 1000 / 60),
              });
            } else {
              this.logger.debug(`${ICONS.note} No entry signals generated on PRIMARY (5m)`);
            }

            // TEST MODE: Allow opening position without signals for debugging
            if (this.testModeEnabled && this.testModeSignalCount < 1) {
              this.testModeSignalCount++;
              const currentPrice = candle.close;

              // Create a test signal for debugging
              const testSignal = {
                type: 'TEST_SIGNAL',
                source: 'TEST_MODE',
                direction: SignalDirection.LONG,
                confidence: 100,
                price: currentPrice,
                stopLoss: currentPrice * 0.98, // 2% below entry
                takeProfits: [
                  { price: currentPrice * 1.01, percent: 1.0 },
                  { price: currentPrice * 1.02, percent: 2.0 },
                  { price: currentPrice * 1.03, percent: 3.0 },
                ],
                reason: 'Test Mode Signal (no real signals)',
                timestamp: Date.now(),
                weight: 1.0,
                priority: 1,
              };

              this.logger.warn(
                `${ICONS.test} TEST MODE: Creating test signal to verify position opening workflow`,
                {
                  price: currentPrice,
                  stopLoss: testSignal.stopLoss,
                },
              );

              // Enrich and store for ENTRY timeframe
              const enrichedSignal = this.enrichSignalWithProtection(testSignal as unknown as EnrichedSignal);
              this.pendingEntryDecision = {
                decision: 'ENTER',
                signal: enrichedSignal,
                timestamp: Date.now(),
                primaryCandle: candle,
              };

              this.logger.info(`${ICONS.note} Test signal stored for ENTRY timeframe refinement`, {
                price: currentPrice,
              });
            }
          }

          // ALSO evaluate exits on PRIMARY timeframe
          this.logger.debug(`${ICONS.chart} PRIMARY candle closed - also evaluating exits`);
          const currentPosition = this.positionManager.getCurrentPosition();
          if (currentPosition && this.exitOrchestrator && this.positionExitingService) {
            try {
              const indicators = {
                ema20: undefined,
                currentVolume: candle.volume,
                avgVolume: candle.volume,
              };

              const exitResult = await this.exitOrchestrator.evaluateExit(
                currentPosition,
                candle.close,
                indicators,
              );

              if (exitResult.actions && exitResult.actions.length > 0) {
                this.logger.info(`${ICONS.warning} Exit orchestrator triggered actions`, {
                  actionCount: exitResult.actions.length,
                  transition: exitResult.stateTransition,
                });

                // Enqueue exit actions through action queue (Phase 0.4)
                await this.enqueueExitActions(exitResult.actions);
              }
            } catch (exitEvalError) {
              this.logger.error('Failed to evaluate exit conditions', {
                error: getErrorMessage(exitEvalError),
              });
            }
          }
        } catch (primaryError) {
          this.logger.error('Error analyzing PRIMARY candle', {
            error: getErrorMessage(primaryError),
          });
        }
      }

      // ENTRY (1m) closed → REFINE ENTRY POINT (only if already have signal from PRIMARY)
      // This timeframe helps find the BEST ENTRY PRICE when PRIMARY already said "we can enter"
      if (role === TimeframeRole.ENTRY) {
        if (this.pendingEntryDecision && this.pendingEntryDecision.decision === 'ENTER') {
          this.logger.info(`${ICONS.note} ENTRY (1m): Refining entry point for pending PRIMARY decision`);

          try {
            // ========================================================
            // FIX: VALIDATE SNAPSHOT BEFORE PROCEEDING
            // ========================================================
            // Re-fetch current HTF bias to detect any race condition
            // Note: currentContext.trend is a TrendBias enum value, not an object
            const currentHTFBias: TrendBias =
              this.currentContext?.trend ?? TrendBias.NEUTRAL;

            let entrySnapshotValidated = false;
            if (this.snapshotGate && this.pendingEntryDecision) {
              // FIX: Pass explicit snapshotId from pendingEntryDecision to avoid race condition
              // with activeSnapshotId being cleared/updated elsewhere
              const snapshotValidation = this.snapshotGate.validateSnapshot(
                currentHTFBias,
                this.pendingEntryDecision.snapshotId  // FIX: explicit snapshot ID
              );

              if (!snapshotValidation.valid) {
                this.logger.warn(`${ICONS.warning} ENTRY: Snapshot validation FAILED - skipping entry`, {
                  reason: snapshotValidation.reason,
                  expired: snapshotValidation.expired,
                  biasMismatch: snapshotValidation.biasMismatch,
                  // FIX: Use actual captured bias from diagnostics (not hardcoded 'captured')
                  capturedBias: snapshotValidation.diagnostics?.capturedBias || 'unknown',
                  currentBias: currentHTFBias,
                  // FIX: Add timing information
                  snapshotAge: snapshotValidation.diagnostics?.ageMs,
                  snapshotId: snapshotValidation.diagnostics?.snapshotId,
                });

                // Clear pending decision and snapshot
                this.pendingEntryDecision = null;
                this.snapshotGate.clearActiveSnapshot();
                return; // SKIP ENTRY - snapshot is invalid
              }

              entrySnapshotValidated = true;
            }

            if (!entrySnapshotValidated && this.snapshotGate) {
              this.logger.warn(`${ICONS.warning} ENTRY: Snapshot gate not available - proceeding with caution`);
            }

            // ========================================================
            // PROCEED WITH ENTRY (snapshot is valid)
            // ========================================================
            // Get latest 1-minute candles for entry point analysis
            const entryCandles = await this.candleProvider.getCandles(TimeframeRole.ENTRY, 50);
            if (!entryCandles || entryCandles.length < 5) {
              this.logger.debug('Not enough ENTRY candles for refinement', {
                available: entryCandles?.length || 0,
              });
              return;
            }

            const currentCandle = entryCandles[entryCandles.length - 1];
            const previousCandle = entryCandles[entryCandles.length - 2];

            // Check if current 1-minute candle is suitable for entry
            // (not at extremes, showing some momentum alignment)
            const candleSize = Math.abs(currentCandle.close - currentCandle.open);
            const avgCandleSize = entryCandles.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / entryCandles.length;

            const isGoodEntryPoint =
              // Not a doji (has clear direction)
              candleSize > avgCandleSize * 0.3 &&
              // Close is favorable (in direction of signal)
              (this.pendingEntryDecision.signal.direction === 'LONG'
                ? currentCandle.close > previousCandle.close
                : currentCandle.close < previousCandle.close);

            if (isGoodEntryPoint) {
              this.logger.info(`${ICONS.success} ENTRY (1m): Suitable entry point found - ready to execute`, {
                direction: this.pendingEntryDecision.signal.direction,
                price: currentCandle.close,
                candleSize,
                avgSize: avgCandleSize,
                snapshotValid: entrySnapshotValidated,
              });

              // Try to execute the trade
              try {
                this.logger.info('🚀 Opening position with signal', {
                  direction: this.pendingEntryDecision.signal.direction,
                  entryPrice: currentCandle.close,
                  confidence: this.pendingEntryDecision.signal.confidence,
                  htfBias: currentHTFBias,
                });

                // Enqueue position opening through action queue (Phase 0.4)
                await this.enqueueOpenPositionAction(this.pendingEntryDecision.signal);

                // Clear pending decision and snapshot once position opened
                this.pendingEntryDecision = null;
                if (this.snapshotGate) {
                  this.snapshotGate.clearActiveSnapshot();
                }
                this.logger.info(`${ICONS.success} Position opened successfully`);
              } catch (openPositionError) {
                this.logger.error(`${ICONS.error} Failed to open position`, {
                  error: getErrorMessage(openPositionError),
                });
              }
            } else {
              this.logger.debug('⏳ ENTRY (1m): Current candle not ideal for entry - waiting for better point', {
                direction: this.pendingEntryDecision.signal.direction,
                candleSize,
                avgSize: avgCandleSize,
                isSmallCandle: candleSize < avgCandleSize * 0.3,
                isWrongDirection: !(
                  this.pendingEntryDecision.signal.direction === 'LONG'
                    ? currentCandle.close > previousCandle.close
                    : currentCandle.close < previousCandle.close
                ),
              });
            }
          } catch (entryRefinementError) {
            this.logger.error('Error refining entry point on ENTRY timeframe', {
              error: getErrorMessage(entryRefinementError),
            });
          }
        }
        // If no pending decision from PRIMARY, ENTRY candles are ignored (that's correct)
      }
    } catch (error) {
      this.logger.error('Error in orchestrator onCandleClosed', {
        role,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Run strategy analysis (black box pattern)
   * Uses AnalyzerRegistry to dynamically load and run enabled analyzers
   */
  private async runStrategyAnalysis(entryCandles: Candle[]): Promise<Array<Record<string, unknown>>> {
    const analyzerConfigs = this.getConfiguredAnalyzers();

    if (!analyzerConfigs || analyzerConfigs.length === 0) {
      this.logger.warn(`${ICONS.warning} No analyzers configured in strategy - check config.analyzers array`);
      return [];
    }

    if (!this.analyzerEngine) {
      this.logger.error('AnalyzerEngine not initialized');
      return [];
    }

    const currentPrice = entryCandles.length > 0 ? entryCandles[entryCandles.length - 1].close : 0;

    try {
      const result = await this.analyzerEngine.executeAnalyzers(
        entryCandles,
        this.buildAnalyzerConfigForRegistry(),
        {
          executionMode: 'parallel',
          checkReadiness: true,
          filterHoldSignals: true,         // TradingOrch-specific: remove HOLD
          enrichSignals: true,             // TradingOrch-specific: add metadata
          currentPrice,
          errorHandling: 'lenient',
        }
      );

      return result.signals.map((signal) => ({
        ...signal,
        type: signal.source,
      }));
    } catch (error) {
      // Phase 8: ErrorHandler integration - SKIP on analyzer failure
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: this.logger,
        context: 'TradingOrchestrator.runStrategyAnalysis',
        onRecover: () => {
          this.logger.warn(`${ICONS.warning} Analyzer execution failed, skipping to next candle`);
        }
      });

      if (!handled.success && handled.error) {
        this.logger.error(`${ICONS.error} Critical analyzer failure`, {
          code: handled.error.metadata?.code,
          message: handled.error.message
        });
      }

      // Return empty signals (SKIP) so entry evaluation doesn't proceed
      return [];
    }
  }

  /**
   * Build analyzer config for AnalyzerRegistry
   * Returns a config object that includes indicator config and all analyzer defaults
   * Each analyzer instance will merge its specific config from this base
   */
  private buildAnalyzerConfigForRegistry(): Parameters<AnalyzerEngineService['executeAnalyzers']>[1] {
    const baseConfig = this.getIndicatorsConfig();
    const analyzerDefaults = this.getAnalyzerDefaults();

    return {
      ...buildAnalyzerRegistryConfig(baseConfig, analyzerDefaults),
    } as unknown as Parameters<AnalyzerEngineService['executeAnalyzers']>[1];
  }

  /**
   * Build analyzer config from strategy and indicator configs
   * Falls back to analyzerDefaults from main config if not specified
   */
  private buildAnalyzerConfig(analyzerCfg: AnalyzerConfigInput): Record<string, unknown> {
    return buildAnalyzerExecutionConfig(
      analyzerCfg,
      this.getIndicatorsConfig(),
      this.getAnalyzerDefaults(),
    );
  }

  /**
   * Sync time with Bybit exchange
   * CRITICAL: Prevents timestamp errors when opening positions
   */
  private async syncTimeWithExchange(): Promise<void> {
    try {
      const serverTime = await this.bybitService.getServerTime();
      const localTime = Date.now();
      const drift = localTime - serverTime;

      if (Math.abs(drift) > BACKTEST_CONSTANTS.BACKTEST_TIMEFRAME_MS) {
        this.logger.warn(`${ICONS.warning} Clock drift detected`, {
          serverTime,
          localTime,
          driftMs: drift,
          driftSec: (drift / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(DECIMAL_PLACES.PERCENT),
        });
      } else {
        this.logger.debug(`${ICONS.note} Time synced`, { driftMs: drift });
      }

      // Store time offset in BybitService for timestamp correction
      // This assumes BybitService has a timeOffset property
      // For now, just log the drift - actual correction happens in SDK
    } catch (error) {
      this.logger.warn('Failed to sync time with exchange', {
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Handle orderbook update from Public WebSocket
   * Stores orderbook data for whale detection
   */
  onOrderbookUpdate(orderbook: OrderBook): void {
    this.currentOrderbook = orderbook;
    // Note: Orderbook updates are very frequent (~20-50ms), don't log
  }

  /**
   * Check for Whale Hunter signals in real-time (called from bot.ts on orderbook updates)
   * This bypasses the candle-close trigger for time-sensitive whale detection
   *
   * @param orderbook - Current orderbook snapshot
   * @returns Promise<void> - Executes trade if whale signal found
   */
  async checkWhaleSignalRealtime(orderbook: OrderBook): Promise<void> {
    // Whale signal detection is handled by market analysis
  }

  /**
   * Enrich signal with SL/TP protection levels from strategy config
   * ATOMIC: All SL/TP levels computed and set together for atomic position opening
   * CRITICAL: Signal must have stopLoss and takeProfits arrays
   */
  private enrichSignalWithProtection(signal: EnrichedSignal): EnrichedSignal {
    const entryPrice = signal.price || 0;
    const isLong = signal.direction === 'LONG';

    // =====================================================================
    // STEP 1: Calculate Stop Loss from config (ATR-based)
    // =====================================================================
    if (typeof signal.stopLoss !== 'number' || isNaN(signal.stopLoss)) {
      const riskManagementConfig = this.getRuntimeConfig()
        .riskManagement as unknown as {
          stopLoss?: { atrMultiplier?: number; minDistancePercent?: number };
          takeProfits?: SignalTakeProfit[];
        } | undefined;
      const riskConfig = riskManagementConfig?.stopLoss || {};
      const atrMultiplier = riskConfig.atrMultiplier || 2.0;
      const minDistancePercent = riskConfig.minDistancePercent || 0.5;

      // Use min distance as fallback if ATR not available
      const slDistancePercent = Math.max(minDistancePercent, 1.0); // At least 1%
      const slDistance = (entryPrice * slDistancePercent) / 100;

      signal.stopLoss = isLong
        ? entryPrice - slDistance
        : entryPrice + slDistance;

      this.logger.warn(`${ICONS.warning} Signal enriched with calculated SL (ATR-based)`, {
        signalType: signal.type,
        direction: signal.direction,
        entryPrice,
        stopLoss: signal.stopLoss,
        slDistancePercent,
      });
    }

    // =====================================================================
    // STEP 2: Calculate Take Profit levels from strategy config (ATOMIC)
    // =====================================================================
    if (!signal.takeProfits || !Array.isArray(signal.takeProfits) || signal.takeProfits.length === 0) {
      const riskManagementConfig = this.getRuntimeConfig()
        .riskManagement as unknown as {
          stopLoss?: { atrMultiplier?: number; minDistancePercent?: number };
          takeProfits?: SignalTakeProfit[];
        } | undefined;
      const tpConfig = riskManagementConfig?.takeProfits || [];

      if (tpConfig.length > 0) {
        // Calculate TP prices based on config percentages
        signal.takeProfits = tpConfig.map((tp) => ({
          price: isLong
            ? entryPrice * (1 + tp.percent / 100)
            : entryPrice * (1 - tp.percent / 100),
          percent: tp.percent,
          level: tp.level || 1,
        }));

        this.logger.info(`${ICONS.success} Signal enriched with strategy TP levels (ATOMIC)`, {
          signalType: signal.type,
          direction: signal.direction,
          entryPrice,
          tpCount: signal.takeProfits.length,
          tpLevels: signal.takeProfits
            .map((tp) => `TP${tp.level}:${tp.price.toFixed(4)}@${tp.percent}%`)
            .join(', '),
        });
      } else {
        // No TP config - use empty array (position can still open with just SL)
        this.logger.warn(`${ICONS.warning} Signal has no TP config - opening with only SL protection`, {
          signalType: signal.type,
          direction: signal.direction,
        });
        signal.takeProfits = [];
      }
    }

    // =====================================================================
    // STEP 3: Ensure reason is string
    // =====================================================================
    if (typeof signal.reason !== 'string') {
      signal.reason = `${signal.type} @ ${signal.confidence?.toFixed(1) || '?'}% confidence`;
    }

    // =====================================================================
    // STEP 4: Ensure timestamp is number
    // =====================================================================
    if (typeof signal.timestamp !== 'number') {
      signal.timestamp = Date.now();
    }

    this.logger.debug(`${ICONS.success} Signal enrichment complete (ATOMIC SL/TP)`, {
      signalType: signal.type,
      entryPrice,
      stopLoss: signal.stopLoss.toFixed(4),
      tpCount: signal.takeProfits.length,
    });

    return signal;
  }

  /**
   * Get current context (for monitoring/debugging)
   */
  getCurrentContext(): TradingContext | null {
    return this.currentContext;
  }

  /**
   * Enqueue and process an OpenPositionAction
   * Called when entry signal is ready to be executed
   */
  async enqueueOpenPositionAction(signal: EnrichedSignal): Promise<void> {
    if (!this.actionQueue) {
      this.logger.warn('Action queue not initialized - calling openPosition directly');
      await this.positionManager.openPosition(signal as unknown as Signal);
      return;
    }

    // Extract position parameters from signal
    const entryPrice = signal.price || signal.entryPrice || 0;
    const stopLoss = signal.stopLoss || entryPrice * 0.98;
    const takeProfits = signal.takeProfits ? signal.takeProfits.map((tp) => tp.price || 0) : [];
    const leverage = signal.leverage || 1;
    const symbol = signal.symbol || 'XRPUSDT';

    const action: OpenPositionAction = {
      id: '',
      type: ActionType.OPEN_POSITION,
      timestamp: Date.now(),
      priority: 'HIGH',
      metadata: {
        source: 'EntryOrchestrator',
      },
      signal: signal as unknown as OpenPositionAction['signal'],
      positionSize: 0, // Will be calculated by handler
      stopLoss,
      takeProfits,
      leverage,
      symbol,
    };

    await this.actionQueue.enqueue(action);
    this.logger.debug(`${ICONS.note} OpenPositionAction enqueued`, {
      actionId: action.id,
      signal: signal.type,
      entryPrice,
      stopLoss,
    });

    // Process action queue
    await this.processActionQueue();
  }

  /**
   * Enqueue exit actions from ExitOrchestrator
   */
  async enqueueExitActions(actions: unknown[]): Promise<void> {
    if (!this.actionQueue) {
      this.logger.warn('Action queue not initialized - executing exit actions directly');
      const currentPosition = this.positionManager.getCurrentPosition();
      if (currentPosition && this.positionExitingService) {
        for (const action of actions) {
          const exitAction = action as Record<string, unknown>;
          try {
            await this.positionExitingService.executeExitAction(
              currentPosition,
              exitAction as unknown as Parameters<PositionExitingService['executeExitAction']>[1],
              0, // price would come from action metadata
              'Orchestrator decision',
              ExitType.MANUAL,
            );
          } catch (error) {
              this.logger.error('Failed to execute exit action', {
                action: String(exitAction.action ?? 'UNKNOWN'),
                error: getErrorMessage(error),
              });
          }
        }
      }
      return;
    }

    // Convert exit actions to queue actions
    const currentPosition = this.positionManager.getCurrentPosition();
    if (!currentPosition) return;

    for (const action of actions) {
      const exitAction = action as Record<string, unknown>;
      let queueAction: ClosePercentAction | UpdateStopLossAction | ActivateTrailingAction | null = null;

      const actionType = String(exitAction.action ?? '');
      switch (actionType) {
        case 'CLOSE_PERCENT':
          queueAction = {
            id: '',
            type: ActionType.CLOSE_PERCENT,
            timestamp: Date.now(),
            priority: 'HIGH',
            metadata: {
              source: 'ExitOrchestrator',
            },
            positionId: currentPosition.id,
            percent: Number(exitAction.percent ?? 100),
            reason: String(exitAction.reason ?? 'TP hit'),
          } as ClosePercentAction;
          break;

        case 'UPDATE_SL':
        case 'MOVE_SL_TO_BREAKEVEN':
          queueAction = {
            id: '',
            type: ActionType.UPDATE_STOP_LOSS,
            timestamp: Date.now(),
            priority: 'HIGH',
            metadata: {
              source: 'ExitOrchestrator',
            },
            positionId: currentPosition.id,
            newStopLossPrice: Number(exitAction.newStopLoss ?? exitAction.price ?? 0),
            reason: String(exitAction.reason ?? 'SL update'),
          } as UpdateStopLossAction;
          break;

        case 'ACTIVATE_TRAILING':
          queueAction = {
            id: '',
            type: ActionType.ACTIVATE_TRAILING,
            timestamp: Date.now(),
            priority: 'HIGH',
            metadata: {
              source: 'ExitOrchestrator',
            },
            positionId: currentPosition.id,
            trailingPercent: Number(exitAction.trailingPercent ?? 1),
          } as ActivateTrailingAction;
          break;

        case 'CLOSE_ALL':
        case 'CLOSE_POSITION':
          // For now, close all with 100%
          queueAction = {
            id: '',
            type: ActionType.CLOSE_PERCENT,
            timestamp: Date.now(),
            priority: 'HIGH',
            metadata: {
              source: 'ExitOrchestrator',
            },
            positionId: currentPosition.id,
            percent: 100,
            reason: String(exitAction.reason ?? 'Full close'),
          } as ClosePercentAction;
          break;
      }

      if (queueAction) {
        await this.actionQueue.enqueue(queueAction);
        this.logger.debug(`${ICONS.note} Exit action enqueued`, {
          actionType,
        });
      }
    }

    // Process action queue
    await this.processActionQueue();
  }

  /**
   * Process all pending actions in the queue
   */
  private async processActionQueue(): Promise<void> {
    if (!this.actionQueue) {
      this.logger.warn('Action queue not initialized');
      return;
    }

    try {
      this.logger.debug(`${ICONS.note} Processing action queue`, {
        queueSize: this.actionQueue.size(),
      });

      const results = await this.actionQueue.process(this.actionHandlers);

      for (const result of results) {
        if (result.success) {
          this.logger.info(`${ICONS.success} Action processed successfully`, {
            actionId: result.actionId,
            metadata: result.metadata,
          });
        } else {
          this.logger.error(`${ICONS.error} Action processing failed`, {
            actionId: result.actionId,
            error: result.error?.message,
          });
        }
      }

      this.logger.debug(`${ICONS.success} Action queue processing complete`, {
        processed: results.length,
        remaining: this.actionQueue.size(),
      });
    } catch (error) {
      this.logger.error('Error processing action queue', {
        error: getErrorMessage(error),
      });
    }
  }

  private getRuntimeConfig(): RuntimeOrchestratorConfig {
    return this.config as RuntimeOrchestratorConfig;
  }

  private getIndicatorsConfig(): Record<string, unknown> {
    return getIndicatorsConfigFromRuntimeConfig(this.getRuntimeConfig());
  }

  private getAnalyzerDefaults(): Record<string, Record<string, unknown>> {
    return getAnalyzerDefaultsFromRuntimeConfig(this.getRuntimeConfig());
  }

  private getConfiguredAnalyzers(): AnalyzerConfigInput[] {
    return getConfiguredAnalyzersFromRuntimeConfig(this.getRuntimeConfig());
  }

  private isEnabledAnalyzerConfig(value: unknown): boolean {
    return isEnabledAnalyzerConfig(value);
  }

  private getPreCalcCache(): IndicatorPreCalcCache | null {
    if (!this.indicatorPreCalc) {
      return null;
    }
    const candidate = this.indicatorPreCalc as unknown as IndicatorPreCalcWithCache;
    return candidate.cache ?? null;
  }

  private buildAggregatedSignal(
    signals: Array<Record<string, unknown>>,
    currentPrice: number,
  ): EnrichedSignal | null {
    if (signals.length === 0) {
      return null;
    }

    const weights = new Map<string, number>();
    for (const signal of signals) {
      if (typeof signal.source === 'string' && typeof signal.weight === 'number') {
        weights.set(signal.source, signal.weight);
      }
    }

    const filters = this.asRecord(this.getRuntimeConfig().filters);
    const blindZone = this.asRecord(filters.blindZone);
    const aggregation = aggregateSignalsWeighted(
      signals as unknown as Parameters<typeof aggregateSignalsWeighted>[0],
      buildAggregationConfig(weights, {
        minConfidence: (this.entryOrchestrator?.getMinConfidenceThreshold() ?? 60) / 100,
        blindZone: blindZone.minSignalsForLong !== undefined || blindZone.minSignalsForShort !== undefined
          ? {
              minSignalsForLong: Number(blindZone.minSignalsForLong ?? 0),
              minSignalsForShort: Number(blindZone.minSignalsForShort ?? 0),
              longPenalty: Number(blindZone.longPenalty ?? 1),
              shortPenalty: Number(blindZone.shortPenalty ?? 1),
            }
          : undefined,
      }),
    );

    if (!aggregation.direction || (aggregation.direction !== SignalDirection.LONG && aggregation.direction !== SignalDirection.SHORT)) {
      this.logger.debug('Weighted aggregation produced no executable direction');
      return null;
    }

    if (aggregation.signalCount <= 0) {
      this.logger.debug('Weighted aggregation produced zero contributing signals');
      return null;
    }

    const topContributor = [...aggregation.analyzerBreakdown.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const originalSignals = signals as unknown as Signal[];
    const longSignalCount = originalSignals.filter((signal) => signal.direction === SignalDirection.LONG).length;
    const shortSignalCount = originalSignals.filter((signal) => signal.direction === SignalDirection.SHORT).length;
    return {
      type: 'AGGREGATED_SIGNAL',
      source: topContributor || 'AGGREGATED_SIGNAL',
      direction: aggregation.direction,
      confidence: Math.round(aggregation.confidence * 100),
      signalCount: aggregation.signalCount,
      aggregationContext: {
        signalCount: aggregation.signalCount,
        longSignalCount,
        shortSignalCount,
        originalSignals,
      },
      price: currentPrice,
      reason: `Weighted aggregate ${aggregation.direction} (${aggregation.signalCount} signals)`,
      timestamp: Date.now(),
    };
  }

  private getSameDirectionReentryBlock(
    direction: SignalDirection,
    currentTimestamp: number,
  ): string | null {
    const recentClose = this.positionManager.getRecentCloseState();
    if (!recentClose || recentClose.direction !== direction) {
      return null;
    }

    const primaryIntervalMinutes = this.timeframeProvider.intervalToMinutes(
      this.timeframeProvider.getInterval(TimeframeRole.PRIMARY) ?? '5',
    );
    const monitoring = this.asRecord((this.getRuntimeConfig() as unknown as { monitoring?: unknown }).monitoring);
    const antiFlip = this.asRecord(monitoring.antiFlip);
    const cooldownCandles = Number(antiFlip.cooldownCandles ?? 0);
    const maxCooldownMs =
      Math.max(cooldownCandles, recentClose.realizedPnl < 0 ? 1 : 0) *
      primaryIntervalMinutes *
      60_000;
    const elapsedMs = currentTimestamp - recentClose.closedAt;

    if (maxCooldownMs <= 0 || elapsedMs >= maxCooldownMs) {
      this.positionManager.clearRecentCloseState();
      return null;
    }

    if (elapsedMs >= 0) {
      return recentClose.realizedPnl < 0
        ? `same-direction cooldown after loss (${direction})`
        : `same-direction cooldown after close (${direction})`;
    }

    return null;
  }

  private getDegradationBlock(direction: SignalDirection): string | null {
    const primaryIntervalMinutes = this.timeframeProvider.intervalToMinutes(
      this.timeframeProvider.getInterval(TimeframeRole.PRIMARY) ?? '5',
    );
    const monitoring = this.asRecord((this.getRuntimeConfig() as unknown as { monitoring?: unknown }).monitoring);
    const antiFlip = this.asRecord(monitoring.antiFlip);
    const cooldownCandles = Number(antiFlip.cooldownCandles ?? 4);
    const degradationGuard = this.positionManager.getDegradationBlock(
      direction,
      Math.max(cooldownCandles, 3) * primaryIntervalMinutes * 60_000,
    );
    return degradationGuard.blocked ? degradationGuard.reason ?? 'degradation guard active' : null;
  }

  private logAggregatedSignalSummary(signal: EnrichedSignal): void {
    const summary = signal.aggregationContext;
    this.logger.debug('Aggregated signal summary', {
      signalSummary: {
        total: Math.max(1, Math.floor(summary?.signalCount ?? signal.signalCount ?? 1)),
        long: Math.max(0, Math.floor(summary?.longSignalCount ?? (signal.direction === SignalDirection.LONG ? 1 : 0))),
        short: Math.max(0, Math.floor(summary?.shortSignalCount ?? (signal.direction === SignalDirection.SHORT ? 1 : 0))),
        direction: signal.direction,
        confidence: signal.confidence ?? 0,
      },
    });
  }

  private stripOriginalSignalsFromAggregationContext(signal: EnrichedSignal): EnrichedSignal {
    if (!signal.aggregationContext?.originalSignals) {
      return signal;
    }

    return {
      ...signal,
      aggregationContext: {
        signalCount: signal.aggregationContext.signalCount,
        longSignalCount: signal.aggregationContext.longSignalCount,
        shortSignalCount: signal.aggregationContext.shortSignalCount,
        originalSignals: [],
      },
    };
  }

  /**
   * Get action queue for monitoring
   */
  getActionQueue(): ActionQueueService | null {
    return this.actionQueue;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return asRecord(value);
  }
}





