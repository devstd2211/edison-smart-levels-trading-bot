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
} from '../types';
// PHASE 4: ContextAnalyzer archived to src/archive/phase4-integration/
// Replaced by TrendAnalyzer (PRIMARY component)
import { CandleProvider } from '../providers/candle.provider';
import { BybitService } from './bybit';
import { PositionLifecycleService } from './position-lifecycle.service';
import { TelegramService } from './telegram.service';
import { TradingJournalService } from './trading-journal.service';
import { SessionStatsService } from './session-stats.service';
import { StrategyCoordinator } from './strategy-coordinator.service';
import { AnalyzerRegistry } from './analyzer-registry.service';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { FundingRateFilterService } from './funding-rate-filter.service';
// FastEntryService archived to src/archive/phase4-week2/ (consolidated into EntryOrchestrator)
// SmartBreakevenService archived to src/archive/phase4-week3/ (consolidated into ExitOrchestrator)
import { RetestEntryService } from './retest-entry.service';
import { DeltaAnalyzerService } from './delta-analyzer.service';
import { OrderbookImbalanceService } from './orderbook-imbalance.service';
import { VolumeProfileService } from './volume-profile.service';
import { RiskCalculator } from './risk-calculator.service';
import { TrendConfirmationService } from './trend-confirmation.service';
// PHASE 4: RiskManager (unified risk gatekeeper - ATOMIC decision point)
import { RiskManager } from './risk-manager.service';
// PHASE 4: EntryOrchestrator (PRIMARY entry decision point - Week 2)
import { EntryOrchestrator } from '../orchestrators/entry.orchestrator';
// PHASE 4.1: NEUTRAL Trend Strength Filter (optimization for SHORT entries)
import { NeutralTrendStrengthFilter } from '../filters/neutral-trend-strength.filter';
// PHASE 4: ExitOrchestrator (PRIMARY exit state machine - Week 3)
import { ExitOrchestrator } from '../orchestrators/exit.orchestrator';
import { PositionExitingService } from './position-exiting.service';
import { EntryLogicService } from './entry-logic.service';
import { SwingPointDetectorService } from './swing-point-detector.service';
import { MultiTimeframeTrendService } from './multi-timeframe-trend.service';
import { TimeframeWeightingService } from './timeframe-weighting.service';
import { IndicatorInitializationService } from './indicator-initialization.service';
import { FilterInitializationService } from './filter-initialization.service';
import { MarketDataPreparationService } from './market-data-preparation.service';
import { TradingContextService } from './trading-context.service';
import { ExternalAnalysisService } from './external-analysis.service';
import { SignalProcessingService } from './signal-processing.service';
import { TradeExecutionService } from './trade-execution.service';
import { WhaleSignalDetectionService } from './whale-signal-detection.service';

// ============================================================================
// TYPES
// ============================================================================

// ============================================================================
// TRADING ORCHESTRATOR
// ============================================================================

export class TradingOrchestrator {
  // Core services
  private strategyCoordinator!: StrategyCoordinator;
  private analyzerRegistry!: AnalyzerRegistry;
  private currentContext: TradingContext | null = null;
  private currentOrderbook: OrderBook | null = null;

  // Orchestrators
  private entryOrchestrator: EntryOrchestrator | null = null;
  private exitOrchestrator: ExitOrchestrator | null = null;
  private positionExitingService: PositionExitingService | null = null;

  // Services
  private retestEntryService: RetestEntryService | null = null;
  private deltaAnalyzerService: DeltaAnalyzerService | null = null;
  private orderbookImbalanceService: OrderbookImbalanceService | null = null;
  private volumeProfileService: VolumeProfileService | null = null;
  private trendConfirmationService: TrendConfirmationService | null = null;
  private fundingRateFilter: FundingRateFilterService | null = null;

  // Data services
  private marketDataPreparationService: any | null = null;
  private tradingContextService: any | null = null;
  private externalAnalysisService: any | null = null;
  private signalProcessingService: any | null = null;
  private tradeExecutionService: any | null = null;
  private entryLogicService: EntryLogicService | null = null;
  private whaleSignalDetectionService: any | null = null;

  constructor(
    private config: OrchestratorConfig,
    private candleProvider: CandleProvider,
    private timeframeProvider: TimeframeProvider,
    private bybitService: BybitService,
    private positionManager: PositionLifecycleService,
    private telegram: TelegramService | null,
    private logger: LoggerService,
    private riskManager: RiskManager,
    // Optional parameters after required ones
    retestEntryService?: RetestEntryService,
    deltaAnalyzerService?: DeltaAnalyzerService,
    orderbookImbalanceService?: OrderbookImbalanceService,
    private tradingJournal?: TradingJournalService,
    private sessionStats?: SessionStatsService,
  ) {
    // Initialize services from parameters
    if (retestEntryService) this.retestEntryService = retestEntryService;
    if (deltaAnalyzerService) this.deltaAnalyzerService = deltaAnalyzerService;
    if (orderbookImbalanceService) this.orderbookImbalanceService = orderbookImbalanceService;

    // Initialize context on startup (async)
    void this.initializeContext();
  }

  /**
   * Initialize context on startup
   */
  private async initializeContext(): Promise<void> {
    // PHASE 4: Context initialization removed
    // ContextAnalyzer is archived - replaced by TrendAnalyzer
    // currentContext is now populated by updateTrendContext() on PRIMARY candle close
    this.logger.info('🔄 Trading context will be initialized on first PRIMARY candle close (TrendAnalyzer)');
  }

