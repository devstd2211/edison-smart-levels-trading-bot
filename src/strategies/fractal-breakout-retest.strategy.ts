import { DECIMAL_PLACES } from '../constants';
/**
 * Fractal Breakout-Retest Strategy
 *
 * Complete strategy implementation with state machine:
 * IDLE → BREAKOUT → RETEST → REVERSAL → ENTRY
 *
 * Features:
 * - Daily High/Low level detection
 * - Breakout confirmation with volume
 * - Retest zone tracking with multiple touches
 * - 1-minute reversal confirmation
 * - Weighted signal scoring (Fractal + SMC)
 * - Confidence-based position sizing
 * - Tight stop loss on local 1m high/low
 * - Market health monitoring
 */

import {
  Candle,
  IStrategy,
  LoggerService,
  Signal,
  SignalDirection,
  SignalType,
  StrategyMarketData,
  StrategySignal,
  TakeProfit,
  FractalSmcWeightingService,
  MarketHealthMonitor,
  DailyLevelTracker,
  BreakoutDetector,
  RetestPhaseAnalyzer,
  EntryRefinementAnalyzer,
  VolumeAnalyzer,
} from '../types';
import {
  FractalSetup,
  FractalState,
  FractalStrategyConfig,
  BreakoutDetectionResult,
  ConfidenceLevel
} from '../types/fractal-strategy.types';
import { formatPrice, TIME_INTERVALS, INTEGER_MULTIPLIERS, RATIO_MULTIPLIERS } from '../constants/technical.constants';

export class FractalBreakoutRetestStrategy implements IStrategy {
  readonly name = 'FRACTAL_BREAKOUT_RETEST';
  readonly priority: number;

  private setupsLong: Map<string, FractalSetup> = new Map();
  private setupsShort: Map<string, FractalSetup> = new Map();

  constructor(
    private config: FractalStrategyConfig,
    private dailyLevelTracker: DailyLevelTracker,
    private breakoutDetector: BreakoutDetector,
    private retestAnalyzer: RetestPhaseAnalyzer,
    private entryRefinement: EntryRefinementAnalyzer,
    private volumeAnalyzer: VolumeAnalyzer,
    private weightingService: FractalSmcWeightingService,
    private healthMonitor: MarketHealthMonitor,
    private logger: LoggerService
  ) {
    this.priority = config.priority;
  }

  /**
   * Main strategy evaluation
   * Processes LONG and SHORT setups independently
   */
  async evaluate(data: StrategyMarketData): Promise<StrategySignal> {
    try {
      // Validate input data
      if (!data.candles || data.candles.length < 20) {
        return {
          valid: false,
          strategyName: this.name,
          priority: this.priority,
          reason: 'Insufficient candle data'
        };
      }

      // Check market health
      const healthStatus = this.healthMonitor.diagnose();
      if (healthStatus.positionSizeMultiplier === 0) {
        // try { this.logger?.warn?.('Strategy disabled by market health monitor'); } catch (e) {}
        return {
          valid: false,
          strategyName: this.name,
          priority: this.priority,
          reason: `Market health: ${healthStatus.message}`
        };
      }

      // Get daily levels
      const dailyLevel = this.dailyLevelTracker.getDailyLevels(data.candles);
      this.logger.debug('Daily level retrieved', {
        high: formatPrice(dailyLevel.high),
        low: formatPrice(dailyLevel.low),
        source: dailyLevel.source
      });

      // Process LONG and SHORT setups independently
      const lastCandle5m = data.candles[data.candles.length - 1];
      const candles1m = data.candles; // In backtesting, might be same as 5m; in live, would be separate

      this.logger.debug('[FRACTAL DEBUG] Last candle 5m', {
        close: formatPrice(lastCandle5m.close),
        high: formatPrice(lastCandle5m.high),
        low: formatPrice(lastCandle5m.low)
      });

      const avgVolume5m = this.volumeAnalyzer.calculateAverage(data.candles, 20);

      const longResult = await this.processSetup(
        SignalDirection.LONG,
        dailyLevel,
        lastCandle5m,
        candles1m,
        avgVolume5m,
        data
      );

      const shortResult = await this.processSetup(
        SignalDirection.SHORT,
        dailyLevel,
        lastCandle5m,
        candles1m,
        avgVolume5m,
        data
      );

      // Select best setup if both ready
      const readySetup = this.selectBestSetup(longResult, shortResult);

      if (!readySetup) {
        return {
          valid: false,
          strategyName: this.name,
          priority: this.priority
        };
      }

      // Check market health multiplier
      const signal = this.createSignal(readySetup, data, healthStatus.positionSizeMultiplier);

      // Final validation
      if (!signal) {
        return {
          valid: false,
          strategyName: this.name,
          priority: this.priority,
          reason: 'Failed to create signal'
        };
      }

      return {
        valid: true,
        signal,
        strategyName: this.name,
        priority: this.priority
      };
    } catch (error) {
      this.logger.error('[FRACTAL ERROR]', {
        message: error instanceof Error ? error.message : String(error),
        error
      });

      return {
        valid: false,
        strategyName: this.name,
        priority: this.priority,
        reason: `Strategy error: ${error instanceof Error ? error.message : 'unknown'}`
      };
    }
  }

