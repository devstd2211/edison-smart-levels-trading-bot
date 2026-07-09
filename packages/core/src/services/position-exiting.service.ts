import {
  LoggerService,
  Candle,
  Position,
  ExitType,
  ExitAction,
  PositionSide,
  TradingConfig,
  RiskManagementConfig,
  Config,
} from '../types/legacy';
import { ExitActionDTO } from '../types/legacy';
import type { IExchange } from '../interfaces/IExchange';
import { ICONS } from '../cli/cli-runtime';
import { TelegramService } from './telegram.service';
import { TradingJournalService } from './trading-journal.service';
import { SessionStatsService } from './session-stats.service';
import { PositionLifecycleService } from './position-lifecycle.service';
import { RealityCheckService } from './reality-check.service';
import {
  calculateBollingerBands,
  calculateBreakevenPrice,
  calculateFallbackBreakevenPrice,
  calculateTrailingStopPrice,
} from './position-exiting/position-exit-pricing.utils';
import {
  applyStopLossUpdate,
  calculateDirectionalPnlSnapshot,
  isFavorableStopLossUpdate,
} from './position-exiting/position-exit-state.utils';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER, TIME_UNITS, TIME_MULTIPLIERS } from '../constants';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

type BollingerCandle = Pick<Candle, 'close'>;

export class PositionExitingService {
  // Prevents concurrent close attempts on the same position
  private readonly closeOperationLock = new Map<string, Promise<void>>();

  constructor(
    private readonly bybitService: IExchange,
    private readonly telegram: TelegramService,
    private readonly logger: LoggerService,
    private readonly journal: TradingJournalService,
    private readonly tradingConfig: TradingConfig,
    private readonly riskConfig: RiskManagementConfig,
    private readonly fullConfig: Config,
    private readonly sessionStats?: SessionStatsService,
    private readonly positionManager?: PositionLifecycleService,
    private readonly realityCheck?: RealityCheckService,
  ) {}

  async executeExitAction(
    position: Position,
    action: ExitActionDTO,
    exitPrice: number,
    exitReason: string,
    exitType: ExitType,
  ): Promise<boolean> {
    try {
      if (!position) {
        throw new Error('Position required for exit action');
      }

      if (position.status === 'CLOSED') {
        this.logger.debug('Position already closed, skipping action', { positionId: position.id });
        return false;
      }

      switch (action.action) {
        case ExitAction.CLOSE_PERCENT:
          return await this.closePartialPosition(position, action.percent, exitPrice, exitReason, exitType);

        case ExitAction.CLOSE_ALL:
          return await this.closeFullPosition(position, exitPrice, exitReason, exitType);

        case ExitAction.UPDATE_SL:
          return await this.updateStopLoss(position, action.newStopLoss);

        case ExitAction.ACTIVATE_TRAILING:
          return await this.activateTrailingStop(position, action.trailingPercent, exitPrice);

        default:
          this.logger.warn('Unknown exit action', { action: action.action });
          return false;
      }
    } catch (error) {
      this.logger.error('Failed to execute exit action', {
        error: getErrorMessage(error),
        positionId: position?.id,
        action: action?.action,
      });
      return false;
    }
  }

