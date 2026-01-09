import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';

export class DeltaAnalyzerNew {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew, private logger?: any) {
    if (typeof config.enabled !== 'boolean') throw new Error('[DELTA] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[DELTA] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[DELTA] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[DELTA] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[DELTA] Invalid candles input');
    if (candles.length < 15) throw new Error('[DELTA] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].volume !== 'number') throw new Error('[DELTA] Invalid candle');
    }

    const delta = this.calculateDelta(candles);
    const direction = delta.value > 0 ? SignalDirectionEnum.LONG : delta.value < 0 ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((0.1 + Math.abs(delta.value) * 0.85) * 100);
    const signal: AnalyzerSignal = { source: 'DELTA_ANALYZER', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private calculateDelta(candles: Candle[]): { value: number } {
    const recent = candles.slice(-10);
    let buyPressure = 0;
    let sellPressure = 0;

    for (let i = 0; i < recent.length - 1; i++) {
      const current = recent[i];
      const next = recent[i + 1];
      const mid = (current.high + current.low) / 2;
      const volume = next.volume || 0;

      if (next.close >= mid) buyPressure += volume;
      else sellPressure += volume;
    }

    const total = buyPressure + sellPressure;
    if (total === 0) return { value: 0 };
    return { value: (buyPressure - sellPressure) / total };
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
