import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { BreakoutAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';

export class OrderBlockAnalyzerNew {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: BreakoutAnalyzerConfigNew, private logger?: any) {
    if (typeof config.enabled !== 'boolean') throw new Error('[ORDER_BLOCK] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[ORDER_BLOCK] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[ORDER_BLOCK] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[ORDER_BLOCK] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[ORDER_BLOCK] Invalid candles input');
    if (candles.length < 25) throw new Error('[ORDER_BLOCK] Not enough candles');
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') throw new Error('[ORDER_BLOCK] Invalid candle');
    }

    const block = this.detectBlock(candles);
    const direction = block.type === 'BULLISH' ? SignalDirectionEnum.LONG : block.type === 'BEARISH' ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((0.1 + block.strength * 0.85) * 100);
    const signal: AnalyzerSignal = { source: 'ORDER_BLOCK_ANALYZER', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectBlock(candles: Candle[]): { type: 'BULLISH' | 'BEARISH' | 'NONE'; strength: number } {
    const recent = candles.slice(-5);
    const bodySize = (c: Candle) => Math.abs(c.close - c.open);
    const largeBody = recent.filter(c => bodySize(c) > bodySize(recent[0]) * 0.8);

    if (largeBody.length >= 2) {
      const lastClose = candles[candles.length - 1].close;
      const avgHigh = largeBody.reduce((s, c) => s + c.high, 0) / largeBody.length;
      return lastClose < avgHigh ? { type: 'BULLISH', strength: 0.6 } : { type: 'BEARISH', strength: 0.6 };
    }
    return { type: 'NONE', strength: 0 };
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