  private async closePartialPosition(
    position: Position,
    closePercent: number,
    exitPrice: number,
    exitReason: string,
    exitType: ExitType,
  ): Promise<boolean> {
    try {
      const quantityToClose = (position.quantity * closePercent) / 100;
      const partialPosition = { ...position, quantity: quantityToClose };

      this.logger.info(`${ICONS.chart} Closing partial position`, {
        positionId: position.id,
        closePercent,
        quantityToClose: quantityToClose.toFixed(8),
        remainingQuantity: (position.quantity - quantityToClose).toFixed(8),
      });

      const percentageToClose = (quantityToClose / position.quantity) * 100;
      await this.bybitService.closePosition({
        positionId: position.id,
        percentage: percentageToClose,
      });

      position.quantity -= quantityToClose;

      const takeProfitManager = this.positionManager?.getTakeProfitManager();
      if (takeProfitManager) {
        if (quantityToClose && typeof quantityToClose === 'number' && !isNaN(quantityToClose) && isFinite(quantityToClose)) {
          const matchedTP = position.takeProfits.find(tp =>
            Math.abs(tp.price - exitPrice) / exitPrice < 0.01 // 1% tolerance
          );
          if (matchedTP) {
            takeProfitManager.recordPartialClose(matchedTP.level, quantityToClose, exitPrice);
          }
        } else {
          this.logger.error(`${ICONS.error} Invalid quantityToClose for recording partial close`, {
            positionId: position.id,
            quantityToClose,
            type: typeof quantityToClose,
          });
        }
      }

      const partialPnl = calculateDirectionalPnlSnapshot(
        partialPosition,
        exitPrice,
        this.tradingConfig.leverage,
        this.tradingConfig.tradingFeeRate,
      );

      this.logger.info(`${ICONS.money} Partial close PnL`, {
        partialPnL: partialPnl.pnlGross.toFixed(DECIMAL_PLACES.PRICE),
        fees: partialPnl.fees.toFixed(DECIMAL_PLACES.PRICE),
        netPnL: partialPnl.pnlNet.toFixed(DECIMAL_PLACES.PRICE),
      });

      await this.telegram.sendAlert(
        `${ICONS.chart} Partial Close (${closePercent}%)\nExit: ${exitPrice.toFixed(8)}\nPnL: ${partialPnl.pnlGross.toFixed(4)} USDT`,
      );

      return true;
    } catch (error) {
      this.logger.error('Failed to close partial position', {
        error: getErrorMessage(error),
        positionId: position.id,
      });
      return false;
    }
  }

  async closeFullPosition(
    position: Position | null | undefined,
    exitPrice: number,
    exitReason: string,
    exitType: ExitType,
  ): Promise<boolean> {
    try {
      if (!position) {
        this.logger.warn(`${ICONS.error} closeFullPosition called with null/undefined position`, {
          exitReason,
          exitType,
        });
        return false;
      }

      if (this.closeOperationLock.has(position.id)) {
        this.logger.warn(`${ICONS.warning} Close operation already in progress for position`, {
          positionId: position.id,
        });
        await this.closeOperationLock.get(position.id);
        return false;
      }

      // Mark as CLOSED before any async operations to prevent race conditions
      const wasAlreadyClosed = position.status === 'CLOSED';
      position.status = 'CLOSED';

      if (wasAlreadyClosed) {
        this.logger.debug('Position already marked closed, skipping', {
          positionId: position.id,
        });
        return false;
      }

      this.logger.info(`${ICONS.note} Closing full position`, {
        positionId: position.id,
        quantity: position.quantity,
        exitPrice,
        exitReason,
      });

      const closePromise = this.executeAtomicClose(position, exitPrice, exitReason, exitType)
        .finally(() => {
          this.closeOperationLock.delete(position.id);
        });

      this.closeOperationLock.set(position.id, closePromise);

      await closePromise;
      return true;
    } catch (error) {
      this.logger.error('Failed to close full position', {
        error: getErrorMessage(error),
        positionId: position?.id || 'UNKNOWN',
      });
      if (position) {
        position.status = 'OPEN';
        this.closeOperationLock.delete(position.id);
      }
      return false;
    }
  }

