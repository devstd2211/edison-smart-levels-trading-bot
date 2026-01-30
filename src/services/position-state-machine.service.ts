/**
 * Position State Machine Service
 * PHASE 4.5: Unified position state management
 *
 * Responsibilities:
 * 1. Maintain single source of truth for position state
 * 2. Persist state to disk (JSONL format) - survives bot restart
 * 3. Validate state transitions (prevent invalid sequences)
 * 4. Track advanced exit modes (pre-BE, trailing, BB trailing)
 * 5. Provide deterministic state recovery on startup
 *
 * Key Problems Solved:
 * - State fragmentation (was scattered across 3 services)
 * - State loss on restart (now persisted to disk)
 * - Invalid state transitions (now validated)
 * - Race conditions (atomic state updates)
 * - Divergence between Position.status and PositionState enum
 *
 * Integration Points:
 * - ExitOrchestrator: Use transitionState() instead of Map updates
 * - PositionLifecycleService: Initialize position state when opening
 * - TradingOrchestrator: Restore state on restart
 */

import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { PositionState } from '../types/enums';
import {
  IPositionStateMachine,
  PositionStateMachineState,
  StateTransitionRequest,
  StateTransitionResult,
  VALID_STATE_TRANSITIONS,
  ACTIVE_EXIT_MODES_BY_STATE,
  PreBEMode,
  TrailingMode,
  BBTrailingMode,
} from '../types/position-state-machine.interface';
import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';

/**
 * In-memory state cache
 * Key: "symbol:positionId"
 */
type StateCache = Map<string, PositionStateMachineState>;

/**
 * Transition history entry (for debugging/auditing)
 */
interface TransitionHistoryEntry {
  request: StateTransitionRequest;
  result: StateTransitionResult;
  timestamp: number;
}

/**
 * Transition history cache
 * Key: "symbol:positionId"
 */
type TransitionHistoryCache = Map<string, TransitionHistoryEntry[]>;

export class PositionStateMachineService implements IPositionStateMachine {
  private stateCache: StateCache = new Map();
  private transitionHistory: TransitionHistoryCache = new Map();
  private stateFilePath: string;
  private historyFilePath: string;
  private initialized = false;

  constructor(
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    this.stateFilePath = path.join(process.cwd(), 'data', 'position-states.jsonl');
    this.historyFilePath = path.join(process.cwd(), 'data', 'position-transitions.jsonl');

    this.logger.info('📍 PositionStateMachineService created', {
      stateFile: this.stateFilePath,
      historyFile: this.historyFilePath,
    });
  }

  // ============================================================================
  // INITIALIZATION & PERSISTENCE
  // ============================================================================

