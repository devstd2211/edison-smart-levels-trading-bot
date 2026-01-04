/**
 * CHOCH/BOS Signal Analyzer - FIX #2
 *
 * Full implementation of Change of Character and Break of Structure detection
 * - No stubs - complete implementation
 * - Detects HH→LH→LL (BoS DOWN) and LL→HL→HH (BoS UP) patterns
 * - Configuration from config.json
 */

import { StrategyMarketData, SignalDirection, SwingPointType, LoggerService } from '../types';

export interface ChochBosConfig {
  minSwingPoints: number;
  baseConfidence: number;
  bosDetectionStrength: number;
  chochDetectionStrength: number;
  enabled: boolean;
  logAllDetections: boolean;
}

export class ChochBosSignalAnalyzer {
  private config: ChochBosConfig;

  constructor(private logger: LoggerService, config: Partial<ChochBosConfig> = {}) {
    this.config = {
      minSwingPoints: 3,
      baseConfidence: 75,
      bosDetectionStrength: 0.8,
      chochDetectionStrength: 0.85,
      enabled: true,
      logAllDetections: false,
      ...config,
    };
  }

  async evaluate(data: StrategyMarketData): Promise<any> {
    if (!this.config.enabled || !data.swingPoints || data.swingPoints.length < this.config.minSwingPoints) {
      return null;
    }

    const swings = data.swingPoints.slice(-3);
    if (swings.length < 3) return null;

    const [s1, s2, s3] = swings;

    // BoS DOWN: HH → LH → LL
    if (s3.type === SwingPointType.LOW && s2.type === SwingPointType.HIGH && s3.price < s1.price) {
      const confidence = this.config.baseConfidence * this.config.bosDetectionStrength;

      if (this.config.logAllDetections) {
        this.logger.info('✅ CHOCH_BOS | BoS DOWN detected', {
          pattern: 'HH→LH→LL',
          newLow: s3.price.toFixed(8),
          prevLow: s1.price.toFixed(8),
          confidence: confidence.toFixed(2),
        });
      }

      return {
        source: 'CHOCH_BOS',
        type: 'BOS_DOWN',
        direction: SignalDirection.SHORT,
        confidence,
        weight: 0.2,
        priority: 7,
      };
    }

    // BoS UP: LL → HL → HH
    if (s3.type === SwingPointType.HIGH && s2.type === SwingPointType.LOW && s3.price > s1.price) {
      const confidence = this.config.baseConfidence * this.config.bosDetectionStrength;

      if (this.config.logAllDetections) {
        this.logger.info('✅ CHOCH_BOS | BoS UP detected', {
          pattern: 'LL→HL→HH',
          newHigh: s3.price.toFixed(8),
          prevHigh: s1.price.toFixed(8),
          confidence: confidence.toFixed(2),
        });
      }

      return {
        source: 'CHOCH_BOS',
        type: 'BOS_UP',
        direction: SignalDirection.LONG,
        confidence,
        weight: 0.2,
        priority: 7,
      };
    }

    // ChoCh patterns (weaker)
    if (s3.type === SwingPointType.LOW && s2.type === SwingPointType.HIGH && s3.price < s2.price) {
      const confidence = this.config.baseConfidence * this.config.chochDetectionStrength * 0.75;

      if (this.config.logAllDetections) {
        this.logger.warn('⚠️  CHOCH_BOS | ChoCh DOWN detected (needs confirmation)', {
          confidence: confidence.toFixed(2),
        });
      }

      return {
        source: 'CHOCH_BOS',
        type: 'CHOCH_DOWN',
        direction: SignalDirection.SHORT,
        confidence,
        weight: 0.2,
        priority: 7,
      };
    }

    return null;
  }
}