  private async executeAtomicClose(
    position: Position,
    exitPrice: number,
    exitReason: string,
    exitType: ExitType,
  ): Promise<void> {
    try {
      await this.closePositionWithRetry(position, exitPrice);
    } catch (closeError) {
      const errorMsg = getErrorMessage(closeError);
      // If position is already zero, this is expected (closed by SL/TP on exchange)
      if (errorMsg.includes('position is zero') || errorMsg.includes('reduce-only')) {
        this.logger.info(`${ICONS.note} Position already closed on exchange (SL/TP triggered)`, {
          positionId: position.id,
        });
      } else {
        throw closeError;
      }
    }

    this.logger.debug(`${ICONS.note} Cancelling conditional orders after close`);
    try {
      await this.bybitService.cancelAllConditionalOrders();
    } catch (error) {
      this.logger.warn('Failed to cancel orders after close', {
        error: getErrorMessage(error),
      });
    }

    const holdingTimeMs = Date.now() - position.openedAt;

    let realizedPnL: number;
    let tpLevelsHit: number[] = [];

    const takeProfitManager = this.positionManager?.getTakeProfitManager?.();
    if (takeProfitManager) {
      const finalPnL = takeProfitManager.calculateFinalPnL(exitPrice);
      realizedPnL = finalPnL.totalPnL.pnlNet;
      tpLevelsHit = takeProfitManager.getTpLevelsHit?.() || [];

      this.logger.info(`${ICONS.chart} Final PnL calculated (with partial closes)`, {
        totalPnL: realizedPnL.toFixed(DECIMAL_PLACES.PRICE),
        fees: finalPnL.totalPnL.fees.toFixed(DECIMAL_PLACES.PRICE),
        tpLevelsHit: tpLevelsHit.length,
      });
    } else {
      const pnlSnapshot = calculateDirectionalPnlSnapshot(
        position,
        exitPrice,
        this.tradingConfig.leverage,
        this.tradingConfig.tradingFeeRate,
      );
      realizedPnL = pnlSnapshot.pnlNet;

      this.logger.info(`${ICONS.chart} PnL calculated (simple)`, {
        pnlGross: pnlSnapshot.pnlGross.toFixed(DECIMAL_PLACES.PRICE),
        fees: pnlSnapshot.fees.toFixed(DECIMAL_PLACES.PRICE),
        netPnL: realizedPnL.toFixed(DECIMAL_PLACES.PRICE),
      });
    }

    this.positionManager?.recordRecentClose?.(position, realizedPnL);

    let journalResult: { rollback: () => void } | null = null;
    try {
      journalResult = await this.recordPositionCloseInJournalWithFallback(position, exitPrice, realizedPnL, exitReason, exitType, tpLevelsHit, holdingTimeMs);
    } catch (journalError) {
      this.logger.error(`${ICONS.error} Journal recording failed`, {
        error: getErrorMessage(journalError),
        positionId: position.id,
      });
    }

    if (this.sessionStats && position.journalId) {
      const pnlSnapshot = calculateDirectionalPnlSnapshot(
        position,
        exitPrice,
        this.tradingConfig.leverage,
        this.tradingConfig.tradingFeeRate,
      );

      try {
        this.sessionStats.updateTradeExit(position.journalId, {
          exitPrice,
          pnl: realizedPnL,
          pnlPercent: pnlSnapshot.pnlPercent,
          exitType,
          tpHitLevels: tpLevelsHit,
          holdingTimeMs,
          stopLoss: {
            initial: position.stopLoss.initialPrice || position.stopLoss.price,
            final: position.stopLoss.price,
            movedToBreakeven: position.stopLoss.isBreakeven,
            trailingActivated: position.stopLoss.isTrailing,
          },
        });
      } catch (statsError) {
        this.logger.error(`${ICONS.error} CRITICAL: Session stats update failed - rolling back journal`, {
          error: getErrorMessage(statsError),
          journalId: position.journalId,
        });

        if (journalResult?.rollback) {
          journalResult.rollback();
        }

        position.status = 'OPEN'; // Revert status
        throw statsError; // Propagate to outer catch
      }
    }

    const pnlSnapshot = calculateDirectionalPnlSnapshot(
      position,
      exitPrice,
      this.tradingConfig.leverage,
      this.tradingConfig.tradingFeeRate,
    );

    await this.sendExitNotificationWithSkip(
      position,
      exitType,
      exitPrice,
      realizedPnL,
      pnlSnapshot.pnlPercent,
    );
  }

