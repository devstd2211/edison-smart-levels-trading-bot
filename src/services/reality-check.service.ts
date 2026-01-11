/**
 * REALITY CHECK SERVICE
 *
 * Analyzes situations where the bot's logic was correct but the market gave the opposite result.
 * This helps identify systematic failures, assumptions that don't hold in real market conditions,
 * and edge cases where the bot's reasoning was sound but the outcome was unexpected.
 *
 * Examples:
 * - Bot detected LONG signal at support level, SL below, but price fell through support (breaking assumption)
 * - Bot detected SHORT in downtrend, but trend suddenly reversed (regime change not caught)
 * - Bot waited for confirmation candle, but gap ignored the confirmation level (liquidity event)
 */

import type { LoggerService } from './logger.service';
import type { Signal } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Reality check event - when logic was right but market did opposite
 */
export interface RealityCheckEvent {
  // Trade context
  symbol: string;
  tradeId: string;
  openedAt: number;
  closedAt: number;
  direction: 'LONG' | 'SHORT';

  // What the bot believed
  signalConfidence: number; // 0-100
  signalReason: string; // Why bot thought this would work
  trendAtEntry: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION';
  entryPrice: number;
  targetPrice: number; // TP price
  stoplossPrice: number;

  // What really happened
  highestPrice: number; // Highest price reached (LONG) or lowest (SHORT)
  lowestPrice: number; // Lowest price reached
  closingPrice: number; // Where closed
  exitType: 'TP_HIT' | 'SL_HIT' | 'MANUAL' | 'PARTIAL'; // How it exited
  actualTrendAtExit: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION';
  priceMovedAgainst: boolean; // Did price move against signal immediately?
  priceReachedTarget: boolean; // Did price reach TP before hitting SL?

  // Analysis
  breakingAssumptions: string[]; // Which assumptions were broken?
  reason: 'REGIME_CHANGE' | 'ASSUMPTION_BROKEN' | 'LIQUIDITY_EVENT' | 'SLIPPAGE' | 'OTHER';
  explanation: string; // Human readable explanation

  // Signals that led to this
  signingAnalyzers: string[]; // Which analyzers voted for this direction?
  conflictingSignals: boolean; // Were there conflicting signals that were ignored?
}

/**
 * Reality check statistics
 */
export interface RealityCheckStats {
  totalChecks: number;
  breakingAssumptions: Map<string, number>; // Assumption -> count
  reasonBreakdown: Map<string, number>; // Reason -> count
  topPatterns: string[]; // Most common failure patterns
  byAnalyzer: Map<string, number>; // Analyzer -> how often wrong
}

// ============================================================================
// SERVICE
// ============================================================================

export class RealityCheckService {
  private events: RealityCheckEvent[] = [];
  private stats: RealityCheckStats = {
    totalChecks: 0,
    breakingAssumptions: new Map(),
    reasonBreakdown: new Map(),
    topPatterns: [],
    byAnalyzer: new Map(),
  };

  constructor(private logger?: LoggerService) {}

  /**
   * Record a reality check event
   * Called when a trade closes and we want to analyze if logic was right but outcome was wrong
   */
  recordEvent(event: RealityCheckEvent): void {
    this.events.push(event);
    this.updateStats(event);

    // Log immediately for visibility
    const logMessage = `
[REALITY CHECK] ${event.symbol} ${event.direction} trade closed
├─ Signal: ${event.signalConfidence}% confidence (${event.signalReason})
├─ Entry: ${event.entryPrice.toFixed(4)} | Target: ${event.targetPrice.toFixed(4)} | SL: ${event.stoplossPrice.toFixed(4)}
├─ Result: Price=${event.closingPrice.toFixed(4)} | Exit: ${event.exitType}
├─ Broken: ${event.breakingAssumptions.join(', ') || 'None'}
├─ Reason: ${event.reason}
└─ Explanation: ${event.explanation}
    `;

    this.logger?.info(logMessage);
  }

