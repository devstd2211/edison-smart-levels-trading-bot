/**
 * RSI Signal Analyzer - FIX #1
 *
 * Generates LONG/SHORT signals based on RSI with dynamic SHORT threshold support
 * - Dynamic threshold mode for SHORT (50 vs 70)
 * - ATR-based adaptive thresholds
 * - Falling/rising knife prevention
 * - Configuration from config.json
 */

import { StrategyMarketData, SignalDirection, LoggerService } from '../types';
import {
  INTEGER_MULTIPLIERS,
  THRESHOLD_VALUES,
} from '../constants/technical.constants';

export interface RSISignalConfig {
  oversoldLevel: number;
  overboughtLevel: number;
  dynamicShortThreshold: number;
  dynamicShortThresholdMode: 'enabled' | 'disabled';
  dynamicMultiplier: number;
  atrBasedAdaptation: boolean;
  minConfidenceAfterFallingKnife: number;
  risingKnifePenalty: number;
  bounceBonus: number;
  maxConfidence: number;
  enabled: boolean;
}

export class RSISignalAnalyzer {
  private config: RSISignalConfig;

  constructor(private logger: LoggerService, config: Partial<RSISignalConfig> = {}) {
    this.config = {
      oversoldLevel: 30,
      overboughtLevel: 70,
      dynamicShortThreshold: 50,
      dynamicShortThresholdMode: 'disabled',
      dynamicMultiplier: 2,
      atrBasedAdaptation: false,
      minConfidenceAfterFallingKnife: 30,
      risingKnifePenalty: 0.6,
      bounceBonus: 1.1,
      maxConfidence: 70,
      enabled: true,
      ...config,
    };
  }

  async evaluate(data: StrategyMarketData): Promise<any> {
    if (!this.config.enabled || !data.rsi) {
      return null;
    }

    // Try LONG signal first
    const longSignal = this.evaluateLong(data);
    if (longSignal) return longSignal;

    // Then try SHORT signal
    const shortSignal = this.evaluateShort(data);
    return shortSignal;
  }

  private evaluateLong(data: StrategyMarketData): any {
    const { rsi } = data;
    if (rsi >= this.config.oversoldLevel) return null;

    let confidence = Math.min(INTEGER_MULTIPLIERS.ONE_HUNDRED - rsi, this.config.maxConfidence);

    // Check candle action
    if (data.candles && data.candles.length >= 2) {
      const last = data.candles[data.candles.length - 1];
      const prev = data.candles[data.candles.length - 2];

      if (last.close < prev.close) {
        confidence *= this.config.risingKnifePenalty;
        if (last.close < prev.low) {
          this.logger.debug('🚫 RSI_SIGNAL LONG | Strong downtrend - BLOCKED');
          return null;
        }
      } else if (last.close > prev.close && last.close > last.open) {
        confidence *= this.config.bounceBonus;
      }
    }

    if (confidence < this.config.minConfidenceAfterFallingKnife) return null;

    this.logger.debug('✅ RSI_SIGNAL LONG', {
      rsi: rsi.toFixed(2),
      confidence: confidence.toFixed(2),
    });

    return {
      source: 'RSI_SIGNAL',
      direction: SignalDirection.LONG,
      confidence,
      weight: THRESHOLD_VALUES.FIFTEEN_PERCENT,
      priority: 6,
    };
  }

  private evaluateShort(data: StrategyMarketData): any {
    const { rsi } = data;
    const threshold = this.getEffectiveOverboughtLevel(data);

    if (rsi <= threshold) return null;

    let confidence = Math.min(rsi - threshold, this.config.maxConfidence);

    // Check candle action
    if (data.candles && data.candles.length >= 2) {
      const last = data.candles[data.candles.length - 1];
      const prev = data.candles[data.candles.length - 2];

      if (last.close > prev.close) {
        confidence *= this.config.risingKnifePenalty;
        this.logger.debug('⚠️  RSI_SIGNAL SHORT | Rising knife detected');

        if (last.close > prev.high) {
          this.logger.debug('🚫 RSI_SIGNAL SHORT | Very strong uptrend - BLOCKED');
          return null;
        }
      } else if (last.close < prev.close && last.close < last.open) {
        confidence *= this.config.bounceBonus;
      }
    }

    if (confidence < this.config.minConfidenceAfterFallingKnife) return null;

    this.logger.debug('✅ RSI_SIGNAL SHORT', {
      rsi: rsi.toFixed(2),
      threshold: threshold.toFixed(1),
      confidence: confidence.toFixed(2),
      dynamicMode: this.config.dynamicShortThresholdMode,
    });

    return {
      source: 'RSI_SIGNAL',
      direction: SignalDirection.SHORT,
      confidence,
      weight: THRESHOLD_VALUES.FIFTEEN_PERCENT,
      priority: 6,
    };
  }

  private getEffectiveOverboughtLevel(data: StrategyMarketData): number {
    if (this.config.dynamicShortThresholdMode !== 'enabled') {
      return this.config.overboughtLevel;
    }

    let level = this.config.dynamicShortThreshold;

    if (this.config.atrBasedAdaptation && data.atr && data.candles?.length) {
      const lastCandle = data.candles[data.candles.length - 1];
      const atrPercent = (data.atr / lastCandle.close) * 100;
      level = 50 + atrPercent * this.config.dynamicMultiplier;
      level = Math.min(level, 75);

      this.logger.debug('🔧 RSI_SIGNAL | Dynamic threshold adapted', {
        atrPercent: atrPercent.toFixed(2),
        effectiveLevel: level.toFixed(1),
      });
    }

    return level;
  }
}
