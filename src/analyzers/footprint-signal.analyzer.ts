/**
 * Footprint Signal Analyzer - FIX #3
 * Resistance rejection mode for SHORT signals
 */

import { StrategyMarketData, SignalDirection, LoggerService } from '../types';

export interface FootprintSignalConfig {
  enabled: boolean;
  resistanceRejectionConfidence: number;
  requireRejectWickPercent: number;
  minClosePositionPercent: number;
  minBodyToRangeRatio: number;
  logRejectionSignals: boolean;
}

export class FootprintSignalAnalyzer {
  private config: FootprintSignalConfig;

  constructor(private logger: LoggerService, config: Partial<FootprintSignalConfig> = {}) {
    this.config = {
      enabled: true,
      resistanceRejectionConfidence: 70,
      requireRejectWickPercent: 95,
      minClosePositionPercent: 70,
      minBodyToRangeRatio: 0.6,
      logRejectionSignals: false,
      ...config,
    };
  }

  async evaluate(data: StrategyMarketData): Promise<any> {
    if (!this.config.enabled || !data.candles || data.candles.length < 2) return null;

    const current = data.candles[data.candles.length - 1];
    const range = current.high - current.low;
    if (range === 0) return null;

    const closePos = (current.close - current.low) / range;
    const minClosePos = this.config.minClosePositionPercent / 100;
    const bodyRatio = Math.abs(current.close - current.open) / range;
    const wickPercent = (current.high - current.open) / range;
    const wickThreshold = this.config.requireRejectWickPercent / 100;

    const closeNearTop = closePos > minClosePos;
    const isBearish = current.close < current.open;
    const hasGoodBody = bodyRatio > this.config.minBodyToRangeRatio;
    const hasRejectWick = wickPercent >= wickThreshold;

    if (closeNearTop && isBearish && hasGoodBody && hasRejectWick) {
      if (this.config.logRejectionSignals) {
        this.logger.info('✅ FOOTPRINT_SIGNAL | Resistance rejection detected', {
          closePos: closePos.toFixed(3),
          confidence: this.config.resistanceRejectionConfidence.toFixed(2),
        });
      }

      return {
        source: 'FOOTPRINT_SIGNAL',
        direction: SignalDirection.SHORT,
        confidence: this.config.resistanceRejectionConfidence,
        weight: 0.18,
        priority: 9,
      };
    }

    return null;
  }
}