  /**
   * Analyze if a closed trade represents a broken assumption
   * Returns null if trade went as expected, or RealityCheckEvent if something unexpected happened
   */
  analyzeClosedTrade(
    symbol: string,
    tradeId: string,
    signal: Signal,
    signingAnalyzers: AnalyzerSignal[],
    entryPrice: number,
    highestPrice: number,
    lowestPrice: number,
    closingPrice: number,
    exitType: 'TP_HIT' | 'SL_HIT' | 'MANUAL' | 'PARTIAL',
    trendAtEntry: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION',
    actualTrendAtExit: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION',
    openedAt: number,
    closedAt: number,
  ): RealityCheckEvent | null {
    const isLong = signal.direction === 'LONG';
    const targetPrice = signal.takeProfits && signal.takeProfits.length > 0 ? signal.takeProfits[0].price : (isLong ? entryPrice * 1.02 : entryPrice * 0.98);
    const stoplossPrice = signal.stopLoss || (isLong ? entryPrice * 0.98 : entryPrice * 1.02);

    // Check if price moved against signal immediately
    const priceMovedAgainst = isLong ? lowestPrice < entryPrice * 0.999 : highestPrice > entryPrice * 1.001;

    // Check if price reached target
    const priceReachedTarget = isLong
      ? highestPrice >= targetPrice * 0.98 // Allow 2% tolerance
      : lowestPrice <= targetPrice * 1.02;

    // Only record if trade was SL hit AND price never reached target (logic was wrong)
    const isRealityCheck =
      exitType === 'SL_HIT' &&
      !priceReachedTarget &&
      signal.confidence >= 60; // Only for high-confidence signals

    if (!isRealityCheck) {
      return null; // Trade went as expected
    }

    // Determine what assumption was broken
    const assumptions: string[] = [];
    let reason: 'REGIME_CHANGE' | 'ASSUMPTION_BROKEN' | 'LIQUIDITY_EVENT' | 'SLIPPAGE' | 'OTHER' = 'OTHER';

    // Check for trend assumption violation
    if (isLong && actualTrendAtExit === 'DOWNTREND' && trendAtEntry !== 'DOWNTREND') {
      assumptions.push('Trend reversal (UPTREND→DOWNTREND not detected)');
      reason = 'REGIME_CHANGE';
    }
    if (!isLong && actualTrendAtExit === 'UPTREND' && trendAtEntry !== 'UPTREND') {
      assumptions.push('Trend reversal (DOWNTREND→UPTREND not detected)');
      reason = 'REGIME_CHANGE';
    }

    // Check for support/resistance breaking
    if (isLong && lowestPrice < stoplossPrice * 0.99) {
      assumptions.push('Support level broken violently (liquidity sweep)');
      reason = 'LIQUIDITY_EVENT';
    }
    if (!isLong && highestPrice > stoplossPrice * 1.01) {
      assumptions.push('Resistance level broken violently (liquidity sweep)');
      reason = 'LIQUIDITY_EVENT';
    }

    // Check for slippage
    if (exitType === 'SL_HIT') {
      const slHitPrice = isLong ? lowestPrice : highestPrice;
      const slDistance = Math.abs(slHitPrice - stoplossPrice) / stoplossPrice;
      if (slDistance > 0.01) {
        // > 1% gap
        assumptions.push(`Large slippage on SL (${(slDistance * 100).toFixed(2)}%)`);
        reason = 'SLIPPAGE';
      }
    }

    // Build event
    const event: RealityCheckEvent = {
      symbol,
      tradeId,
      openedAt,
      closedAt,
      direction: isLong ? 'LONG' : 'SHORT',
      signalConfidence: signal.confidence,
      signalReason: signal.reason || 'Unknown',
      trendAtEntry,
      entryPrice,
      targetPrice,
      stoplossPrice,
      highestPrice,
      lowestPrice,
      closingPrice,
      exitType,
      actualTrendAtExit,
      priceMovedAgainst,
      priceReachedTarget,
      breakingAssumptions: assumptions.length > 0 ? assumptions : ['Trade unexpected behavior'],
      reason,
      explanation: `Trade closed by ${exitType}. Price never reached TP (${priceReachedTarget ? 'yes' : 'no'}). Assumptions: ${assumptions.join('; ')}`,
      signingAnalyzers: signingAnalyzers.map((s) => s.source),
      conflictingSignals: false,
    };

    this.recordEvent(event);
    return event;
  }

