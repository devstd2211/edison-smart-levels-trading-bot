/**
 * Position Lifecycle Service
 * Consolidated from 8 separate position services:
 * - PositionManagerService (orchestration)
 * - PositionOpeningService (opening workflow)
 * - PositionSyncService (WebSocket sync)
 * - PositionCalculatorService (quantity math)
 * - PositionInitializationService (Position object creation)
 * - PositionExecutionService (exchange execution)
 * - PositionProtectionService (SL/TP setup)
 * - PositionSizingService (size calculation)
 *
 * UNIFIED RESPONSIBILITY: Manage position lifecycle from open → close
 * - Open positions with atomic SL/TP protection
 * - Sync positions with WebSocket on bot restart
 * - Track position state (currentPosition, takeProfitManager)
 * - Manage entry confirmation for signals requiring candle confirmation
 *
 * CRITICAL: SL and TP are set ATOMICALLY with position opening via Bybit
 * No separate verification service needed - handled by BybitService.openPosition()
 */

import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { TIMING_CONSTANTS } from '../constants/technical.constants';

import {
  Position,
  Signal,
  SignalDirection,
  TradingConfig,
  RiskManagementConfig,
  LoggerService,
  EntryConfirmationConfig,
  SessionEntryCondition,
  Config,
  SmartBreakevenConfig,
  SignalType,
  PositionSide,
  ExitType,
  SessionTradeRecord,
} from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { BotEventBus } from './event-bus';
import { TelegramService } from './telegram.service';
import { TradingJournalService } from './trading-journal.service';
import { TakeProfitManagerService } from './take-profit-manager.service';
import { EntryConfirmationManager } from './entry-confirmation.service';
import { CompoundInterestCalculatorService } from './compound-interest-calculator.service';
import { SessionStatsService } from './session-stats.service';
import type { DynamicPositionSizerService } from './dynamic-position-sizer.service';
import type { PositionScalingService } from './position-scaling.service';
import { IPositionRepository } from '../repositories/IRepositories';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import {
  applyWebSocketPositionUpdate,
  clonePositionSnapshot,
  restoreWebSocketPosition,
} from './position-lifecycle/position-lifecycle-sync.utils';
import {
  calculatePositionExposure,
  calculateRiskRewardRatio,
  resolveFirstTakeProfitPrice,
} from './position-lifecycle/position-lifecycle-sizing.utils';
import { buildOpenedPosition } from './position-lifecycle/position-lifecycle-open.utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const PERCENT_TO_DECIMAL = PERCENT_MULTIPLIER;

type DynamicPositionSizingConfigView = {
  dynamicPositionSizing?: {
    enabled?: boolean;
  };
};

// ============================================================================
// POSITION LIFECYCLE SERVICE
// ============================================================================

export class PositionLifecycleService {
  // State
  private currentPosition: Position | null = null;
  private isOpeningPosition: boolean = false; // Prevent duplicate position opening
  private takeProfitManager: TakeProfitManagerService | null = null;
  private entryConfirmation: EntryConfirmationManager;

  // PHASE 9.P0: Atomic lock for position close (prevent timeout ↔ close race)
  private positionClosing = new Map<string, Promise<void>>();

  constructor(
    private readonly bybitService: IExchange,
    private readonly tradingConfig: TradingConfig,
    private readonly riskConfig: RiskManagementConfig,
    private readonly telegram: TelegramService,
    private readonly logger: LoggerService,
    private readonly journal: TradingJournalService,
    private readonly entryConfirmationConfig: EntryConfirmationConfig,
    private readonly fullConfig: Config,
    private readonly eventBus: BotEventBus,
    private readonly compoundInterestCalculator?: CompoundInterestCalculatorService,
    private readonly sessionStats?: SessionStatsService,
    private readonly strategyId?: string,  // Phase 10.3c: Strategy identifier for event tagging
    private readonly positionRepository?: IPositionRepository, // Phase 6.2: Repository pattern
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.17: Error handling integration
    private readonly dynamicPositionSizer?: DynamicPositionSizerService, // Phase 11.1: Kelly Criterion position sizing
    private readonly positionScalingService?: PositionScalingService, // Phase 11.2: Dynamic pyramiding
  ) {
    this.entryConfirmation = new EntryConfirmationManager(entryConfirmationConfig, logger);
  }

  private readStoredPosition(): Position | null {
    if (this.positionRepository) {
      return this.positionRepository.getCurrentPosition();
    }
    return this.currentPosition;
  }

  private writeStoredPosition(position: Position | null): void {
    if (this.positionRepository) {
      this.positionRepository.setCurrentPosition(position);
      return;
    }
    this.currentPosition = position;
  }

  // =========================================================================
  // PUBLIC API: Core Lifecycle
  // =========================================================================

