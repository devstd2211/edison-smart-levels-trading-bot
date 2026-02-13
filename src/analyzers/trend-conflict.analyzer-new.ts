/**
 * Trend Conflict Analyzer NEW - with ConfigNew Support
 * Detects conflicts between different timeframes or indicators
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { TrendConflictAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import type { LoggerService } from '../services/logger.service';
import { IAnalyzer } from '../types/analyzer.interface';
import { AnalyzerType } from '../types/analyzer-type.enum';

const DEFAULT_MIN_CANDLES_FOR_TREND_CONFLICT = 20;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_CONFLICT_CONFIDENCE = 30;
const DEFAULT_NO_CONFLICT_CONFIDENCE = 10;
const DEFAULT_RECENT_LOOKBACK_WINDOW = 20;
const DEFAULT_SHORT_MA_PERIOD = 5;
const DEFAULT_CONFLICT_STRENGTH = 0.5;

export class TrendConflictAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandlesForTrendConflict: number;
  private readonly maxConfidence: number;
  private readonly conflictConfidence: number;
  private readonly noConflictConfidence: number;
  private readonly recentLookbackWindow: number;
  private readonly shortMaPeriod: number;
  private readonly conflictStrength: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: TrendConflictAnalyzerConfigNew, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean') throw new Error('[TREND_CONFLICT] Missing or invalid: enabled (boolean)');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[TREND_CONFLICT] Missing or invalid: weight (0.0-1.0)');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[TREND_CONFLICT] Missing or invalid: priority (1-10)');

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForTrendConflict = config.minCandlesForTrendConflict ?? DEFAULT_MIN_CANDLES_FOR_TREND_CONFLICT;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.conflictConfidence = config.conflictConfidence ?? DEFAULT_CONFLICT_CONFIDENCE;
    this.noConflictConfidence = config.noConflictConfidence ?? DEFAULT_NO_CONFLICT_CONFIDENCE;
    this.recentLookbackWindow = config.recentLookbackWindow ?? DEFAULT_RECENT_LOOKBACK_WINDOW;
    this.shortMaPeriod = config.shortMaPeriod ?? DEFAULT_SHORT_MA_PERIOD;
    this.conflictStrength = config.conflictStrength ?? DEFAULT_CONFLICT_STRENGTH;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[TREND_CONFLICT] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[TREND_CONFLICT] Invalid candles input (must be array)');
    if (candles.length < this.minCandlesForTrendConflict) throw new Error(`[TREND_CONFLICT] Not enough candles. Need ${this.minCandlesForTrendConflict}, got ${candles.length}`);

    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') throw new Error(`[TREND_CONFLICT] Invalid candle at index ${i}`);
    }

    const conflict = this.detectConflict(candles);
    const direction = SignalDirectionEnum.HOLD;
    const confidence = conflict.hasConflict ? this.conflictConfidence : this.noConflictConfidence;

    const signal: AnalyzerSignal = { source: 'TREND_CONFLICT_ANALYZER_NEW', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectConflict(candles: Candle[]): { hasConflict: boolean; strength: number } {
    const recent = candles.slice(-this.recentLookbackWindow);
    const closes = recent.map(c => c.close);

    const shortMA = closes.slice(-this.shortMaPeriod).reduce((a, b) => a + b) / this.shortMaPeriod;
    const longMA = closes.reduce((a, b) => a + b) / closes.length;

    const hasConflict = (closes[closes.length - 1] > shortMA && longMA < shortMA) ||
                        (closes[closes.length - 1] < shortMA && longMA > shortMA);

    return { hasConflict, strength: hasConflict ? this.conflictStrength : 0 };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.TREND_CONFLICT;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForTrendConflict;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForTrendConflict;
  }

  /**
   * Get analyzer weight
   */
  getWeight(): number {
    return this.weight;
  }

  /**
   * Get analyzer priority
   */
  getPriority(): number {
    return this.priority;
  }

  /**
   * Get maximum confidence
   */
  getMaxConfidence(): number {
    return this.maxConfidence;
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
