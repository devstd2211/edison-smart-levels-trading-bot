/**
 * REALITY CHECK SERVICE
 *
 * Analyzes situations where the bot's logic was correct but the market gave the opposite result.
 * This helps identify systematic failures, assumptions that don't hold in real market conditions,
 * and edge cases where the bot's reasoning was sound but the outcome was unexpected.
 *
 * Examples:
 * - Bot detected LONG signal at support level, SL below, but price fell through support.
 * - Bot detected SHORT in downtrend, but trend suddenly reversed.
 * - Bot waited for confirmation candle, but a gap ignored the confirmation level.
 */

import type { LoggerService } from './logger.service';
import { SignalDirection } from '../types/enums';
import type { Signal } from '../types/core';
import type { AnalyzerSignal } from '../types/strategy';

/**
 * Reality check event - when logic was right but market did opposite
 */
export interface RealityCheckEvent {
  symbol: string;
  tradeId: string;
  openedAt: number;
  closedAt: number;
  direction: 'LONG' | 'SHORT';
  signalConfidence: number;
  signalReason: string;
  trendAtEntry: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION';
  entryPrice: number;
  targetPrice: number;
  stoplossPrice: number;
  highestPrice: number;
  lowestPrice: number;
  closingPrice: number;
  exitType: 'TP_HIT' | 'SL_HIT' | 'MANUAL' | 'PARTIAL';
  actualTrendAtExit: 'UPTREND' | 'DOWNTREND' | 'CONSOLIDATION';
  priceMovedAgainst: boolean;
  priceReachedTarget: boolean;
  breakingAssumptions: string[];
  reason: 'REGIME_CHANGE' | 'ASSUMPTION_BROKEN' | 'LIQUIDITY_EVENT' | 'SLIPPAGE' | 'OTHER';
  explanation: string;
  signingAnalyzers: string[];
  conflictingSignals: boolean;
}

/**
 * Reality check statistics
 */
export interface RealityCheckStats {
  totalChecks: number;
  breakingAssumptions: Map<string, number>;
  reasonBreakdown: Map<string, number>;
  topPatterns: string[];
  byAnalyzer: Map<string, number>;
}

type RealityCheckDirection = RealityCheckEvent['direction'];
type RealityCheckTrend = RealityCheckEvent['trendAtEntry'];
type RealityCheckExitType = RealityCheckEvent['exitType'];
type RealityCheckReason = RealityCheckEvent['reason'];

type RealityCheckOutcome = {
  targetPrice: number;
  stoplossPrice: number;
  priceMovedAgainst: boolean;
  priceReachedTarget: boolean;
  isRealityCheck: boolean;
};

type RealityCheckClassification = {
  assumptions: string[];
  reason: RealityCheckReason;
};

