import type { Candle } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';
import type { LevelAnalyzerConfigNew } from '../types/config-new.types';
import { SignalDirection as SignalDirectionEnum } from '../types/enums';
import type { LoggerService } from '../services/logger.service';

const MIN_CANDLES = 30;
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 0.95;

export class LevelAnalyzerNew {
  private readonly enabled: boolean;
  private readonly weight: number;
  private readonly priority: number;
  private lastSignal: AnalyzerSignal | null = null;
  private initialized: boolean = false;

  constructor(config: LevelAnalyzerConfigNew, private logger?: LoggerService) {
    if (typeof config.enabled !== 'boolean') throw new Error('[LEVEL] Missing or invalid: enabled');
    if (typeof config.weight !== 'number' || config.weight < 0 || config.weight > 1) throw new Error('[LEVEL] Missing or invalid: weight');
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) throw new Error('[LEVEL] Missing or invalid: priority');
    this.enabled = config.enabled;
    this.weight = config.weight;
    this.priority = config.priority;
  }

  analyze(candles: Candle[]): AnalyzerSignal {
    if (!this.enabled) throw new Error('[LEVEL] Analyzer is disabled');
    if (!Array.isArray(candles)) throw new Error('[LEVEL] Invalid candles input');
    if (candles.length < MIN_CANDLES) throw new Error(`[LEVEL] Not enough candles`);
    for (let i = 0; i < candles.length; i++) {
      if (!candles[i] || typeof candles[i].close !== 'number') throw new Error(`[LEVEL] Invalid candle`);
    }

    const level = this.analyzeLevels(candles);
    const direction = level.nearSupport ? SignalDirectionEnum.LONG : level.nearResistance ? SignalDirectionEnum.SHORT : SignalDirectionEnum.HOLD;
    const confidence = Math.round((MIN_CONFIDENCE + level.strength * (MAX_CONFIDENCE - MIN_CONFIDENCE)) * 100);
    const signal: AnalyzerSignal = { source: 'LEVEL_ANALYZER', direction, confidence, weight: this.weight, priority: this.priority, score: (confidence / 100) * this.weight };
    this.lastSignal = signal;
    this.initialized = true;
    return signal;
  }

  private analyzeLevels(candles: Candle[]): { nearSupport: boolean; nearResistance: boolean; strength: number } {
    const recent = candles.slice(-30);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    const support = Math.min(...lows);
    const resistance = Math.max(...highs);
    const current = candles[candles.length - 1].close;
    const range = resistance - support;
    return { nearSupport: current - support < range * 0.15, nearResistance: resistance - current < range * 0.15, strength: Math.min(1, Math.max(current - support, resistance - current) / range) };
  }

  getLastSignal(): AnalyzerSignal | null { return this.lastSignal; }
  getState() { return { enabled: this.enabled, initialized: this.initialized, lastSignal: this.lastSignal, config: { weight: this.weight, priority: this.priority } }; }
  reset(): void { this.lastSignal = null; this.initialized = false; }
  isEnabled(): boolean { return this.enabled; }
  getConfig() { return { enabled: this.enabled, weight: this.weight, priority: this.priority }; }
}
