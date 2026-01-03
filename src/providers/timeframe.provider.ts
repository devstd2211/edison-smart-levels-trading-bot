/**
 * TimeframeProvider
 *
 * Manages multi-timeframe configuration and provides access to timeframe settings.
 * Validates that entry and primary timeframes are always enabled.
 */

import { TimeframeConfig, TimeframeRole } from '../types';

export class TimeframeProvider {
  private timeframes: Map<TimeframeRole, TimeframeConfig>;

  constructor(timeframesConfig: Record<string, TimeframeConfig>) {
    this.timeframes = new Map();
    this.loadTimeframes(timeframesConfig);
    this.validateTimeframes();
  }

  /**
   * Load timeframes from config
   */
  private loadTimeframes(config: Record<string, TimeframeConfig>): void {
    const roleMapping: Record<string, TimeframeRole> = {
      entry: TimeframeRole.ENTRY,
      primary: TimeframeRole.PRIMARY,
      trend1: TimeframeRole.TREND1,
      trend2: TimeframeRole.TREND2,
      context: TimeframeRole.CONTEXT,
    };

    for (const [key, tfConfig] of Object.entries(config)) {
      const role = roleMapping[key];
      if (role && tfConfig.enabled) {
        this.timeframes.set(role, tfConfig);
      }
    }
  }

  /**
   * Validate that required timeframes are present
   */
  private validateTimeframes(): void {
    if (!this.timeframes.has(TimeframeRole.PRIMARY)) {
      throw new Error('PRIMARY timeframe is required but not enabled in config');
    }

    if (!this.timeframes.has(TimeframeRole.ENTRY)) {
      throw new Error('ENTRY timeframe is required but not enabled in config');
    }
  }

  /**
   * Get timeframe config by role
   */
  getTimeframe(role: TimeframeRole): TimeframeConfig | undefined {
    return this.timeframes.get(role);
  }

  /**
   * Get all active timeframes
   */
  getAllTimeframes(): Map<TimeframeRole, TimeframeConfig> {
    return new Map(this.timeframes);
  }

  /**
   * Check if timeframe is enabled
   */
  isTimeframeEnabled(role: TimeframeRole): boolean {
    return this.timeframes.has(role);
  }

  /**
   * Convert Bybit interval to minutes
   * Examples: "1" -> 1, "5" -> 5, "60" -> 60, "240" -> 240
   */
  intervalToMinutes(interval: string): number {
    return parseInt(interval, 10);
  }

  /**
   * Get all enabled timeframe roles
   */
  getEnabledRoles(): TimeframeRole[] {
    return Array.from(this.timeframes.keys());
  }

  /**
   * Get timeframe interval by role
   */
  getInterval(role: TimeframeRole): string | undefined {
    return this.timeframes.get(role)?.interval;
  }

  /**
   * Get candle limit for timeframe
   */
  getCandleLimit(role: TimeframeRole): number | undefined {
    return this.timeframes.get(role)?.candleLimit;
  }
}