  /**
   * Set the BTC candles store (used to access pre-loaded BTC candles)
   * Called by BotServices after initialization
   */
  setBtcCandlesStore(store: { btcCandles1m: Candle[] }): void {
    // Link BTC candles to ExternalAnalysisService for BTC analysis
    if (this.externalAnalysisService) {
      (this.externalAnalysisService as any).setBtcCandlesStore(store);
    }
    this.logger.info('🔗 BTC candles store linked to TradingOrchestrator');
  }

  /**
   * Initialize trend analysis from loaded candles
   * CRITICAL: Called immediately after candles are loaded to prevent ~5 minute startup delay
   * This allows trend analysis to be available immediately instead of waiting for first PRIMARY candle close
   */
  async initializeTrendAnalysis(): Promise<void> {
    try {
      this.logger.error('🔥🔥🔥 TradingOrchestrator.initializeTrendAnalysis() CALLED - CRITICAL POINT 🔥🔥🔥');
      if (this.tradingContextService) {
        this.logger.info('✅ TradingContextService exists, calling initializeTrendAnalysis()...');
        await this.tradingContextService.initializeTrendAnalysis();
        this.logger.info('✅ TradingContextService.initializeTrendAnalysis() returned');
      } else {
        this.logger.error('🚨 CRITICAL: TradingContextService is NULL!');
      }
    } catch (error) {
      this.logger.error('🚨 Exception in TradingOrchestrator.initializeTrendAnalysis()', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Non-fatal error - continue without initial trend analysis
      // It will be available on first PRIMARY candle close
    }
  }

  /**
   * Handle candle close event
   * Called by Bot when candle closes on any timeframe
   * Week 13 Phase 5d: Thin dispatcher - delegates to specialized services
   */
  async onCandleClosed(role: TimeframeRole, candle: Candle): Promise<void> {
    try {
      // PRIMARY closed → Update trend analysis + evaluate exits
      if (role === TimeframeRole.PRIMARY) {
        this.logger.info('📊 PRIMARY candle closed - updating trend analysis');
        const startTime = Date.now();
        await this.tradingContextService!.updateTrendContext();
        const elapsed = Date.now() - startTime;
        this.logger.info('✅ Trend analysis updated on PRIMARY candle close', {
          timeframeName: 'PRIMARY (5-minute)',
          timestamp: new Date(candle.timestamp).toISOString(),
          candleClose: candle.close,
          elapsedMs: elapsed,
        });

        // PHASE 4 Week 3: Evaluate exit conditions with orchestrator
        const currentPosition = this.positionManager.getCurrentPosition();
        if (currentPosition && this.exitOrchestrator && this.positionExitingService) {
          try {
            // Gather indicators for advanced exit features (Smart Breakeven, SmartTrailingV2)
            const indicators = {
              ema20: undefined,  // EMA calculation handled by AnalyzerRegistry
              currentVolume: candle.volume,
              avgVolume: candle.volume, // TODO: Calculate proper average from recent candles
              // ATRPercent: Will use default value if not provided (1.5%)
            };

            // Evaluate exit with orchestrator and full indicators
            const exitResult = await this.exitOrchestrator.evaluateExit(
              currentPosition,
              candle.close,
              indicators,
            );

            // Log the transition if any
            if (exitResult.stateTransition) {
              this.logger.debug('📊 Exit state machine', {
                transition: exitResult.stateTransition,
              });
            }

            // Execute exit actions if any
            if (exitResult.actions && exitResult.actions.length > 0) {
              this.logger.info('🚨 Exit orchestrator triggered actions', {
                actionCount: exitResult.actions.length,
                transition: exitResult.stateTransition,
              });

              for (const action of exitResult.actions) {
                try {
                  await this.positionExitingService.executeExitAction(
                    currentPosition,
                    action,
                    candle.close,
                    'Orchestrator decision',
                    ExitType.MANUAL,
                  );

                  this.logger.info('✅ Exit action executed', {
                    actionType: action.action,
                  });
                } catch (actionError) {
                  this.logger.error('Failed to execute exit action', {
                    actionType: action.action,
                    error: actionError instanceof Error ? actionError.message : String(actionError),
                  });
                }
              }
            }

            // Update position state if needed
            if (exitResult.newState) {
              this.logger.debug('📍 Position state updated', {
                newState: exitResult.newState,
              });
            }
          } catch (exitEvalError) {
            this.logger.error('Failed to evaluate exit conditions', {
              error: exitEvalError instanceof Error ? exitEvalError.message : String(exitEvalError),
            });
          }
        }
      }

      // ENTRY closed → Scan for entry (delegated to EntryLogicService)
      if (role === TimeframeRole.ENTRY) {
        await this.entryLogicService!.scanForEntries(candle);
      }
    } catch (error) {
      this.logger.error('Error in orchestrator onCandleClosed', {
        role,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
        this.logger.warn('⏰ Clock drift detected', {
          serverTime,
          localTime,
          driftMs: drift,
          driftSec: (drift / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(DECIMAL_PLACES.PERCENT),
        });
      } else {
        this.logger.debug('⏰ Time synced', { driftMs: drift });
      }

      // Store time offset in BybitService for timestamp correction
      // This assumes BybitService has a timeOffset property
      // For now, just log the drift - actual correction happens in SDK
    } catch (error) {
      this.logger.warn('Failed to sync time with exchange', {
        error: error instanceof Error ? error.message : String(error),
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
    // Delegated to WhaleSignalDetectionService (Week 13 Phase 5e)
    await this.whaleSignalDetectionService!.checkWhaleSignalRealtime(
      orderbook,
      this.currentContext,
    );
  }

  /**
   * Get current context (for monitoring/debugging)
   */
  getCurrentContext(): TradingContext | null {
    return this.currentContext;
  }
}
