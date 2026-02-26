/**
 * Anomaly Detection Service
 * Phase 10.2.3
 *
 * Detects market anomalies:
 * - Volume anomalies (unusual trading volume)
 * - Volatility spikes (sudden price movements)
 * - Whale activity (large trades)
 * - Market manipulation patterns (wash trading, spoofing, pump & dump)
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { LogLevel, AnomalyDetectionStrategicConfig } from '../types/legacy';
import {
  AnomalyResult,
  AnomalyType,
  AnomalySeverity,
  VolatilitySpike,
  WhaleAlert,
  ManipulationFlags,
  Trade,
  TradeDirection,
  VolumeStats,
  VolatilityStats,
  AnomalyDetectionConfig,
  DEFAULT_ANOMALY_DETECTION_CONFIG,
} from '../types/legacy';
import {
  DEFAULT_ANOMALY_DETECTION,
  ANOMALY_DETECTION_TECHNICAL,
} from '../constants/phase-10-constants';

/**
 * AnomalyDetectionService
 *
 * Detects market anomalies using statistical analysis.
 *
 * Recovery Strategies:
 * - THROW: Config/input validation (null/invalid inputs)
 * - GRACEFUL_DEGRADE: Detection failures → no anomaly detected
 * - SKIP: All logging failures via safeLog()
 */
export class AnomalyDetectionService {
  private config: AnomalyDetectionConfig;
  private strategicConfig: AnomalyDetectionStrategicConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandler | null;

  /** Volume history for statistical analysis */
  private volumeHistory: number[] = [];

  /** Volatility history for spike detection */
  private volatilityHistory: number[] = [];

  /** Recent trades for whale detection */
  private recentTrades: Trade[] = [];

  /** Current price for manipulation detection */
  private currentPrice: number = 0;

  constructor(
    config?: Partial<AnomalyDetectionConfig>,
    strategicConfig?: AnomalyDetectionStrategicConfig,
    logger?: LoggerService,
    errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation OUTSIDE try-catch
    if (config !== undefined && config !== null && (typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('[AnomalyDetection] Config must be an object or undefined');
    }

    this.config = { ...DEFAULT_ANOMALY_DETECTION_CONFIG, ...config };
    this.strategicConfig = { ...DEFAULT_ANOMALY_DETECTION, ...strategicConfig };
    this.logger = logger || new LoggerService(LogLevel.ERROR, './logs', false);
    this.errorHandler = errorHandler || null;

    this.safeLog('info', 'AnomalyDetectionService initialized', {
      volumeThreshold: this.config.volumeAnomalyThreshold,
      volatilityThreshold: this.config.volatilitySpikeThreshold,
      strategicThresholds: this.strategicConfig,
    });
  }

  /**
   * Detect volume anomaly
   *
   * @param volume - Current volume to check
   * @returns Anomaly detection result
   *
   * @throws Error if volume is null/undefined or invalid
   */
  detectVolumeAnomaly(volume: number): AnomalyResult {
    // THROW: Input validation
    if (typeof volume !== 'number') {
      throw new Error('[AnomalyDetection] Volume must be a number');
    }
    if (!isFinite(volume) || volume < 0) {
      throw new Error('[AnomalyDetection] Volume must be a finite non-negative number');
    }

    // Add to history
    this.addVolumeToHistory(volume);

    // GRACEFUL_DEGRADE: Detection with safe fallback
    try {
      return this.performVolumeAnomalyDetection(volume);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'detectVolumeAnomaly',
        });
      }

      this.safeLog('warn', 'Volume anomaly detection failed, returning no anomaly', {
        volume,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.getNoAnomalyResult('volume');
    }
  }

