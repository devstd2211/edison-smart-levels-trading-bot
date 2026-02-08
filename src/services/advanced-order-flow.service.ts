/**
 * Advanced Order Flow Service (Phase 10.1)
 *
 * Tick-level order flow analysis with:
 * - Real-time buy/sell imbalance calculation
 * - Execution pattern detection (accumulation/distribution/neutral)
 * - Spoofing detection via sudden volume changes
 * - Order flow momentum calculation
 *
 * Error Handling:
 * - THROW: Config validation, input validation
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity)
 * - SKIP: Logger failures (non-blocking)
 */

import {
  AdvancedOrderFlowConfig,
  Tick,
  OrderBook,
  AdvancedOrderFlow,
  FlowPattern,
  SpoofingSignal,
  ImbalanceMetric,
  PatternMetric,
  SpoofingMetric,
  MomentumMetric,
} from '../types/advanced-order-flow.interface';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { LoggerService } from '../types';
import { ADVANCED_ORDER_FLOW } from '../constants/phase-10-constants';

/**
 * AdvancedOrderFlowService - Modular order flow analysis with ErrorHandler integration
 *
 * Modular Design:
 * - Each metric can be used independently (getImbalance, getPattern, etc.)
 * - All metrics can be combined via analyze()
 * - Config-driven feature enablement (disable expensive metrics if needed)
 * - Backward compatible (works without ErrorHandler)
 */
export class AdvancedOrderFlowService {
  private tickBuffer: Tick[] = [];
  private orderbookHistory: OrderBook[] = [];
  private lastSpoofingLevel: number | null = null;
  private accumulatedMomentum: number = 0;

  constructor(
    private config: AdvancedOrderFlowConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation OUTSIDE try-catch
    this.validateConfig(config);

    // Safe logging (SKIP strategy)
    this.safeLog('info', 'AdvancedOrderFlowService initialized', {
      tickWindowMs: config.tickWindowMs,
      orderbookLevels: config.orderbookLevels,
      enableSpoofing: config.enableSpoofingDetection,
      enableMomentum: config.enableMomentum,
    });
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate configuration (THROW strategy)
   * Called during construction - validation errors bubble up
   */
  private validateConfig(config: AdvancedOrderFlowConfig): void {
    // THROW: null/undefined config
    if (!config) {
      throw new Error('AdvancedOrderFlowConfig cannot be null or undefined');
    }

    // THROW: Invalid tickWindowMs
    if (!Number.isFinite(config.tickWindowMs) || config.tickWindowMs <= 0) {
      throw new Error(
        `Invalid tickWindowMs: ${config.tickWindowMs} (must be positive number)`,
      );
    }

    // THROW: Invalid orderbookLevels
    if (
      !Number.isInteger(config.orderbookLevels) ||
      config.orderbookLevels < 1
    ) {
      throw new Error(
        `Invalid orderbookLevels: ${config.orderbookLevels} (must be integer >= 1)`,
      );
    }

    // THROW: Invalid imbalanceThreshold
    if (
      !Number.isFinite(config.imbalanceThreshold) ||
      config.imbalanceThreshold < 0 ||
      config.imbalanceThreshold > 1
    ) {
      throw new Error(
        `Invalid imbalanceThreshold: ${config.imbalanceThreshold} (must be 0-1)`,
      );
    }

    // THROW: Invalid spoofingThreshold
    if (
      !Number.isFinite(config.spoofingThreshold) ||
      config.spoofingThreshold <= 0
    ) {
      throw new Error(
        `Invalid spoofingThreshold: ${config.spoofingThreshold} (must be positive)`,
      );
    }

    // THROW: Invalid minVolumeUSDT
    if (!Number.isFinite(config.minVolumeUSDT) || config.minVolumeUSDT < 0) {
      throw new Error(
        `Invalid minVolumeUSDT: ${config.minVolumeUSDT} (must be non-negative)`,
      );
    }

    // THROW: Invalid maxConfidence
    if (
      !Number.isFinite(config.maxConfidence) ||
      config.maxConfidence <= 0 ||
      config.maxConfidence > 100
    ) {
      throw new Error(
        `Invalid maxConfidence: ${config.maxConfidence} (must be 0-100)`,
      );
    }
  }

  /**
   * Validate tick input (THROW strategy)
   */
  private validateTick(tick: Tick): void {
    if (!tick) {
      throw new Error('Tick cannot be null or undefined');
    }

    if (tick.side !== 'BUY' && tick.side !== 'SELL') {
      throw new Error(`Invalid tick.side: ${tick.side} (must be BUY or SELL)`);
    }

    if (!Number.isFinite(tick.price)) {
      throw new Error(
        `Invalid tick.price: ${tick.price} (must be finite number)`,
      );
    }

    if (!Number.isFinite(tick.size) || tick.size < 0) {
      throw new Error(
        `Invalid tick.size: ${tick.size} (must be non-negative finite number)`,
      );
    }

    if (!Number.isInteger(tick.timestamp) || tick.timestamp <= 0) {
      throw new Error(
        `Invalid tick.timestamp: ${tick.timestamp} (must be positive integer)`,
      );
    }
  }

  /**
   * Validate orderbook input (THROW strategy)
   */
  private validateOrderbook(orderbook: OrderBook): void {
    if (!orderbook) {
      throw new Error('OrderBook cannot be null or undefined');
    }

    if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
      throw new Error('OrderBook must have bids and asks arrays');
    }

    // Validate bid/ask format
    for (const [price, quantity] of orderbook.bids) {
      if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
        throw new Error(`Invalid orderbook bid: [${price}, ${quantity}]`);
      }
    }

