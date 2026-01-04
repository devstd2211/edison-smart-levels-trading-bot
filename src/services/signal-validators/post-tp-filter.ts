/**
 * Post Take-Profit Filter - FIX #7
 * Prevents FOMO entries after profitable exits
 */

import { LoggerService } from '../../types';

export interface PostTPFilterConfig {
  enabled: boolean;
  consolidationMinutes: number;
  firstHalfMinutes: number;
  firstHalfRequired: number;
  secondHalfMinutes: number;
  secondHalfRequired: number;
  logDecisions: boolean;
}

export class PostTPFilter {
  private config: PostTPFilterConfig;

  constructor(private logger: LoggerService, config: Partial<PostTPFilterConfig> = {}) {
    this.config = {
      enabled: true,
      consolidationMinutes: 10,
      firstHalfMinutes: 5,
      firstHalfRequired: 0.75,
      secondHalfMinutes: 3,
      secondHalfRequired: 0.70,
      logDecisions: false,
      ...config,
    };
  }

  filterEntry(lastExitMs: number | null, currentConfidence: number): { allowed: boolean; requiredConfidence: number } {
    if (!this.config.enabled || !lastExitMs) {
      return { allowed: true, requiredConfidence: 0 };
    }

    const elapsed = Date.now() - lastExitMs;
    const firstHalfMs = this.config.firstHalfMinutes * 60000;
    const secondHalfMs = this.config.secondHalfMinutes * 60000;
    const totalMs = this.config.consolidationMinutes * 60000;

    if (elapsed > totalMs) {
      return { allowed: true, requiredConfidence: 0 };
    }

    let required = this.config.firstHalfRequired;
    if (elapsed > firstHalfMs) {
      required = this.config.secondHalfRequired;
    }

    const allowed = currentConfidence >= required;

    if (this.config.logDecisions) {
      this.logger.info(allowed ? '✅ POST_TP | Entry allowed' : '🚫 POST_TP | Entry blocked', {
        minsSinceExit: (elapsed / 60000).toFixed(1),
        currentConfidence: currentConfidence.toFixed(2),
        required: required.toFixed(2),
      });
    }

    return { allowed, requiredConfidence: required };
  }
}
