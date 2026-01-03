import { INTEGER_MULTIPLIERS } from '../constants';
import { OrderBook, LoggerService } from '../types';
import { BotServices } from './bot-services';

/**
 * Real-Time Whale Detector
 *
 * Monitors orderbook in real-time for whale activity signals.
 * Detects large orders (whale walls) and unusual market movements.
 *
 * Responsibilities:
 * - Throttle whale detection to avoid CPU overload
 * - Delegate actual detection to TradingOrchestrator
 * - Log whale detection events
 *
 * Throttle: 100ms (check every 100ms to avoid redundant analysis)
 */
export class RealTimeWhaleDetector {
  private logger: LoggerService;
  private lastWhaleAnalysis: number = 0;
  private readonly whaleThrottle = INTEGER_MULTIPLIERS.ONE_HUNDRED; // 100ms

  constructor(private services: BotServices, private config: any) {
    this.logger = services.logger;
  }

  /**
   * Check for whale signals in real-time
   *
   * Only runs if whale hunting strategies are enabled in config.
   * Throttled to 100ms intervals to avoid CPU overload.
   *
   * @param orderbookSnapshot - Current orderbook state
   */
  async checkWhaleSignalRealtime(orderbookSnapshot: OrderBook): Promise<void> {
    // Check if whale hunting is enabled
    if (!this.isWhaleHuntingEnabled()) {
      return;
    }

    // Throttle analysis to avoid CPU overload
    const now = Date.now();
    if (now - this.lastWhaleAnalysis < this.whaleThrottle) {
      return;
    }

    this.lastWhaleAnalysis = now;

    try {
      // Delegate actual detection to TradingOrchestrator
      await this.services.tradingOrchestrator.checkWhaleSignalRealtime(orderbookSnapshot);
    } catch (error) {
      this.logger.error('Error checking whale signal', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if whale hunting is enabled in config
   */
  private isWhaleHuntingEnabled(): boolean {
    return this.config.whaleHunter?.enabled || this.config.whaleHunterFollow?.enabled;
  }

  /**
   * Get time since last whale analysis (for testing)
   */
  getTimeSinceLastAnalysis(): number {
    return Date.now() - this.lastWhaleAnalysis;
  }

  /**
   * Reset last analysis time (for testing)
   */
  resetLastAnalysisTime(): void {
    this.lastWhaleAnalysis = 0;
  }
}
