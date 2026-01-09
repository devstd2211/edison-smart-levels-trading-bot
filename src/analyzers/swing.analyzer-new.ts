/**
 * Swing Analyzer NEW - with ConfigNew Support
 * Detects swing highs and lows patterns
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { SwingAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import type { LoggerService } from '../services/logger.service';

const MIN_CANDLES = 25;
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 0.95;

export class SwingAnalyzerNew {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: SwingAnalyzerConfigNew, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean') throw new Error('[SWING] Missing or invalid: enabled (boolean)');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[SWING] Missing or invalid: weight (0.0-1.0)');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[SWING] Missing or invalid: priority (1-10)');

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[SWING] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[SWING] Invalid candles input (must be array)');
    if (candles.length < MIN_CANDLES) throw new Error(`[SWING] Not enough candles. Need ${MIN_CANDLES}, got ${candles.length}`);

    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].high !== 'number' || typeof candles[i].low !== 'number')
        throw new Error(`[SWING] Invalid candle at index ${i}`);
    }

    const swing = this.detectSwing(candles);
    const direction = swing.type === 'HIGH' ? SignalDirectionEnum.SHORT : swing.type === 'LOW' ? SignalDirectionEnum.LONG : SignalDirectionEnum.HOLD;
    const confidence = swing.type === 'NONE' ? Math.round(MIN_CONFIDENCE * 100) : Math.round((MIN_CONFIDENCE + swing.strength * (MAX_CONFIDENCE - MIN_CONFIDENCE)) * 100);

    const signal: AnalyzerSignal = { source: 'SWING_ANALYZER', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectSwing(candles: Candle[]): { type: 'HIGH' | 'LOW' | 'NONE'; strength: number } {
    const current = candles[candles.length - 1];
    const prev1 = candles[candles.length - 2];
    const prev2 = candles[candles.length - 3] || prev1;

    if (current.high > prev1.high && prev1.high > prev2.high) {
      return { type: 'HIGH', strength: Math.min(1, (current.high - prev2.high) / prev2.high * 10) };
    }
    if (current.low < prev1.low && prev1.low < prev2.low) {
      return { type: 'LOW', strength: Math.min(1, (prev2.low - current.low) / prev2.low * 10) };
    }

    return { type: 'NONE', strength: 0 };
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
