/**
 * Trade Execution Service (Week 13 Phase 4b Extract)
 *
 * Extracted from trading-orchestrator.service.ts
 * Responsible for executing trades with all pre-trade checks and position opening
 *
 * Responsibilities:
 * - Check emergency kill-switch
 * - Apply RiskManager atomic decision
 * - Calculate position size
 * - Create entry snapshot for session stats
 * - Check impulse/retest conditions
 * - Verify BTC and funding rate filters
 * - Open position on exchange
 * - Send notifications
 */

import {
  LoggerService,
  Signal,
  Position,
  RiskDecision,
  StrategyMarketData,
  TimeframeRole,
  EntryDecision,
  TrendAnalysis,
  EntrySignal,
  EntryOrchestratorDecision,
  SignalType,
  SignalDirection,
  OrchestratorConfig,
  TrendBias,
  FlatMarketResult,
} from '../types';
import { BybitService } from './bybit/bybit.service';
import { PositionLifecycleService } from './position-lifecycle.service';
import { TelegramService } from './telegram.service';
import { ExternalAnalysisService } from './external-analysis.service';
import { RetestEntryService } from './retest-entry.service';
import { RiskManager } from './risk-manager.service';
import { CandleProvider } from '../providers/candle.provider';
import { EntryOrchestrator } from '../orchestrators/entry.orchestrator';
import { MultiTimeframeRSIAnalyzer } from '../analyzers/multi-timeframe-rsi.analyzer';
import { MultiTimeframeEMAAnalyzer } from '../analyzers/multi-timeframe-ema.analyzer';
import { LiquidityDetector } from '../analyzers/liquidity.detector';
import {
  DECIMAL_PLACES,
  THRESHOLD_VALUES,
  PERCENT_MULTIPLIER,
} from '../constants';


/**
 * Trade Execution Service
 *
 * Orchestrates the trade execution pipeline:
 * 1. Check kill-switch
 * 2. Apply risk manager decision
 * 3. Calculate position size
 * 4. Create entry snapshot
 * 5. Check impulse/retest conditions
 * 6. Verify filters (BTC, funding)
 * 7. Open position
 * 8. Send notifications
 */
export class TradeExecutionService {
  constructor(
    private bybitService: BybitService,
    private positionManager: PositionLifecycleService,
    private candleProvider: CandleProvider,
    private riskManager: RiskManager | null,
    private retestEntryService: RetestEntryService | null,
    private externalAnalysisService: ExternalAnalysisService | null,
    private telegram: TelegramService | null,
    private logger: LoggerService,
    private config?: OrchestratorConfig,
    private rsiAnalyzer?: MultiTimeframeRSIAnalyzer,
    private emaAnalyzer?: MultiTimeframeEMAAnalyzer,
    private liquidityDetector?: LiquidityDetector,
    private entryOrchestrator?: EntryOrchestrator,
  ) {}