  /**
   * Get all reality check events
   */
  getEvents(): RealityCheckEvent[] {
    return [...this.events];
  }

  /**
   * Get statistics
   */
  getStats(): RealityCheckStats {
    return {
      ...this.stats,
      breakingAssumptions: new Map(this.stats.breakingAssumptions),
      reasonBreakdown: new Map(this.stats.reasonBreakdown),
      byAnalyzer: new Map(this.stats.byAnalyzer),
    };
  }

  /**
   * Get reality check report as markdown
   */
  getReport(): string {
    const stats = this.stats;

    let report = `# Reality Check Report\n\n`;
    report += `**Total Events:** ${stats.totalChecks}\n\n`;

    if (stats.totalChecks === 0) {
      report += `No reality check events recorded.\n`;
      return report;
    }

    report += `## Broken Assumptions (Top 10)\n`;
    const topAssumptions = Array.from(stats.breakingAssumptions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [assumption, count] of topAssumptions) {
      report += `- ${assumption}: **${count}** times\n`;
    }

    report += `\n## Failure Reasons\n`;
    for (const [reason, count] of stats.reasonBreakdown.entries()) {
      const percent = ((count / stats.totalChecks) * 100).toFixed(1);
      report += `- ${reason}: ${count} (${percent}%)\n`;
    }

    report += `\n## Unreliable Analyzers (Most Wrong)\n`;
    const topUnreliable = Array.from(stats.byAnalyzer.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [analyzer, count] of topUnreliable) {
      const percent = ((count / stats.totalChecks) * 100).toFixed(1);
      report += `- ${analyzer}: ${count} times wrong (${percent}%)\n`;
    }

    report += `\n## Top Failure Patterns\n`;
    for (let i = 0; i < Math.min(5, stats.topPatterns.length); i++) {
      report += `${i + 1}. ${stats.topPatterns[i]}\n`;
    }

    return report;
  }

  /**
   * Export events to JSON
   */
  exportToJson(): string {
    return JSON.stringify({
      totalEvents: this.events.length,
      stats: {
        breakingAssumptions: Object.fromEntries(this.stats.breakingAssumptions),
        reasonBreakdown: Object.fromEntries(this.stats.reasonBreakdown),
        byAnalyzer: Object.fromEntries(this.stats.byAnalyzer),
      },
      events: this.events,
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateStats(event: RealityCheckEvent): void {
    this.stats.totalChecks += 1;

    // Update reason breakdown
    const reasonCount = this.stats.reasonBreakdown.get(event.reason) ?? 0;
    this.stats.reasonBreakdown.set(event.reason, reasonCount + 1);

    // Update broken assumptions
    for (const assumption of event.breakingAssumptions) {
      const count = this.stats.breakingAssumptions.get(assumption) ?? 0;
      this.stats.breakingAssumptions.set(assumption, count + 1);
    }

    // Update analyzer reliability
    for (const analyzer of event.signingAnalyzers) {
      const count = this.stats.byAnalyzer.get(analyzer) ?? 0;
      this.stats.byAnalyzer.set(analyzer, count + 1);
    }

    // Update top patterns (simple heuristic)
    const pattern = `${event.direction} in ${event.trendAtEntry} ended by ${event.reason}`;
    if (!this.stats.topPatterns.includes(pattern)) {
      this.stats.topPatterns.push(pattern);
    }
  }
}