    for (const [price, quantity] of orderbook.asks) {
      if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
        throw new Error(`Invalid orderbook ask: [${price}, ${quantity}]`);
      }
    }
  }

  // ==========================================================================
  // SAFE LOGGING (SKIP STRATEGY)
  // ==========================================================================

  /**
   * Safe logging wrapper - errors don't interrupt execution
   */
  private safeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: any,
  ): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
        });
      }
    }
  }

  // ==========================================================================
  // PUBLIC API - TICK PROCESSING
  // ==========================================================================

  /**
   * Add a tick to the buffer for analysis
   * THROW on invalid tick
   */
  addTick(tick: Tick): void {
    // THROW: Validate input before processing
    this.validateTick(tick);

    try {
      // Add tick to buffer
      this.tickBuffer.push(tick);

      // Clean up old ticks on each addition
      this.cleanupOldTicks(tick.timestamp);
    } catch (error) {
      this.safeLog('error', 'Error adding tick', { error });
      throw error;
    }
  }

  /**
   * Process orderbook snapshot
   * THROW on invalid orderbook
   */
  processOrderbook(orderbook: OrderBook): void {
    // THROW: Validate input
    this.validateOrderbook(orderbook);

    try {
      this.orderbookHistory.push(orderbook);

      // Keep only last N orderbooks
      if (this.orderbookHistory.length > ADVANCED_ORDER_FLOW.LIMITS.MAX_ORDERBOOK_HISTORY) {
        this.orderbookHistory = this.orderbookHistory.slice(-ADVANCED_ORDER_FLOW.LIMITS.MAX_ORDERBOOK_HISTORY);
      }
    } catch (error) {
      this.safeLog('error', 'Error processing orderbook', { error });
      throw error;
    }
  }

  // ==========================================================================
  // PUBLIC API - INDIVIDUAL METRICS
  // ==========================================================================

  /**
   * Get imbalance metric (buy/sell ratio)
   * Uses GRACEFUL_DEGRADE for calculation failures
   */
  getImbalance(): ImbalanceMetric | null {
    try {
      if (this.tickBuffer.length === 0) {
        return {
          buyVolume: 0,
          sellVolume: 0,
          value: 0,
          confidence: 0,
        };
      }

      const { buyVol, sellVol } = this.calculateVolumes();
      const total = buyVol + sellVol;

      if (total === 0) {
        return {
          buyVolume: 0,
          sellVolume: 0,
          value: 0,
          confidence: 0,
        };
      }

      const imbalance = (buyVol - sellVol) / total;

      // Validate result
      if (!Number.isFinite(imbalance)) {
        if (this.errorHandler) {
          this.errorHandler.handle(
            new Error('Imbalance calculation produced invalid result'),
            { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
          );
        }
        return {
          buyVolume: buyVol,
          sellVolume: sellVol,
          value: 0,
          confidence: 0,
        };
      }

      const confidence = Math.min(
        100,
        Math.abs(imbalance) * this.config.maxConfidence,
      );

      return {
        buyVolume: buyVol,
        sellVolume: sellVol,
        value: imbalance,
        confidence,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      return {
        buyVolume: 0,
        sellVolume: 0,
        value: 0,
        confidence: 0,
      };
    }
  }

  /**
   * Get flow pattern (accumulation/distribution/neutral)
   * Uses GRACEFUL_DEGRADE for detection failures
   */
  getPattern(): PatternMetric | null {
    try {
      if (this.tickBuffer.length < 2) {
        return {
          pattern: 'neutral',
          confidence: 0,
          buyPressure: 0,
          sellPressure: 0,
          duration: 0,
        };
      }

      const { buyVol, sellVol } = this.calculateVolumes();
      const total = buyVol + sellVol;

      if (total === 0) {
        return {
          pattern: 'neutral',
          confidence: 0,
          buyPressure: 0,
          sellPressure: 0,
          duration: 0,
        };
      }

      const buyPressure = Math.round((buyVol / total) * 100);
      const sellPressure = Math.round((sellVol / total) * 100);

      let pattern: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
      let confidence = 0;

      if (buyPressure > ADVANCED_ORDER_FLOW.PATTERN.ACCUMULATION_THRESHOLD) {
        pattern = 'accumulation';
        confidence = buyPressure;
      } else if (sellPressure > ADVANCED_ORDER_FLOW.PATTERN.ACCUMULATION_THRESHOLD) {
        pattern = 'distribution';
        confidence = sellPressure;
      }

      const duration =
        this.tickBuffer[this.tickBuffer.length - 1].timestamp -
        this.tickBuffer[0].timestamp;

      return {
        pattern,
        confidence,
        buyPressure,
        sellPressure,
        duration,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      return {
        pattern: 'neutral',
        confidence: 0,
        buyPressure: 0,
        sellPressure: 0,
        duration: 0,
      };
    }
  }

  /**
   * Get spoofing detection metric
   * Uses GRACEFUL_DEGRADE for detection failures
   */
  getSpoofing(): SpoofingMetric | null {
    if (!this.config.enableSpoofingDetection) {
      return {
        detected: false,
        confidence: 0,
      };
    }

    try {
      if (this.orderbookHistory.length < 2) {
        return {
          detected: false,
          confidence: 0,
        };
      }

      const current = this.orderbookHistory[
        this.orderbookHistory.length - 1
      ] as OrderBook;
      const previous = this.orderbookHistory[
        this.orderbookHistory.length - 2
      ] as OrderBook;

      const currentBidVolume = current.bids
        .slice(0, this.config.orderbookLevels)
        .reduce((sum, [, qty]) => sum + qty, 0);
      const previousBidVolume = previous.bids
        .slice(0, this.config.orderbookLevels)
        .reduce((sum, [, qty]) => sum + qty, 0);

      const currentAskVolume = current.asks
        .slice(0, this.config.orderbookLevels)
        .reduce((sum, [, qty]) => sum + qty, 0);
      const previousAskVolume = previous.asks
        .slice(0, this.config.orderbookLevels)
        .reduce((sum, [, qty]) => sum + qty, 0);

      // Detect sudden volume changes
      let detected = false;
      let side: 'BUY' | 'SELL' | undefined;
      let volumeChange: number | undefined;
      let suspiciousLevel: number | undefined;

      if (previousBidVolume > 0) {
        const bidChange = currentBidVolume / previousBidVolume;
        if (bidChange > this.config.spoofingThreshold) {
          detected = true;
          side = 'BUY';
          volumeChange = bidChange;
          suspiciousLevel = current.bids[0]?.[0];
        }
      }

      if (previousAskVolume > 0) {
        const askChange = currentAskVolume / previousAskVolume;
        if (askChange > this.config.spoofingThreshold) {
          detected = true;
          side = 'SELL';
          volumeChange = askChange;
          suspiciousLevel = current.asks[0]?.[0];
        }
      }

      return {
        detected,
        side,
        suspiciousLevel,
        volumeChange,
        confidence: detected ? ADVANCED_ORDER_FLOW.SPOOFING.DETECTION_CONFIDENCE : 0,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      return {
        detected: false,
        confidence: 0,
      };
    }
  }

  /**
   * Get momentum metric
   * Uses GRACEFUL_DEGRADE for calculation failures
   */
  getMomentum(): MomentumMetric | null {
    if (!this.config.enableMomentum) {
      return {
        value: 0,
        direction: 'NEUTRAL',
        confidence: 0,
        rate: 0,
      };
    }

    try {
      if (this.tickBuffer.length === 0) {
        return {
          value: 0,
          direction: 'NEUTRAL',
          confidence: 0,
          rate: 0,
        };
      }

      const { buyVol, sellVol } = this.calculateVolumes();
      const total = buyVol + sellVol;

      if (total === 0) {
        return {
          value: 0,
          direction: 'NEUTRAL',
          confidence: 0,
          rate: 0,
        };
      }

      // Momentum: -100 (pure sell) to +100 (pure buy)
      const momentum = ((buyVol - sellVol) / total) * 100;

      // Validate
      if (!Number.isFinite(momentum)) {
        if (this.errorHandler) {
          this.errorHandler.handle(
            new Error('Momentum calculation produced invalid result'),
            { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
          );
        }
        return {
          value: 0,
          direction: 'NEUTRAL',
          confidence: 0,
          rate: 0,
        };
      }

      // Calculate rate of change
      const previousMomentum = this.accumulatedMomentum;
      this.accumulatedMomentum = momentum;
      const rate = momentum - previousMomentum;

      // Determine direction
      let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
      if (momentum > ADVANCED_ORDER_FLOW.MOMENTUM.LONG_THRESHOLD) direction = 'LONG';
      else if (momentum < ADVANCED_ORDER_FLOW.MOMENTUM.SHORT_THRESHOLD) direction = 'SHORT';

      const confidence = Math.min(100, Math.abs(momentum));

      return {
        value: momentum,
        direction,
        confidence,
        rate,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      return {
        value: 0,
        direction: 'NEUTRAL',
        confidence: 0,
        rate: 0,
      };
    }
  }

  // ==========================================================================
  // PUBLIC API - COMBINED ANALYSIS
  // ==========================================================================

  /**
   * Complete order flow analysis combining all enabled metrics
   * Returns neutral results on errors (GRACEFUL_DEGRADE)
   */
  analyze(): AdvancedOrderFlow {
    const timestamp = Date.now();

    // Clean up old ticks before analysis
    this.cleanupOldTicks(timestamp);

    try {
      const { buyVol, sellVol } = this.calculateVolumes();
      const volumeUSDT = this.calculateVolumeUSDT();

      // Get individual metrics
      const imbalance = this.getImbalance();
      const pattern = this.getPattern();
      const spoofing = this.getSpoofing();
      const momentum = this.getMomentum();

      // Aggregate into direction
      let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
      let confidence = 0;

      if (imbalance && Math.abs(imbalance.value) > 0.3) {
        direction = imbalance.value > 0 ? 'LONG' : 'SHORT';
        confidence = imbalance.confidence;
      }

      if (pattern && pattern.confidence > confidence) {
        direction = pattern.pattern === 'accumulation' ? 'LONG' : 'SHORT';
        confidence = pattern.confidence;
      }

      if (momentum && Math.abs(momentum.value) > 20) {
        direction = momentum.direction;
        confidence = momentum.confidence;
      }

      return {
        timestamp,
        buyVolume: buyVol,
        sellVolume: sellVol,
        imbalance: imbalance ? imbalance.value : 0,
        pattern: pattern ? pattern.pattern : 'neutral',
        patternConfidence: pattern ? pattern.confidence : 0,
        direction,
        confidence: Math.min(100, confidence),
        momentum: momentum ? momentum.value : 0,
        spoofingDetected: spoofing ? spoofing.detected : false,
        volumeUSDT,
        tickCount: this.tickBuffer.length,
        orderbookCount: this.orderbookHistory.length,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }

      // Return neutral analysis on error
      return {
        timestamp,
        buyVolume: 0,
        sellVolume: 0,
        imbalance: 0,
        pattern: 'neutral',
        patternConfidence: 0,
        direction: 'NEUTRAL',
        confidence: 0,
        momentum: 0,
        spoofingDetected: false,
        volumeUSDT: 0,
        tickCount: this.tickBuffer.length,
        orderbookCount: this.orderbookHistory.length,
      };
    }
  }

  // ==========================================================================
  // PUBLIC API - HISTORY MANAGEMENT
  // ==========================================================================

  /**
   * Clear all stored history
   */
  clearHistory(): void {
    this.tickBuffer = [];
    this.orderbookHistory = [];
    this.accumulatedMomentum = 0;
    this.lastSpoofingLevel = null;
    this.safeLog('debug', 'Order flow history cleared');
  }

  /**
   * Get current tick count
   */
  getTickCount(): number {
    return this.tickBuffer.length;
  }

  /**
   * Get current orderbook count
   */
  getOrderbookCount(): number {
    return this.orderbookHistory.length;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AdvancedOrderFlowConfig>): void {
    try {
      const newConfig = { ...this.config, ...updates };
      this.validateConfig(newConfig);
      Object.assign(this.config, updates);
      this.safeLog('info', 'Configuration updated', updates);
    } catch (error) {
      this.safeLog('error', 'Failed to update configuration', { error });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AdvancedOrderFlowConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Calculate buy and sell volumes from tick buffer
   */
  private calculateVolumes(): { buyVol: number; sellVol: number } {
    let buyVol = 0;
    let sellVol = 0;

    for (const tick of this.tickBuffer) {
      const volume = tick.price * tick.size;

      if (tick.side === 'BUY') {
        buyVol += volume;
      } else {
        sellVol += volume;
      }
    }

    return { buyVol, sellVol };
  }

  /**
   * Calculate total volume in USDT
   */
  private calculateVolumeUSDT(): number {
    let total = 0;
    for (const tick of this.tickBuffer) {
      total += tick.price * tick.size;
    }
    return total;
  }

  /**
   * Remove ticks outside the time window
   */
  private cleanupOldTicks(currentTime: number): void {
    const cutoff = currentTime - this.config.tickWindowMs;
    this.tickBuffer = this.tickBuffer.filter(tick => tick.timestamp >= cutoff);

    // Limit buffer size to prevent memory bloat
    if (this.tickBuffer.length > ADVANCED_ORDER_FLOW.LIMITS.MAX_TICK_BUFFER_SIZE) {
      this.tickBuffer = this.tickBuffer.slice(-ADVANCED_ORDER_FLOW.LIMITS.MAX_TICK_BUFFER_SIZE);
    }
  }
}