  /**
   * Execute trade from entry signal
   * PHASE 6a: Now accepts globalTrendBias for trend-aware entry filtering
   * PHASE 1.3: Now accepts flatMarketAnalysis for flat market blocking
   * @param entrySignal - Entry signal with trade details
   * @param marketData - Market data for session stats (optional)
   * @param globalTrendBias - Current trend (BULLISH/BEARISH/NEUTRAL) from TrendAnalyzer (optional, can be null or undefined)
   * @param flatMarketAnalysis - Flat market detection result (optional)
   */
  async executeTrade(
    entrySignal: EntrySignal,
    marketData?: StrategyMarketData,
    globalTrendBias?: TrendAnalysis | null,
    flatMarketAnalysis?: FlatMarketResult | null,
  ): Promise<void> {
    try {
      // PHASE 5: Check Emergency Kill-Switch
      const killSwitchExists = await this.checkKillSwitch();
      if (killSwitchExists) {
        this.logger.warn('⛔ Trading halted by emergency kill-switch (data/STOP_TRADING exists)');
        return;
      }

      // Get account balance for risk checks
      const accountBalance = await this.bybitService.getBalance();

      // Convert EntrySignal to Signal (shared format)
      const signal: Signal = {
        type: (entrySignal.strategyName as SignalType) || SignalType.LEVEL_BASED,
        direction: entrySignal.direction as SignalDirection,
        price: entrySignal.entryPrice,
        stopLoss: entrySignal.stopLoss,
        takeProfits: entrySignal.takeProfits,
        confidence: entrySignal.confidence,
        reason: entrySignal.reason,
        timestamp: entrySignal.timestamp,
      };

      // Get open positions for risk checking
      const openPositions = await this.getOpenPositions();

      // PHASE 6a: ENTRY ORCHESTRATOR - PRIMARY DECISION POINT (Trend-aware filtering)
      // PHASE 1.3: Include flat market analysis for blocking (NEW)
      const riskManagerDecision = await this.evaluateEntryWithOrchestrator(
        signal,
        accountBalance,
        openPositions,
        globalTrendBias,
        flatMarketAnalysis,
      );

      // If orchestrator blocked the trade, return early
      if (!riskManagerDecision) {
        return;
      }

      this.logger.info('🚀 Executing trade...', {
        direction: entrySignal.direction,
        entry: entrySignal.entryPrice,
        sl: entrySignal.stopLoss,
      });

      // PHASE 1: Check for missed impulse - Create retest zone
      if (this.retestEntryService && this.config?.retestEntry?.enabled) {
        const shouldRetestWait = await this.checkImpulseAndCreateRetestZone(entrySignal);
        if (shouldRetestWait) {
          return; // Don't enter immediately, wait for retest
        }
      }

      // Week 13: BTC confirmation check removed - now handled as analyzer vote in confidence system
      // BTC_CORRELATION analyzer participates in voting with weight 0.12, not hard block

      // Week 13: Funding rate filter check (using ExternalAnalysisService)
      if (this.externalAnalysisService && this.config?.fundingRateFilter?.enabled) {
        const fundingRateAllowed = await this.externalAnalysisService.checkFundingRate(
          entrySignal.direction as SignalDirection
        );

        if (!fundingRateAllowed) {
          return; // Block signal - ExternalAnalysisService logs details
        }
      }

      // Note: Signal already converted at line 105-114 for orchestrator/risk checks
      this.logger.info('💰 Current balance', {
        balance: accountBalance.toFixed(DECIMAL_PLACES.PERCENT),
      });

      // Calculate position size (riskManagerDecision may be null if RiskManager not initialized)
      const qty = this.calculatePositionSize(
        riskManagerDecision || null,
        entrySignal.entryPrice,
        accountBalance,
      );

      // Note: Entry snapshot creation with full feature set is delegated to TradingOrchestrator
      // This service focuses on core trade execution, not session statistics

      // Open position
      const position = await this.positionManager.openPosition(signal, undefined);

      this.logger.info('✅ Position opened successfully!', {
        positionId: position.id,
        side: position.side,
        entry: position.entryPrice,
      });

      // Send Telegram notification
      if (this.telegram) {
        await this.telegram.sendTradeNotification({
          type: 'ENTRY',
          direction: signal.direction,
          price: signal.price,
          stopLoss: signal.stopLoss,
          takeProfits: signal.takeProfits,
          confidence: signal.confidence,
          reason: signal.reason,
        });
      }

      // PHASE 6c: Schedule immediate entry validation (1-minute check)
      this.scheduleEntryValidationCheck(position, signal);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute trade', {
        error: errorMessage,
      });

