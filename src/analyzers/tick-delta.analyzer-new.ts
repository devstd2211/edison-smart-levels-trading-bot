import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';

const DEFAULT_MIN_CANDLES_FOR_TICK_DELTA = 15;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_BASE_CONFIDENCE = 0.1;
const DEFAULT_CONFIDENCE_MULTIPLIER = 0.85;
const DEFAULT_LOOKBACK_WINDOW = 10;

export class TickDeltaAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly maxConfidence: number;
  private readonly baseConfidence: number;
  private readonly confidenceMultiplier: number;
  private readonly lookbackWindow: number;
  private readonly minCandlesForTickDelta: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew & { minCandlesForTickDelta?: number; maxConfidence?: number; baseConfidence?: number; confidenceMultiplier?: number; lookbackWindow?: number }, private logger?: any) {
    if (typeof config.enabled !== 'boolean') throw new Error('[TICK_DELTA] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[TICK_DELTA] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[TICK_DELTA] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForTickDelta = config.minCandlesForTickDelta ?? DEFAULT_MIN_CANDLES_FOR_TICK_DELTA;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.baseConfidence = config.baseConfidence ?? DEFAULT_BASE_CONFIDENCE;
    this.confidenceMultiplier = config.confidenceMultiplier ?? DEFAULT_CONFIDENCE_MULTIPLIER;
    this.lookbackWindow = config.lookbackWindow ?? DEFAULT_LOOKBACK_WINDOW;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[TICK_DELTA] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[TICK_DELTA] Invalid candles input');
    if (candles.length < this.minCandlesForTickDelta) throw new Error('[TICK_DELTA] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') throw new Error('[TICK_DELTA] Invalid candle');
    }

    const delta = this.calculateDelta(candles);
    const direction = delta.positive ? SignalDirectionEnum.LONG : delta.negative ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((this.baseConfidence + Math.abs(delta.value) * this.confidenceMultiplier) * 100);
    const signal: AnalyzerSignal = { source: 'TICK_DELTA_ANALYZER_NEW', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private calculateDelta(candles: Candle[]): { value: number; positive: boolean; negative: boolean } {
    let delta = 0;
    const recent = candles.slice(-this.lookbackWindow);

    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i + 1].close > recent[i].close) delta += 1;
      else delta -= 1;
    }

    const normalized = delta / this.lookbackWindow;
    return { value: normalized, positive: delta > 0, negative: delta < 0 };
  }

  // ===== INTERFACE IMPLEMENTATION (IAnalyzer) =====
  getType(): string { return AnalyzerType.TICK_DELTA; }
  isReady(candles: Candle[]): boolean { return candles && Array.isArray(candles) && candles.length >= this.minCandlesForTickDelta; }
  getMinCandlesRequired(): number { return this.minCandlesForTickDelta; }
  getWeight(): number { return this.weight; }
  getPriority(): number { return this.priority; }
  getMaxConfidence(): number { return this.maxConfidence; }
  isEnabled(): boolean { return this.enabled; }

  // ===== EXISTING METHODS =====
  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}

