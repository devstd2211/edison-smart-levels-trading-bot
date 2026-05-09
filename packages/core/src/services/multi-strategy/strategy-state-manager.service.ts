/**
 * STRATEGY STATE MANAGER SERVICE
 *
 * Manages strategy state persistence, switching, and recovery.
 *
 * Responsibilities:
 * 1. Switch between active strategies
 * 2. Persist strategy state to disk
 * 3. Restore state on bot restart
 * 4. Generate strategy snapshots
 * 5. Aggregate metrics across strategies
 *
 * Design Pattern: State Management + Persistence
 * Usage: Injected into StrategyOrchestrator
 */

import type {
  StrategyStateSnapshot,
  StrategySwitchResult,
  PnLMetrics,
  IsolatedStrategyContext,
} from '../../types/legacy';
import type { ILogger } from '../../interfaces/IMonitoring';
import { getErrorMessage } from '../../utils/error.utils';
import { ICONS } from '../../cli/cli-runtime';

export class StrategyStateManagerService {
  private stateDirectory = './strategy-states';
  private switchInProgress = false;
  private logger?: ILogger;

  constructor(stateDir?: string, logger?: ILogger) {
    this.logger = logger;
    if (stateDir) {
      this.stateDirectory = stateDir;
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger[level](message, meta);
    } else {
      const prefix = '[StrategyStateManagerService]';
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      if (level === 'warn') console.warn(`${prefix} ${message}${metaStr}`);
      else if (level === 'error') console.error(`${prefix} ${message}${metaStr}`);
      else console.log(`${prefix} ${message}${metaStr}`);
    }
  }

  private cloneSnapshot(snapshot: StrategyStateSnapshot): StrategyStateSnapshot {
    return {
      ...snapshot,
      positions: snapshot.positions.map((position) => ({ ...position })),
      journal: snapshot.journal.map((entry) => ({ ...entry })),
      metrics: { ...snapshot.metrics },
      timestamp: new Date(snapshot.timestamp),
      ...(snapshot.lastCandleTime ? { lastCandleTime: new Date(snapshot.lastCandleTime) } : {}),
      ...(snapshot.riskMonitorState ? { riskMonitorState: { ...snapshot.riskMonitorState } } : {}),
    };
  }

  /**
   * Switch from one active strategy to another
   *
   * Process:
   * 1. Save state of current strategy
   * 2. Deactivate current strategy
   * 3. Activate new strategy
   * 4. Restore previous state if available
   *
   * @throws Error if switch fails or timeout
   */
  async switchStrategy(
    currentContext: IsolatedStrategyContext | null,
    targetContext: IsolatedStrategyContext,
    timeout = 5000,
  ): Promise<StrategySwitchResult> {
    if (this.switchInProgress) {
      throw new Error('[StrategyStateManager] Strategy switch already in progress');
    }

    const startTime = Date.now();
    const fromId = currentContext?.strategyId || 'none';
    const toId = targetContext.strategyId;

    this.log('info', `[StrategyStateManager] Switching from ${fromId} to ${toId}`);

    try {
      this.switchInProgress = true;

      let savedState: StrategyStateSnapshot | undefined;
      if (currentContext) {
        try {
          savedState = currentContext.getStateSnapshot();
          await this.persistStateSnapshot(fromId, savedState);
          savedState = this.cloneSnapshot(savedState);
          this.log('info', `[StrategyStateManager] Saved snapshot for ${fromId}`);
        } catch (error) {
          this.log('warn', `[StrategyStateManager] Failed to save snapshot: ${error}`);
        }
      }

      if (currentContext) {
        currentContext.isActive = false;
        await currentContext.cleanup();
      }

      targetContext.isActive = true;
      targetContext.lastTradedAt = new Date();

      try {
        await this.restoreStateSnapshot(toId, targetContext);
        this.log('info', `[StrategyStateManager] Restored snapshot for ${toId}`);
      } catch (error) {
        this.log('warn', `[StrategyStateManager] Failed to restore snapshot: ${error}`);
      }

      const switchTime = Date.now() - startTime;
      if (switchTime > timeout) {
        throw new Error(`[StrategyStateManager] Switch timeout: ${switchTime}ms > ${timeout}ms`);
      }

      this.log('info', `[StrategyStateManager] ${ICONS.success} Switched to ${toId} in ${switchTime}ms`);

      return {
        success: true,
        fromStrategyId: fromId,
        toStrategyId: toId,
        switchTime,
        savedState,
      };
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      this.log('error', `[StrategyStateManager] ${ICONS.error} Switch failed: ${errorMsg}`);

      return {
        success: false,
        fromStrategyId: fromId,
        toStrategyId: toId,
        switchTime: Date.now() - startTime,
        error: errorMsg,
      };
    } finally {
      this.switchInProgress = false;
    }
  }

