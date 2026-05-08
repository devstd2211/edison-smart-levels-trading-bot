/**
 * CHOCH/BOS Analyzer NEW - with ConfigNew Support
 * Detects Change of Character (CHOCH) and Break of Structure (BOS)
 *
 * Signal Logic:
 * - BOS (Break of Structure): Price breaks key support/resistance = Signal
 * - CHOCH (Change of Character): Trend pattern changes = Signal
 * - No structure break: HOLD signal
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { ChochBosAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import type { LoggerService } from '../services/logger.service';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';

const DEFAULT_MIN_CANDLES_FOR_CHOCH_BOS = 30;
const DEFAULT_MIN_CONFIDENCE = 0.1;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_LOOKBACK_BARS = 20;
const DEFAULT_STRENGTH_MULTIPLIER = 10;

export class ChochBosAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandlesForChochBos: number;
  private readonly minConfidence: number;
  private readonly maxConfidence: number;
  private readonly lookbackBars: number;
  private readonly strengthMultiplier: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: ChochBosAnalyzerConfigNew, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean')
      throw new Error('[CHOCH_BOS] Missing or invalid: enabled (boolean)');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1)
      throw new Error('[CHOCH_BOS] Missing or invalid: weight (0.0-1.0)');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10)
      throw new Error('[CHOCH_BOS] Missing or invalid: priority (1-10)');

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForChochBos = config.minCandlesForChochBos ?? DEFAULT_MIN_CANDLES_FOR_CHOCH_BOS;
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.lookbackBars = config.lookbackBars ?? DEFAULT_LOOKBACK_BARS;
    this.strengthMultiplier = config.strengthMultiplier ?? DEFAULT_STRENGTH_MULTIPLIER;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[CHOCH_BOS] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[CHOCH_BOS] Invalid candles input (must be array)');
    if (candles.length < this.minCandlesForChochBos) throw new Error(`[CHOCH_BOS] Not enough candles. Need ${this.minCandlesForChochBos}, got ${candles.length}`);

    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].high !== 'number' || typeof candles[i].low !== 'number')
        throw new Error(`[CHOCH_BOS] Invalid candle at index ${i}`);
    }

    const structure = this.detectStructure(candles);
    const direction = structure.type === 'BULLISH_BOS' ? SignalDirectionEnum.LONG : structure.type === 'BEARISH_BOS' ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = structure.type === 'NONE' ? Math.round(this.minConfidence * 100) : Math.round((this.minConfidence + structure.strength * (this.maxConfidence - this.minConfidence)) * 100);

    const signal: AnalyzerSignal = {
      source: 'CHOCH_BOS_ANALYZER_NEW',
      direction,
      confidence,
      weight: this.weight,
      priority: this.priority,
      score: (confidence / 100) * this.weight,
    };

    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectStructure(candles: Candle[]): { type: 'NONE' | 'BULLISH_BOS' | 'BEARISH_BOS'; strength: number } {
    const lookback = Math.min(this.lookbackBars, candles.length - 1);
    const recent = candles.slice(-lookback);

    const lows = recent.map(c => c.low);
    const highs = recent.map(c => c.high);

    const lowestLow = Math.min(...lows.slice(0, -1));
    const highestHigh = Math.max(...highs.slice(0, -1));

    const current = candles[candles.length - 1];

    if (current.low < lowestLow) {
      return { type: 'BULLISH_BOS', strength: Math.min(1, Math.abs(current.low - lowestLow) / lowestLow * this.strengthMultiplier) };
    }
    if (current.high > highestHigh) {
      return { type: 'BEARISH_BOS', strength: Math.min(1, Math.abs(current.high - highestHigh) / highestHigh * this.strengthMultiplier) };
    }

    return { type: 'NONE', strength: 0 };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.CHOCH_BOS;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForChochBos;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForChochBos;
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
  getStateSnapshot() {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      lastSignal: this.lastSignal ? { ...this.lastSignal } : null,
      config: { weight: this.weight, priority: this.priority },
    };
  }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}

