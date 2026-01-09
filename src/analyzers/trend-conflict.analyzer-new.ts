/**
 * Trend Conflict Analyzer NEW - with ConfigNew Support
 * Detects conflicts between different timeframes or indicators
 */

import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { SignalDirection } from '../types/enums';
import type { TrendConflictAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import type { LoggerService } from '../services/logger.service';

const MIN_CANDLES = 20;
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 0.95;

export class TrendConflictAnalyzerNew {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: TrendConflictAnalyzerConfigNew, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean') throw new Error('[TREND_CONFLICT] Missing or invalid: enabled (boolean)');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[TREND_CONFLICT] Missing or invalid: weight (0.0-1.0)');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[TREND_CONFLICT] Missing or invalid: priority (1-10)');

    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[TREND_CONFLICT] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[TREND_CONFLICT] Invalid candles input (must be array)');
    if (candles.length < MIN_CANDLES) throw new Error(`[TREND_CONFLICT] Not enough candles. Need ${MIN_CANDLES}, got ${candles.length}`);

    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') throw new Error(`[TREND_CONFLICT] Invalid candle at index ${i}`);
    }

    const conflict = this.detectConflict(candles);
    const direction = SignalDirectionEnum.HOLD;
    const confidence = conflict.hasConflict ? 30 : 10;

    const signal: AnalyzerSignal = { source: 'TREND_CONFLICT_ANALYZER', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private detectConflict(candles: Candle[]): { hasConflict: boolean; strength: number } {
    const recent = candles.slice(-20);
    const closes = recent.map(c => c.close);
    
    const shortMA = closes.slice(-5).reduce((a, b) => a + b) / 5;
    const longMA = closes.reduce((a, b) => a + b) / closes.length;
    
    const hasConflict = (closes[closes.length - 1] > shortMA && longMA < shortMA) || 
                        (closes[closes.length - 1] < shortMA && longMA > shortMA);

    return { hasConflict, strength: hasConflict ? 0.5 : 0 };
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