  private async closePositionWithRetry(position: Position, exitPrice: number): Promise<void> {
    const maxAttempts = 3;
    const initialDelayMs = 500;
    const backoffMultiplier = 2;
    const maxDelayMs = 5000;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.bybitService.closePosition({
          positionId: position.id,
          percentage: 100, // Close fully
        });
        return; // Success
      } catch (error) {
        lastError = normalizeError(error);

        if (attempt < maxAttempts) {
          const delayMs = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);

          this.logger.warn(`${ICONS.warning} Retrying close position (attempt ${attempt}/${maxAttempts})`, {
            positionId: position.id,
            delayMs,
            error: lastError.message,
          });

          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    const handled = await ErrorHandler.handle(lastError, {
      strategy: RecoveryStrategy.RETRY,
      logger: this.logger,
      context: 'PositionExitingService.closePositionWithRetry',
      retryConfig: {
        maxAttempts,
        initialDelayMs,
        backoffMultiplier,
        maxDelayMs,
      },
    });

    if (!handled.success) {
      throw lastError || new Error('Failed to close position after retries');
    }
  }

  private async recordPositionCloseInJournalWithFallback(
    position: Position,
    exitPrice: number,
    realizedPnL: number,
    exitReason: string,
    exitType: ExitType,
    tpLevelsHit: number[],
    holdingTimeMs: number,
  ): Promise<{ rollback: () => void }> {
    try {
      return await this.recordPositionCloseInJournal(position, exitPrice, realizedPnL, exitReason, exitType, tpLevelsHit, holdingTimeMs);
    } catch (error) {
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.FALLBACK,
        logger: this.logger,
        context: 'PositionExitingService.recordPositionCloseInJournal',
        onRecover: () => {
          this.logger.warn(`${ICONS.warning} Journal recording failed, using fallback (no-op rollback)`, {
            positionId: position.id,
          });
        },
      });

