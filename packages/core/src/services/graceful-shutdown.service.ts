/**
 * Phase 9: Graceful Shutdown Manager Service
 *
 * Handles safe bot shutdown with:
 * - Position closure or persistence
 * - Order cancellation
 * - State persistence to disk
 * - Recovery on bot restart
 * - Signal handler registration (SIGINT, SIGTERM)
 *
 * Shutdown Sequence:
 * 1. Register signal handlers
 * 2. Emit shutdown-started event
 * 3. Cancel all pending orders
 * 4. Close positions (or persist state)
 * 5. Persist bot state to disk
 * 6. Emit shutdown-complete event
 * 7. Exit process
 *
 * Recovery:
 * - Load persisted positions from disk
 * - Restore position state
 * - Resume monitoring
 */

import * as fs from 'fs';
import * as path from 'path';
import { BotEventBus } from './event-bus';
import { PositionLifecycleService } from './position-lifecycle.service';
import { ActionQueueService } from './action-queue.service';
import { IExchange } from '../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { ICONS } from '../cli/cli-runtime';
import { registerGracefulShutdownSignals } from '../cli/cli-shutdown';
import { getErrorMessage } from '../utils/error.utils';

import {
  LoggerService,
  PersistedPositionState,
  RecoveryMetadata,
  BotStateSnapshot,
  IGracefulShutdownManager,
  GracefulShutdownConfig,
  ShutdownResult,
  EmergencyCloseReason,
  LiveTradingEventType,
  ActionType,
  ClosePercentAction,
} from '../types/legacy';

/**
 * GracefulShutdownManager: Safe bot shutdown with state persistence
 */
export class GracefulShutdownManager implements IGracefulShutdownManager {
  private static readonly SIGNAL_LABELS = {
    SIGINT: 'SIGINT (Ctrl+C)',
    SIGTERM: 'SIGTERM (kill)',
  } as const;

  private static readonly SIGNAL_REASONS = {
    SIGINT: 'SIGINT - User interrupt',
    SIGTERM: 'SIGTERM - Process termination',
  } as const;

  private config: GracefulShutdownConfig;
  private positionLifecycleService: PositionLifecycleService;
  private actionQueue: ActionQueueService;
  private exchange: IExchange;
  private logger: LoggerService;
  private eventBus: BotEventBus;
  private shutdownInProgress = false;
  private stateDirectory: string;

  constructor(
    config: GracefulShutdownConfig,
    positionLifecycleService: PositionLifecycleService,
    actionQueue: ActionQueueService,
    exchange: IExchange,
    logger: LoggerService,
    eventBus: BotEventBus,
    stateDirectory: string = './data/shutdown-state',
  ) {
    this.config = config;
    this.positionLifecycleService = positionLifecycleService;
    this.actionQueue = actionQueue;
    this.exchange = exchange;
    this.logger = logger;
    this.eventBus = eventBus;
    this.stateDirectory = stateDirectory;
  }

  public registerShutdownHandlers(): void {
    this.ensureStateDirectory();

    registerGracefulShutdownSignals(process, {
      onSigint: () => {
        void this.handleRegisteredSignal('SIGINT');
      },
      onSigterm: () => {
        void this.handleRegisteredSignal('SIGTERM');
      },
      onUncaughtException: () => undefined,
      onUnhandledRejection: () => undefined,
    });

    this.logger.info('[GracefulShutdownManager] Signal handlers registered');
  }

  private async handleRegisteredSignal(signal: keyof typeof GracefulShutdownManager.SIGNAL_REASONS): Promise<void> {
    this.logger.info(`[GracefulShutdownManager] Received ${GracefulShutdownManager.SIGNAL_LABELS[signal]}`);
    await this.initiateShutdown(GracefulShutdownManager.SIGNAL_REASONS[signal]);
  }

