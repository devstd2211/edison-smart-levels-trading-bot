import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import { IAnalyzer } from '../types/analyzer.interface';
import { AnalyzerType } from '../types/analyzer-type.enum';

const DEFAULT_MIN_CANDLES_FOR_FOOTPRINT = 25;
const DEFAULT_MAX_CONFIDENCE = 0.95;
const DEFAULT_BASE_CONFIDENCE = 0.1;
const DEFAULT_CONFIDENCE_MULTIPLIER = 0.85;
const DEFAULT_LOOKBACK_WINDOW = 10;
const DEFAULT_VOLUME_MULTIPLIER_THRESHOLD = 1.5;
const DEFAULT_STRENGTH_DIVISOR = 3;

export class FootprintAnalyzerNew implements IAnalyzer {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private readonly minCandlesForFootprint: number;
  private readonly maxConfidence: number;
  private readonly baseConfidence: number;
  private readonly confidenceMultiplier: number;
  private readonly lookbackWindow: number;
  private readonly volumeMultiplierThreshold: number;
  private readonly strengthDivisor: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew & {
    minCandlesForFootprint?: number;
    maxConfidence?: number;
    baseConfidence?: number;
    confidenceMultiplier?: number;
    lookbackWindow?: number;
    volumeMultiplierThreshold?: number;
    strengthDivisor?: number;
  }, private logger?: any) {
    if (typeof config.enabled !== 'boolean') throw new Error('[FOOTPRINT] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[FOOTPRINT] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[FOOTPRINT] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
    this.minCandlesForFootprint = config.minCandlesForFootprint ?? DEFAULT_MIN_CANDLES_FOR_FOOTPRINT;
    this.maxConfidence = config.maxConfidence ?? DEFAULT_MAX_CONFIDENCE;
    this.baseConfidence = config.baseConfidence ?? DEFAULT_BASE_CONFIDENCE;
    this.confidenceMultiplier = config.confidenceMultiplier ?? DEFAULT_CONFIDENCE_MULTIPLIER;
    this.lookbackWindow = config.lookbackWindow ?? DEFAULT_LOOKBACK_WINDOW;
    this.volumeMultiplierThreshold = config.volumeMultiplierThreshold ?? DEFAULT_VOLUME_MULTIPLIER_THRESHOLD;
    this.strengthDivisor = config.strengthDivisor ?? DEFAULT_STRENGTH_DIVISOR;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[FOOTPRINT] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[FOOTPRINT] Invalid candles input');
    if (candles.length < this.minCandlesForFootprint) throw new Error('[FOOTPRINT] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') throw new Error('[FOOTPRINT] Invalid candle');
    }

    const fp = this.analyzeFootprint(candles);
    const direction = fp.type === 'BULLISH' ? SignalDirectionEnum.LONG : fp.type === 'BEARISH' ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((this.baseConfidence + fp.strength * this.confidenceMultiplier) * 100);
    const signal: AnalyzerSignal = { source: 'FOOTPRINT_ANALYZER_NEW', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private analyzeFootprint(candles: Candle[]): { type: 'BULLISH' | 'BEARISH' | 'NONE'; strength: number } {
    const recent = candles.slice(-this.lookbackWindow);
    const volumes = recent.map(c => c.volume || 0);
    const avgVol = volumes.reduce((a, b) => a + b) / volumes.length;
    const lastVol = volumes[volumes.length - 1];

    if (lastVol > avgVol * this.volumeMultiplierThreshold && candles[candles.length - 1].close > candles[candles.length - 2].close) {
      return { type: 'BULLISH', strength: Math.min(1, lastVol / avgVol / this.strengthDivisor) };
    }
    if (lastVol > avgVol * this.volumeMultiplierThreshold && candles[candles.length - 1].close < candles[candles.length - 2].close) {
      return { type: 'BEARISH', strength: Math.min(1, lastVol / avgVol / this.strengthDivisor) };
    }
    return { type: 'NONE', strength: 0 };
  }

  /**
   * Get analyzer type
   */
  getType(): string {
    return AnalyzerType.FOOTPRINT;
  }

  /**
   * Check if analyzer has enough data
   */
  isReady(candles: Candle[]): boolean {
    return candles && Array.isArray(candles) && candles.length >= this.minCandlesForFootprint;
  }

  /**
   * Get minimum candles required
   */
  getMinCandlesRequired(): number {
    return this.minCandlesForFootprint;
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
