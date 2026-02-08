/**
 * ML-Based Signal Validation Service
 * Phase 10.2.1
 *
 * Validates trading signals using machine learning-based approach:
 * - Historical win rate tracking per signal type
 * - Market regime adjustment (trending vs range-bound)
 * - Time-decay of signal relevance
 * - Feature extraction from multiple timeframes
 * - Confidence scoring and adjustment
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { Signal, SignalType } from '../types';
import {
  MarketContext,
  MarketRegime,
  ValidationResult,
  SignalRecord,
  SignalTypeStats,
  MLSignalValidatorConfig,
  DEFAULT_ML_SIGNAL_VALIDATOR_CONFIG,
  RecommendedAction,
  RiskLevel,
} from '../types/ml-signal-validator.interface';

/**
 * MLSignalValidatorService
 *
 * Validates signals using ML-based historical analysis and market regime detection.
 *
 * Recovery Strategies:
 * - THROW: Config validation (null/invalid config)
 * - THROW: Signal/context validation (null/invalid inputs)
 * - GRACEFUL_DEGRADE: Validation failures → return conservative result
 * - GRACEFUL_DEGRADE: Win rate calculation failures → use safe defaults
 * - SKIP: All logging failures via safeLog()
 */
export class MLSignalValidatorService {
  private config: MLSignalValidatorConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandler | null;

  /** Historical signal records for ML analysis */
  private signalHistory: SignalRecord[] = [];

  /** Signal type statistics cache */
  private statsCache: Map<SignalType, SignalTypeStats> = new Map();

  /** Last stats update timestamp */
  private lastStatsUpdate: number = 0;

  /** Stats cache TTL (5 minutes) */
  private readonly STATS_CACHE_TTL = 5 * 60 * 1000;

  constructor(
    config?: Partial<MLSignalValidatorConfig>,
    logger?: LoggerService,
    errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation OUTSIDE try-catch
    if (config !== undefined && config !== null && (typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('[MLSignalValidator] Config must be an object or undefined');
    }

    this.config = { ...DEFAULT_ML_SIGNAL_VALIDATOR_CONFIG, ...config };
    this.logger = logger || new LoggerService('MLSignalValidator');
    this.errorHandler = errorHandler || null;

    this.safeLog('info', 'MLSignalValidatorService initialized', {
      minSamples: this.config.minHistoricalSamples,
      timeDecayFactor: this.config.timeDecayFactor,
    });
  }

  /**
   * Validate a signal and adjust confidence based on ML analysis
   *
   * @param signal - Trading signal to validate
   * @param context - Current market context
   * @returns Validation result with adjusted confidence
   *
   * @throws Error if signal or context is null/undefined
   */
  async validateSignal(signal: Signal, context: MarketContext): Promise<ValidationResult> {
    // THROW: Input validation OUTSIDE try-catch
    if (!signal) {
      throw new Error('[MLSignalValidator] Signal cannot be null or undefined');
    }
    if (!context) {
      throw new Error('[MLSignalValidator] Market context cannot be null or undefined');
    }
    if (typeof signal.confidence !== 'number' || isNaN(signal.confidence)) {
      throw new Error('[MLSignalValidator] Signal confidence must be a valid number');
    }
    if (typeof signal.type !== 'string' || !signal.type) {
      throw new Error('[MLSignalValidator] Signal type must be a non-empty string');
    }

    // GRACEFUL_DEGRADE: Validation logic with safe fallback
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync<ValidationResult>(
        async () => this.performValidation(signal, context),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'validateSignal',
        },
      );

      if (result.success && result.value) {
        return result.value;
      }

      // Fallback: Conservative validation result
      this.safeLog('warn', 'Signal validation failed, using conservative result', {
        signalType: signal.type,
        error: result.error?.message,
      });

      return this.getConservativeResult(signal);
    }

    // Without ErrorHandler: Direct execution
    try {
      return this.performValidation(signal, context);
    } catch (error) {
      this.safeLog('error', 'Signal validation failed without ErrorHandler', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getConservativeResult(signal);
    }
  }

