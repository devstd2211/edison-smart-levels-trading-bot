import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer.interface';
import { AnalyzerType } from '../types/analyzer-type.enum';

// Default configuration values
const DEFAULT_MIN_CANDLES = 15;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_BASE_CONFIDENCE = 0.1;
const DEFAULT_CONFIDENCE_MULTIPLIER = 0.85;
const DEFAULT_RECENT_WINDOW_SIZE = 8;

export class OrderFlowAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandles: number;
  private readonly maxConfidence: number;
  private readonly baseConfidence: number;
  private readonly confidenceMultiplier: number;
  private readonly recentWindowSize: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(
    config: BreakoutAnalyzerConfigNew & {
      minCandles?: number;
      maxConfidence?: number;
      baseConfidence?: number;
      confidenceMultiplier?: number;
      recentWindowSize?: number;
    },
    private logger?: any
  ) {
    if (typeof config.enabled !== 'boolean') throw new Error('[ORDER_FLOW] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[ORDER_FLOW] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[ORDER_FLOW] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandles = config.minCandles ?? DEFAULT_MIN_CANDLES;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.baseConfidence = config.baseConfidence ?? DEFAULT_BASE_CONFIDENCE;
    this.confidenceMultiplier = config.confidenceMultiplier ?? DEFAULT_CONFIDENCE_MULTIPLIER;
    this.recentWindowSize = config.recentWindowSize ?? DEFAULT_RECENT_WINDOW_SIZE;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[ORDER_FLOW] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[ORDER_FLOW] Invalid candles input');
    if (candles.length < this.minCandles) throw new Error('[ORDER_FLOW] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') throw new Error('[ORDER_FLOW] Invalid candle');
    }

    const flow = this.analyzeFlow(candles);
    const direction = flow.type === 'BULLISH' ? SignalDirectionEnum.LONG : flow.type === 'BEARISH' ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((this.baseConfidence + flow.strength * this.confidenceMultiplier) * 100);
    const signal: AnalyzerSignal = { source: 'ORDER_FLOW_ANALYZER_NEW', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private analyzeFlow(candles: Candle[]): { type: 'BULLISH' | 'BEARISH' | 'NONE'; strength: number } {
    const recent = candles.slice(-this.recentWindowSize);
    let bullishVol = 0;
    let bearishVol = 0;

    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i + 1].close > recent[i].close) bullishVol += recent[i + 1].volume || 0;
      else bearishVol += recent[i + 1].volume || 0;
    }

    const total = bullishVol + bearishVol;
    if (total === 0) return { type: 'NONE', strength: 0 };

    if (bullishVol > bearishVol) return { type: 'BULLISH', strength: bullishVol / total };
    if (bearishVol > bullishVol) return { type: 'BEARISH', strength: bearishVol / total };
    return { type: 'NONE', strength: 0 };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.ORDER_FLOW;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandles;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandles;
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
