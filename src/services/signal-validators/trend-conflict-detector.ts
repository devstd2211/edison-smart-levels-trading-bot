/**
 * Trend Conflict Detector - FIX #6
 * Detects conflicting signals that indicate trend reversals
 */

import { SignalDirection, LoggerService } from '../../types';

export interface TrendConflictConfig {
  enabled: boolean;
  minConflictingSignals: number;
  conflictConfidence: number;
  weight: number;
  priority: number;
  logDetections: boolean;
}

export class TrendConflictDetector {
  private config: TrendConflictConfig;

  constructor(private logger: LoggerService, config: Partial<TrendConflictConfig> = {}) {
    this.config = {
      enabled: true,
      minConflictingSignals: 2,
      conflictConfidence: 60,
      weight: 0.1,
      priority: 8,
      logDetections: false,
      ...config,
    };
  }

  detectConflict(signals: any[], trendDirection: SignalDirection): any {
    if (!this.config.enabled || !signals || signals.length < this.config.minConflictingSignals) {
      return null;
    }

    const shortSignals = signals.filter(s => s.direction === SignalDirection.SHORT);
    const longSignals = signals.filter(s => s.direction === SignalDirection.LONG);

    // Check for SHORT signals conflicting with LONG trend
    if (
      trendDirection === SignalDirection.LONG &&
      shortSignals.length >= this.config.minConflictingSignals &&
      longSignals.length >= 1
    ) {
      if (this.config.logDetections) {
        this.logger.warn('⚠️  TREND_CONFLICT | SHORT signals vs LONG trend', {
          shortSignals: shortSignals.length,
          conflictConfidence: this.config.conflictConfidence.toFixed(2),
        });
      }

      return {
        source: 'TREND_CONFLICT',
        direction: SignalDirection.SHORT,
        confidence: this.config.conflictConfidence,
        weight: this.config.weight,
        priority: this.config.priority,
      };
    }

    return null;
  }
}
