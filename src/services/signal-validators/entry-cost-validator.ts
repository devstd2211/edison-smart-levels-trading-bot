/**
 * Entry Cost Validator - FIX #9
 * Ensures minimum analyzer consensus before entry
 */

import { SignalDirection, LoggerService } from '../../types';

export interface EntryCostValidatorConfig {
  enabled: boolean;
  minAnalyzersForShort: number;
  minAnalyzersForLong: number;
  maxSilentPercentShort: number;
  maxSilentPercentLong: number;
  logDecisions: boolean;
}

export class EntryCostValidator {
  private config: EntryCostValidatorConfig;

  constructor(private logger: LoggerService, config: Partial<EntryCostValidatorConfig> = {}) {
    this.config = {
      enabled: true,
      minAnalyzersForShort: 2,
      minAnalyzersForLong: 2,
      maxSilentPercentShort: 40,
      maxSilentPercentLong: 50,
      logDecisions: false,
      ...config,
    };
  }

  validate(
    signal: any,
    totalAnalyzers: number,
    votingAnalyzers: number
  ): { valid: boolean; reason: string } {
    if (!this.config.enabled) {
      return { valid: true, reason: 'VALIDATOR_DISABLED' };
    }

    const isShort = signal.direction === SignalDirection.SHORT;
    const minRequired = isShort ? this.config.minAnalyzersForShort : this.config.minAnalyzersForLong;
    const maxSilentPercent = isShort ? this.config.maxSilentPercentShort : this.config.maxSilentPercentLong;

    // Check minimum voting analyzers
    if (votingAnalyzers < minRequired) {
      if (this.config.logDecisions) {
        this.logger.warn('🚫 ENTRY_COST | Insufficient analyzer consensus', {
          direction: isShort ? 'SHORT' : 'LONG',
          votingAnalyzers,
          minRequired,
          reason: 'NOT_ENOUGH_VOTES',
        });
      }
      return {
        valid: false,
        reason: `Only ${votingAnalyzers} analyzer(s) voting, need ${minRequired}`,
      };
    }

    // Check maximum silent analyzers percentage
    const silentAnalyzers = totalAnalyzers - votingAnalyzers;
    const silentPercent = (silentAnalyzers / totalAnalyzers) * 100;

    if (silentPercent > maxSilentPercent) {
      if (this.config.logDecisions) {
        this.logger.warn('🚫 ENTRY_COST | Too many silent analyzers', {
          direction: isShort ? 'SHORT' : 'LONG',
          silentPercent: silentPercent.toFixed(1),
          maxAllowed: maxSilentPercent,
          votingAnalyzers,
          totalAnalyzers,
          reason: 'TOO_MANY_SILENT',
        });
      }
      return {
        valid: false,
        reason: `${silentPercent.toFixed(1)}% analyzers silent, max allowed ${maxSilentPercent}%`,
      };
    }

    if (this.config.logDecisions) {
      this.logger.info('✅ ENTRY_COST | Entry cost validated', {
        direction: isShort ? 'SHORT' : 'LONG',
        votingAnalyzers,
        totalAnalyzers,
        silentPercent: silentPercent.toFixed(1),
        confidence: signal.confidence.toFixed(2),
      });
    }

    return { valid: true, reason: 'ENTRY_COST_APPROVED' };
  }
}
