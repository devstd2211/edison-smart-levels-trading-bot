/**
 * Short Entry Validator - FIX #8
 * Stricter requirements for SHORT entries
 */

import { StrategyMarketData, SignalDirection, LoggerService } from '../../types/legacy';
import { ICONS } from '../../cli/cli-runtime';

export interface ShortValidatorConfig {
  enabled: boolean;
  minConfidenceShort: number;
  minConfidenceLong: number;
  requireMomentumConfirmation: boolean;
  maxRsiForShort: number;
  logValidations: boolean;
}

interface ShortValidationSignal {
  direction: SignalDirection;
  confidence: number;
}

export class ShortEntryValidator {
  private config: ShortValidatorConfig;

  constructor(private logger: LoggerService, config: Partial<ShortValidatorConfig> = {}) {
    this.config = {
      enabled: true,
      minConfidenceShort: 0.75,
      minConfidenceLong: 0.70,
      requireMomentumConfirmation: true,
      maxRsiForShort: 60,
      logValidations: false,
      ...config,
    };
  }

  validate(signal: ShortValidationSignal, data: StrategyMarketData): { valid: boolean; adjustedConfidence: number } {
    if (!this.config.enabled || signal.direction !== SignalDirection.SHORT) {
      return { valid: true, adjustedConfidence: signal.confidence };
    }

    let confidence = signal.confidence;

    // Check minimum confidence
    if (confidence < this.config.minConfidenceShort) {
      if (this.config.logValidations) {
        this.logger.debug(`${ICONS.no_entry} SHORT_VALIDATOR | Confidence too low`);
      }
      return { valid: false, adjustedConfidence: 0 };
    }

    // Check momentum
    if (this.config.requireMomentumConfirmation && data.rsi && data.rsi > this.config.maxRsiForShort) {
      confidence *= 0.8; // Reduce by 20%

      if (this.config.logValidations) {
        this.logger.warn(`${ICONS.warning}  SHORT_VALIDATOR | High RSI - confidence reduced`, {
          rsi: data.rsi.toFixed(2),
          penalty: 0.8,
        });
      }
    }

    if (confidence < this.config.minConfidenceShort) {
      return { valid: false, adjustedConfidence: 0 };
    }

    return { valid: true, adjustedConfidence: confidence };
  }
}