      // Send error notification via Telegram
      if (this.telegram) {
        try {
          await this.telegram.notifyError('Trade Execution Failed', errorMessage);
        } catch (telegramError) {
          this.logger.warn('Failed to send Telegram error notification', {
            error: telegramError instanceof Error ? telegramError.message : String(telegramError),
          });
        }
      }
    }
  }

  /**
   * PHASE 6a: Evaluate entry using EntryOrchestrator with trend-aware filtering
   * PHASE 1.3: Include flat market analysis for entry blocking
   * @param signal - Prepared trade signal
   * @param accountBalance - Current account balance
   * @param openPositions - Currently open positions
   * @param globalTrendBias - Current trend (BULLISH/BEARISH/NEUTRAL)
   * @param flatMarketAnalysis - Flat market detection result (NEW - PHASE 1.3)
   * @returns RiskDecision if approved, null if blocked
   */
  private async evaluateEntryWithOrchestrator(
    signal: Signal,
    accountBalance: number,
    openPositions: Position[],
    globalTrendBias?: TrendAnalysis | null,
    flatMarketAnalysis?: FlatMarketResult | null,
  ): Promise<RiskDecision | null> {
    // Validate orchestrator is initialized (PHASE 4: FAST FAIL)
    if (!this.entryOrchestrator) {
      this.logger.error('❌ CRITICAL: EntryOrchestrator not initialized', {
        detail: 'EntryOrchestrator is required for trade execution',
      });
      throw new Error('EntryOrchestrator must be initialized');
    }

    // Validate trend analysis is provided (CRITICAL: required by EntryOrchestrator)
    let validTrendBias: TrendAnalysis;
    if (!globalTrendBias) {
      this.logger.warn('⚠️ Trend analysis not provided to entry orchestrator, using NEUTRAL bias');
      validTrendBias = {
        bias: TrendBias.NEUTRAL,
        strength: 0,
        restrictedDirections: [],
        timeframe: '1m',
        reasoning: ['No trend analysis provided - using default NEUTRAL bias'],
      };
    } else {
      validTrendBias = globalTrendBias;
    }

    // Use EntryOrchestrator for single atomic entry decision with trend filtering
    const orchestratorDecision = await this.entryOrchestrator.evaluateEntry(
      [signal], // Convert single signal to array for multi-signal ranking capability
      accountBalance,
      openPositions,
      validTrendBias, // PHASE 6a: Now provided - enables trend-aware filtering
      flatMarketAnalysis ?? undefined, // PHASE 1.3: Convert null to undefined for type safety
    );

    // Check orchestrator decision result
    if (orchestratorDecision.decision !== EntryDecision.ENTER) {
      this.logEntryBlocked(orchestratorDecision, validTrendBias);
      return null;
    }

    // Log successful approval with risk details
    this.logEntryApproved(orchestratorDecision, signal, validTrendBias);
    return orchestratorDecision.riskAssessment || null;
  }

  /**
   * Log when entry is blocked by EntryOrchestrator
   */
  private logEntryBlocked(
    orchestratorDecision: EntryOrchestratorDecision,
    globalTrendBias?: TrendAnalysis | null,
  ): void {
    this.logger.info('❌ Trade blocked by EntryOrchestrator', {
      reason: orchestratorDecision.reason,
      trendProvided: globalTrendBias
        ? `${globalTrendBias.bias} (strength: ${globalTrendBias.strength.toFixed(2)})`
        : 'NOT PROVIDED',
    });
  }

  /**
   * Log when entry is approved by EntryOrchestrator
   */
  private logEntryApproved(
    orchestratorDecision: EntryOrchestratorDecision,
    signal: Signal,
    globalTrendBias?: TrendAnalysis | null,
  ): void {
    const riskAssessment = orchestratorDecision.riskAssessment;
    if (!riskAssessment?.riskDetails) {
      return;
    }

    this.logger.info('✅ Trade approved by EntryOrchestrator (PHASE 6a)', {
      decision: orchestratorDecision.decision,
      signal: signal.type,
      direction: signal.direction,
      trendBias: globalTrendBias?.bias || 'NEUTRAL (default)',
      confidence: `${signal.confidence.toFixed(1)}%`,
      adjustedPositionSize: riskAssessment.adjustedPositionSize?.toFixed(4),
      dailyPnL: riskAssessment.riskDetails.dailyPnL?.toFixed(2) + '%',
      consecutiveLosses: riskAssessment.riskDetails.consecutiveLosses,
      totalExposure: riskAssessment.riskDetails.totalExposure?.toFixed(2) + '%',
    });
  }

  /**
   * Check if emergency kill-switch file exists
   * @returns true if kill-switch exists
   */
  private async checkKillSwitch(): Promise<boolean> {
    try {
      const fs = await import('fs');
      return fs.existsSync('data/STOP_TRADING');
    } catch (error) {
      this.logger.warn('Failed to check kill-switch', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get open positions from position manager
   * @returns Array of open positions
   */
  private async getOpenPositions(): Promise<Position[]> {
    try {
      return this.positionManager.getOpenPositions();
    } catch (error) {
      this.logger.warn('Failed to get open positions', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check for missed impulse and create retest zone if needed
   * @param entrySignal - Entry signal
   * @returns true if should wait for retest
   */
  private async checkImpulseAndCreateRetestZone(entrySignal: EntrySignal): Promise<boolean> {
    try {
      const entryCandles = await this.candleProvider.getCandles(TimeframeRole.ENTRY);
      if (entryCandles.length < 10) {
        return false;
      }

      const currentPrice = entryCandles[entryCandles.length - 1].close;
      const symbol = this.bybitService.getSymbol();

      if (!this.retestEntryService) {
        return false;
      }

      const impulse = this.retestEntryService.detectImpulse(symbol, currentPrice, entryCandles);

      if (impulse.hasImpulse) {
        const signal: Signal = {
          type: (entrySignal.strategyName as SignalType) || SignalType.LEVEL_BASED,
          direction: entrySignal.direction as SignalDirection,
          price: entrySignal.entryPrice,
          stopLoss: entrySignal.stopLoss,
          takeProfits: entrySignal.takeProfits,
          confidence: entrySignal.confidence,
          reason: entrySignal.reason,
          timestamp: entrySignal.timestamp,
        };

        this.retestEntryService.createRetestZone(symbol, signal, impulse.impulseStart, impulse.impulseEnd);

        this.logger.info('⏳ Impulse detected - waiting for retest (not entering immediately)');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn('Failed to check for missed impulse', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Calculate position size
   * @param riskManagerDecision - Risk manager decision with adjusted size
   * @param entryPrice - Entry price
   * @param accountBalance - Account balance
   * @returns Position quantity
   */
  private calculatePositionSize(
    riskManagerDecision: RiskDecision | null,
    entryPrice: number,
    accountBalance: number,
  ): number {
    if (riskManagerDecision && riskManagerDecision.adjustedPositionSize) {
      this.logger.info('📐 Position size from RiskManager (PHASE 4)', {
        qty: riskManagerDecision.adjustedPositionSize.toFixed(4),
        value: (riskManagerDecision.adjustedPositionSize * entryPrice).toFixed(DECIMAL_PLACES.PERCENT),
        source: 'RiskManager.canTrade()',
      });
      return riskManagerDecision.adjustedPositionSize;
    }

    // Fallback: Use legacy calculatePositionSize
    const targetUsdt = this.config?.positionSizeUsdt || 10;
    const maxUsdt = Math.min(targetUsdt, accountBalance * THRESHOLD_VALUES.NINETY_PERCENT);
    const qty = Math.floor((maxUsdt / entryPrice) * PERCENT_MULTIPLIER) / PERCENT_MULTIPLIER;

    this.logger.info('📐 Position size calculated (legacy fallback)', {
      qty,
      value: (qty * entryPrice).toFixed(DECIMAL_PLACES.PERCENT),
      source: 'calculatePositionSize()',
    });

    return qty;
  }

  /**
   * PHASE 6c: Schedule immediate entry validation check (1-minute after entry)
   * Validates that price moved favorably after entry
   * Logs errors if price moved against entry direction - DO NOT auto-close
   * @param position - Opened position
   * @param signal - Entry signal
   */
  private scheduleEntryValidationCheck(position: Position, signal: Signal): void {
    const VALIDATION_DELAY_MS = 60000; // 1 minute
    // Convert percent to decimal (0.1% → 0.001)
    const favorableMovementThreshold = 0.1 / PERCENT_MULTIPLIER;

    // Schedule validation asynchronously (non-blocking)
    setTimeout(async () => {
      try {
        const currentPrice = await this.bybitService.getCurrentPrice();
        const entry = position.entryPrice;
        const direction = position.side;

        // Determine if price moved favorably
        const movedFavorable =
          direction === 'LONG'
            ? currentPrice > entry * (1 + favorableMovementThreshold) // LONG: price should be up
            : currentPrice < entry * (1 - favorableMovementThreshold); // SHORT: price should be down

        // Calculate actual movement
        const movementPercent = ((currentPrice - entry) / entry) * 100;

        // Determine if price moved in the right direction (regardless of threshold)
        const movedInRightDirection =
          direction === 'LONG'
            ? currentPrice > entry // LONG: any upward movement
            : currentPrice < entry; // SHORT: any downward movement

        if (movedFavorable) {
          // Price moved favorably beyond threshold - good entry signal
          this.logger.info('✅ Entry validation passed - Price moved favorably', {
            positionId: position.id,
            side: direction,
            entryPrice: entry.toFixed(8),
            currentPrice: currentPrice.toFixed(8),
            movementPercent: movementPercent.toFixed(3) + '%',
            timestamp: Date.now(),
          });
        } else if (!movedInRightDirection) {
          // Price moved AGAINST entry direction - BAD signal
          this.logger.error('❌ BAD ENTRY - Price moved AGAINST direction', {
            positionId: position.id,
            side: direction,
            entryPrice: entry.toFixed(8),
            currentPrice: currentPrice.toFixed(8),
            movementPercent: movementPercent.toFixed(3) + '%',
            timestamp: Date.now(),
            action: 'Logged for analysis (NOT auto-closed)',
          });
        } else {
          // Price moved in right direction but not enough - WEAK signal
          this.logger.warn('⚠️ WEAK ENTRY - Price moved correctly but below threshold', {
            positionId: position.id,
            side: direction,
            entryPrice: entry.toFixed(8),
            currentPrice: currentPrice.toFixed(8),
            movementPercent: movementPercent.toFixed(3) + '%',
            threshold: (favorableMovementThreshold * PERCENT_MULTIPLIER).toFixed(1) + '%',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        this.logger.warn('Failed to perform entry validation check', {
          error: error instanceof Error ? error.message : String(error),
          note: 'This is not a critical error - validation check is for analysis only',
        });
      }
    }, VALIDATION_DELAY_MS);

    this.logger.debug('📋 Entry validation check scheduled', {
      positionId: position.id,
      delaySeconds: VALIDATION_DELAY_MS / 1000,
      threshold: (favorableMovementThreshold * PERCENT_MULTIPLIER).toFixed(1) + '%',
    });
  }

}