  /**
   * Open a new position based on signal
   * CRITICAL: SL and TP are set ATOMICALLY with position opening
   *
   * @param signal - Trading signal with entry/SL/TP levels
   * @param entrySnapshot - Optional session entry snapshot for stats
   * @returns Position object if successful
   * @throws Error if position already exists or opening fails
   */
  async openPosition(signal: Signal, entrySnapshot?: SessionEntryCondition): Promise<Position> {
    // Prevent duplicate position opening
    if (this.readStoredPosition() !== null) {
      throw new Error('Position already exists. Close existing position first.');
    }

    if (this.isOpeningPosition) {
      throw new Error('Position opening already in progress. Preventing duplicate.');
    }

    this.isOpeningPosition = true;

    try {
      // ===================================================================
      // STEP 1: Calculate position size (with compound interest support)
      // ===================================================================
      const sizingResult = await this.calculatePositionSize(signal);

      this.logger.info('📐 Position sizing completed', {
        quantity: sizingResult.quantity,
        marginUsed: sizingResult.marginUsed.toFixed(DECIMAL_PLACES.PERCENT),
        notionalValue: sizingResult.notionalValue.toFixed(DECIMAL_PLACES.PERCENT),
        sizingChain: sizingResult.sizingChain.join(' → '),
      });

      // ===================================================================
      // STEP 2-3: Cancel hanging orders and prepare SL context before open
      // Phase 8.9.17: ErrorHandler integration with RETRY and SKIP strategy
      // ===================================================================
      const openContext = await this.prepareOpenExecutionContext(signal);
      const { side, slDistance, currentPrice, actualStopLoss } = openContext;

      this.logger.info('📊 Stop-loss calculated', {
        signalPrice: signal.price,
        currentPrice,
        slDistancePercent: (slDistance / currentPrice * PERCENT_MULTIPLIER).toFixed(2) + '%',
        actualStopLoss: actualStopLoss.toFixed(DECIMAL_PLACES.PERCENT),
      });

      // ===================================================================
      // STEP 4: ATOMIC POSITION OPENING - SL+TP in ONE call (CRITICAL)
      // This prevents race condition liquidations by setting SL atomically
      // Phase 8.7: ErrorHandler integration with RETRY strategy
      // ===================================================================
      this.logger.info('🚀 Opening position on exchange with atomic SL/TP protection', {
        side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
        quantity: sizingResult.quantity,
        entry: signal.price,
        sl: actualStopLoss,
        leverage: this.tradingConfig.leverage,
      });

      const atomicOpen = await this.executeAtomicOpenPosition({
        side,
        quantity: sizingResult.quantity,
        actualStopLoss,
        takeProfits: signal.takeProfits,
      });
      const { openedPosition, orderId, tpOrderIds } = atomicOpen;


      // Phase 8.9.17: RETRY → SKIP strategy for additional TP levels (non-critical)
      // Set additional TP levels (if more than 1)
      await this.configureAdditionalTakeProfits(signal, sizingResult.quantity);

      // ===================================================================
      // STEP 5: Create Position object
      // ===================================================================
      const timestamp = Date.now();
      const symbol = this.bybitService.getSymbol?.() || 'UNKNOWN';
      const position = buildOpenedPosition({
        symbol,
        side,
        quantity: sizingResult.quantity,
        entryPrice: signal.price,
        leverage: this.tradingConfig.leverage,
        marginUsed: sizingResult.marginUsed,
        stopLossPrice: actualStopLoss,
        takeProfits: signal.takeProfits,
        tpOrderIds,
        orderId: orderId ?? openedPosition.id,
        timestamp,
      });
      const journalId = position.journalId || `${position.id}_${timestamp}`;

      this.wireOpenedPositionState(position, signal);


      // ===================================================================
      // STEP 6: Send notifications and record
      // Phase 8.7: SKIP strategy for Telegram (non-critical)
      // ===================================================================
      await ErrorHandler.executeAsync(
        () => this.telegram.notifyPositionOpened(position),
        {
          strategy: RecoveryStrategy.SKIP,
          logger: this.logger,
          context: 'PositionLifecycleService.notifyPositionOpened',
          onRecover: () => {
            this.logger.info('Telegram notification skipped due to error');
          },
        }
      );
      await this.recordPositionOpenAnalytics({
        position,
        signal,
        side,
        quantity: sizingResult.quantity,
        journalId,
        timestamp,
        actualStopLoss,
        entrySnapshot,
      });

      this.logger.info('✅ Position opened successfully', {
        positionId: position.id,
        side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
        entry: position.entryPrice,
        quantity: position.quantity,
      });

      return position;
    } catch (error) {
      this.logger.error('Failed to open position', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.isOpeningPosition = false;
    }
  }

  private async configureAdditionalTakeProfits(signal: Signal, quantity: number): Promise<void> {
    if (!signal.takeProfits || signal.takeProfits.length <= 1) {
      return;
    }

    this.logger.info('Setting additional TP levels', {
      additionalLevels: signal.takeProfits.length - 1,
    });

    for (let i = 1; i < signal.takeProfits.length; i++) {
      const tp = signal.takeProfits[i];
      const tpSize = quantity / signal.takeProfits.length;

      if (!this.bybitService.updateTakeProfitPartial) {
        continue;
      }

      if (this.errorHandler) {
        const updateTPFn = this.bybitService.updateTakeProfitPartial.bind(this.bybitService);
        const tpResult = await this.errorHandler.executeAsync(
          () => updateTPFn({
            price: tp.price,
            size: tpSize,
            index: i,
          }),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: { maxAttempts: 2, initialDelayMs: 200, backoffMultiplier: 2 },
            context: `PositionLifecycleService.openPosition.updateTakeProfitPartial[TP${i + 1}]`,
          }
        );

        if (tpResult.success) {
          this.logger.debug(`TP${i + 1} set`, {
            price: tp.price,
            size: tpSize,
          });
        } else {
          this.logger.warn(`Failed to set TP${i + 1} level (non-critical)`, {
            error: tpResult.error?.message,
          });
        }
        continue;
      }

      try {
        await this.bybitService.updateTakeProfitPartial({
          price: tp.price,
          size: tpSize,
          index: i,
        });

        this.logger.debug(`TP${i + 1} set`, {
          price: tp.price,
          size: tpSize,
        });
      } catch (error) {
        this.logger.warn(`Failed to set TP${i + 1} level`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  /**
   * Get current position
   * Phase 6.2: Read from repository if available, fallback to direct storage
   */
  getCurrentPosition(): Position | null {
    return this.readStoredPosition();
  }

  /**
   * Expose entry-lock state for lifecycle orchestration safeguards.
   */
  isPositionOpening(): boolean {
    return this.isOpeningPosition;
  }

  /**
   * Get all open positions from journal
   * @returns Array of Position objects currently open
   */
  getOpenPositions(): Position[] {
    const currentPosition = this.readStoredPosition();
    if (!this.journal || !currentPosition) {
      return [];
    }

    // Return only the current position (single open position per symbol)
    return [currentPosition];
  }

  /**
   * Sync position from WebSocket update
   * Handles both position restoration (after bot restart) and state updates
   * Phase 8.9.17: GRACEFUL_DEGRADE if journal lookup fails
   */
  syncWithWebSocket(wsPosition: Position): void {
    this.currentPosition = this.resolveWebSocketSyncedPosition(this.currentPosition, wsPosition);
  }

  private resolveWebSocketSyncedPosition(
    currentPosition: Position | null,
    wsPosition: Position,
  ): Position {
    if (currentPosition === null) {
      // Restore position after bot restart
      // Phase 8.9.17: GRACEFUL_DEGRADE - continue without journalId if journal unavailable
      // Note: Sync version for backward compatibility - async restoration handled internally
      return this.restorePositionFromWebSocketSync(wsPosition);
    }

    // Update existing position state
    return this.updatePositionState(currentPosition, wsPosition);
  }

  /**
   * Clear position (called when WebSocket reports position closed)
   * Phase 6.2: Clear from repository if available
   * Phase 8.7: ErrorHandler integration for order cancellation
   */
  async clearPosition(): Promise<void> {
    // Get position before clearing (for event emission)
    const closedPosition = this.readStoredPosition();
    await this.cancelConditionalOrdersAfterClose();
    this.finalizePositionClear(closedPosition);
  }

  private async cancelConditionalOrdersAfterClose(): Promise<void> {
    // Phase 8.7: Cancel with RETRY strategy, then SKIP if exhausted
    this.logger.debug('Cancelling conditional orders after position close...');
    await ErrorHandler.executeAsync(
      () => this.bybitService.cancelAllConditionalOrders(),
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 200,
          backoffMultiplier: 2,
          maxDelayMs: 2000,
        },
        logger: this.logger,
        context: 'PositionLifecycleService.cancelAllConditionalOrders',
        onRetry: (attempt, error, delayMs) => {
          this.logger.warn(`🔄 Retrying order cancellation (attempt ${attempt}/3)`, {
            delayMs,
            error: error.message,
          });
        },
        onFailure: () => {
          this.logger.warn('Failed to cancel orders - proceeding with position clear');
        },
      }
    );
  }

  private finalizePositionClear(closedPosition: Position | null): void {
    // Clear state
    // Phase 6.2: Use repository if available
    if (this.positionRepository && closedPosition) {
      this.writeStoredPosition(null);
      this.logger.debug('[Phase 6.2] Position cleared from repository', { positionId: closedPosition.id });
    } else {
      this.writeStoredPosition(null);
    }
    this.takeProfitManager = null;
    this.isOpeningPosition = false;

    // Emit position-closed event
    if (closedPosition) {
      this.eventBus.emit('position-closed', {
        position: closedPosition,
        strategyId: this.strategyId,  // Phase 10.3c: Include strategyId for multi-strategy filtering
      });
    }
  }

  // =========================================================================
  // PUBLIC API: Entry Confirmation
  // =========================================================================

  /**
   * Check if confirmation is enabled for direction
   */
  isConfirmationEnabled(direction: SignalDirection): boolean {
    return this.entryConfirmation.isEnabled(direction);
  }

  /**
   * Add pending signal waiting for candle confirmation
   */
  addPendingSignal(signal: Signal, keyLevel: number): string {
    return this.entryConfirmation.addPending({
      symbol: this.bybitService.getSymbol?.() || 'UNKNOWN',
      direction: signal.direction,
      keyLevel,
      detectedAt: Date.now(),
      signalData: signal as unknown as Record<string, unknown>,
    });
  }

  /**
   * Check pending signals for confirmation
   */
  checkPendingConfirmations(currentCandleClose: number): Signal | null {
    const allPending = this.entryConfirmation.getAllPending();

    for (const pending of allPending) {
      const result = this.entryConfirmation.checkConfirmation(pending.id, currentCandleClose);

      if (result.confirmed) {
        const levelType = pending.direction === SignalDirection.LONG ? 'support' : 'resistance';

        this.logger.info(`✅ ${pending.direction} signal confirmed - ready to enter`, {
          pendingId: pending.id,
          direction: pending.direction,
          [`${levelType}Level`]: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
          candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
        });

        return pending.signalData as unknown as Signal;
      }

      // Log rejections
      if (!result.confirmed) {
        if (pending.direction === SignalDirection.LONG && result.reason.includes('below support')) {
          this.logger.info('❌ LONG signal rejected - falling knife avoided', {
            pendingId: pending.id,
            supportLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
            candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
          });
        } else if (pending.direction === SignalDirection.SHORT && result.reason.includes('above resistance')) {
          this.logger.info('❌ SHORT signal rejected - pump continues', {
            pendingId: pending.id,
            resistanceLevel: pending.keyLevel.toFixed(DECIMAL_PLACES.PRICE),
            candleClose: currentCandleClose.toFixed(DECIMAL_PLACES.PRICE),
          });
        }
      }
    }

    // Cleanup expired entries
    this.entryConfirmation.cleanupExpired();

    return null;
  }

  /**
   * Get count of pending signals
   */
  getPendingCount(direction?: SignalDirection): number {
    return this.entryConfirmation.getPendingCount(direction);
  }

  // =========================================================================
  // PUBLIC API: State Access
  // =========================================================================

  /**
   * Get the current TakeProfitManager (if position is open)
   * Used by PositionExitingService to track TP hits
   */
  getTakeProfitManager(): TakeProfitManagerService | null {
    return this.takeProfitManager;
  }

  // =========================================================================
  // PRIVATE HELPERS: Position Sizing
  // =========================================================================

  /**
   * Calculate final position size with compound interest support
   * Phase 8.7: FALLBACK strategy if compound calculation fails
   */
  private async calculatePositionSize(signal: Signal): Promise<{
    quantity: number;
    marginUsed: number;
    notionalValue: number;
    sizingChain: string[];
  }> {
    const sizingChain: string[] = [];
    let positionSizeUsdt: number;

    // Priority 1: Compound Interest (highest priority if enabled)
    if (this.compoundInterestCalculator?.isEnabled?.()) {
      try {
        const compoundResult = await this.compoundInterestCalculator.calculatePositionSize();
        positionSizeUsdt = compoundResult.positionSize;
        sizingChain.push('COMPOUND_INTEREST');

        this.logger.info('💰 Position sizing: Compound interest', {
          currentBalance: compoundResult.currentBalance,
          totalProfit: compoundResult.totalProfit,
          positionSize: positionSizeUsdt,
        });
      } catch (error) {
        // Phase 8.7: FALLBACK to fixed size if compound fails
        this.logger.warn('Compound interest calculation failed, falling back to fixed size', {
          error: error instanceof Error ? error.message : String(error),
        });
        positionSizeUsdt = this.riskConfig.positionSizeUsdt;
        sizingChain.push('COMPOUND_INTEREST_FAILED');
        sizingChain.push('FALLBACK_FIXED');
      }
    }
    // Priority 2: Dynamic Position Sizing (Phase 11.1 - Kelly Criterion)
    else if (this.dynamicPositionSizer && this.isDynamicPositionSizingEnabled()) {
      try {
        // Get account balance
        const balanceInfo = await this.bybitService.getBalance();
        const accountBalance = balanceInfo.walletBalance || 10000; // Fallback

        // Calculate RR ratio
        const firstTP = resolveFirstTakeProfitPrice(signal);
        const rrRatio = calculateRiskRewardRatio(signal.price, signal.stopLoss, firstTP);

        // Get ATR if available (optional)
        const currentATR = this.extractSignalNumber(signal, ['atr']) ?? signal.marketData?.atr;
        const averageATR = this.extractSignalNumber(signal, ['averageATR', 'averageAtr']);

        const sizingResult = await this.dynamicPositionSizer.calculateOptimalSize(
          signal.price,           // entry price
          signal.stopLoss,        // stop loss price
          accountBalance,         // current balance
          signal.confidence || 0.7, // signal confidence (0-1)
          currentATR,            // current ATR (optional)
          averageATR,            // average ATR (optional)
          rrRatio                // risk/reward ratio
        );

        positionSizeUsdt = sizingResult.adjustedSize;
        sizingChain.push('KELLY_CRITERION');
        sizingChain.push(`CONF_${(signal.confidence || 0.7) * 100}%`);
        sizingChain.push(`RISK_${sizingResult.riskPercent.toFixed(2)}%`);
        if (currentATR && averageATR) {
          sizingChain.push(`ATR_${sizingResult.volatilityAdjustment.toFixed(2)}x`);
        }

        this.logger.info('🎲 Position sizing: Kelly Criterion', {
          baseSize: sizingResult.baseSize,
          adjustedSize: sizingResult.adjustedSize,
          riskPercent: sizingResult.riskPercent,
          confidence: signal.confidence || 0.7,
          volatilityAdj: sizingResult.volatilityAdjustment,
          recommendation: sizingResult.recommendation,
        });
      } catch (error) {
        // FALLBACK to fixed size if Kelly fails
        this.logger.warn('Kelly Criterion calculation failed, falling back to fixed size', {
          error: error instanceof Error ? error.message : String(error),
        });
        positionSizeUsdt = this.riskConfig.positionSizeUsdt;
        sizingChain.push('KELLY_FAILED');
        sizingChain.push('FALLBACK_FIXED');
      }
    } else {
      // Priority 3: Fixed position size from config
      positionSizeUsdt = this.riskConfig.positionSizeUsdt;
      sizingChain.push('FIXED');
    }

    // Calculate quantity with leverage
    const exposure = calculatePositionExposure(
      positionSizeUsdt,
      this.tradingConfig.leverage,
      signal.price,
    );

    return { ...exposure, sizingChain };
  }

  /**
   * Calculate stop-loss distance in absolute price
   */
  private calculateSLDistance(entryPrice: number, signalStopLoss: number): number {
    return Math.abs(signalStopLoss - entryPrice);
  }

  /**
   * Calculate actual stop-loss price accounting for market movement
   */
  private calculateActualStopLoss(
    isLong: boolean,
    currentPrice: number,
    slDistance: number,
  ): number {
    return isLong ? currentPrice - slDistance : currentPrice + slDistance;
  }

  private async prepareOpenExecutionContext(signal: Signal): Promise<{
    side: PositionSide;
    slDistance: number;
    currentPrice: number;
    actualStopLoss: number;
  }> {
    await this.cancelHangingOrdersBeforeOpen();

    const isLong = signal.direction === SignalDirection.LONG;
    const side = isLong ? PositionSide.LONG : PositionSide.SHORT;
    const slDistance = this.calculateSLDistance(signal.price, signal.stopLoss);
    const currentPrice = await this.resolveCurrentPriceForOpen(signal.price);
    const actualStopLoss = this.calculateActualStopLoss(isLong, currentPrice, slDistance);

    return { side, slDistance, currentPrice, actualStopLoss };
  }

  private async executeAtomicOpenPosition(params: {
    side: PositionSide;
    quantity: number;
    actualStopLoss: number;
    takeProfits: Signal['takeProfits'] | undefined;
  }): Promise<{
    openedPosition: Position;
    orderId: string | undefined;
    tpOrderIds: (string | undefined)[];
  }> {
    const { side, quantity, actualStopLoss, takeProfits } = params;
    const exchangeSide: 'Buy' | 'Sell' = side === PositionSide.LONG ? 'Buy' : 'Sell';
    const tpPrices = takeProfits && takeProfits.length > 0
      ? takeProfits.map(tp => tp.price)
      : [];

    const openResult = await ErrorHandler.executeAsync(
      () => this.bybitService.openPosition({
        symbol: this.bybitService.getSymbol?.() || 'UNKNOWN',
        side: exchangeSide,
        quantity,
        leverage: this.tradingConfig.leverage,
        stopLoss: actualStopLoss,
        takeProfits: tpPrices,
      }),
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 500,
          backoffMultiplier: 2,
          maxDelayMs: 5000,
        },
        logger: this.logger,
        context: 'PositionLifecycleService.openPosition',
        onRetry: (attempt, error, delayMs) => {
          this.logger.warn(`🔄 Retrying position open (attempt ${attempt}/3)`, {
            delayMs,
            error: error.message,
          });
        },
      }
    );

    if (!openResult.success || !openResult.value) {
      throw openResult.error || new Error('Failed to open position on exchange');
    }

    const openedPosition = openResult.value;
    const orderId = openedPosition.id;
    this.logger.info('Position opened WITH atomic SL/TP protection', {
      orderId,
      side: side === PositionSide.LONG ? 'LONG' : 'SHORT',
      quantity,
      slSet: true,
      tpSet: tpPrices.length > 0,
    });

    const tpOrderIds: (string | undefined)[] = [];
    if (tpPrices.length > 0) {
      tpOrderIds.push(orderId);
    }

    return { openedPosition, orderId, tpOrderIds };
  }