      return { rollback: () => {} };
    }
  }

  private async sendExitNotificationWithSkip(
    position: Position,
    exitType: ExitType,
    exitPrice: number,
    realizedPnL: number,
    pnlPercent: number,
  ): Promise<void> {
    try {
      await this.telegram.sendAlert(
        `${ICONS.note} Position Closed\nExit Type: ${exitType}\nExit: ${exitPrice.toFixed(8)}\nPnL: ${realizedPnL.toFixed(4)} USDT (${pnlPercent.toFixed(2)}%)`,
      );
    } catch (error) {
      const handled = await ErrorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        logger: this.logger,
        context: 'PositionExitingService.sendExitNotification',
        onRecover: () => {
          this.logger.warn(`${ICONS.warning} Exit notification failed, skipping notification`, {
            positionId: position.id,
            error: getErrorMessage(error),
          });
        },
      });

    }
  }

  private async updateStopLoss(position: Position, newStopLoss: number): Promise<boolean> {
    try {
      const isLong = position.side === PositionSide.LONG;
      const shouldUpdate = isFavorableStopLossUpdate(
        position.side,
        position.stopLoss.price,
        newStopLoss,
      );

      if (!shouldUpdate) {
        this.logger.debug('SL update not favorable, skipping', {
          side: isLong ? 'LONG' : 'SHORT',
          currentSL: position.stopLoss.price.toFixed(8),
          newSL: newStopLoss.toFixed(8),
        });
        return false;
      }

      this.logger.info(`${ICONS.note} Updating stop-loss`, {
        side: isLong ? 'LONG' : 'SHORT',
        currentSL: position.stopLoss.price.toFixed(8),
        newSL: newStopLoss.toFixed(8),
      });

      await this.bybitService.updateStopLoss({
        positionId: position.id,
        newPrice: newStopLoss,
      });
      applyStopLossUpdate(position, newStopLoss);

      return true;
    } catch (error) {
      this.logger.error('Failed to update stop-loss', {
        error: getErrorMessage(error),
        positionId: position.id,
      });
      return false;
    }
  }

  private async activateTrailingStop(position: Position, trailingDistance: number, currentPrice: number): Promise<boolean> {
    try {
      const isLong = position.side === PositionSide.LONG;
      const trailingPrice = isLong ? currentPrice - trailingDistance : currentPrice + trailingDistance;

      this.logger.info(`${ICONS.note} Activating trailing stop`, {
        side: isLong ? 'LONG' : 'SHORT',
        currentPrice: currentPrice.toFixed(8),
        trailingDistance: trailingDistance.toFixed(8),
        initialTrailingPrice: trailingPrice.toFixed(8),
      });

      await this.bybitService.updateStopLoss({
        positionId: position.id,
        newPrice: trailingPrice,
      });

      applyStopLossUpdate(position, trailingPrice, { isTrailing: true });

      return true;
    } catch (error) {
      this.logger.error('Failed to activate trailing stop', {
        error: getErrorMessage(error),
        positionId: position.id,
      });
      return false;
    }
  }

  private async recordPositionCloseInJournal(
    position: Position,
    exitPrice: number,
    realizedPnL: number,
    exitReason: string,
    exitType: ExitType,
    tpLevelsHit: number[],
    holdingTimeMs: number,
  ): Promise<{ rollback: () => void }> {
    try {
      // Skip if position has no journalId (restored from WebSocket without journal entry)
      if (!position.journalId) {
        this.logger.warn('Skipping journal recording - position has no journalId', {
          positionId: position.id,
        });
        return { rollback: () => {} };
      }

      const holdingTimeMinutes = holdingTimeMs / TIME_UNITS.MINUTE;
      const pnlSnapshot = calculateDirectionalPnlSnapshot(
        position,
        exitPrice,
        this.tradingConfig.leverage,
        this.tradingConfig.tradingFeeRate,
      );

      const journalResult = this.journal.recordTradeClose({
        id: position.journalId,
        exitPrice,
        realizedPnL,
        exitCondition: {
          exitType,
          price: exitPrice,
          timestamp: Date.now(),
          reason: exitReason,
          pnlUsdt: realizedPnL,
          pnlPercent: pnlSnapshot.pnlPercent,
          realizedPnL,
          tpLevelsHit,
          tpLevelsHitCount: tpLevelsHit.length,
          holdingTimeMs,
          holdingTimeMinutes,
          holdingTimeHours: holdingTimeMinutes / TIME_MULTIPLIERS.SECONDS_PER_MINUTE,
          stoppedOut: exitType === ExitType.STOP_LOSS,
          slMovedToBreakeven: position.stopLoss.isBreakeven,
          trailingStopActivated: position.stopLoss.isTrailing,
          maxProfitPercent: pnlSnapshot.pnlPercent > 0 ? pnlSnapshot.pnlPercent : 0,
          maxDrawdownPercent: pnlSnapshot.pnlPercent < 0 ? Math.abs(pnlSnapshot.pnlPercent) : 0,
        },
      });

      this.logger.info(`${ICONS.note} Position close recorded in journal`, {
        journalId: position.journalId,
        exitType,
        pnl: realizedPnL.toFixed(DECIMAL_PLACES.PRICE),
        pnlPercent: pnlSnapshot.pnlPercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        holdingTime: `${holdingTimeMinutes.toFixed(1)}m`,
      });

      return journalResult;
    } catch (error) {
      this.logger.error('Failed to record position close in journal', {
        error: getErrorMessage(error),
        journalId: position.journalId,
      });
      return { rollback: () => {} };
    }
  }

  async onTakeProfitHit(position: Position, tpLevel: number, currentPrice: number): Promise<void> {
    try {
      if (!position) {
        this.logger.error('onTakeProfitHit called with null position');
        return;
      }

      const tpConfig = position.takeProfits.find((tp) => tp.level === tpLevel);
      if (!tpConfig || tpConfig.hit) {
        this.logger.debug('TP event ignored - already hit or not found', {
          tpLevel,
          alreadyHit: tpConfig?.hit,
          positionId: position.id,
        });
        return;
      }

      const takeProfitManager = this.positionManager?.getTakeProfitManager();
      if (takeProfitManager) {
        if (!position.quantity || typeof position.quantity !== 'number' || isNaN(position.quantity)) {
          this.logger.error(`${ICONS.error} Invalid position.quantity for partial close`, {
            positionId: position.id,
            quantity: position.quantity,
            type: typeof position.quantity,
          });
        } else {
          const partialQuantity = (position.quantity * tpConfig.sizePercent) / PERCENT_MULTIPLIER;

          if (isNaN(partialQuantity) || !isFinite(partialQuantity)) {
            this.logger.error(`${ICONS.error} Calculated partialQuantity is NaN`, {
              positionId: position.id,
              quantity: position.quantity,
              sizePercent: tpConfig.sizePercent,
              partialQuantity,
            });
          } else {
            takeProfitManager.recordPartialClose(tpLevel, partialQuantity, currentPrice);
          }
        }
      }

      tpConfig.hit = true;
      tpConfig.hitAt = Date.now();

      // Clear orderId to prevent Smart TP3 from trying to update filled order
      if (tpConfig.orderId) {
        tpConfig.orderId = undefined;
      }

      this.logger.info(`${ICONS.success} TP hit recorded`, {
        positionId: position.id,
        tpLevel,
        hitPrice: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
      });

      if (tpLevel === 1) {
        await this.handleTP1Hit(position, currentPrice);
      }

      if (tpLevel === this.riskConfig.trailingStopActivationLevel) {
        await this.handleTP2Hit(position, currentPrice);
      }
    } catch (error) {
      this.logger.error('Failed to handle TP hit', {
        error: getErrorMessage(error),
        positionId: position?.id,
        tpLevel,
      });
    }
  }

  private async handleTP1Hit(position: Position, currentPrice: number): Promise<void> {
    if (position.stopLoss.isBreakeven) {
      return;
    }

    try {
      if (!position.entryPrice || isNaN(position.entryPrice) || position.entryPrice <= 0) {
        this.logger.error(`${ICONS.error} CRITICAL: Invalid entry price for breakeven calculation`, {
          positionId: position.id,
          entryPrice: position.entryPrice,
          isNaN: isNaN(position.entryPrice),
          currentPrice,
          currentSL: position.stopLoss.price,
        });

        // Prevents position from being orphaned
        const fallbackBreakevenPrice = calculateFallbackBreakevenPrice(position.stopLoss.price, position.side);

        this.logger.warn(`${ICONS.warning} Using fallback breakeven SL`, {
          positionId: position.id,
          reason: 'Invalid entry price',
          fallbackSL: fallbackBreakevenPrice.toFixed(DECIMAL_PLACES.PRICE),
        });

        await this.bybitService.updateStopLoss({
          positionId: position.id,
          newPrice: fallbackBreakevenPrice,
        });
        applyStopLossUpdate(position, fallbackBreakevenPrice, { isBreakeven: true });

        await this.telegram.sendAlert(
          `${ICONS.warning} Breakeven activated (with fallback due to data issue)\nSL: ${fallbackBreakevenPrice.toFixed(8)}`,
        );
        return;
      }

      if (!this.riskConfig.breakevenOffsetPercent ||
          typeof this.riskConfig.breakevenOffsetPercent !== 'number' ||
          isNaN(this.riskConfig.breakevenOffsetPercent) ||
          !isFinite(this.riskConfig.breakevenOffsetPercent)) {
        this.logger.error(`${ICONS.error} CRITICAL: Invalid breakevenOffsetPercent in riskConfig`, {
          breakevenOffsetPercent: this.riskConfig.breakevenOffsetPercent,
          type: typeof this.riskConfig.breakevenOffsetPercent,
          isNaN: isNaN(this.riskConfig.breakevenOffsetPercent),
        });

        const fallbackBreakevenPrice = calculateFallbackBreakevenPrice(position.stopLoss.price, position.side);
        this.logger.warn(`${ICONS.warning} Using fallback breakeven SL (invalid config)`, {
          positionId: position.id,
          reason: 'Invalid breakevenOffsetPercent in riskConfig',
          fallbackSL: fallbackBreakevenPrice.toFixed(DECIMAL_PLACES.PRICE),
        });

        await this.bybitService.updateStopLoss({
          positionId: position.id,
          newPrice: fallbackBreakevenPrice,
        });
        applyStopLossUpdate(position, fallbackBreakevenPrice, { isBreakeven: true });

        await this.telegram.sendAlert(
          `${ICONS.warning} Breakeven activated (with fallback due to config issue)\nSL: ${fallbackBreakevenPrice.toFixed(8)}`,
        );
        return;
      }

      const breakevenPrice = calculateBreakevenPrice(
        position.entryPrice,
        position.side,
        this.riskConfig.breakevenOffsetPercent,
      );

      if (isNaN(breakevenPrice)) {
        throw new Error(`calculateBreakevenPrice returned NaN (entry=${position.entryPrice})`);
      }

      this.logger.info(`${ICONS.note} Moving SL to breakeven after TP1`, {
        positionId: position.id,
        currentSL: position.stopLoss.price.toFixed(DECIMAL_PLACES.PRICE),
        newSL: breakevenPrice.toFixed(DECIMAL_PLACES.PRICE),
      });

      await this.bybitService.updateStopLoss({
        positionId: position.id,
        newPrice: breakevenPrice,
      });
      applyStopLossUpdate(position, breakevenPrice, { isBreakeven: true });

      await this.telegram.sendAlert(
        `${ICONS.success} Breakeven Activated\nSL moved to: ${breakevenPrice.toFixed(8)}`,
      );
    } catch (error) {
      this.logger.error('Failed to move SL to breakeven', {
        error: getErrorMessage(error),
        positionId: position.id,
        entryPrice: position.entryPrice,
        currentPrice,
      });

      // Don't rethrow — position must remain managed
      await this.telegram.sendAlert(
        `${ICONS.warning} Failed to move SL to breakeven. Position will be managed with current SL.`,
      );
    }
  }

  private async handleTP2Hit(position: Position, currentPrice: number): Promise<void> {
    if (position.stopLoss.isTrailing || position.stopLoss.isBreakeven) {
      this.logger.info(`${ICONS.warning} Trailing activation skipped - SL already in breakeven or trailing`, {
        positionId: position.id,
      });
      return;
    }

    this.logger.info(`${ICONS.success} Activating trailing stop on TP2`, {
      positionId: position.id,
      activationPrice: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
    });

    if (this.bybitService.setTrailingStop) {
      await this.bybitService.setTrailingStop({
        side: position.side === PositionSide.LONG ? 'Buy' : 'Sell',
        activationPrice: currentPrice,
        trailingPercent: this.riskConfig.trailingStopPercent,
      });
    }

    applyStopLossUpdate(position, position.stopLoss.price, {
      isTrailing: true,
      trailingPercent: this.riskConfig.trailingStopPercent,
      trailingActivationPrice: currentPrice,
    });

    const trailingStopPrice = calculateTrailingStopPrice(
      position.side,
      currentPrice,
      this.riskConfig.trailingStopPercent,
    );

    await this.telegram.sendAlert(
      `${ICONS.success} Trailing Stop Activated\nSL now trails at ${this.riskConfig.trailingStopPercent}%`,
    );
  }

  async updateSmartTrailingV2(position: Position, currentPrice: number): Promise<void> {
    if (!position.stopLoss.isTrailing) {
      return;
    }

    try {
      const trailingStop = calculateTrailingStopPrice(
        position.side,
        currentPrice,
        this.riskConfig.trailingStopPercent,
      );

      const isLong = position.side === PositionSide.LONG;
      const shouldUpdate = isFavorableStopLossUpdate(
        position.side,
        position.stopLoss.price,
        trailingStop,
      );

      if (!shouldUpdate) {
        return;
      }

      await this.bybitService.updateStopLoss({
        positionId: position.id,
        newPrice: trailingStop,
      });
      applyStopLossUpdate(position, trailingStop);

      this.logger.debug(`${ICONS.chart} Trailing stop updated`, {
        positionId: position.id,
        newSL: trailingStop.toFixed(DECIMAL_PLACES.PRICE),
      });
    } catch (error) {
      this.logger.error('Failed to update trailing stop', {
        error: getErrorMessage(error),
        positionId: position.id,
      });
    }
  }

  async updateSmartTP3(position: Position, currentPrice: number): Promise<void> {
    if (!position.stopLoss.isTrailing) {
      return;
    }

    const tp3 = position.takeProfits.find((tp) => tp.level === 3);
    if (!tp3 || tp3.hit || !tp3.orderId) {
      return;
    }

    try {
      const smartTP3 = this.riskConfig.smartTP3;
      if (!smartTP3?.enabled) {
        return;
      }

      const isLong = position.side === PositionSide.LONG;
      const tickSize = (smartTP3.tickSizePercent / PERCENT_MULTIPLIER) * currentPrice;
      const maxMove = tickSize * smartTP3.maxTicks;

      let newTP3Price: number;
      if (isLong) {
        newTP3Price = Math.min(tp3.price + maxMove, currentPrice + maxMove);
      } else {
        newTP3Price = Math.max(tp3.price - maxMove, currentPrice - maxMove);
      }

      const moved = isLong ? newTP3Price > tp3.price : newTP3Price < tp3.price;
      if (!moved) {
        return;
      }

      if (this.bybitService.updateTakeProfit) {
        await this.bybitService.updateTakeProfit(tp3.orderId, newTP3Price);
      }
      tp3.price = newTP3Price;

      this.logger.debug(`${ICONS.chart} TP3 updated`, {
        positionId: position.id,
        newTP3: newTP3Price.toFixed(DECIMAL_PLACES.PRICE),
      });
    } catch (error) {
      this.logger.error('Failed to update TP3', {
        error: getErrorMessage(error),
        positionId: position.id,
      });
    }
  }

  async updateBBTrailingStop(position: Position, candles: BollingerCandle[]): Promise<void> {
    if (!position.stopLoss.isTrailing || candles.length < 20) {
      return;
    }

    try {
      const closes = candles.slice(-20).map((c) => c.close);
      const bands = calculateBollingerBands(closes);

      const isLong = position.side === PositionSide.LONG;
      const bbStop = isLong ? bands.lower : bands.upper;

      const shouldUpdate = isFavorableStopLossUpdate(
        position.side,
        position.stopLoss.price,
        bbStop,
      );

      if (!shouldUpdate) {
        return;
      }

      await this.bybitService.updateStopLoss({
        positionId: position.id,
        newPrice: bbStop,
      });
      applyStopLossUpdate(position, bbStop);

      this.logger.debug(`${ICONS.chart} BB trailing stop updated`, {
        positionId: position.id,
        newSL: bbStop.toFixed(DECIMAL_PLACES.PRICE),
      });
    } catch (error) {
      this.logger.error('Failed to update BB trailing stop', {
        error: getErrorMessage(error),
        positionId: position.id,
      });
    }
  }
}