  /**
   * Initialize state machine and recover states from disk
   * Phase 8.9.11: ErrorHandler integration with RETRY strategy
   */
  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dataDir)) {
        await fsPromises.mkdir(dataDir, { recursive: true });
      }

      // Phase 8.9.11: RETRY strategy for critical state loading
      if (this.errorHandler) {
        const loadResult = await this.errorHandler.executeAsync(
          () => this.loadStatesFromDisk(),
          {
            strategy: RecoveryStrategy.RETRY,
            retryConfig: {
              maxAttempts: 3,
              initialDelayMs: 100,
              backoffMultiplier: 2,
              maxDelayMs: 1000,
            },
            logger: this.logger,
            context: 'PositionStateMachineService.initialize.loadStates',
            onRetry: (attempt, error, delayMs) => {
              this.logger.warn(`🔄 Retrying state loading (attempt ${attempt}/3)`, {
                delayMs,
                error: error.message,
              });
            },
          }
        );

        if (!loadResult.success) {
          throw loadResult.error || new Error('Failed to load position states after retries');
        }
      } else {
        // Fallback: no ErrorHandler available
        await this.loadStatesFromDisk();
      }

      // Phase 8.9.11: GRACEFUL_DEGRADE for history loading (non-critical)
      if (this.errorHandler) {
        const historyResult = await this.errorHandler.executeAsync(
          () => this.loadTransitionHistoryFromDisk(),
          {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            logger: this.logger,
            context: 'PositionStateMachineService.initialize.loadHistory',
          }
        );

        if (!historyResult.success && historyResult.error) {
          this.logger.warn('⚠️ Failed to load transition history (non-critical)', {
            error: historyResult.error.message,
          });
        }
      } else {
        // Fallback: no ErrorHandler available
        await this.loadTransitionHistoryFromDisk();
      }

      this.initialized = true;

      this.logger.info('✅ PositionStateMachineService initialized', {
        loadedPositions: this.stateCache.size,
        stateFile: this.stateFilePath,
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize PositionStateMachineService', { error });
      throw error;
    }
  }

  /**
   * Load all states from JSONL file
   * Phase 8.9.11: GRACEFUL_DEGRADE with backup on corruption
   */
  private async loadStatesFromDisk(): Promise<void> {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        this.logger.info('📁 State file not found, starting fresh', {
          path: this.stateFilePath,
        });
        return;
      }

      let content: string;
      try {
        content = await fsPromises.readFile(this.stateFilePath, 'utf-8');
      } catch (error) {
        // Phase 8.9.11: GRACEFUL_DEGRADE - try to use backup if original fails
        const backupPath = this.stateFilePath + '.backup';
        if (fs.existsSync(backupPath)) {
          this.logger.warn('⚠️ Main state file corrupted, attempting backup recovery', {
            original: this.stateFilePath,
            backup: backupPath,
            error: error instanceof Error ? error.message : String(error),
          });
          try {
            content = await fsPromises.readFile(backupPath, 'utf-8');
            this.logger.info('✅ Recovered states from backup file');
          } catch (backupError) {
            this.logger.error('❌ Backup file also corrupted', { error: backupError });
            throw error; // Throw original error if both fail
          }
        } else {
          throw error;
        }
      }

      const lines = content.trim().split('\n').filter((line: string) => line.length > 0);
      let validLines = 0;
      let invalidLines = 0;

      for (const line of lines) {
        try {
          const state = JSON.parse(line) as PositionStateMachineState;
          const key = this.getStateKey(state.symbol, state.positionId);
          this.stateCache.set(key, state);
          validLines++;
        } catch (err) {
          invalidLines++;
          this.logger.warn('⚠️ Skipped corrupted state line', {
            line: line.substring(0, 50) + '...',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Phase 8.9.11: Create backup after successful load
      if (validLines > 0) {
        try {
          await fsPromises.copyFile(this.stateFilePath, this.stateFilePath + '.backup');
        } catch (backupError) {
          this.logger.debug('ℹ️ Could not create state backup', { error: backupError });
        }
      }

      this.logger.info('📖 Loaded position states from disk', {
        count: this.stateCache.size,
        validLines,
        invalidLines,
      });
    } catch (error) {
      this.logger.error('❌ Failed to load states from disk', { error });
      throw error;
    }
  }

  /**
   * Load transition history from JSONL file (optional, for debugging)
   * Phase 8.9.11: GRACEFUL_DEGRADE - history is non-critical
   */
  private async loadTransitionHistoryFromDisk(): Promise<void> {
    try {
      if (!fs.existsSync(this.historyFilePath)) {
        return;
      }

      const content = await fsPromises.readFile(this.historyFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter((line: string) => line.length > 0);

      // Keep last 1000 transitions per position for memory efficiency
      const maxPerPosition = 1000;
      let loadedCount = 0;
      let skippedCount = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as TransitionHistoryEntry;
          const key = this.getStateKey(entry.request.symbol, entry.request.positionId);

          if (!this.transitionHistory.has(key)) {
            this.transitionHistory.set(key, []);
          }

          const history = this.transitionHistory.get(key)!;
          history.push(entry);
          loadedCount++;

          // Keep only recent transitions
          if (history.length > maxPerPosition) {
            history.shift();
          }
        } catch (err) {
          skippedCount++;
          this.logger.debug('ℹ️ Skipped corrupted history line', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      this.logger.info('📖 Loaded transition history from disk', {
        loaded: loadedCount,
        skipped: skippedCount,
      });
    } catch (error) {
      this.logger.warn('⚠️ Failed to load transition history (non-critical)', { error });
      // Don't throw - history is optional, just continue
    }
  }

  /**
   * Persist state to disk (append-only JSONL)
   * Phase 8.9.11: RETRY strategy with exponential backoff
   */
  private async persistStateToDisk(state: PositionStateMachineState): Promise<void> {
    if (!this.errorHandler) {
      // Fallback: no ErrorHandler available
      try {
        const dataDir = path.dirname(this.stateFilePath);
        if (!fs.existsSync(dataDir)) {
          await fsPromises.mkdir(dataDir, { recursive: true });
        }

        const line = JSON.stringify(state) + '\n';
        await fsPromises.appendFile(this.stateFilePath, line);
      } catch (error) {
        this.logger.error('❌ Failed to persist state to disk', { error });
        throw error;
      }
      return;
    }

    // Phase 8.9.11: RETRY strategy for I/O operations
    const persistResult = await this.errorHandler.executeAsync(
      async () => {
        const dataDir = path.dirname(this.stateFilePath);
        if (!fs.existsSync(dataDir)) {
          await fsPromises.mkdir(dataDir, { recursive: true });
        }

        const line = JSON.stringify(state) + '\n';
        await fsPromises.appendFile(this.stateFilePath, line);
      },
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: {
          maxAttempts: 3,
          initialDelayMs: 50,
          backoffMultiplier: 2,
          maxDelayMs: 500,
        },
        logger: this.logger,
        context: 'PositionStateMachineService.persistState',
        onRetry: (attempt, error, delayMs) => {
          this.logger.debug(`🔄 Retrying state persistence (attempt ${attempt}/3)`, {
            delayMs,
            error: error.message,
          });
        },
      }
    );

    if (!persistResult.success) {
      this.logger.error('❌ Failed to persist state to disk after retries', {
        error: persistResult.error?.message,
      });
      throw persistResult.error || new Error('Failed to persist state to disk');
    }
  }

  /**
   * Persist transition to history file
   * Phase 8.9.11: GRACEFUL_DEGRADE - history is non-critical
   */
  private async persistTransitionToDisk(entry: TransitionHistoryEntry): Promise<void> {
    if (!this.errorHandler) {
      // Fallback: no ErrorHandler available
      try {
        const dataDir = path.dirname(this.historyFilePath);
        if (!fs.existsSync(dataDir)) {
          await fsPromises.mkdir(dataDir, { recursive: true });
        }

        const line = JSON.stringify(entry) + '\n';
        await fsPromises.appendFile(this.historyFilePath, line);
      } catch (error) {
        this.logger.debug('ℹ️ Failed to persist transition (non-critical)', { error });
        // Don't throw - history is optional
      }
      return;
    }

    // Phase 8.9.11: GRACEFUL_DEGRADE for non-critical history
    const persistResult = await this.errorHandler.executeAsync(
      async () => {
        const dataDir = path.dirname(this.historyFilePath);
        if (!fs.existsSync(dataDir)) {
          await fsPromises.mkdir(dataDir, { recursive: true });
        }

        const line = JSON.stringify(entry) + '\n';
        await fsPromises.appendFile(this.historyFilePath, line);
      },
      {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        logger: this.logger,
        context: 'PositionStateMachineService.persistTransition',
      }
    );

    if (!persistResult.success && persistResult.error) {
      this.logger.debug('ℹ️ Failed to persist transition (non-critical)', {
        error: persistResult.error.message,
      });
    }
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /**
   * Get current state for a position
   */
  getState(symbol: string, positionId: string): PositionState | null {
    const key = this.getStateKey(symbol, positionId);
    const state = this.stateCache.get(key);
    return state ? state.currentState : null;
  }

  /**
   * Get full state with metadata
   */
  getFullState(symbol: string, positionId: string): PositionStateMachineState | null {
    const key = this.getStateKey(symbol, positionId);
    return this.stateCache.get(key) || null;
  }

  /**
   * Get all states for a symbol
   */
  getStatesBySymbol(symbol: string): Map<string, PositionStateMachineState> {
    const result = new Map<string, PositionStateMachineState>();

    for (const [key, state] of this.stateCache) {
      if (state.symbol === symbol && state.currentState !== PositionState.CLOSED) {
        result.set(state.positionId, state);
      }
    }

    return result;
  }

  // ============================================================================
  // STATE TRANSITIONS
  // ============================================================================

  /**
   * Validate and execute state transition
   * Returns result indicating success and current state
   */
  transitionState(request: StateTransitionRequest): StateTransitionResult {
    const key = this.getStateKey(request.symbol, request.positionId);
    const currentStateObj = this.stateCache.get(key);
    const currentState = currentStateObj?.currentState || PositionState.OPEN;

    // Validate transition is allowed
    const validNextStates = VALID_STATE_TRANSITIONS[currentState];
    if (!validNextStates.includes(request.targetState)) {
      const error = `Invalid state transition: ${currentState} → ${request.targetState}`;
      this.logger.warn('⚠️ Invalid state transition attempted', {
        symbol: request.symbol,
        positionId: request.positionId,
        currentState,
        targetState: request.targetState,
        reason: request.reason,
      });

      return {
        allowed: false,
        currentState,
        error,
        stateChange: `${currentState} ✗ ${request.targetState}`,
      };
    }

    // Create new state object
    const newState: PositionStateMachineState = {
      symbol: request.symbol,
      positionId: request.positionId,
      currentState: request.targetState,
      stateChangedAt: Date.now(),
      createdAt: currentStateObj?.createdAt || Date.now(),
      closedAt: request.targetState === PositionState.CLOSED ? Date.now() : undefined,
      reason: request.reason,
      preBEMode: request.metadata?.preBEMode,
      trailingMode: request.metadata?.trailingMode,
      bbTrailingMode: request.metadata?.bbTrailingMode,
      // Add closure details if closing
      closureReason: request.closureReason,
      closurePrice: request.closurePrice,
      closurePnL: request.closurePnL,
    };

    // Update cache
    this.stateCache.set(key, newState);

    // Phase 8.9.11: Persist to disk with error handling (async, don't wait)
    // But use ErrorHandler internally via persistStateToDisk()
    this.persistStateToDisk(newState).catch(err => {
      this.logger.error('❌ Failed to persist state transition', { error: err });
    });

    // Record transition history
    const historyEntry: TransitionHistoryEntry = {
      request,
      result: {
        allowed: true,
        currentState: request.targetState,
        previousState: currentState,
        stateChange: `${currentState} → ${request.targetState}`,
      },
      timestamp: Date.now(),
    };

    if (!this.transitionHistory.has(key)) {
      this.transitionHistory.set(key, []);
    }
    this.transitionHistory.get(key)!.push(historyEntry);

    // Phase 8.9.11: Persist history with GRACEFUL_DEGRADE (async, don't wait)
    // But use ErrorHandler internally via persistTransitionToDisk()
    this.persistTransitionToDisk(historyEntry).catch(err => {
      this.logger.debug('ℹ️ Failed to persist transition history (non-critical)', { error: err });
    });

    this.logger.info('📍 Position state transitioned', {
      symbol: request.symbol,
      positionId: request.positionId,
      transition: `${currentState} → ${request.targetState}`,
      reason: request.reason,
    });

    return {
      allowed: true,
      currentState: request.targetState,
      previousState: currentState,
      stateChange: `${currentState} → ${request.targetState}`,
    };
  }

  /**
   * Update advanced exit modes without changing state
   */
  updateExitMode(
    symbol: string,
    positionId: string,
    mode: {
      preBEMode?: PreBEMode;
      trailingMode?: TrailingMode;
      bbTrailingMode?: BBTrailingMode;
    }
  ): void {
    const key = this.getStateKey(symbol, positionId);
    const state = this.stateCache.get(key);

    if (!state) {
      this.logger.warn('⚠️ Cannot update exit mode - position state not found', {
        symbol,
        positionId,
      });
      return;
    }

    // Update modes
    if (mode.preBEMode) {
      state.preBEMode = mode.preBEMode;
    }
    if (mode.trailingMode) {
      state.trailingMode = mode.trailingMode;
    }
    if (mode.bbTrailingMode) {
      state.bbTrailingMode = mode.bbTrailingMode;
    }

    // Phase 8.9.11: Persist to disk with error handling (async, don't wait)
    this.persistStateToDisk(state).catch(err => {
      this.logger.error('❌ Failed to persist exit mode update', { error: err });
    });

    this.logger.debug('📍 Position exit mode updated', {
      symbol,
      positionId,
      modes: Object.keys(mode).filter(k => mode[k as keyof typeof mode]),
    });
  }

  /**
   * Close position (terminal state)
   */
  closePosition(
    symbol: string,
    positionId: string,
    reason: string,
    closureDetails?: {
      closureReason?: 'SL_HIT' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'TRAILING_STOP' | 'MANUAL' | 'OTHER';
      closurePrice?: number;
      closurePnL?: number;
    }
  ): StateTransitionResult {
    return this.transitionState({
      symbol,
      positionId,
      targetState: PositionState.CLOSED,
      reason,
      closureReason: closureDetails?.closureReason,
      closurePrice: closureDetails?.closurePrice,
      closurePnL: closureDetails?.closurePnL,
    });
  }

  // ============================================================================
  // STATISTICS & DIAGNOSTICS
  // ============================================================================

  /**
   * Get statistics about state machine
   */
  getStatistics(): {
    totalPositions: number;
    byState: Record<string, number>;
    averageStateHoldTime: number;
  } {
    const byState: Record<string, number> = {
      [PositionState.OPEN]: 0,
      [PositionState.TP1_HIT]: 0,
      [PositionState.TP2_HIT]: 0,
      [PositionState.TP3_HIT]: 0,
      [PositionState.CLOSED]: 0,
    };

    let totalHoldTime = 0;
    let positionCount = 0;

    for (const state of this.stateCache.values()) {
      if (state.currentState !== PositionState.CLOSED) {
        byState[state.currentState]++;
        positionCount++;
      } else {
        byState[state.currentState]++;
      }

      // Calculate hold time for closed positions
      if (state.closedAt && state.createdAt) {
        totalHoldTime += state.closedAt - state.createdAt;
      }
    }

    return {
      totalPositions: this.stateCache.size,
      byState,
      averageStateHoldTime:
        positionCount > 0 ? totalHoldTime / this.stateCache.size : 0,
    };
  }

  /**
   * Clear state for a position
   */
  clearState(symbol: string, positionId: string): void {
    const key = this.getStateKey(symbol, positionId);
    this.stateCache.delete(key);
    this.transitionHistory.delete(key);

    this.logger.info('🗑️ Cleared position state', {
      symbol,
      positionId,
    });
  }

  /**
   * Get transition history for debugging
   */
  getTransitionHistory(symbol: string, positionId: string, limit = 10): StateTransitionRequest[] {
    const key = this.getStateKey(symbol, positionId);
    const history = this.transitionHistory.get(key) || [];

    return history
      .slice(-limit)
      .map(entry => entry.request);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getStateKey(symbol: string, positionId: string): string {
    return `${symbol}:${positionId}`;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get size of state cache (for testing)
   */
  getStateCount(): number {
    return this.stateCache.size;
  }
}
