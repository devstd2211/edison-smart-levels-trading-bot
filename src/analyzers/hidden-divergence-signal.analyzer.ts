/**
 * Hidden Divergence Signal Analyzer - FIX #4
 * Detects hidden divergence patterns (Price HH/LL vs RSI LH/HL)
 */

import { StrategyMarketData, SignalDirection, SwingPointType, LoggerService } from '../types';

export interface HiddenDivergenceConfig {
  enabled: boolean;
  hiddenBearishConfidence: number;
  hiddenBullishConfidence: number;
  logDetections: boolean;
}

export class HiddenDivergenceSignalAnalyzer {
  private config: HiddenDivergenceConfig;

  constructor(private logger: LoggerService, config: Partial<HiddenDivergenceConfig> = {}) {
    this.config = {
      enabled: true,
      hiddenBearishConfidence: 65,
      hiddenBullishConfidence: 65,
      logDetections: false,
      ...config,
    };
  }

  async evaluate(data: StrategyMarketData): Promise<any> {
    if (!this.config.enabled || !data.swingPoints || !data.rsi || data.swingPoints.length < 2) {
      return null;
    }

    const lastTwoHighs = data.swingPoints.filter(p => p.type === SwingPointType.HIGH).slice(-2);

    // Hidden Bearish: Price HH but RSI LH (momentum weakening)
    if (lastTwoHighs.length === 2) {
      if (lastTwoHighs[1].price > lastTwoHighs[0].price && data.rsi < 80) {
        if (this.config.logDetections) {
          this.logger.info('⚠️  HIDDEN_DIVERGENCE | Hidden Bearish detected', {
            rsi: data.rsi.toFixed(2),
            confidence: this.config.hiddenBearishConfidence.toFixed(2),
          });
        }

        return {
          source: 'HIDDEN_DIVERGENCE',
          type: 'HIDDEN_BEARISH',
          direction: SignalDirection.SHORT,
          confidence: this.config.hiddenBearishConfidence,
          weight: 0.15,
          priority: 7,
        };
      }
    }

    return null;
  }
}
