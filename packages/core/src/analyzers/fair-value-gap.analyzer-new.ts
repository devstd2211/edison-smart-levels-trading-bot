import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';
import type { LoggerService } from '../services/logger.service';

const DEFAULT_MIN_CANDLES_FOR_FAIR_VALUE_GAP = 25;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_BASE_CONFIDENCE = 0.1;
const DEFAULT_CONFIDENCE_MULTIPLIER = 0.85;

export class FairValueGapAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandlesForFairValueGap: number;
  private readonly maxConfidence: number;
  private readonly baseConfidence: number;
  private readonly confidenceMultiplier: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew & { minCandlesForFairValueGap?: number; maxConfidence?: number; baseConfidence?: number; confidenceMultiplier?: number }, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean') throw new Error('[FVG] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[FVG] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[FVG] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForFairValueGap = config.minCandlesForFairValueGap ?? DEFAULT_MIN_CANDLES_FOR_FAIR_VALUE_GAP;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.baseConfidence = config.baseConfidence ?? DEFAULT_BASE_CONFIDENCE;
    this.confidenceMultiplier = config.confidenceMultiplier ?? DEFAULT_CONFIDENCE_MULTIPLIER;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[FVG] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[FVG] Invalid candles input');
    if (candles.length < this.minCandlesForFairValueGap) throw new Error('[FVG] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].high !== 'number' || typeof candles[i].low !== 'number') throw new Error('[FVG] Invalid candle');
    }

    const fvg = this.detectFVG(candles);
    const direction = fvg.type === 'BULLISH' ? SignalDirectionEnum.LONG : fvg.type === 'BEARISH' ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((this.baseConfidence + fvg.strength * this.confidenceMultiplier) * 100);
    const signal: AnalyzerSignal = { source: 'FAIR_VALUE_GAP_ANALYZER_NEW', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectFVG(candles: Candle[]): { type: 'BULLISH' | 'BEARISH' | 'NONE'; strength: number } {
    if (candles.length < 3) return { type: 'NONE', strength: 0 };
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];

    if (c1.high < c2.low) return { type: 'BULLISH', strength: Math.min(1, (c2.low - c1.high) / c1.high * 100) };
    if (c1.low > c2.high) return { type: 'BEARISH', strength: Math.min(1, (c1.low - c2.high) / c1.high * 100) };
    return { type: 'NONE', strength: 0 };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.FAIR_VALUE_GAP;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForFairValueGap;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForFairValueGap;
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
  getStateSnapshot(): {
    enabled: boolean;
    initialized: boolean;
    lastSignal: AnalyzerSignal | null;
    config: { weight: number; priority: number };
  } {
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