  /**
   * Calculate win rate for a specific signal type
   *
   * @param signals - Historical signal records
   * @returns Win rate (0-100)
   *
   * @throws Error if signals array is null/undefined
   */
  calculateWinRate(signals: SignalRecord[]): number {
    // THROW: Input validation
    if (!signals) {
      throw new Error('[MLSignalValidator] Signals array cannot be null or undefined');
    }
    if (!Array.isArray(signals)) {
      throw new Error('[MLSignalValidator] Signals must be an array');
    }

    // GRACEFUL_DEGRADE: Calculation with safe fallback
    try {
      return this.performWinRateCalculation(signals);
    } catch (error) {
      // Log error via errorHandler if available
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'calculateWinRate',
        });
      }

      this.safeLog('warn', 'Win rate calculation failed, using default 50%', {
        signalsCount: signals.length,
        error: error instanceof Error ? error.message : String(error),
      });

      return 50; // Default neutral win rate
    }
  }

  /**
   * Adjust confidence based on market regime
   *
   * @param confidence - Original confidence (0-100)
   * @param regime - Current market regime
   * @param signalType - Type of signal
   * @returns Adjusted confidence (0-100)
   *
   * @throws Error if confidence is invalid
   */
  adjustConfidenceByRegime(
    confidence: number,
    regime: MarketRegime,
    signalType: SignalType,
  ): number {
    // THROW: Input validation
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      throw new Error('[MLSignalValidator] Confidence must be a valid number');
    }
    if (!regime) {
      throw new Error('[MLSignalValidator] Market regime cannot be null or undefined');
    }

    // GRACEFUL_DEGRADE: Adjustment with safe fallback
    try {
      return this.performRegimeAdjustment(confidence, regime, signalType);
    } catch (error) {
      // Log error via errorHandler if available
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'adjustConfidenceByRegime',
        });
      }

      this.safeLog('warn', 'Regime adjustment failed, using original confidence', {
        regime,
        signalType,
        error: error instanceof Error ? error.message : String(error),
      });

      return confidence; // No adjustment on failure
    }
  }

  /**
   * Score signal quality based on multiple factors
   *
   * @param signal - Trading signal to score
   * @param context - Market context
   * @returns Quality score (0-100)
   *
   * @throws Error if signal is null/undefined
   */
  async scoreSignalQuality(signal: Signal, context: MarketContext): Promise<number> {
    // THROW: Input validation
    if (!signal) {
      throw new Error('[MLSignalValidator] Signal cannot be null or undefined');
    }
    if (!context) {
      throw new Error('[MLSignalValidator] Market context cannot be null or undefined');
    }

    // GRACEFUL_DEGRADE: Scoring with safe fallback
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync<number>(
        async () => this.performQualityScoring(signal, context),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'scoreSignalQuality',
        },
      );

      if (result.success && result.value !== undefined) {
        return result.value;
      }

      this.safeLog('warn', 'Quality scoring failed, using neutral score', {
        signalType: signal.type,
      });

      return 50; // Neutral score on failure
    }

    // Without ErrorHandler
    try {
      return this.performQualityScoring(signal, context);
    } catch (error) {
      this.safeLog('error', 'Quality scoring failed without ErrorHandler', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 50; // Neutral score on failure
    }
  }

  /**
   * Add a signal record to history (for ML training)
   */
  addSignalRecord(record: SignalRecord): void {
    if (!record) {
      this.safeLog('warn', 'Cannot add null signal record');
      return;
    }

    this.signalHistory.push(record);

    // Invalidate stats cache
    this.lastStatsUpdate = 0;

    this.safeLog('debug', 'Signal record added to history', {
      signalType: record.signal.type,
      wasWinner: record.wasWinner,
      totalRecords: this.signalHistory.length,
    });
  }

  /**
   * Get statistics for a specific signal type
   */
  getSignalTypeStats(type: SignalType): SignalTypeStats | null {
    // Check cache
    const now = Date.now();
    if (now - this.lastStatsUpdate < this.STATS_CACHE_TTL) {
      return this.statsCache.get(type) || null;
    }

    // Rebuild stats cache
    this.rebuildStatsCache();

    return this.statsCache.get(type) || null;
  }

  /**
   * Clear all historical data (for testing)
   */
  clearHistory(): void {
    this.signalHistory = [];
    this.statsCache.clear();
    this.lastStatsUpdate = 0;
    this.safeLog('info', 'Signal history cleared');
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Perform actual signal validation
   */
  private performValidation(signal: Signal, context: MarketContext): ValidationResult {
    const stats = this.getSignalTypeStats(signal.type);
    const hasHistory = stats && stats.totalSignals >= this.config.minHistoricalSamples;

    // Base confidence
    let adjustedConfidence = signal.confidence;

    // Adjustment factors
    const factors = {
      regimeAdjustment: 1.0,
      timeDecay: 1.0,
      winRateAdjustment: 1.0,
      volatilityAdjustment: 1.0,
    };

    // Apply regime adjustment
    const regimeMultiplier = this.getRegimeMultiplier(signal.type, context.regime);
    factors.regimeAdjustment = regimeMultiplier;
    adjustedConfidence *= regimeMultiplier;

    // Apply time decay (signals lose relevance over time)
    const ageHours = (Date.now() - signal.timestamp) / (1000 * 60 * 60);
    const timeDecay = Math.pow(this.config.timeDecayFactor, ageHours);
    factors.timeDecay = timeDecay;
    adjustedConfidence *= timeDecay;

    // Apply historical win rate adjustment
    if (hasHistory && stats) {
      if (stats.winRate >= this.config.highWinRateThreshold) {
        factors.winRateAdjustment = this.config.highWinRateBoost;
        adjustedConfidence *= this.config.highWinRateBoost;
      } else if (stats.winRate <= this.config.lowWinRateThreshold) {
        factors.winRateAdjustment = this.config.lowWinRatePenalty;
        adjustedConfidence *= this.config.lowWinRatePenalty;
      }
    }

    // Apply volatility adjustment
    if (context.volatility > this.config.highVolatilityThreshold) {
      factors.volatilityAdjustment = this.config.volatilityPenalty;
      adjustedConfidence *= this.config.volatilityPenalty;
    }

    // Clamp confidence to 0-100
    adjustedConfidence = Math.max(0, Math.min(100, adjustedConfidence));

    // Determine recommended action
    const recommendedAction = this.getRecommendedAction(adjustedConfidence, signal.direction);

    // Determine risk level
    const riskLevel = this.getRiskLevel(adjustedConfidence, context.volatility);

    // Expected win rate and RR
    const expectedWinRate = hasHistory && stats ? stats.winRate : 50;
    const expectedRR = hasHistory && stats ? stats.avgRR : 2.0;

    return {
      originalConfidence: signal.confidence,
      adjustedConfidence,
      recommendedAction,
      riskLevel,
      expectedWinRate,
      expectedRR,
      adjustmentFactors: factors,
    };
  }

  /**
   * Perform win rate calculation
   */
  private performWinRateCalculation(signals: SignalRecord[]): number {
    if (signals.length === 0) {
      return 50; // Neutral for no data
    }

    const winners = signals.filter((s) => s.wasWinner).length;
    const winRate = (winners / signals.length) * 100;

    // Validate result
    if (!isFinite(winRate) || isNaN(winRate)) {
      throw new Error('Win rate calculation resulted in invalid number');
    }

    return Math.round(winRate * 100) / 100; // Round to 2 decimals
  }

  /**
   * Perform regime-based confidence adjustment
   */
  private performRegimeAdjustment(
    confidence: number,
    regime: MarketRegime,
    signalType: SignalType,
  ): number {
    const multiplier = this.getRegimeMultiplier(signalType, regime);
    const adjusted = confidence * multiplier;

    // Validate result
    if (!isFinite(adjusted) || isNaN(adjusted)) {
      throw new Error('Regime adjustment resulted in invalid number');
    }

    return Math.max(0, Math.min(100, adjusted));
  }

  /**
   * Perform quality scoring
   */
  private async performQualityScoring(signal: Signal, context: MarketContext): Promise<number> {
    const stats = this.getSignalTypeStats(signal.type);

    let score = 50; // Base neutral score

    // Factor 1: Historical performance (30% weight)
    if (stats && stats.totalSignals >= this.config.minHistoricalSamples) {
      const performanceScore = (stats.winRate / 100) * 30;
      score += performanceScore - 15; // Centered at 50
    }

    // Factor 2: Signal confidence (25% weight)
    const confidenceScore = (signal.confidence / 100) * 25;
    score += confidenceScore - 12.5;

    // Factor 3: Regime alignment (25% weight)
    const regimeScore = this.getRegimeAlignmentScore(signal.type, context.regime) * 25;
    score += regimeScore - 12.5;

    // Factor 4: Risk-reward ratio (20% weight)
    const rrScore = stats ? Math.min(stats.avgRR / 4, 1) * 20 : 10;
    score += rrScore - 10;

    // Validate and clamp
    if (!isFinite(score) || isNaN(score)) {
      throw new Error('Quality scoring resulted in invalid number');
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get regime multiplier for signal type
   */
  private getRegimeMultiplier(signalType: SignalType, regime: MarketRegime): number {
    // Trend-following signals work best in trending markets
    if (signalType === SignalType.TREND_FOLLOWING) {
      if (regime === 'trending_up' || regime === 'trending_down') {
        return 1.2; // Boost confidence
      }
      if (regime === 'range_bound') {
        return this.config.regimeMismatchPenalty; // Penalty
      }
    }

    // Counter-trend signals work best in range-bound markets
    if (signalType === SignalType.COUNTER_TREND) {
      if (regime === 'range_bound') {
        return 1.2;
      }
      if (regime === 'trending_up' || regime === 'trending_down') {
        return this.config.regimeMismatchPenalty;
      }
    }

    // Reversal signals work best at regime transitions
    if (signalType === SignalType.REVERSAL) {
      if (regime === 'volatile') {
        return 1.1;
      }
    }

    return 1.0; // No adjustment
  }

  /**
   * Get regime alignment score (0-1)
   */
  private getRegimeAlignmentScore(signalType: SignalType, regime: MarketRegime): number {
    const multiplier = this.getRegimeMultiplier(signalType, regime);

    // Convert multiplier to 0-1 score
    if (multiplier >= 1.2) return 1.0; // Perfect alignment
    if (multiplier >= 1.0) return 0.7; // Neutral
    if (multiplier >= 0.8) return 0.3; // Misalignment
    return 0.0; // Strong misalignment
  }

  /**
   * Get recommended action based on confidence and direction
   */
  private getRecommendedAction(confidence: number, direction: string): RecommendedAction {
    const isLong = direction === 'LONG' || direction === 'long';

    if (confidence >= 80) {
      return isLong ? 'strong_buy' : 'strong_sell';
    }
    if (confidence >= 60) {
      return isLong ? 'buy' : 'sell';
    }
    return 'hold';
  }

  /**
   * Get risk level based on confidence and volatility
   */
  private getRiskLevel(confidence: number, volatility: number): RiskLevel {
    if (confidence >= 70 && volatility < this.config.highVolatilityThreshold) {
      return 'low';
    }
    if (confidence >= 50 && volatility < this.config.highVolatilityThreshold * 1.5) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * Get conservative validation result (fallback)
   */
  private getConservativeResult(signal: Signal): ValidationResult {
    return {
      originalConfidence: signal.confidence,
      adjustedConfidence: signal.confidence * 0.7, // 30% penalty for failure
      recommendedAction: 'hold', // Conservative: don't trade
      riskLevel: 'high', // Conservative: assume high risk
      expectedWinRate: 50, // Neutral
      expectedRR: 2.0, // Standard RR
    };
  }

  /**
   * Rebuild statistics cache
   */
  private rebuildStatsCache(): void {
    this.statsCache.clear();

    // Group signals by type
    const grouped = new Map<SignalType, SignalRecord[]>();
    for (const record of this.signalHistory) {
      const type = record.signal.type;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(record);
    }

    // Calculate stats for each type
    for (const [type, records] of grouped) {
      const totalSignals = records.length;
      const winningSignals = records.filter((r) => r.wasWinner).length;
      const winRate = totalSignals > 0 ? (winningSignals / totalSignals) * 100 : 0;

      const rrValues = records.map((r) => r.actualRR).filter((rr) => isFinite(rr));
      const avgRR = rrValues.length > 0 ? rrValues.reduce((sum, rr) => sum + rr, 0) / rrValues.length : 0;

      const profits = records.filter((r) => r.wasWinner).map((r) => r.profitLoss);
      const avgProfit = profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0;

      const losses = records.filter((r) => !r.wasWinner).map((r) => Math.abs(r.profitLoss));
      const avgLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;

      this.statsCache.set(type, {
        type,
        totalSignals,
        winningSignals,
        winRate: Math.round(winRate * 100) / 100,
        avgRR: Math.round(avgRR * 100) / 100,
        avgProfit: Math.round(avgProfit * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        lastUpdated: Date.now(),
      });
    }

    this.lastStatsUpdate = Date.now();
  }

  /**
   * Safe logging wrapper (SKIP strategy for logging failures)
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
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