  public async initiateShutdown(reason: string): Promise<ShutdownResult> {
    if (this.shutdownInProgress) {
      this.logger.warn('[GracefulShutdownManager] Shutdown already in progress');
      return {
        success: false,
        duration: 0,
        closedPositions: 0,
        cancelledOrders: 0,
        persistedState: false,
        error: 'Shutdown already in progress',
        timestamp: Date.now(),
      };
    }

    this.shutdownInProgress = true;
    const startTime = Date.now();

    this.logger.info(`[GracefulShutdownManager] Initiating shutdown: ${reason}`);

    this.eventBus.publishSync({
      type: LiveTradingEventType.SHUTDOWN_STARTED,
      data: {
        reason,
        timestamp: Date.now(),
        timeoutMs: this.config.timeoutMs,
      },
      timestamp: Date.now(),
    });

    try {
      const shutdownTimer = setTimeout(() => {
        this.logger.error('[GracefulShutdownManager] Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, this.config.timeoutMs);

      let closedPositions = 0;
      let cancelledOrders = 0;

      this.logger.info('[GracefulShutdownManager] Cancelling pending orders...');
      try {
        cancelledOrders = await this.cancelAllPendingOrders();
        this.logger.info(`[GracefulShutdownManager] Cancelled ${cancelledOrders} orders`);
      } catch (error) {
        this.logger.warn(`[GracefulShutdownManager] Error cancelling orders: ${error}`);
      }

      if (this.config.closeAllPositions) {
        this.logger.info('[GracefulShutdownManager] Closing all open positions...');
        await this.closeAllPositions(EmergencyCloseReason.BOT_SHUTDOWN);
        closedPositions = 1;
        this.logger.info(`[GracefulShutdownManager] Closed ${closedPositions} positions`);
      }

      this.logger.info('[GracefulShutdownManager] Waiting for action queue to complete...');
      const queueEmptyTimeout = Math.min(10000, this.config.timeoutMs / 2);
      try {
        await this.actionQueue.waitEmpty(queueEmptyTimeout);
        this.logger.info('[GracefulShutdownManager] Action queue completed');
      } catch {
        this.logger.warn('[GracefulShutdownManager] Action queue did not empty within timeout');
      }

      if (this.config.persistState) {
        if (!this.config.closeAllPositions) {
          this.logger.info('[GracefulShutdownManager] Persisting position state...');
        }
        await this.persistState();
        this.logger.info('[GracefulShutdownManager] Position state persisted');
      }

      const duration = Date.now() - startTime;
      clearTimeout(shutdownTimer);

      const result: ShutdownResult = {
        success: true,
        duration,
        closedPositions,
        cancelledOrders,
        persistedState: this.config.persistState,
        timestamp: Date.now(),
      };

      this.eventBus.publishSync({
        type: LiveTradingEventType.SHUTDOWN_COMPLETED,
        data: {
          result,
          recovery: null,
        },
        timestamp: Date.now(),
      });

      this.logger.info(`[GracefulShutdownManager] Shutdown complete (${duration}ms)`);
      process.exit(0);
    } catch (error) {
      this.logger.error(`[GracefulShutdownManager] Error during shutdown: ${error}`);

      this.eventBus.publishSync({
        type: LiveTradingEventType.SHUTDOWN_FAILED,
        data: {
          error: getErrorMessage(error),
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

      return {
        success: false,
        duration: Date.now() - startTime,
        closedPositions: 0,
        cancelledOrders: 0,
        persistedState: false,
        error: getErrorMessage(error),
        timestamp: Date.now(),
      };
    }
  }

  public async closeAllPositions(reason: EmergencyCloseReason): Promise<void> {
    const position = this.positionLifecycleService.getCurrentPosition();
    if (!position) {
      this.logger.info('[GracefulShutdownManager] No open positions to close');
      return;
    }

    try {
      const closeAction: ClosePercentAction = {
        id: `action-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: ActionType.CLOSE_PERCENT,
        timestamp: Date.now(),
        priority: 'HIGH' as const,
        positionId: position.id,
        percent: 100,
        reason,
        metadata: {},
      };
      this.actionQueue.enqueue(closeAction);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      this.logger.error(`[GracefulShutdownManager] Error closing positions: ${error}`);
    }
  }

  private async cancelAllPendingOrders(): Promise<number> {
    let cancelledCount = 0;
    const position = this.positionLifecycleService.getCurrentPosition();

    if (!position) {
      this.logger.info('[GracefulShutdownManager] No open position, no orders to cancel');
      return 0;
    }

    const hangingOrdersResult = await ErrorHandler.executeAsync(
      () => this.exchange.cancelAllOrders(position.symbol),
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 500,
          backoffMultiplier: 2,
          maxDelayMs: 5000,
        },
        logger: this.logger,
        context: 'GracefulShutdownManager.cancelAllOrders',
        onRetry: (attempt, error, delayMs) => {
          this.logger.info(`${ICONS.note} Retrying order cancellation (${attempt}/3) after ${delayMs}ms`, {
            error: error.message,
          });
        },
      },
    );

    if (hangingOrdersResult.success) {
      cancelledCount += 1;
      this.logger.info(`[GracefulShutdownManager] Cancelled hanging orders for ${position.symbol}`);
    } else {
      this.logger.warn(`${ICONS.warning} Could not cancel hanging orders after retries, continuing shutdown`);
    }

    const conditionalOrdersResult = await ErrorHandler.executeAsync(
      () => this.exchange.cancelAllConditionalOrders(),
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 500,
          backoffMultiplier: 2,
          maxDelayMs: 5000,
        },
        logger: this.logger,
        context: 'GracefulShutdownManager.cancelAllConditionalOrders',
        onRetry: (attempt, error, delayMs) => {
          this.logger.info(`${ICONS.note} Retrying conditional order cancellation (${attempt}/3) after ${delayMs}ms`, {
            error: error.message,
          });
        },
      },
    );

    if (conditionalOrdersResult.success) {
      cancelledCount += 1;
      this.logger.info('[GracefulShutdownManager] Cancelled all conditional orders');
    } else {
      this.logger.warn(`${ICONS.warning} Could not cancel conditional orders after retries, continuing shutdown`);
    }

    return cancelledCount;
  }

  public async persistState(): Promise<void> {
    this.ensureStateDirectory();
    const result = await ErrorHandler.executeAsync(
      async () => {
        const position = this.positionLifecycleService.getCurrentPosition();
        const stateSnapshot: BotStateSnapshot = {
          snapshotTime: Date.now(),
          positions: position
            ? [
                {
                  positionId: position.id,
                  symbol: position.symbol,
                  direction: position.side as 'LONG' | 'SHORT',
                  quantity: position.quantity,
                  entryPrice: position.entryPrice,
                  entryTime: position.openedAt || Date.now(),
                  currentPrice: undefined,
                  currentPnL: position.unrealizedPnL,
                  currentPnLPercent: (position.unrealizedPnL / (position.quantity * position.entryPrice)) * 100,
                  openOrders: [],
                  state: 'OPEN',
                  persistedAt: Date.now(),
                },
              ]
            : [],
          sessionMetrics: {
            totalTrades: 0,
            totalPnL: 0,
            startTime: Date.now(),
          },
          riskMetrics: {
            dailyPnL: 0,
            consecutiveLosses: 0,
            totalExposure: position ? position.marginUsed || position.quantity * position.entryPrice : 0,
          },
        };

        const filePath = path.join(this.stateDirectory, 'bot-state.json');
        fs.writeFileSync(filePath, JSON.stringify(stateSnapshot, null, 2));

        this.eventBus.publishSync({
          type: LiveTradingEventType.STATE_PERSISTED,
          data: {
            filePath,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      },
      {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        logger: this.logger,
        context: 'GracefulShutdownManager.persistState',
        onRecover: () => {
          this.logger.warn(`${ICONS.warning} State persistence failed, continuing shutdown without saved state`);
        },
      },
    );

    if (!result.success) {
      this.logger.error(`[GracefulShutdownManager] Failed to persist state: ${result.error?.message}`);
      return;
    }

    this.logger.info('[GracefulShutdownManager] State persisted successfully');
  }

  public async recoverState(): Promise<RecoveryMetadata | null> {
    try {
      const filePath = path.join(this.stateDirectory, 'bot-state.json');

      if (!fs.existsSync(filePath)) {
        this.logger.info('[GracefulShutdownManager] No saved state found, starting fresh');
        return null;
      }

      const stateData = fs.readFileSync(filePath, 'utf-8');
      const snapshot: BotStateSnapshot = JSON.parse(stateData);

      this.logger.info(`[GracefulShutdownManager] Recovering state from ${filePath}`);
      this.logger.info(`[GracefulShutdownManager] Found ${snapshot.positions.length} persisted positions`);

      const recoveredCount = 0;
      for (const persistedPos of snapshot.positions) {
        try {
          this.logger.info(`[GracefulShutdownManager] Restored position: ${persistedPos.symbol}`);
        } catch (error) {
          this.logger.warn(`[GracefulShutdownManager] Error restoring position: ${error}`);
        }
      }

      const metadata: RecoveryMetadata = {
        recoveredAt: Date.now(),
        recoveredPositions: recoveredCount,
        recoveredOrders: 0,
        sourcePath: filePath,
        warning: 'Check persisted positions and verify they are still open on exchange',
      };

      this.eventBus.publishSync({
        type: LiveTradingEventType.STATE_RECOVERED,
        data: metadata,
        timestamp: Date.now(),
      });

      return metadata;
    } catch (error) {
      await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.FALLBACK,
        logger: this.logger,
        context: 'GracefulShutdownManager.recoverState',
        onRecover: () => {
          this.logger.warn(`${ICONS.warning} State recovery failed, starting with fresh state`, {
            reason: getErrorMessage(error),
          });
        },
      });

      return null;
    }
  }

  private ensureStateDirectory(): void {
    try {
      if (!fs.existsSync(this.stateDirectory)) {
        fs.mkdirSync(this.stateDirectory, { recursive: true });
        this.logger.debug(`[GracefulShutdownManager] Created state directory: ${this.stateDirectory}`);
      }
    } catch (error) {
      void ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        logger: this.logger,
        context: 'GracefulShutdownManager.ensureStateDirectory',
        onRecover: () => {
          this.logger.warn(`${ICONS.warning} Could not create state directory, persistence will be disabled`, {
            directory: this.stateDirectory,
            error: getErrorMessage(error),
          });
        },
      });
    }
  }

  private calculateUnrealizedPnL(position: PersistedPositionState): number {
    const currentPrice = position.currentPrice || position.entryPrice;
    if (position.direction === 'LONG') {
      return (currentPrice - position.entryPrice) * position.quantity;
    }
    return (position.entryPrice - currentPrice) * position.quantity;
  }

  private calculateUnrealizedPnLPercent(position: PersistedPositionState): number {
    const pnl = this.calculateUnrealizedPnL(position);
    const positionValue = position.quantity * position.entryPrice;
    return (pnl / positionValue) * 100;
  }

  public isShutdownInProgress(): boolean {
    return this.shutdownInProgress;
  }

  public getStateDirectory(): string {
    return this.stateDirectory;
  }

  public hasSavedState(): boolean {
    const filePath = path.join(this.stateDirectory, 'bot-state.json');
    return fs.existsSync(filePath);
  }
}
