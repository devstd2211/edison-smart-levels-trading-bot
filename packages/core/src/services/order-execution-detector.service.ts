/**
 * Order Execution Detector Service (Phase 8.9.50 ErrorHandler Integration)
 * Detects and analyzes order execution types from Bybit WebSocket
 *
 * Error Handling Strategies:
 * - THROW: Input validation (null/undefined execData, missing required fields)
 * - GRACEFUL_DEGRADE: Parsing failures (NaN prices, invalid numeric strings)
 * - SKIP: Logging failures (non-blocking)
 *
 * Responsibilities:
 * - Identify TP/SL/Trailing Stop/Entry execution types
 * - Track TP counter for multiple TP hits
 * - Track last close reason for journal
 * - Return structured execution result for downstream processing
 */

import { LoggerService } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { normalizeError } from '../utils/error.utils';
import type { OrderExecutionData } from '../types/events/websocket.types';
import {
  advanceOrderExecutionState,
  buildOrderExecutionResult,
  createOrderExecutionLogContext,
  detectOrderExecutionType,
  parseOrderExecutionNumber,
  type OrderExecutionCloseReason,
  type OrderExecutionType,
} from './order-execution-detector/order-execution-detector-state.utils';

export interface OrderExecutionResult {
  type: OrderExecutionType;
  tpLevel?: number; // For TP: 1, 2, 3, etc.
  orderId?: string;
  symbol: string;
  closedSize: number;
  execPrice: number;
  execQty: string;
  side: string;
  closedSizeStr?: string;
}

export class OrderExecutionDetectorService {
  private tpCounter: number = 0;
  private lastCloseReason: OrderExecutionCloseReason = null;

  constructor(
    private readonly logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  private handleRecoveryError(error: unknown, strategy: RecoveryStrategy): void {
    if (!this.errorHandler) {
      return;
    }

    try {
      this.errorHandler.handle(normalizeError(error), { strategy });
    } catch {
      // Preserve non-blocking behavior if the recovery pipeline itself fails.
    }
  }

  /**
   * Safe logging wrapper: SKIP strategy for logging failures (non-blocking)
   */
  private safeLog(
    level: 'info' | 'debug',
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.SKIP);
    }
  }

  private parseFiniteNumber(
    value: string | undefined,
    fieldName: 'closedSize' | 'execPrice',
  ): number {
    try {
      const parsedValue = parseOrderExecutionNumber(value);
      if (parsedValue === null) {
        this.safeLog('debug', `Invalid ${fieldName}, using 0`, {
          [fieldName]: value,
        });
        return 0;
      }

      return parsedValue;
    } catch (error) {
      this.safeLog('debug', `Failed to parse ${fieldName}`, {
        [fieldName]: value,
      });
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE);
      return 0;
    }
  }

  /**
   * Detect order execution type from Bybit execution data
   * THROW on input validation, GRACEFUL_DEGRADE on parsing failures
   *
   * @param execData - Order execution data from Bybit WebSocket
   * @returns OrderExecutionResult with detected type and metadata
   * @throws Error if execData is null/undefined or missing required fields
   */
  public detectExecution(execData: OrderExecutionData): OrderExecutionResult {
    if (!execData) {
      throw new Error('OrderExecutionDetectorService.detectExecution: execData is required');
    }

    const closedSize = this.parseFiniteNumber(execData.closedSize, 'closedSize');
    this.safeLog('debug', 'Processing execution event', createOrderExecutionLogContext(execData));

    const executionType = detectOrderExecutionType(execData, closedSize);
    const previousCounter = this.tpCounter;
    const transition = advanceOrderExecutionState(
      {
        tpCounter: this.tpCounter,
        lastCloseReason: this.lastCloseReason,
      },
      executionType,
    );

    if (executionType === 'TAKE_PROFIT') {
      this.safeLog('info', `TP${transition.tpLevel} execution detected from WebSocket`, {
        tpLevel: transition.tpLevel,
        orderId: execData.orderId,
        execPrice: execData.execPrice,
        execQty: execData.execQty,
        closedSize: execData.closedSize,
      });
    } else if (executionType === 'STOP_LOSS') {
      this.safeLog('info', 'Stop Loss execution detected from WebSocket', {
        orderId: execData.orderId,
        execPrice: execData.execPrice,
        execQty: execData.execQty,
      });
      this.safeLog('debug', 'Stop Loss hit - resetting TP counter', { previousCounter });
    } else if (executionType === 'TRAILING_STOP') {
      this.safeLog('info', 'Trailing Stop execution detected from WebSocket', {
        orderId: execData.orderId,
        execPrice: execData.execPrice,
        execQty: execData.execQty,
      });
      this.safeLog('debug', 'Trailing Stop hit - resetting TP counter', { previousCounter });
    } else {
      this.safeLog('debug', 'Position entry execution - resetting TP counter', { previousCounter });
    }

    this.tpCounter = transition.nextState.tpCounter;
    this.lastCloseReason = transition.nextState.lastCloseReason;

    const execPrice = this.parseFiniteNumber(execData.execPrice, 'execPrice');

    return buildOrderExecutionResult({
      execData,
      type: transition.type,
      tpLevel: transition.tpLevel,
      closedSize,
      execPrice,
    });
  }

  /**
   * Get current TP counter (for TP1, TP2, TP3 tracking)
   * @returns Current TP level
   */
  public getTpCounter(): number {
    return this.tpCounter;
  }

  /**
   * Reset TP counter (call on position close or new entry)
   * SKIP on logging failure (non-blocking)
   */
  public resetTpCounter(): void {
    this.tpCounter = 0;
    this.safeLog('debug', 'TP counter reset');
  }

  /**
   * Get last close reason for journal
   * @returns Close reason or null if no recent close
   */
  public getLastCloseReason(): OrderExecutionCloseReason {
    return this.lastCloseReason;
  }

  /**
   * Reset last close reason (call after journal entry)
   * SKIP on logging failure (non-blocking)
   */
  public resetLastCloseReason(): void {
    this.lastCloseReason = null;
    this.safeLog('debug', 'Last close reason reset');
  }
}
