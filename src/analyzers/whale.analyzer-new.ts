import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer';
import { AnalyzerType } from '../types/analyzer';

// Default configuration constants
const DEFAULT_MIN_CANDLES_FOR_WHALE = 25;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_BASE_CONFIDENCE = 0.1;
const DEFAULT_STRENGTH_MULTIPLIER = 0.85;
const DEFAULT_RECENT_CANDLES_WINDOW = 30;
const DEFAULT_VOLUME_THRESHOLD_MULTIPLIER = 3;
const DEFAULT_STRENGTH_DENOMINATOR = 5;

export class WhaleAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandlesForWhale: number;
  private readonly maxConfidence: number;
  private readonly baseConfidence: number;
  private readonly strengthMultiplier: number;
  private readonly recentCandlesWindow: number;
  private readonly volumeThresholdMultiplier: number;
  private readonly strengthDenominator: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(
    config: BreakoutAnalyzerConfigNew & {
      minCandlesForWhale?: number;
      maxConfidence?: number;
      baseConfidence?: number;
      strengthMultiplier?: number;
      recentCandlesWindow?: number;
      volumeThresholdMultiplier?: number;
      strengthDenominator?: number;
    },
    private logger?: any
  ) {
    if (typeof config.enabled !== 'boolean') throw new Error('[WHALE] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[WHALE] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[WHALE] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForWhale = config.minCandlesForWhale ?? DEFAULT_MIN_CANDLES_FOR_WHALE;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.baseConfidence = config.baseConfidence ?? DEFAULT_BASE_CONFIDENCE;
    this.strengthMultiplier = config.strengthMultiplier ?? DEFAULT_STRENGTH_MULTIPLIER;
    this.recentCandlesWindow = config.recentCandlesWindow ?? DEFAULT_RECENT_CANDLES_WINDOW;
    this.volumeThresholdMultiplier = config.volumeThresholdMultiplier ?? DEFAULT_VOLUME_THRESHOLD_MULTIPLIER;
    this.strengthDenominator = config.strengthDenominator ?? DEFAULT_STRENGTH_DENOMINATOR;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[WHALE] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[WHALE] Invalid candles input');
    if (candles.length < this.minCandlesForWhale) throw new Error('[WHALE] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') throw new Error('[WHALE] Invalid candle');
    }

    const whale = this.detectWhale(candles);
    const direction = whale.type === 'BULLISH' ? SignalDirectionEnum.LONG : whale.type === 'BEARISH' ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((this.baseConfidence + whale.strength * this.strengthMultiplier) * 100);
    const signal: AnalyzerSignal = { source: 'WHALE_ANALYZER_NEW', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectWhale(candles: Candle[]): { type: 'BULLISH' | 'BEARISH' | 'NONE'; strength: number } {
    const recent = candles.slice(-this.recentCandlesWindow);
    const volumes = recent.map(c => c.volume || 0);
    const avgVol = volumes.reduce((a, b) => a + b) / volumes.length;
    const maxVol = Math.max(...volumes);

    if (maxVol > avgVol * this.volumeThresholdMultiplier) {
      const maxIdx = volumes.indexOf(maxVol);
      const candle = recent[maxIdx];
      if (candle.close > candle.open) return { type: 'BULLISH', strength: Math.min(1, (maxVol - avgVol) / avgVol / this.strengthDenominator) };
      else return { type: 'BEARISH', strength: Math.min(1, (maxVol - avgVol) / avgVol / this.strengthDenominator) };
    }
    return { type: 'NONE', strength: 0 };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.WHALE;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForWhale;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForWhale;
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

