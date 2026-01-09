import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';

export class LiquidityZoneAnalyzerNew {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew, private logger?: any) {
    if (typeof config.enabled !== 'boolean') throw new Error('[LIQUIDITY_ZONE] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[LIQUIDITY_ZONE] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[LIQUIDITY_ZONE] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[LIQUIDITY_ZONE] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[LIQUIDITY_ZONE] Invalid candles input');
    if (candles.length < 25) throw new Error('[LIQUIDITY_ZONE] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') throw new Error('[LIQUIDITY_ZONE] Invalid candle');
    }

    const zone = this.detectZone(candles);
    const direction = zone.hasHigh ? SignalDirectionEnum.SHORT : zone.hasLow ? SignalDirectionEnum.LONG : SignalDirectionEnum.HOLD;
    const confidence = Math.round((0.1 + zone.strength * 0.85) * 100);
    const signal: AnalyzerSignal = { source: 'LIQUIDITY_ZONE_ANALYZER', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectZone(candles: Candle[]): { hasHigh: boolean; hasLow: boolean; strength: number } {
    const recent = candles.slice(-30);
    const highVolume = recent.filter(c => (c.volume || 0) > recent.reduce((s, x) => s + (x.volume || 0), 0) / recent.length * 1.5);
    const highVol = highVolume.length > 5;
    return { hasHigh: highVol, hasLow: highVol, strength: highVolume.length / recent.length };
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