const DEFAULT_LONG_TARGET_MULTIPLIER = 1.02;
const DEFAULT_SHORT_TARGET_MULTIPLIER = 0.98;
const DEFAULT_LONG_STOPLOSS_MULTIPLIER = 0.98;
const DEFAULT_SHORT_STOPLOSS_MULTIPLIER = 1.02;
const LONG_ADVERSE_MOVE_THRESHOLD = 0.999;
const SHORT_ADVERSE_MOVE_THRESHOLD = 1.001;
const TARGET_TOLERANCE = 0.02;
const LIQUIDITY_BREAK_THRESHOLD = 0.01;
const SLIPPAGE_THRESHOLD = 0.01;
const REALITY_CHECK_CONFIDENCE_THRESHOLD = 60;

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

  recordEvent(event: RealityCheckEvent): void {
    this.events.push(event);
    this.updateStats(event);
    this.logger?.info(this.formatEventLog(event));
  }

  analyzeClosedTrade(
    symbol: string,
    tradeId: string,
    signal: Signal,
    signingAnalyzers: AnalyzerSignal[],
    entryPrice: number,
    highestPrice: number,
    lowestPrice: number,
    closingPrice: number,
    exitType: RealityCheckExitType,
    trendAtEntry: RealityCheckTrend,
    actualTrendAtExit: RealityCheckTrend,
    openedAt: number,
    closedAt: number,
  ): RealityCheckEvent | null {
    const direction = this.resolveDirection(signal.direction);
    const outcome = this.buildOutcome(
      direction,
      signal,
      entryPrice,
      highestPrice,
      lowestPrice,
      exitType,
    );

    if (!outcome.isRealityCheck) {
      return null;
    }

    const classification = this.classifyTradeOutcome(
      direction,
      trendAtEntry,
      actualTrendAtExit,
      lowestPrice,
      highestPrice,
      outcome.stoplossPrice,
      exitType,
    );

    const event: RealityCheckEvent = {
      symbol,
      tradeId,
      openedAt,
      closedAt,
      direction,
      signalConfidence: signal.confidence,
      signalReason: signal.reason || 'Unknown',
      trendAtEntry,
      entryPrice,
      targetPrice: outcome.targetPrice,
      stoplossPrice: outcome.stoplossPrice,
      highestPrice,
      lowestPrice,
      closingPrice,
      exitType,
      actualTrendAtExit,
      priceMovedAgainst: outcome.priceMovedAgainst,
      priceReachedTarget: outcome.priceReachedTarget,
      breakingAssumptions:
        classification.assumptions.length > 0
          ? classification.assumptions
          : ['Trade unexpected behavior'],
      reason: classification.reason,
      explanation: this.buildExplanation(
        exitType,
        outcome.priceReachedTarget,
        classification.assumptions,
      ),
      signingAnalyzers: signingAnalyzers.map((entry) => entry.source),
      conflictingSignals: false,
    };

    this.recordEvent(event);
    return event;
  }

  getEvents(): RealityCheckEvent[] {
    return [...this.events];
  }

  getStats(): RealityCheckStats {
    return {
      ...this.stats,
      breakingAssumptions: new Map(this.stats.breakingAssumptions),
      reasonBreakdown: new Map(this.stats.reasonBreakdown),
      byAnalyzer: new Map(this.stats.byAnalyzer),
    };
  }

  getReport(): string {
    const lines = [
      '# Reality Check Report',
      '',
      `**Total Events:** ${this.stats.totalChecks}`,
      '',
    ];

    if (this.stats.totalChecks === 0) {
      lines.push('No reality check events recorded.');
      return lines.join('\n');
    }

    lines.push('## Broken Assumptions (Top 10)');
    for (const [assumption, count] of this.getSortedEntries(this.stats.breakingAssumptions)) {
      lines.push(`- ${assumption}: **${count}** times`);
    }

    lines.push('', '## Failure Reasons');
    for (const [reason, count] of this.stats.reasonBreakdown.entries()) {
      const percent = ((count / this.stats.totalChecks) * 100).toFixed(1);
      lines.push(`- ${reason}: ${count} (${percent}%)`);
    }

    lines.push('', '## Unreliable Analyzers (Most Wrong)');
    for (const [analyzer, count] of this.getSortedEntries(this.stats.byAnalyzer)) {
      const percent = ((count / this.stats.totalChecks) * 100).toFixed(1);
      lines.push(`- ${analyzer}: ${count} times wrong (${percent}%)`);
    }

    lines.push('', '## Top Failure Patterns');
    this.stats.topPatterns
      .slice(0, 5)
      .forEach((pattern, index) => lines.push(`${index + 1}. ${pattern}`));

    return lines.join('\n');
  }

  exportToJson(): string {
    return JSON.stringify({
      totalEvents: this.events.length,
      stats: this.serializeStats(),
      events: this.events,
    });
  }

  private updateStats(event: RealityCheckEvent): void {
    this.stats.totalChecks += 1;

    const reasonCount = this.stats.reasonBreakdown.get(event.reason) ?? 0;
    this.stats.reasonBreakdown.set(event.reason, reasonCount + 1);

    for (const assumption of event.breakingAssumptions) {
      const count = this.stats.breakingAssumptions.get(assumption) ?? 0;
      this.stats.breakingAssumptions.set(assumption, count + 1);
    }

    for (const analyzer of event.signingAnalyzers) {
      const count = this.stats.byAnalyzer.get(analyzer) ?? 0;
      this.stats.byAnalyzer.set(analyzer, count + 1);
    }

    const pattern = `${event.direction} in ${event.trendAtEntry} ended by ${event.reason}`;
    if (!this.stats.topPatterns.includes(pattern)) {
      this.stats.topPatterns.push(pattern);
    }
  }

  private buildOutcome(
    direction: RealityCheckDirection,
    signal: Signal,
    entryPrice: number,
    highestPrice: number,
    lowestPrice: number,
    exitType: RealityCheckExitType,
  ): RealityCheckOutcome {
    const isLong = direction === 'LONG';
    const targetPrice =
      signal.takeProfits.length > 0
        ? signal.takeProfits[0].price
        : entryPrice *
          (isLong ? DEFAULT_LONG_TARGET_MULTIPLIER : DEFAULT_SHORT_TARGET_MULTIPLIER);
    const stoplossPrice =
      signal.stopLoss ||
      entryPrice *
        (isLong ? DEFAULT_LONG_STOPLOSS_MULTIPLIER : DEFAULT_SHORT_STOPLOSS_MULTIPLIER);
    const priceMovedAgainst = isLong
      ? lowestPrice < entryPrice * LONG_ADVERSE_MOVE_THRESHOLD
      : highestPrice > entryPrice * SHORT_ADVERSE_MOVE_THRESHOLD;
    const priceReachedTarget = isLong
      ? highestPrice >= targetPrice * (1 - TARGET_TOLERANCE)
      : lowestPrice <= targetPrice * (1 + TARGET_TOLERANCE);

    return {
      targetPrice,
      stoplossPrice,
      priceMovedAgainst,
      priceReachedTarget,
      isRealityCheck:
        exitType === 'SL_HIT' &&
        !priceReachedTarget &&
        signal.confidence >= REALITY_CHECK_CONFIDENCE_THRESHOLD,
    };
  }

  private classifyTradeOutcome(
    direction: RealityCheckDirection,
    trendAtEntry: RealityCheckTrend,
    actualTrendAtExit: RealityCheckTrend,
    lowestPrice: number,
    highestPrice: number,
    stoplossPrice: number,
    exitType: RealityCheckExitType,
  ): RealityCheckClassification {
    const assumptions: string[] = [];
    let reason: RealityCheckReason = 'OTHER';
    const isLong = direction === 'LONG';

    if (isLong && actualTrendAtExit === 'DOWNTREND' && trendAtEntry !== 'DOWNTREND') {
      assumptions.push('Trend reversal (UPTREND to DOWNTREND not detected)');
      reason = 'REGIME_CHANGE';
    }
    if (!isLong && actualTrendAtExit === 'UPTREND' && trendAtEntry !== 'UPTREND') {
      assumptions.push('Trend reversal (DOWNTREND to UPTREND not detected)');
      reason = 'REGIME_CHANGE';
    }

    if (isLong && lowestPrice < stoplossPrice * (1 - LIQUIDITY_BREAK_THRESHOLD)) {
      assumptions.push('Support level broken violently (liquidity sweep)');
      reason = 'LIQUIDITY_EVENT';
    }
    if (!isLong && highestPrice > stoplossPrice * (1 + LIQUIDITY_BREAK_THRESHOLD)) {
      assumptions.push('Resistance level broken violently (liquidity sweep)');
      reason = 'LIQUIDITY_EVENT';
    }

    if (exitType === 'SL_HIT' && stoplossPrice !== 0) {
      const slHitPrice = isLong ? lowestPrice : highestPrice;
      const slDistance = Math.abs(slHitPrice - stoplossPrice) / stoplossPrice;
      if (slDistance > SLIPPAGE_THRESHOLD) {
        assumptions.push(`Large slippage on SL (${(slDistance * 100).toFixed(2)}%)`);
        reason = 'SLIPPAGE';
      }
    }

    return { assumptions, reason };
  }

  private buildExplanation(
    exitType: RealityCheckExitType,
    priceReachedTarget: boolean,
    assumptions: string[],
  ): string {
    return `Trade closed by ${exitType}. Price never reached TP (${priceReachedTarget ? 'yes' : 'no'}). Assumptions: ${assumptions.join('; ')}`;
  }

  private formatEventLog(event: RealityCheckEvent): string {
    return [
      `[REALITY CHECK] ${event.symbol} ${event.direction} trade closed`,
      `|- Signal: ${event.signalConfidence}% confidence (${event.signalReason})`,
      `|- Entry: ${event.entryPrice.toFixed(4)} | Target: ${event.targetPrice.toFixed(4)} | SL: ${event.stoplossPrice.toFixed(4)}`,
      `|- Result: Price=${event.closingPrice.toFixed(4)} | Exit: ${event.exitType}`,
      `|- Broken: ${event.breakingAssumptions.join(', ') || 'None'}`,
      `|- Reason: ${event.reason}`,
      `'- Explanation: ${event.explanation}`,
    ].join('\n');
  }

  private getSortedEntries(source: Map<string, number>): Array<[string, number]> {
    return Array.from(source.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10);
  }

  private serializeStats(): Record<string, Record<string, number>> {
    return {
      breakingAssumptions: Object.fromEntries(this.stats.breakingAssumptions),
      reasonBreakdown: Object.fromEntries(this.stats.reasonBreakdown),
      byAnalyzer: Object.fromEntries(this.stats.byAnalyzer),
    };
  }

  private resolveDirection(direction: Signal['direction']): RealityCheckDirection {
    return direction === SignalDirection.LONG ? 'LONG' : 'SHORT';
  }
}