  /**
   * Process individual setup (LONG or SHORT)
   * Manages state machine progression
   */
  private async processSetup(
    direction: SignalDirection,
    dailyLevel: any,
    lastCandle5m: Candle,
    candles1m: Candle[],
    avgVolume5m: number,
    data: StrategyMarketData
  ): Promise<FractalSetup | null> {
    const setups = direction === SignalDirection.LONG ? this.setupsLong : this.setupsShort;

    // Find existing setup for this direction (O(1) lookup, not O(n))
    let setup: FractalSetup | null = null;
    for (const s of setups.values()) {
      if (s.direction === direction) {
        setup = s;
        break;
      }
    }

    // STEP 1: Detect initial breakout
    if (!setup) {
      this.logger.debug('[FRACTAL DEBUG] Checking for breakout', {
        direction,
        price: formatPrice(lastCandle5m.close),
        dailyLevel: direction === SignalDirection.LONG ? formatPrice(dailyLevel.high) : formatPrice(dailyLevel.low)
      });

      const breakoutResult: BreakoutDetectionResult = this.breakoutDetector.detectBreakout(
        lastCandle5m,
        dailyLevel,
        avgVolume5m
      );

      if (!breakoutResult.detected || !breakoutResult.breakout) {
        this.logger.debug('[FRACTAL DEBUG] No breakout detected', {
          direction,
          reason: breakoutResult.reason
        });
        return null; // No breakout yet
      }

      // Verify breakout direction matches what we're looking for
      if (breakoutResult.breakout.direction !== direction) {
        return null;
      }

      // Create new setup
      const setupId = `${direction}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setup = {
        id: setupId,
        direction,
        state: FractalState.BREAKOUT_DETECTED,
        dailyLevel,
        breakout: breakoutResult.breakout,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + this.config.dailyLevelConfig.retestTimeoutBars * TIME_INTERVALS.MS_PER_5_MINUTES
      };

      setups.set(setupId, setup);

       this.logger.info(`Breakout detected: ${direction}`, {
        setupId: setup.id,
        price: formatPrice(setup.breakout!.price),
        level: setup.breakout!.strength.toFixed(DECIMAL_PLACES.STRENGTH),
        volumeRatio: formatPrice(setup.breakout!.volumeRatio) + 'x'
      });

      return null; // Breakout detected, wait for retest
    }

    // STEP 2: Check timeout
    if (this.retestAnalyzer.isRetestTimeout(setup)) {
      this.logger.warn(`Setup timeout: ${setup.id}`);
      setups.delete(setup.id);
      return null;
    }

    // STEP 3: Transition from BREAKOUT to RETEST
    if (setup.state === FractalState.BREAKOUT_DETECTED) {
      const retestResult = this.retestAnalyzer.updateRetestInfo(setup, lastCandle5m, candles1m);

      if (retestResult.inRetestZone && retestResult.retestInfo) {
        setup.retest = retestResult.retestInfo;
        setup.state = FractalState.RETEST_ZONE;
        setup.updatedAt = Date.now();

        this.logger.debug(`Retest zone: ${setup.id}`, {
          touchCount: setup.retest.touchCount,
          price: formatPrice(lastCandle5m.close),
          zone: this.retestAnalyzer.getRetestZoneInfo(setup)
        });
      }
    }

    // UPDATE RETEST INFO WHILE IN RETEST ZONE (must happen every bar!)
    if (setup.state === FractalState.RETEST_ZONE && setup.retest) {
      const retestResult = this.retestAnalyzer.updateRetestInfo(setup, lastCandle5m, candles1m);
      if (retestResult.retestInfo) {
        setup.retest = retestResult.retestInfo;
        setup.updatedAt = Date.now();
      }
    }

    // STEP 4: Transition from RETEST to REVERSAL
    if (setup.state === FractalState.RETEST_ZONE && setup.retest) {
      const avgVolume1m = this.volumeAnalyzer.calculateAverage(candles1m, 20);
      const refinementResult = this.entryRefinement.checkReversalConfirmation(
        setup,
        candles1m,
        avgVolume1m
      );

      this.logger.debug('[FRACTAL STATE]', {
        direction,
        state: setup.state,
        retestZone: setup.retest ? 'YES' : 'NO',
        reversalConfirmed: refinementResult.confirmed,
        reversalPattern: refinementResult.reversal ? 'YES' : 'NO'
      });

      if (refinementResult.confirmed && refinementResult.reversal) {
        setup.reversal = refinementResult.reversal;
        setup.state = FractalState.REVERSAL_SIGNAL;
        setup.updatedAt = Date.now();

        this.logger.debug('[FRACTAL REVERSAL CONFIRMED]', {
          setupId: setup.id,
          direction,
          pattern: setup.reversal.priceActionPattern,
          conditions: refinementResult.conditionsMet
        });

        this.logger.info(`Reversal confirmed: ${setup.id}`, {
          pattern: setup.reversal.priceActionPattern,
          conditionsMet: refinementResult.conditionsMet
        });

        return setup; // READY FOR ENTRY!
      }
    }

    return null;
  }

  /**
   * Select best setup if multiple are ready
   * Prioritizes by breakout strength
   */
  private selectBestSetup(longSetup: FractalSetup | null, shortSetup: FractalSetup | null): FractalSetup | null {
    if (longSetup && !shortSetup) {
      return longSetup;
    }
    if (shortSetup && !longSetup) {
      return shortSetup;
    }
    if (!longSetup || !shortSetup) {
      return null;
    }

    // Both ready - pick stronger breakout
    const longStrength = longSetup.breakout?.strength ?? 0;
    const shortStrength = shortSetup.breakout?.strength ?? 0;

    return longStrength > shortStrength ? longSetup : shortSetup;
  }

  /**
   * Create trading signal with weighted scoring and position sizing
   */
  private createSignal(
    setup: FractalSetup,
    data: StrategyMarketData,
    healthMultiplier: number = RATIO_MULTIPLIERS.FULL as number
  ): Signal | null {
    try {
      if (!setup.retest || !setup.reversal || !setup.breakout) {
        this.logger.error('Incomplete setup for signal creation');
        return null;
      }

      // Calculate weighted score
      const weightedScore = this.weightingService.calculateWeightedScore(setup, data);

      this.logger.debug('[FRACTAL SCORE]', {
        fractal: weightedScore.fractalScore.toFixed(1),
        smc: weightedScore.smcScore.toFixed(1),
        combined: weightedScore.combinedScore.toFixed(1),
        threshold: weightedScore.threshold,
        passes: weightedScore.passesThreshold
      });

      // Check threshold
      if (!weightedScore.passesThreshold) {
        this.logger.debug(`Signal below threshold`, {
          score: weightedScore.combinedScore.toFixed(1),
          threshold: weightedScore.threshold
        });
        return null;
      }

      // Calculate stop loss - tight buffer on local 1m high/low
      const stopLoss = this.retestAnalyzer.calculateTightStopLoss(
        setup.retest.localHighLow,
        setup.direction,
        0.1 // 0.1% buffer
      );

      // Validate stop loss
      if (setup.direction === SignalDirection.LONG && stopLoss >= data.currentPrice) {
        this.logger.error('Invalid SL: long SL >= entry price');
        return null;
      }
      if (setup.direction === SignalDirection.SHORT && stopLoss <= data.currentPrice) {
        this.logger.error('Invalid SL: short SL <= entry price');
        return null;
      }

      // Calculate risk/reward
      const riskAmount = Math.abs(data.currentPrice - stopLoss);

      // Create take profit levels with configured R/R ratios
      const takeProfits: TakeProfit[] = [
        {
          level: 1,
          percent: this.config.rrRatio.tp1,
          sizePercent: 50, // Close 50% at TP1
          price: this.calculateTP(setup.direction, data.currentPrice, riskAmount, this.config.rrRatio.tp1),
          hit: false
        },
        {
          level: 2,
          percent: this.config.rrRatio.tp2,
          sizePercent: 30, // Close 30% at TP2
          price: this.calculateTP(setup.direction, data.currentPrice, riskAmount, this.config.rrRatio.tp2),
          hit: false
        },
        {
          level: 3,
          percent: this.config.rrRatio.tp3,
          sizePercent: 20, // Close 20% at TP3
          price: this.calculateTP(setup.direction, data.currentPrice, riskAmount, this.config.rrRatio.tp3),
          hit: false
        }
      ];

      // Apply health monitor position sizing
      const baseConfidence = this.getConfidenceValue(weightedScore.confidence);
      const adjustedConfidence = Math.min(1.0, baseConfidence * healthMultiplier);

      // Build reason
      const reason = this.buildSignalReason(setup, weightedScore);

      const signal: Signal = {
        direction: setup.direction,
        type: SignalType.FRACTAL_BREAKOUT_RETEST,
        confidence: adjustedConfidence,
        price: data.currentPrice,
        stopLoss,
        takeProfits,
        reason,
        timestamp: Date.now()
      };

      this.logger.info('Signal generated', {
        direction: setup.direction,
        score: weightedScore.combinedScore.toFixed(1),
        confidence: weightedScore.confidence,
        positionSize: (weightedScore.positionSize * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(0) + '%'
      });

      return signal;
    } catch (error) {
      this.logger.error('Error creating signal', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Calculate TP price based on R/R ratio
   */
  private calculateTP(
    direction: SignalDirection,
    entryPrice: number,
    riskAmount: number,
    rrRatio: number
  ): number {
    const targetProfit = riskAmount * rrRatio;

    if (direction === SignalDirection.LONG) {
      return entryPrice + targetProfit;
    } else {
      return entryPrice - targetProfit;
    }
  }

  /**
   * Convert confidence level to numeric value
   */
  private getConfidenceValue(confidence: ConfidenceLevel): number {
    switch (confidence) {
      case ConfidenceLevel.HIGH:
        return 1.0;
      case ConfidenceLevel.MEDIUM:
        return 0.75;
      case ConfidenceLevel.LOW:
        return 0.5;
    }
  }

  /**
   * Build detailed signal reason
   */
  private buildSignalReason(setup: FractalSetup, weightedScore: any): string {
    const parts: string[] = [
      `Daily ${setup.direction} breakout at ${formatPrice(setup.breakout!.price)}`,
      `Retest: ${setup.retest!.touchCount} touches`,
      `Score: ${weightedScore.combinedScore.toFixed(0)}/220`,
      `Confidence: ${weightedScore.confidence}`
    ];

    if (setup.reversal?.priceActionPattern) {
      parts.push(`Pattern: ${setup.reversal.priceActionPattern}`);
    }

    return parts.join(' | ');
  }
}
