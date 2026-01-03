/**
 * DataQueue
 *
 * In-memory queues for candles, orderbook, and trade ticks.
 * Implements memory limits to prevent memory leaks.
 */

import { CandleRecord, OrderbookSnapshot, TradeTickRecord, LoggerService } from '../../types';
import { INTEGER_MULTIPLIERS, MAX_QUEUE_SIZE, WARN_QUEUE_SIZE, QUEUE_LOG_INTERVAL } from '../../constants/technical.constants';

// ============================================================================
// QUEUE
// ============================================================================

export class DataQueue {
  private candlesQueue: CandleRecord[] = [];
  private orderbooksQueue: OrderbookSnapshot[] = [];
  private ticksQueue: TradeTickRecord[] = [];

  private droppedCandles = 0;
  private droppedOrderbooks = 0;
  private droppedTicks = 0;

  constructor(
    private logger: LoggerService,
    private maxQueueSize: number = MAX_QUEUE_SIZE,
  ) {}

  /**
   * Add candle to queue (with memory limit)
   */
  addCandle(candle: CandleRecord): void {
    if (this.candlesQueue.length >= this.maxQueueSize) {
      this.droppedCandles++;
      if (this.droppedCandles % INTEGER_MULTIPLIERS.ONE_HUNDRED === 1) {
        this.logger.warn('⚠️ Candles queue full - dropping data', {
          queueSize: this.candlesQueue.length,
          dropped: this.droppedCandles,
        });
      }
      return;
    }

    this.candlesQueue.push(candle);

    // Warn if queue is growing too large
    if (this.candlesQueue.length >= WARN_QUEUE_SIZE && this.candlesQueue.length % QUEUE_LOG_INTERVAL === 0) {
      this.logger.warn('⚠️ Candles queue is growing', {
        queueSize: this.candlesQueue.length,
        maxSize: this.maxQueueSize,
      });
    }
  }

  /**
   * Add orderbook snapshot to queue (with memory limit)
   */
  addOrderbook(orderbook: OrderbookSnapshot): void {
    if (this.orderbooksQueue.length >= this.maxQueueSize) {
      this.droppedOrderbooks++;
      if (this.droppedOrderbooks % INTEGER_MULTIPLIERS.ONE_HUNDRED === 1) {
        this.logger.warn('⚠️ Orderbooks queue full - dropping data', {
          queueSize: this.orderbooksQueue.length,
          dropped: this.droppedOrderbooks,
        });
      }
      return;
    }

    this.orderbooksQueue.push(orderbook);

    if (this.orderbooksQueue.length >= WARN_QUEUE_SIZE && this.orderbooksQueue.length % QUEUE_LOG_INTERVAL === 0) {
      this.logger.warn('⚠️ Orderbooks queue is growing', {
        queueSize: this.orderbooksQueue.length,
        maxSize: this.maxQueueSize,
      });
    }
  }

  /**
   * Add trade tick to queue (with memory limit)
   */
  addTick(tick: TradeTickRecord): void {
    if (this.ticksQueue.length >= this.maxQueueSize) {
      this.droppedTicks++;
      if (this.droppedTicks % INTEGER_MULTIPLIERS.ONE_HUNDRED === 1) {
        this.logger.warn('⚠️ Ticks queue full - dropping data', {
          queueSize: this.ticksQueue.length,
          dropped: this.droppedTicks,
        });
      }
      return;
    }

    this.ticksQueue.push(tick);

    if (this.ticksQueue.length >= WARN_QUEUE_SIZE && this.ticksQueue.length % QUEUE_LOG_INTERVAL === 0) {
      this.logger.warn('⚠️ Ticks queue is growing', {
        queueSize: this.ticksQueue.length,
        maxSize: this.maxQueueSize,
      });
    }
  }

  /**
   * Drain candles queue (return all and clear)
   */
  drainCandles(): CandleRecord[] {
    const candles = this.candlesQueue;
    this.candlesQueue = [];
    return candles;
  }

  /**
   * Drain orderbooks queue (return all and clear)
   */
  drainOrderbooks(): OrderbookSnapshot[] {
    const orderbooks = this.orderbooksQueue;
    this.orderbooksQueue = [];
    return orderbooks;
  }

  /**
   * Drain ticks queue (return all and clear)
   */
  drainTicks(): TradeTickRecord[] {
    const ticks = this.ticksQueue;
    this.ticksQueue = [];
    return ticks;
  }

  /**
   * Get queue sizes
   */
  getSizes(): { candles: number; orderbooks: number; ticks: number } {
    return {
      candles: this.candlesQueue.length,
      orderbooks: this.orderbooksQueue.length,
      ticks: this.ticksQueue.length,
    };
  }

  /**
   * Get dropped counts (memory overflow protection)
   */
  getDroppedCounts(): { candles: number; orderbooks: number; ticks: number } {
    return {
      candles: this.droppedCandles,
      orderbooks: this.droppedOrderbooks,
      ticks: this.droppedTicks,
    };
  }

  /**
   * Clear all queues (for shutdown)
   */
  clear(): void {
    this.candlesQueue = [];
    this.orderbooksQueue = [];
    this.ticksQueue = [];
    this.logger.info('All queues cleared');
  }
}