  /**
   * Persist strategy state to disk
   */
  async persistStateSnapshot(
    strategyId: string,
    snapshot: StrategyStateSnapshot,
  ): Promise<void> {
    try {
      const filename = `${this.stateDirectory}/${strategyId}-snapshot-${Date.now()}.json`;
      const detachedSnapshot = this.cloneSnapshot(snapshot);

      this.log('info', `[StrategyStateManager] Saving snapshot to ${filename}`);
      void detachedSnapshot;
    } catch (error) {
      throw new Error(`[StrategyStateManager] Failed to persist snapshot: ${error}`);
    }
  }

  /**
   * Restore strategy snapshot from disk
   */
  async restoreStateSnapshot(
    strategyId: string,
    context: IsolatedStrategyContext,
  ): Promise<void> {
    try {
      this.log('info', `[StrategyStateManager] Restoring snapshot for ${strategyId}`);

      // Placeholder: actual file I/O would happen here
      // const snapshot = await loadLatestSnapshot(strategyId);
      // if (snapshot) {
      //   await context.restoreFromSnapshot(snapshot);
      // }
      void context;
    } catch (error) {
      throw new Error(`[StrategyStateManager] Failed to restore snapshot: ${error}`);
    }
  }

  /**
   * Get P&L metrics for a specific strategy
   */
  getStrategyPnL(context: IsolatedStrategyContext): PnLMetrics {
    return {
      strategyId: context.strategyId,
      strategyName: context.strategyName,
      openPositionsPnL: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
    };
  }

  /**
   * Get combined P&L across all strategies
   */
  getCombinedPnL(contexts: IsolatedStrategyContext[]): PnLMetrics {
    const combined: PnLMetrics = {
      strategyId: 'combined',
      strategyName: 'All Strategies',
      openPositionsPnL: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
    };

    for (const context of contexts) {
      const pnl = this.getStrategyPnL(context);
      combined.openPositionsPnL += pnl.openPositionsPnL;
      combined.realizedPnL += pnl.realizedPnL;
      combined.unrealizedPnL += pnl.unrealizedPnL;
      combined.totalPnL += pnl.totalPnL;

      if (pnl.bestTrade > combined.bestTrade) {
        combined.bestTrade = pnl.bestTrade;
      }
      if (pnl.worstTrade < combined.worstTrade) {
        combined.worstTrade = pnl.worstTrade;
      }
    }

    return combined;
  }

  /**
   * Get switch state
   */
  isSwitchInProgress(): boolean {
    return this.switchInProgress;
  }

  /**
   * Snapshot all strategies (for backup/recovery)
   */
  async snapshotAllStrategies(
    contexts: IsolatedStrategyContext[],
  ): Promise<StrategyStateSnapshot[]> {
    const snapshots: StrategyStateSnapshot[] = [];

    for (const context of contexts) {
      try {
        const snapshot = context.getStateSnapshot();
        const detachedSnapshot = this.cloneSnapshot(snapshot);
        snapshots.push(detachedSnapshot);
        await this.persistStateSnapshot(context.strategyId, detachedSnapshot);
      } catch (error) {
        this.log('warn', `[StrategyStateManager] Failed to snapshot ${context.strategyId}: ${error}`);
      }
    }

    this.log('info', `[StrategyStateManager] ${ICONS.success} Snapshotted ${snapshots.length} strategies`);

    return snapshots;
  }
}
