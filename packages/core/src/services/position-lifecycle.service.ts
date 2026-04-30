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
 * UNIFIED RESPONSIBILITY: Manage position lifecycle from open -> close
 * - Open positions with atomic SL/TP protection
 * - Sync positions with WebSocket on bot restart
 * - Track position state (currentPosition, takeProfitManager)
 * - Manage entry confirmation for signals requiring candle confirmation
 *
 * CRITICAL: SL and TP are set ATOMICALLY with position opening via Bybit
 * No separate verification service needed - handled by BybitService.openPosition()
 */

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
} from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { BotEventBus } from './event-bus';
import { TelegramService } from './telegram.service';
import { TradingJournalService } from './trading-journal.service';
import { TakeProfitManagerService } from './take-profit-manager.service';
import { EntryConfirmationManager, type PendingSignalData } from './entry-confirmation.service';
import { CompoundInterestCalculatorService } from './compound-interest-calculator.service';
import { SessionStatsService } from './session-stats.service';
import type { DynamicPositionSizerService } from './dynamic-position-sizer.service';
import type { PositionScalingService } from './position-scaling.service';
import { IPositionRepository } from '../repositories/IRepositories';
import { ErrorHandler } from '../errors';
import { closePositionWithAtomicLockOrchestrated } from './position-lifecycle/position-lifecycle-atomic.orchestrator';
import { getPositionSnapshotOrchestrated } from './position-lifecycle/position-lifecycle-snapshot.orchestrator';
import { cancelConditionalOrdersAfterCloseOrchestrated } from './position-lifecycle/position-lifecycle-clear.orchestrator';
import { processPendingConfirmationOrchestrated } from './position-lifecycle/position-lifecycle-confirmation.orchestrator';
import { syncWithWebSocketLifecycleOrchestrated } from './position-lifecycle/position-lifecycle-sync-lifecycle.orchestrator';
import { finalizePositionClearLifecycleOrchestrated } from './position-lifecycle/position-lifecycle-clear-lifecycle.orchestrator';
import { openPositionLifecycleOrchestrated } from './position-lifecycle/position-lifecycle-open-lifecycle.orchestrator';

// ============================================================================
// CONSTANTS
// ============================================================================

// ============================================================================
// POSITION LIFECYCLE SERVICE
// ============================================================================

export class PositionLifecycleService {
  // State
  private currentPosition: Position | null = null;
  private isOpeningPosition: boolean = false; // Prevent duplicate position opening
  private takeProfitManager: TakeProfitManagerService | null = null;
  private entryConfirmation: EntryConfirmationManager;

  // PHASE 9.P0: Atomic lock for position close (prevent timeout -> close race)
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
      const { position, takeProfitManager } = await openPositionLifecycleOrchestrated({
        signal,
        entrySnapshot,
        bybitService: this.bybitService,
        tradingConfig: this.tradingConfig,
        riskConfig: this.riskConfig,
        logger: this.logger,
        journal: this.journal,
        sessionStats: this.sessionStats,
        errorHandler: this.errorHandler,
        strategyId: this.strategyId,
        eventBus: this.eventBus,
        telegram: this.telegram,
        fullConfig: this.fullConfig,
        compoundInterestCalculator: this.compoundInterestCalculator,
        dynamicPositionSizer: this.dynamicPositionSizer,
        hasRepository: Boolean(this.positionRepository),
        writeStoredPosition: (nextPosition) => this.writeStoredPosition(nextPosition),
      });
      this.takeProfitManager = takeProfitManager;
      return position;
    } catch (error) {
      throw error;
    } finally {
      this.isOpeningPosition = false;
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
    const syncedPosition = syncWithWebSocketLifecycleOrchestrated({
      currentPosition: this.readStoredPosition(),
      wsPosition,
      getOpenTradeBySymbol: (symbol) => this.journal.getOpenPositionBySymbol(symbol),
      logger: this.logger,
    });
    this.writeStoredPosition(syncedPosition);
  }

  /**
   * Clear position (called when WebSocket reports position closed)
   * Phase 6.2: Clear from repository if available
   * Phase 8.7: ErrorHandler integration for order cancellation
   */
  async clearPosition(): Promise<void> {
    // Get position before clearing (for event emission)
    const closedPosition = this.readStoredPosition();
    await cancelConditionalOrdersAfterCloseOrchestrated({
      cancelAllConditionalOrders: () => this.bybitService.cancelAllConditionalOrders(),
      logger: this.logger,
    });
    finalizePositionClearLifecycleOrchestrated({
      closedPosition,
      hasRepository: Boolean(this.positionRepository),
      writeStoredPosition: (nextPosition) => this.writeStoredPosition(nextPosition),
      clearRuntimeState: () => {
        this.takeProfitManager = null;
        this.isOpeningPosition = false;
      },
      strategyId: this.strategyId,
      eventBus: this.eventBus,
      logger: this.logger,
    });
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
      signalData: this.toPendingSignalData(signal),
    });
  }

  /**
   * Check pending signals for confirmation
   */
  checkPendingConfirmations(currentCandleClose: number): Signal | null {
    const allPending = this.entryConfirmation.getAllPending();

    for (const pending of allPending) {
      const confirmedSignal = processPendingConfirmationOrchestrated({
        pending: pending as {
          id: string;
          direction: SignalDirection;
          keyLevel: number;
          signalData: PendingSignalData;
        },
        currentCandleClose,
        entryConfirmation: this.entryConfirmation,
        logger: this.logger,
      });
      if (confirmedSignal) {
        return confirmedSignal;
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
  // PRIVATE HELPERS: Atomic Close + Snapshots (PHASE 9.P0)
  // =========================================================================

  /**
   * P0.1: Close position with atomic guarantee
   * Prevents timeout -> close race condition by using atomic lock
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
    await closePositionWithAtomicLockOrchestrated({
      reason,
      onCloseInternal,
      positionClosing: this.positionClosing,
      getCurrentPosition: () => this.getCurrentPosition(),
      clearPosition: () => this.clearPosition(),
      logger: this.logger,
    });
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
    return getPositionSnapshotOrchestrated({
      position: this.getCurrentPosition(),
      errorHandler: this.errorHandler,
      logger: this.logger,
    });
  }

  private toPendingSignalData(signal: Signal): PendingSignalData {
    return { ...signal };
  }

}