  /**
   * Detect volatility spike
   *
   * @param currentVolatility - Current volatility value (e.g., ATR)
   * @returns Volatility spike result
   *
   * @throws Error if volatility is null/undefined or invalid
   */
  detectVolatilitySpike(currentVolatility: number): VolatilitySpike {
    // THROW: Input validation
    if (typeof currentVolatility !== 'number') {
      throw new Error('[AnomalyDetection] Volatility must be a number');
    }
    if (!isFinite(currentVolatility) || currentVolatility < 0) {
      throw new Error('[AnomalyDetection] Volatility must be a finite non-negative number');
    }

    // Add to history
    this.addVolatilityToHistory(currentVolatility);

    // GRACEFUL_DEGRADE: Detection with safe fallback
    try {
      return this.performVolatilitySpikeDetection(currentVolatility);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'detectVolatilitySpike',
        });
      }

      this.safeLog('warn', 'Volatility spike detection failed, returning no spike', {
        currentVolatility,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        detected: false,
        currentVolatility,
        averageVolatility: currentVolatility,
        magnitude: 1.0,
        severity: 'low',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Detect whale activity in trades
   *
   * @param trades - Array of recent trades
   * @returns Array of whale alerts
   *
   * @throws Error if trades is null/undefined or not an array
   */
  detectWhaleActivity(trades: Trade[]): WhaleAlert[] {
    // THROW: Input validation
    if (!trades) {
      throw new Error('[AnomalyDetection] Trades array cannot be null or undefined');
    }
    if (!Array.isArray(trades)) {
      throw new Error('[AnomalyDetection] Trades must be an array');
    }

    // Store recent trades
    this.recentTrades = [...trades];

    // GRACEFUL_DEGRADE: Detection with safe fallback
    if (!this.config.enableWhaleDetection) {
      return [];
    }

    try {
      return this.performWhaleDetection(trades);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'detectWhaleActivity',
        });
      }

      this.safeLog('warn', 'Whale activity detection failed, returning empty array', {
        tradesCount: trades.length,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /**
   * Flag possible market manipulation
   *
   * @returns Manipulation flags
   */
  flagPossibleManipulation(): ManipulationFlags {
    // GRACEFUL_DEGRADE: Detection with safe fallback
    if (!this.config.enableManipulationDetection) {
      return this.getNoManipulationFlags();
    }

    try {
      return this.performManipulationDetection();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'flagPossibleManipulation',
        });
      }

      this.safeLog('warn', 'Manipulation detection failed, returning no flags', {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.getNoManipulationFlags();
    }
  }

  /**
   * Update current price (for manipulation detection)
   */
  updatePrice(price: number): void {
    if (typeof price === 'number' && isFinite(price) && price > 0) {
      this.currentPrice = price;
    }
  }

  /**
   * Get volume statistics
   */
  getVolumeStats(): VolumeStats | null {
    if (this.volumeHistory.length === 0) {
      return null;
    }

    return this.calculateStats(this.volumeHistory);
  }

  /**
   * Get volatility statistics
   */
  getVolatilityStats(): VolatilityStats | null {
    if (this.volatilityHistory.length === 0) {
      return null;
    }

    return this.calculateStats(this.volatilityHistory);
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.volumeHistory = [];
    this.volatilityHistory = [];
    this.recentTrades = [];
    this.currentPrice = 0;
    this.safeLog('info', 'Anomaly detection history cleared');
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Add volume to history (with window size limit)
   */
  private addVolumeToHistory(volume: number): void {
    this.volumeHistory.push(volume);

    // Maintain window size
    if (this.volumeHistory.length > this.config.volumeWindowSize) {
      this.volumeHistory.shift();
    }
  }

  /**
   * Add volatility to history (with window size limit)
   */
  private addVolatilityToHistory(volatility: number): void {
    this.volatilityHistory.push(volatility);

    // Maintain window size
    if (this.volatilityHistory.length > this.config.volatilityWindowSize) {
      this.volatilityHistory.shift();
    }
  }

  /**
   * Perform volume anomaly detection
   */
  private performVolumeAnomalyDetection(volume: number): AnomalyResult {
    if (this.volumeHistory.length < this.config.minVolumeSamples) {
      return this.getNoAnomalyResult('volume');
    }

    const stats = this.calculateStats(this.volumeHistory);
    const zScore = (volume - stats.average) / stats.stdDev;

    const detected = Math.abs(zScore) > this.config.volumeAnomalyThreshold;
    const deviation = volume / stats.average;

    let severity: AnomalySeverity = 'low';
    if (Math.abs(zScore) > this.strategicConfig.zScoreCritical) severity = 'critical';
    else if (Math.abs(zScore) > this.strategicConfig.zScoreHigh) severity = 'high';
    else if (Math.abs(zScore) > this.strategicConfig.zScoreMedium) severity = 'medium';

    const confidence = Math.min(100, Math.abs(zScore) * 20);

    return {
      detected,
      type: 'volume',
      severity,
      deviation,
      confidence: Math.round(confidence),
      description: detected
        ? `Volume anomaly: ${deviation.toFixed(2)}x average (z-score: ${zScore.toFixed(2)})`
        : 'No volume anomaly detected',
      timestamp: Date.now(),
      metadata: {
        volume,
        average: stats.average,
        stdDev: stats.stdDev,
        zScore,
      },
    };
  }

  /**
   * Perform volatility spike detection
   */
  private performVolatilitySpikeDetection(currentVolatility: number): VolatilitySpike {
    if (this.volatilityHistory.length < this.config.minVolatilitySamples) {
      return {
        detected: false,
        currentVolatility,
        averageVolatility: currentVolatility,
        magnitude: 1.0,
        severity: 'low',
        timestamp: Date.now(),
      };
    }

    const stats = this.calculateStats(this.volatilityHistory);
    const zScore = (currentVolatility - stats.average) / stats.stdDev;
    const magnitude = currentVolatility / stats.average;

    const detected = zScore > this.config.volatilitySpikeThreshold;

    let severity: AnomalySeverity = 'low';
    if (zScore > this.strategicConfig.zScoreCritical) severity = 'critical';
    else if (zScore > this.strategicConfig.zScoreHigh) severity = 'high';
    else if (zScore > this.strategicConfig.zScoreMedium) severity = 'medium';

    return {
      detected,
      currentVolatility,
      averageVolatility: stats.average,
      magnitude,
      severity,
      timestamp: Date.now(),
    };
  }

  /**
   * Perform whale activity detection
   */
  private performWhaleDetection(trades: Trade[]): WhaleAlert[] {
    const alerts: WhaleAlert[] = [];

    if (trades.length === 0) {
      return alerts;
    }

    // Calculate average trade size
    const avgTradeSize = trades.reduce((sum, t) => sum + t.size * t.price, 0) / trades.length;

    // Detect single large trades
    for (const trade of trades) {
      const tradeValueUSDT = trade.size * trade.price;
      const ratio = tradeValueUSDT / avgTradeSize;

      if (ratio > this.config.whaleTradeThreshold) {
        alerts.push({
          type: 'single_large_trade',
          severity: this.getSeverityFromRatio(ratio),
          direction: trade.side,
          volumeUSDT: tradeValueUSDT,
          price: trade.price,
          timestamp: trade.timestamp,
          tradeCount: 1,
          confidence: Math.min(100, ratio * 10),
          description: `Large ${trade.side} trade: ${ratio.toFixed(1)}x average size`,
        });
      }
    }

    // Detect accumulation/distribution patterns
    const accumulationAlert = this.detectAccumulation(trades, avgTradeSize);
    if (accumulationAlert) alerts.push(accumulationAlert);

    const distributionAlert = this.detectDistribution(trades, avgTradeSize);
    if (distributionAlert) alerts.push(distributionAlert);

    return alerts;
  }

  /**
   * Detect accumulation pattern (multiple buys)
   */
  private detectAccumulation(trades: Trade[], avgSize: number): WhaleAlert | null {
    const buyTrades = trades.filter((t) => t.side === 'BUY');
    if (buyTrades.length < 3) return null;

    const totalBuyVolume = buyTrades.reduce((sum, t) => sum + t.size * t.price, 0);
    const ratio = totalBuyVolume / (avgSize * trades.length);

    if (ratio > this.strategicConfig.whaleAccumulationRatio) {
      return {
        type: 'accumulation',
        severity: this.getSeverityFromRatio(ratio),
        direction: 'BUY',
        volumeUSDT: totalBuyVolume,
        price: buyTrades[buyTrades.length - 1].price,
        timestamp: Date.now(),
        tradeCount: buyTrades.length,
        confidence: Math.min(100, ratio * 25),
        description: `Accumulation detected: ${buyTrades.length} buys, ${ratio.toFixed(1)}x average`,
      };
    }

    return null;
  }

  /**
   * Detect distribution pattern (multiple sells)
   */
  private detectDistribution(trades: Trade[], avgSize: number): WhaleAlert | null {
    const sellTrades = trades.filter((t) => t.side === 'SELL');
    if (sellTrades.length < 3) return null;

    const totalSellVolume = sellTrades.reduce((sum, t) => sum + t.size * t.price, 0);
    const ratio = totalSellVolume / (avgSize * trades.length);

    if (ratio > this.strategicConfig.whaleAccumulationRatio) {
      return {
        type: 'distribution',
        severity: this.getSeverityFromRatio(ratio),
        direction: 'SELL',
        volumeUSDT: totalSellVolume,
        price: sellTrades[sellTrades.length - 1].price,
        timestamp: Date.now(),
        tradeCount: sellTrades.length,
        confidence: Math.min(100, ratio * 25),
        description: `Distribution detected: ${sellTrades.length} sells, ${ratio.toFixed(1)}x average`,
      };
    }

    return null;
  }

  /**
   * Perform manipulation detection
   */
  private performManipulationDetection(): ManipulationFlags {
    const flags: ManipulationFlags = {
      washTrading: false,
      spoofing: false,
      pumpAndDump: false,
      likelihood: 0,
      severity: 'low',
      evidence: [],
      timestamp: Date.now(),
    };

    // Need sufficient data
    if (this.recentTrades.length < ANOMALY_DETECTION_TECHNICAL.MANIPULATION.MIN_TRADES || this.volumeHistory.length < ANOMALY_DETECTION_TECHNICAL.MANIPULATION.MIN_VOLUME_HISTORY) {
      return flags;
    }

    // Check wash trading (trades at similar prices)
    flags.washTrading = this.detectWashTrading();
    if (flags.washTrading) {
      flags.evidence.push('Wash trading: Trades clustered at similar prices');
      flags.likelihood += ANOMALY_DETECTION_TECHNICAL.LIKELIHOOD_WEIGHTS.WASH_TRADING;
    }

    // Check pump and dump (rapid price increase then decrease)
    flags.pumpAndDump = this.detectPumpAndDump();
    if (flags.pumpAndDump) {
      flags.evidence.push('Pump and dump: Rapid price movement detected');
      flags.likelihood += ANOMALY_DETECTION_TECHNICAL.LIKELIHOOD_WEIGHTS.PUMP_DUMP;
    }

    // Determine severity
    if (flags.likelihood > 70) flags.severity = 'critical';
    else if (flags.likelihood > 50) flags.severity = 'high';
    else if (flags.likelihood > 30) flags.severity = 'medium';

    return flags;
  }

  /**
   * Detect wash trading (trades at similar prices)
   */
  private detectWashTrading(): boolean {
    if (this.recentTrades.length < 5) return false;

    const prices = this.recentTrades.map((t) => t.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Cannot detect wash trading with zero average price
    if (avgPrice === 0) return false;

    // Count trades within tolerance
    const similarPrices = prices.filter(
      (p) => Math.abs(p - avgPrice) / avgPrice < this.config.washTradingPriceTolerance,
    );

    // If >threshold of trades are at similar prices, flag as suspicious
    return similarPrices.length / prices.length > this.strategicConfig.washTradingSimilarity;
  }

  /**
   * Detect pump and dump (rapid price changes)
   */
  private detectPumpAndDump(): boolean {
    if (this.recentTrades.length < 10) return false;

    const sortedTrades = [...this.recentTrades].sort((a, b) => a.timestamp - b.timestamp);
    const firstPrice = sortedTrades[0].price;
    const maxPrice = Math.max(...sortedTrades.map((t) => t.price));
    const lastPrice = sortedTrades[sortedTrades.length - 1].price;

    const priceIncrease = (maxPrice - firstPrice) / firstPrice;
    const priceDecrease = (maxPrice - lastPrice) / maxPrice;

    // Pump and dump: rapid increase >threshold%, then decrease >threshold%
    return priceIncrease > this.config.pumpDumpThreshold && priceDecrease > this.strategicConfig.pumpDumpDecrease;
  }

  /**
   * Calculate statistics for array of numbers
   */
  private calculateStats(values: number[]): VolumeStats | VolatilityStats {
    const sum = values.reduce((s, v) => s + v, 0);
    const average = sum / values.length;

    const squaredDiffs = values.map((v) => Math.pow(v - average, 2));
    const variance = squaredDiffs.reduce((s, d) => s + d, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      current: values[values.length - 1],
      average,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      sampleCount: values.length,
    };
  }

  /**
   * Get severity from ratio
   */
  private getSeverityFromRatio(ratio: number): AnomalySeverity {
    if (ratio > ANOMALY_DETECTION_TECHNICAL.SEVERITY_RATIOS.CRITICAL) return 'critical';
    if (ratio > ANOMALY_DETECTION_TECHNICAL.SEVERITY_RATIOS.HIGH) return 'high';
    if (ratio > ANOMALY_DETECTION_TECHNICAL.SEVERITY_RATIOS.MEDIUM) return 'medium';
    return 'low';
  }

  /**
   * Get no anomaly result
   */
  private getNoAnomalyResult(type: AnomalyType): AnomalyResult {
    return {
      detected: false,
      type,
      severity: 'low',
      deviation: 1.0,
      confidence: 0,
      description: `No ${type} anomaly detected`,
      timestamp: Date.now(),
    };
  }

  /**
   * Get no manipulation flags
   */
  private getNoManipulationFlags(): ManipulationFlags {
    return {
      washTrading: false,
      spoofing: false,
      pumpAndDump: false,
      likelihood: 0,
      severity: 'low',
      evidence: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Safe logging wrapper (SKIP strategy for logging failures)
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      // Silently skip logging errors (SKIP strategy)
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'logging',
        });
      }
    }
  }
}

