/**
 * Wick Signal Analyzer - FIX #5
 * Adaptive wick age handling for rejection signals
 */

import { StrategyMarketData, SignalDirection, LoggerService } from '../types';
import { WICK_CANDLE_INTERVAL_MS } from '../constants/technical.constants';

export interface WickSignalConfig {
  enabled: boolean;
  baseConfidence: number;
  maxConfidence: number;
  rejectionThresholdPercent: number;
  adaptiveAging: 'enabled' | 'disabled';
  currentCandlePercent: number;
  previousCandlePercent: number;
  twoThreeCandlesPercent: number;
  logWickAge: boolean;
}

export class WickSignalAnalyzer {
  private config: WickSignalConfig;

  constructor(private logger: LoggerService, config: Partial<WickSignalConfig> = {}) {
    this.config = {
      enabled: true,
      baseConfidence: 50,
      maxConfidence: 80,
      rejectionThresholdPercent: 40,
      adaptiveAging: 'disabled',
      currentCandlePercent: 100,
      previousCandlePercent: 70,
      twoThreeCandlesPercent: 30,
      logWickAge: false,
      ...config,
    };
  }

  async evaluate(data: StrategyMarketData): Promise<any> {
    if (!this.config.enabled || !data.candles || data.candles.length < 2) return null;

    const current = data.candles[data.candles.length - 1];
    const range = current.high - current.low;
    if (range === 0) return null;

    const wickPercent = (current.high - current.open) / range;
    const threshold = this.config.rejectionThresholdPercent / 100;

    if (wickPercent < threshold) return null;

    const ageConfidence = this.getWickAgeConfidence(data);
    if (ageConfidence === 0) {
      if (this.config.logWickAge) {
        this.logger.debug('⛔ WICK_SIGNAL | Wick too old - BLOCKED');
      }
      return null;
    }

    if (current.close >= current.open) return null; // Not bearish

    const confidence = Math.min(this.config.baseConfidence * ageConfidence, this.config.maxConfidence);

    if (this.config.logWickAge) {
      this.logger.debug('✅ WICK_SIGNAL | Rejection wick detected', {
        ageMultiplier: ageConfidence.toFixed(2),
        confidence: confidence.toFixed(2),
      });
    }

    return {
      source: 'WICK_SIGNAL',
      direction: SignalDirection.SHORT,
      confidence,
      weight: 0.12,
      priority: 7,
    };
  }

  private getWickAgeConfidence(data: StrategyMarketData): number {
    if (this.config.adaptiveAging !== 'enabled' || !data.candles || data.candles.length < 2) {
      return 1.0;
    }

    const now = Date.now();
    const lastCandle = data.candles[data.candles.length - 1];
    const prevCandle = data.candles[data.candles.length - 2];
    const timeSincePrev = now - (prevCandle.timestamp || 0);

    if (timeSincePrev < this.config.currentCandlePercent) {
      return this.config.currentCandlePercent / 100;
    } else if (timeSincePrev < WICK_CANDLE_INTERVAL_MS * 1.5) {
      return this.config.previousCandlePercent / 100;
    } else if (timeSincePrev < WICK_CANDLE_INTERVAL_MS * 3.5) {
      return this.config.twoThreeCandlesPercent / 100;
    }

    return 0;
  }
}
