/**
 * Trading Context Service (Week 13 Phase 2 Extract)
 *
 * Extracted from trading-orchestrator.service.ts
 * Responsible for maintaining and updating trading context (trend analysis)
 *
 * Responsibilities:
 * - Update trend analysis on PRIMARY candle close
 * - Provide current trend information for signal filtering
 * - Filter signals by trend alignment (block counter-trend signals)
 * - Cache trend analysis to avoid recalculation
 */

import {
  LoggerService,
  TimeframeRole,
  TrendAnalysis,
  ComprehensiveTrendAnalysis,
  AnalyzerSignal,
  SignalDirection,
  TradingMode,
  TrendAnalyzer,
} from '../types';
import { CandleProvider } from '../providers/candle.provider';

/**
 * Trading Context Service
 *
 * Manages trend analysis and signal filtering based on trend alignment.
 * PHASE 4 PRIMARY: Global trend detection runs FIRST in the pipeline
 */
export class TradingContextService {
  private currentTrendAnalysis: TrendAnalysis | null = null;

  constructor(
    private candleProvider: CandleProvider,
    private trendAnalyzer: TrendAnalyzer | null,
    private logger: LoggerService,
  ) {}

  /**
   * Update trend context on PRIMARY candle close
   * CRITICAL: Runs FIRST in signal pipeline to set global trend bias
   */
  async updateTrendContext(): Promise<void> {
    if (!this.trendAnalyzer) {
      return;
    }

    try {
      const primaryCandles = await this.candleProvider.getCandles(TimeframeRole.PRIMARY);
      if (!primaryCandles || primaryCandles.length < 20) {
        this.logger.warn('⚠️ Insufficient candles for trend analysis', {
          available: primaryCandles?.length || 0,
          required: 20,
        });
        return;
      }

      this.currentTrendAnalysis = await this.trendAnalyzer.analyzeTrend(primaryCandles, '1h');

      if (this.currentTrendAnalysis) {
        this.logger.info('📊 TREND ANALYSIS UPDATED (PRIMARY)', {
          bias: this.currentTrendAnalysis.bias,
          strength: (this.currentTrendAnalysis.strength * 100).toFixed(1) + '%',
          pattern: this.currentTrendAnalysis.pattern,
          restrictedDirections:
            this.currentTrendAnalysis.restrictedDirections.length > 0
              ? this.currentTrendAnalysis.restrictedDirections.join(', ')
              : 'NONE',
          reasoning: this.currentTrendAnalysis.reasoning.slice(0, 3).join(' | '),
        });
      }
    } catch (error) {
      this.logger.warn('Failed to update trend analysis', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Do not clear currentTrendAnalysis - keep previous value if analysis fails
    }
  }

  /**
   * Get current trend analysis
   * @returns Current TrendAnalysis or null if not available
   */
  getCurrentTrendAnalysis(): TrendAnalysis | null {
    return this.currentTrendAnalysis;
  }

  /**
   * Filter analyzer signals by trend alignment
   * Blocks counter-trend signals BEFORE weighted voting aggregation
   * - LONG blocked in BEARISH trend
   * - SHORT blocked in BULLISH trend
   * - NEUTRAL allows both
   *
   * @param signals - Array of analyzer signals to filter
   * @returns Filtered array with counter-trend signals removed
   */
  filterSignalsByTrend(signals: AnalyzerSignal[]): AnalyzerSignal[] {
    // Skip if no trend analysis available
    if (!this.currentTrendAnalysis) {
      return signals;
    }

    const { restrictedDirections } = this.currentTrendAnalysis;

    // If no restrictions, return all signals
    if (restrictedDirections.length === 0) {
      return signals;
    }

    // Filter out restricted directions
    const filtered = signals.filter((signal) => {
      const isRestricted = restrictedDirections.includes(signal.direction as SignalDirection);
      if (isRestricted) {
        this.logger.warn('🚫 Signal BLOCKED by trend alignment', {
          signal: signal.direction,
          trend: this.currentTrendAnalysis!.bias,
          reason: `${signal.direction} blocked in ${this.currentTrendAnalysis!.bias} trend`,
        });
      }
      return !isRestricted;
    });

    if (filtered.length < signals.length) {
      this.logger.info('🔀 Trend Alignment Filtering', {
        total: signals.length,
        filtered: filtered.length,
        blocked: signals.length - filtered.length,
        trend: this.currentTrendAnalysis.bias,
      });
    }

    return filtered;
  }
}
