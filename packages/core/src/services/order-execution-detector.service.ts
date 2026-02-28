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

import { LoggerService, OrderExecutionData } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

export interface OrderExecutionResult {
  type: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'ENTRY' | 'UNKNOWN';
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
  private lastCloseReason: 'SL' | 'TP' | 'TRAILING' | null = null;

  constructor(
    private readonly logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  /**
   * Safe logging wrapper: SKIP strategy for logging failures (non-blocking)
   */
  private safeLog(level: 'info' | 'debug', message: string, meta?: Record<string, unknown>): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      // SKIP: Non-critical logging failure
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
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
    // THROW strategy: Input validation
    if (!execData) {
      throw new Error('OrderExecutionDetectorService.detectExecution: execData is required');
    }

    // GRACEFUL_DEGRADE: Parse numeric fields with NaN/Infinity validation
    let closedSize = 0;
    try {
      closedSize = parseFloat(execData.closedSize ?? '0');
      if (!Number.isFinite(closedSize)) {
        this.safeLog('debug', 'Invalid closedSize, using 0', { closedSize: execData.closedSize });
        closedSize = 0;
      }
    } catch (error) {
      this.safeLog('debug', 'Failed to parse closedSize', { closedSize: execData.closedSize });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      closedSize = 0;
    }

    // Log all executions for debugging (SKIP on error)
    this.safeLog('debug', 'Processing execution event', {
      orderId: execData.orderId,
      symbol: execData.symbol,
      execType: execData.execType,
      stopOrderType: execData.stopOrderType,
      orderType: execData.orderType,
      createType: execData.createType,
      execPrice: execData.execPrice,
      execQty: execData.execQty,
      closedSize: execData.closedSize,
    });

    // Detect Take Profit:
    // - stopOrderType="PartialTakeProfit" (Bybit sends this for TP fills), OR
    // - stopOrderType="UNKNOWN" + createType="CreateByUser" (legacy/fallback detection)
    const isTakeProfit =
      execData.stopOrderType === 'PartialTakeProfit' ||
      (execData.stopOrderType === 'UNKNOWN' &&
        execData.createType === 'CreateByUser' &&
        closedSize > 0);

    // Detect Stop Loss: stopOrderType="StopLoss", "Stop", or "PartialStopLoss" (Bybit uses multiple formats)
    const isStopLoss =
      execData.stopOrderType === 'StopLoss' ||
      execData.stopOrderType === 'Stop' ||
      execData.stopOrderType === 'PartialStopLoss';

    // Detect Trailing Stop: stopOrderType="TrailingStop"
    const isTrailingStop = execData.stopOrderType === 'TrailingStop';

    // Determine execution type and update state
    let executionType: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'ENTRY' | 'UNKNOWN';
    let tpLevel: number | undefined;

    if (isTakeProfit) {
      executionType = 'TAKE_PROFIT';
      this.tpCounter++;
      tpLevel = this.tpCounter;
      this.lastCloseReason = 'TP';

      this.safeLog('info', `🎯 TP${this.tpCounter} execution detected from WebSocket`, {
        tpLevel: this.tpCounter,
        orderId: execData.orderId,
        execPrice: execData.execPrice,
        execQty: execData.execQty,
        closedSize: execData.closedSize,
      });
    } else if (isStopLoss) {
      executionType = 'STOP_LOSS';
      this.safeLog('info', '🛑 Stop Loss execution detected from WebSocket', {
        orderId: execData.orderId,
        execPrice: execData.execPrice,
        execQty: execData.execQty,
      });

      // Reset TP counter on SL hit
      this.safeLog('debug', 'Stop Loss hit - resetting TP counter', { previousCounter: this.tpCounter });
      this.tpCounter = 0;
      this.lastCloseReason = 'SL';
    } else if (isTrailingStop) {
      executionType = 'TRAILING_STOP';
      this.safeLog('info', '📉 Trailing Stop execution detected from WebSocket', {
        orderId: execData.orderId,
        execPrice: execData.execPrice,
        execQty: execData.execQty,
      });

      // Reset TP counter on Trailing Stop hit
      this.safeLog('debug', 'Trailing Stop hit - resetting TP counter', { previousCounter: this.tpCounter });
      this.tpCounter = 0;
      this.lastCloseReason = 'TRAILING';
    } else {
      // Regular order fill (market/limit entry)
      executionType = 'ENTRY';
      this.safeLog('debug', 'Position entry execution - resetting TP counter', { previousCounter: this.tpCounter });
      this.tpCounter = 0;
    }

    // Parse execPrice with GRACEFUL_DEGRADE for invalid values
    let execPrice = 0;
    try {
      execPrice = parseFloat(execData.execPrice ?? '0');
      if (!Number.isFinite(execPrice)) {
        this.safeLog('debug', 'Invalid execPrice, using 0', { execPrice: execData.execPrice });
        execPrice = 0;
      }
    } catch (error) {
      this.safeLog('debug', 'Failed to parse execPrice', { execPrice: execData.execPrice });
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      execPrice = 0;
    }

    return {
      type: executionType,
      tpLevel,
      orderId: execData.orderId,
      symbol: execData.symbol ?? '',
      closedSize,
      execPrice,
      execQty: execData.execQty ?? '0',
      side: execData.side ?? '',
      closedSizeStr: execData.closedSize ?? '',
    };
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
  public getLastCloseReason(): 'SL' | 'TP' | 'TRAILING' | null {
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