  private async cancelHangingOrdersBeforeOpen(): Promise<void> {
    this.logger.debug('🧹 Cancelling any hanging conditional orders before opening...');
    if (this.errorHandler) {
      const cancelResult = await this.errorHandler.executeAsync(
        () => this.bybitService.cancelAllConditionalOrders(),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
          context: 'PositionLifecycleService.openPosition.cancelAllConditionalOrders',
          onFailure: () => {
            this.logger.warn('Failed to cancel hanging orders (non-blocking)', {
              note: 'Continuing with position opening',
            });
          },
        }
      );

      if (!cancelResult.success) {
        // SKIP: non-blocking operation - continue anyway
        this.logger.warn('Hanging order cancellation skipped, proceeding with position open', {
          error: cancelResult.error?.message,
        });
      }
      return;
    }

    try {
      await this.bybitService.cancelAllConditionalOrders();
    } catch (error) {
      this.logger.warn('Failed to cancel hanging orders', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue anyway - don't fail the position opening
    }
  }

  private async resolveCurrentPriceForOpen(signalPrice: number): Promise<number> {
    if (this.errorHandler) {
      const priceResult = await this.errorHandler.executeAsync(
        () => this.bybitService.getCurrentPrice(),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 3, initialDelayMs: 500, backoffMultiplier: 2 },
          context: 'PositionLifecycleService.openPosition.getCurrentPrice',
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn(`🔄 Retrying price fetch (${attempt}/3)`, {
              delayMs,
              error: error.message,
            });
          },
          onFailure: () => {
            this.logger.warn('⚠️ Price fetch failed, falling back to signal price', {
              signalPrice,
            });
          },
        }
      );
      return priceResult.success && priceResult.value !== undefined
        ? priceResult.value
        : signalPrice;
    }

    return this.bybitService.getCurrentPrice();
  }

  private wireOpenedPositionState(position: Position, signal: Signal): void {
    // Store position immediately to prevent race condition
    if (this.positionRepository) {
      this.writeStoredPosition(position);
      this.logger.debug('[Phase 6.2] Position stored in repository', { positionId: position.id });
    } else {
      this.writeStoredPosition(position);
    }

    // Emit position-opened event
    this.logger.info('Emitting position-opened event', { positionId: position.id });
    this.eventBus.emit('position-opened', {
      position,
      strategyId: this.strategyId,  // Phase 10.3c: Include strategyId for multi-strategy filtering
    });
    this.logger.debug('[EVENT] position-opened emitted', { positionId: position.id });

    // Initialize TakeProfitManager for partial close tracking
    this.takeProfitManager = new TakeProfitManagerService(
      {
        positionId: position.id,
        symbol: position.symbol,
        side: position.side,
        entryPrice: signal.price,
        totalQuantity: position.quantity,
        leverage: this.tradingConfig.leverage,
      },
      this.logger,
      this.errorHandler,
    );
  }

  private isDynamicPositionSizingEnabled(): boolean {
    const config = this.fullConfig as Config & DynamicPositionSizingConfigView;
    return config.dynamicPositionSizing?.enabled === true;
  }

  private async recordPositionOpenAnalytics(params: {
    position: Position;
    signal: Signal;
    side: PositionSide;
    quantity: number;
    journalId: string;
    timestamp: number;
    actualStopLoss: number;
    entrySnapshot?: SessionEntryCondition;
  }): Promise<void> {
    const { position, signal, side, quantity, journalId, timestamp, actualStopLoss, entrySnapshot } = params;
    await this.recordTradeOpenWithResilience({
      positionId: position.id,
      symbol: position.symbol,
      signal,
      side,
      quantity,
      journalId,
    });

    if (this.sessionStats && entrySnapshot) {
      const sessionTrade = this.createSessionTradeRecordForOpen({
        journalId,
        timestamp,
        signal,
        quantity,
        actualStopLoss,
        entrySnapshot,
      });
      await this.recordSessionTradeEntryWithResilience(sessionTrade, journalId);
    }
  }

  private async recordTradeOpenWithResilience(params: {
    positionId: string;
    symbol: string;
    signal: Signal;
    side: PositionSide;
    quantity: number;
    journalId: string;
  }): Promise<void> {
    const { positionId, symbol, signal, side, quantity, journalId } = params;
    const tradeOpenPayload = {
      id: journalId,
      symbol,
      side,
      entryPrice: signal.price,
      quantity,
      leverage: this.tradingConfig.leverage,
      entryCondition: {
        signal,
      },
    };

    if (this.errorHandler) {
      const journalResult = await this.errorHandler.executeAsync(
        async () => {
          this.journal.recordTradeOpen(tradeOpenPayload);
        },
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
          context: 'PositionLifecycleService.openPosition.recordTradeOpen',
          onFailure: () => {
            this.logger.warn('Trade opened without journal recording (degraded mode)');
          },
        }
      );

      if (!journalResult.success) {
        this.logger.warn('Position opened but journal recording failed', {
          positionId,
          error: journalResult.error?.message,
          note: 'Position will be managed but not recorded in journal',
        });
      } else {
        this.logger.info('Trade recorded in journal', { journalId });
      }
      return;
    }

    this.journal.recordTradeOpen(tradeOpenPayload);
    this.logger.info('Trade recorded in journal', { journalId });
  }

  private createSessionTradeRecordForOpen(params: {
    journalId: string;
    timestamp: number;
    signal: Signal;
    quantity: number;
    actualStopLoss: number;
    entrySnapshot: SessionEntryCondition;
  }): SessionTradeRecord {
    const { journalId, timestamp, signal, quantity, actualStopLoss, entrySnapshot } = params;

    return {
      tradeId: journalId,
      timestamp: new Date(timestamp).toISOString(),
      direction: signal.direction,
      entryPrice: signal.price,
      exitPrice: 0,
      quantity,
      pnl: 0,
      pnlPercent: 0,
      exitType: ExitType.MANUAL,
      tpHitLevels: [],
      holdingTimeMs: 0,
      entryCondition: entrySnapshot,
      stopLoss: {
        initial: actualStopLoss,
        final: actualStopLoss,
        movedToBreakeven: false,
        trailingActivated: false,
      },
    };
  }

  private async recordSessionTradeEntryWithResilience(
    sessionTrade: SessionTradeRecord,
    tradeId: string,
  ): Promise<void> {
    if (!this.sessionStats) {
      return;
    }

    if (this.errorHandler) {
      const statsResult = await this.errorHandler.executeAsync(
        async () => {
          this.sessionStats!.recordTradeEntry(sessionTrade);
        },
        {
          strategy: RecoveryStrategy.SKIP,
          context: 'PositionLifecycleService.openPosition.recordTradeEntry',
        }
      );

      if (statsResult.success) {
        this.logger.debug('Trade recorded in session stats', { tradeId });
      } else {
        this.logger.warn('Failed to record session stats (non-critical)', {
          error: statsResult.error?.message,
        });
      }
      return;
    }

    this.sessionStats.recordTradeEntry(sessionTrade);
    this.logger.debug('Trade recorded in session stats', { tradeId });
  }

  private extractSignalNumber(signal: Signal, keys: string[]): number | undefined {
    const raw = signal as unknown as Record<string, unknown>;
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }
    return undefined;
  }

  // =========================================================================
  // PRIVATE HELPERS: WebSocket Sync
  // =========================================================================

  /**
   * Restore position from WebSocket after bot restart (synchronous for backward compatibility)
   * Phase 8.9.17: GRACEFUL_DEGRADE - continue without journalId if journal unavailable
   */
  private restorePositionFromWebSocketSync(position: Position): Position {
    // Phase 8.9.17: Try to find matching open trade in journal with graceful degradation
    // Synchronous version - ErrorHandler integration happens asynchronously
    try {
      const openTrade = this.journal.getOpenPositionBySymbol(position.symbol);

      if (openTrade) {
        const restored = restoreWebSocketPosition(position, openTrade.id);
        this.logger.info('✅ Position restored from WebSocket with journal ID', {
          exchangeId: restored.id,
          journalId: restored.journalId,
          symbol: restored.symbol,
        });
        return restored;
      }

      const restored = restoreWebSocketPosition(position, undefined);
      this.logger.warn('⚠️ Position restored from WebSocket but not found in journal - IGNORING from statistics', {
        exchangeId: restored.id,
        symbol: restored.symbol,
        entryPrice: restored.entryPrice,
        quantity: restored.quantity,
        note: 'This position will be managed (TP/SL) but NOT recorded in journal.',
      });
      return restored;
    } catch (error) {
      const restored = restoreWebSocketPosition(position, undefined);
      // Journal lookup failed - graceful degrade (continue without journalId)
      this.logger.warn('Journal lookup failed during position restoration - proceeding without journalId', {
        error: error instanceof Error ? error.message : String(error),
        positionId: restored.id,
      });
      return restored;
    }
  }

  /**
   * Update existing position state with WebSocket data
   */
  private updatePositionState(currentPosition: Position, wsPosition: Position): Position {
    const { position, entryPriceUpdated } = applyWebSocketPositionUpdate(currentPosition, wsPosition);

    // CRITICAL: Bybit can send entryPrice=0 before MARKET order fill
    if (entryPriceUpdated) {
      this.logger.info('✅ Entry price updated from WebSocket', {
        positionId: position.id,
        entryPrice: wsPosition.entryPrice,
      });
    }

    return position;
  }

  // =========================================================================
  // PHASE 9.P0: Safety Guards for Live Trading Integration
  // =========================================================================

  /**
   * P0.1: Close position with atomic guarantee
   * Prevents timeout ↔ close race condition by using atomic lock
   *
   * Returns early if position already closing (returns same promise)
   * Multiple concurrent calls to same position wait for first close to complete
   */
  /**
   * [P0.1 + P3] Close position with atomic lock
   * Prevents race conditions between timeout close, WebSocket close, and local close
   *
   * @param reason - Reason for close ('EXTERNAL_CLOSE', 'TIMEOUT', etc)
   * @param onCloseInternal - Optional callback to execute within the lock (e.g., WebSocket handler)
   */
  async closePositionWithAtomicLock(
    reason: string,
    onCloseInternal?: () => Promise<void>,
  ): Promise<void> {
    const position = this.getCurrentPosition();
    const positionId = position?.id || 'UNKNOWN';

    // Check if already closing this position
    if (this.positionClosing.has(positionId)) {
      this.logger.warn(`[P0.1 + P3] Position already closing: ${positionId}`, { reason });
      return this.positionClosing.get(positionId)!; // Wait for in-progress close
    }

    // Create close promise
    const closePromise = this.performClose(positionId, reason, onCloseInternal);
    this.positionClosing.set(positionId, closePromise);

    try {
      await closePromise;
    } finally {
      // Clean up lock
      this.positionClosing.delete(positionId);
    }
  }

  /**
   * [P0.1 + P3] Perform actual close operation within atomic lock
   * If onCloseInternal is provided, it executes within the lock (for WebSocket handler)
   * Otherwise, just clears the position (for timeout-based close)
   */
  private async performClose(
    positionId: string,
    reason: string,
    onCloseInternal?: () => Promise<void>,
  ): Promise<void> {
    const position = this.getCurrentPosition();
    if (!position) {
      this.logger.info(`[P0.1 + P3] Position already closed or not found: ${positionId}`, {
        reason,
      });
      return;
    }

    try {
      this.logger.info(`[P0.1 + P3] Closing position with atomic lock: ${positionId}`, {
        reason,
        hasCloseHandler: !!onCloseInternal,
      });

      // If custom close handler provided (e.g., WebSocket), execute it within the lock
      if (onCloseInternal) {
        await onCloseInternal();
      } else {
        // Standard timeout-based close: just clear position
        await this.clearPosition();
      }

      this.logger.info(`[P0.1 + P3] Position closed successfully: ${positionId}`, {
        reason,
      });
    } catch (error) {
      this.logger.error(`[P0.1 + P3] Failed to close position: ${positionId}`, {
        error: error instanceof Error ? error.message : String(error),
        reason,
      });
      throw error;
    }
  }

  /**
   * P0.3: Get atomic snapshot of current position
   * Prevents WebSocket updates from changing fields mid-calculation
   * Used by Phase 9 services for concurrent-safe position reads
   *
   * Returns deep copy so concurrent WebSocket updates don't affect snapshot
   * Phase 8.9.17: FALLBACK strategy if JSON serialization fails
   */
  getPositionSnapshot(): Position | null {
    const position = this.getCurrentPosition();
    if (!position) return null;

    // Deep copy = atomic read (WebSocket changes won't affect copy)
    if (this.errorHandler) {
      try {
        const snapshot = clonePositionSnapshot(position);
        return snapshot;
      } catch (error) {
        // FALLBACK: use reference if deep copy fails
        this.logger.warn('[P0.3] Failed to create position snapshot, using reference (degraded mode)', {
          error: error instanceof Error ? error.message : String(error),
        });
        return position;
      }
    } else {
      try {
        return clonePositionSnapshot(position);
      } catch (error) {
        this.logger.error('[P0.3] Failed to create position snapshot', { error });
        return position; // Fallback to reference if copy fails
      }
    }
  }
}





