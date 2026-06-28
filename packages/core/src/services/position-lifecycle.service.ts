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

export class PositionLifecycleService {
  private static readonly PERFORMANCE_WINDOW = 5;
  private static readonly CONSECUTIVE_LOSS_THRESHOLD = 3;
  private static readonly MIN_WINRATE = 0.4;
  private static readonly SAME_DIRECTION_LOSS_THRESHOLD = 2;

  private currentPosition: Position | null = null;
  private isOpeningPosition: boolean = false;
  private takeProfitManager: TakeProfitManagerService | null = null;
  private entryConfirmation: EntryConfirmationManager;
  private recentCloseState: {
    direction: SignalDirection;
    closedAt: number;
    realizedPnl: number;
  } | null = null;
  private recentTradePerformance: Array<{
    result: 'win' | 'loss';
    direction: SignalDirection;
    closedAt: number;
  }> = [];
  private degradationState: {
    cooldownUntil: number;
    blockedDirection: SignalDirection | null;
    blockedUntil: number;
  } = {
    cooldownUntil: 0,
    blockedDirection: null,
    blockedUntil: 0,
  };

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
    private readonly strategyId?: string,
    private readonly positionRepository?: IPositionRepository,
    private readonly errorHandler?: ErrorHandler,
    private readonly dynamicPositionSizer?: DynamicPositionSizerService,
    private readonly positionScalingService?: PositionScalingService,
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

  async openPosition(signal: Signal, entrySnapshot?: SessionEntryCondition): Promise<Position> {
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

  getCurrentPosition(): Position | null {
    return this.readStoredPosition();
  }

  isPositionOpening(): boolean {
    return this.isOpeningPosition;
  }

  getOpenPositions(): Position[] {
    const currentPosition = this.readStoredPosition();
    if (!this.journal || !currentPosition) {
      return [];
    }

    return [currentPosition];
  }

  syncWithWebSocket(wsPosition: Position): void {
    const syncedPosition = syncWithWebSocketLifecycleOrchestrated({
      currentPosition: this.readStoredPosition(),
      wsPosition,
      getOpenTradeBySymbol: (symbol) => this.journal.getOpenPositionBySymbol(symbol),
      logger: this.logger,
    });
    this.writeStoredPosition(syncedPosition);
  }

  async clearPosition(): Promise<void> {
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

  isConfirmationEnabled(direction: SignalDirection): boolean {
    return this.entryConfirmation.isEnabled(direction);
  }

  addPendingSignal(signal: Signal, keyLevel: number): string {
    return this.entryConfirmation.addPending({
      symbol: this.bybitService.getSymbol?.() || 'UNKNOWN',
      direction: signal.direction,
      keyLevel,
      detectedAt: Date.now(),
      signalData: this.toPendingSignalData(signal),
    });
  }

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

    this.entryConfirmation.cleanupExpired();

    return null;
  }

  getPendingCount(direction?: SignalDirection): number {
    return this.entryConfirmation.getPendingCount(direction);
  }

  recordRecentClose(position: Position, realizedPnl: number): void {
    const closedAt = Date.now();
    const direction = position.side === 'LONG' ? SignalDirection.LONG : SignalDirection.SHORT;
    this.recentCloseState = {
      direction,
      closedAt,
      realizedPnl,
    };

    const result: 'win' | 'loss' = realizedPnl > 0 ? 'win' : 'loss';
    this.recentTradePerformance = [...this.recentTradePerformance, { result, direction, closedAt }]
      .slice(-PositionLifecycleService.PERFORMANCE_WINDOW);

    if (result === 'win') {
      this.recentTradePerformance = [{ result, direction, closedAt }];
      this.degradationState = { cooldownUntil: 0, blockedDirection: null, blockedUntil: 0 };
    }
  }

  getRecentCloseState(): {
    direction: SignalDirection;
    closedAt: number;
    realizedPnl: number;
  } | null {
    if (!this.recentCloseState) {
      return null;
    }

    if (!Number.isFinite(this.recentCloseState.closedAt)) {
      this.recentCloseState = null;
      return null;
    }

    return this.recentCloseState;
  }

  clearRecentCloseState(): void {
    this.recentCloseState = null;
  }

  getDegradationBlock(
    direction: SignalDirection,
    cooldownMs: number,
  ): { blocked: boolean; reason?: string } {
    const now = Date.now();
    if (this.degradationState.cooldownUntil > 0 && now >= this.degradationState.cooldownUntil) {
      this.degradationState.cooldownUntil = 0;
    }
    if (this.degradationState.blockedUntil > 0 && now >= this.degradationState.blockedUntil) {
      this.degradationState.blockedDirection = null;
      this.degradationState.blockedUntil = 0;
    }

    const losses = this.recentTradePerformance.filter((trade) => trade.result === 'loss');
    const wins = this.recentTradePerformance.length - losses.length;
    const winrate = this.recentTradePerformance.length > 0 ? wins / this.recentTradePerformance.length : 1;
    const consecutiveLosses = this.recentTradePerformance.slice().reverse().findIndex((trade) => trade.result === 'win');
    const lossStreak = consecutiveLosses === -1 ? losses.length : consecutiveLosses;
    const sameDirectionLosses = losses.filter((trade) => trade.direction === direction).length;

    if (cooldownMs > 0) {
      if (lossStreak >= PositionLifecycleService.CONSECUTIVE_LOSS_THRESHOLD ||
        (this.recentTradePerformance.length >= PositionLifecycleService.PERFORMANCE_WINDOW && winrate < PositionLifecycleService.MIN_WINRATE)) {
        this.degradationState.cooldownUntil = Math.max(this.degradationState.cooldownUntil, now + cooldownMs);
      }
      if (sameDirectionLosses >= PositionLifecycleService.SAME_DIRECTION_LOSS_THRESHOLD) {
        this.degradationState.blockedDirection = direction;
        this.degradationState.blockedUntil = Math.max(this.degradationState.blockedUntil, now + cooldownMs);
      }
    }

    this.logger.debug('Degradation state', {
      degradationState: {
        losses: losses.length,
        winrate: Number((winrate * 100).toFixed(1)),
        blockedDirection: this.degradationState.blockedDirection,
        cooldownActive: this.degradationState.cooldownUntil > now,
      },
    });

    if (this.degradationState.cooldownUntil > now) {
      return { blocked: true, reason: 'degradation cooldown active' };
    }
    if (this.degradationState.blockedDirection === direction && this.degradationState.blockedUntil > now) {
      return { blocked: true, reason: `degradation block for ${direction}` };
    }
    return { blocked: false };
  }

  // Used by PositionExitingService to track TP hits
  getTakeProfitManager(): TakeProfitManagerService | null {
    return this.takeProfitManager;
  }

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







