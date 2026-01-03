/**
 * WhaleHunter Strategy Calibration Script
 *
 * Automatically tests multiple parameter combinations to find optimal settings
 * for WhaleHunter strategy (single TP mode).
 *
 * Usage:
 *   npm run calibrate-whale
 */

import * as fs from 'fs';
import * as path from 'path';

import { BacktestEngineV2, BacktestResult } from './backtest-engine-v2';
import { SqliteDataProvider } from './data-providers/sqlite.provider';
import { LoggerService, LogLevel } from '../src/types';

// ============================================================================
// CALIBRATION CONFIGURATION
// ============================================================================

interface CalibrationParam {
  name: string;
  description: string;
  values: any[];
}

interface CalibrationResult {
  params: Record<string, any>;
  metrics: {
    totalTrades: number;
    winRate: number;
    rrRatio: number; // W/L Ratio
    netPnlPercent: number;
    netPnlUsdt: number;
    avgWin: number;
    avgLoss: number;
    stopOutRate: number;
    tp1HitRate: number;
    avgHoldingMinutes: number;
    longWinRate: number;
    shortWinRate: number;
    longTrades: number;
    shortTrades: number;
  };
  timestamp: string;
}

// Parameters to test for WhaleHunter
const CALIBRATION_PARAMS: CalibrationParam[] = [
  {
    name: 'takeProfitPercent',
    description: 'Single TP target (whale scalping)',
    values: [0.3, 0.4, 0.5, 0.6, 0.7], // 5 variants
  },
  {
    name: 'stopLossAtrMultiplier',
    description: 'Stop Loss ATR multiplier',
    values: [0.5, 0.75, 1.0, 1.25, 1.5], // 5 variants
  },
  {
    name: 'minConfidenceToEnter',
    description: 'Minimum confidence threshold',
    values: [70, 75, 80, 85], // 4 variants
  },
  {
    name: 'wallBreakEnabled',
    description: 'WALL_BREAK mode enabled',
    values: [true, false], // 2 variants
  },
  {
    name: 'wallDisappearanceEnabled',
    description: 'WALL_DISAPPEARANCE mode enabled',
    values: [true, false], // 2 variants
  },
];

// Total combinations: 5 × 5 × 4 × 2 × 2 = 400 combinations (~10-12 hours)
// You can reduce this by commenting out some values above

// ============================================================================
// CALIBRATION ENGINE
// ============================================================================

class WhaleCalibrator {
  private logger: LoggerService;
  private dataProvider: SqliteDataProvider;
  private results: CalibrationResult[] = [];

  constructor() {
    this.logger = new LoggerService(LogLevel.ERROR, './logs', false);
    this.dataProvider = new SqliteDataProvider('./data/market-data.db');
  }

  /**
   * Run calibration for all parameter combinations
   */
  async calibrate(): Promise<void> {
    console.log('🐋 WhaleHunter Calibration Started\n');
    console.log('📊 Testing parameters:');
    CALIBRATION_PARAMS.forEach(param => {
      console.log(`  - ${param.description}: ${param.values.length} variations`);
   });
    // Generate all combinations
    const combinations = this.generateCombinations();
    console.log(`\n📈 Total combinations: ${combinations.length}\n`);
    console.log(`⏱️  Estimated time: ${(combinations.length * 1.5).toFixed(0)}-${(combinations.length * 2).toFixed(0)} minutes\n`);

    let completed = 0;
    for (const combo of combinations) {
      completed++;
      console.log(`\n[${completed}/${combinations.length}] Testing:`);
      console.log(`  TP: ${combo.takeProfitPercent}% | SL: ${combo.stopLossAtrMultiplier}x | Conf: ${combo.minConfidenceToEnter}% | BREAK: ${combo.wallBreakEnabled ? '✅' : '❌'} | DISAPP: ${combo.wallDisappearanceEnabled ? '✅' : '❌'}`);

      try {
        const result = await this.runBacktest(combo);
        this.results.push(result);

        console.log(`✅ WR=${result.metrics.winRate.toFixed(1)}% | R/R=${result.metrics.rrRatio.toFixed(2)}x | PnL=${result.metrics.netPnlPercent.toFixed(2)}% | Trades=${result.metrics.totalTrades}`);
      } catch (error) {
        console.error(`❌ Failed:`, error instanceof Error ? error.message : String(error));
      }
    }

    // Save results
    this.saveResults();
    this.printSummary();
  }

  /**
   * Generate all parameter combinations
   */
  private generateCombinations(): Record<string, any>[] {
    const combinations: Record<string, any>[] = [{}];

    for (const param of CALIBRATION_PARAMS) {
      const newCombinations: Record<string, any>[] = [];

      for (const combo of combinations) {
        for (const value of param.values) {
          newCombinations.push({
            ...combo,
            [param.name]: value,
          });
        }
      }

      combinations.length = 0;
      combinations.push(...newCombinations);
    }

    return combinations;
  }

  /**
   * Run backtest with specific parameter combination
   */
  private async runBacktest(params: Record<string, any>): Promise<CalibrationResult> {
    // Load config template
    const configPath = path.join(process.cwd(), 'config.json');
    const config: any = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Apply WhaleHunter parameters
    config.whaleHunter.enabled = true; // Always enabled for whale calibration
    config.whaleHunter.takeProfitPercent = params.takeProfitPercent;
    config.whaleHunter.stopLossAtrMultiplier = params.stopLossAtrMultiplier;

    // NOTE: dynamicTakeProfit uses production config (enabled: true)
    // This means 3-level TP system will be used, NOT single TP
    // takeProfitPercent is used as base, then adjusted by wall size/ATR

    // Disable other strategies (WhaleHunter only)
    config.strategies.levelBased.enabled = false;
    config.strategies.trendFollowing.enabled = false;
    config.strategies.counterTrend.enabled = false;

    // DEBUG: Verify strategies are disabled
    console.log('\n🔧 DEBUG: Strategy enabled flags:');
    console.log(`  - LevelBased: ${config.strategies.levelBased.enabled}`);
    console.log(`  - TrendFollowing: ${config.strategies.trendFollowing.enabled}`);
    console.log(`  - CounterTrend: ${config.strategies.counterTrend.enabled}`);
    console.log(`  - WhaleHunter: ${config.whaleHunter.enabled}\n`);

    // Weight Matrix threshold
    config.weightMatrix.minConfidenceToEnter = params.minConfidenceToEnter;

    // WhaleHunter detector modes (correct path)
    if (config.whaleHunter.detector && config.whaleHunter.detector.modes) {
      config.whaleHunter.detector.modes.wallBreak.enabled = params.wallBreakEnabled;
      config.whaleHunter.detector.modes.wallDisappearance.enabled = params.wallDisappearanceEnabled;
    }

    // Load data (last 7 days for comprehensive testing)
    const symbol = 'APEXUSDT';
    const endTime = new Date('2025-11-15').getTime();
    const startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days back

    const timeframeData = await this.dataProvider.loadCandles(symbol, startTime, endTime);

    if (timeframeData.candles1m.length === 0) {
      throw new Error('No 1m candles loaded');
    }

    // Wrap config in BacktestConfig structure
    const backtestConfig = {
      symbol: 'APEXUSDT',
      initialBalance: 1000,
      positionSizeUsdt: 100,
      leverage: config.trading.leverage || 10,
      takerFee: 0.0006, // Bybit taker fee
      makerFee: 0.0001, // Bybit maker fee
      config: config, // Full config.json
    };

    // Run backtest
    const engine = new BacktestEngineV2(backtestConfig);
    const result: BacktestResult = await engine.run(
      timeframeData.candles1m,
      timeframeData.candles5m,
      timeframeData.candles15m,
      this.dataProvider // Pass dataProvider for orderbook loading
    );

    // Calculate metrics
    const closedTrades = result.trades.filter(t => t.exitPrice !== undefined);
    const winners = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losers = closedTrades.filter(t => (t.pnl || 0) <= 0);
    const stoppedOut = closedTrades.filter(t => t.exitReason?.includes('Stop Loss'));

    const avgWin = winners.length > 0
      ? winners.reduce((sum, t) => sum + (t.pnl || 0), 0) / winners.length
      : 0;

    const avgLoss = losers.length > 0
      ? Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0) / losers.length)
      : 0;

    const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Count TP1 hits (single TP mode)
    const tp1Hits = closedTrades.filter(t => t.exitReason?.includes('TP1') || t.exitReason?.includes('TAKE_PROFIT')).length;

    // Calculate LONG vs SHORT performance
    const longTrades = closedTrades.filter(t => t.direction === 'LONG');
    const shortTrades = closedTrades.filter(t => t.direction === 'SHORT');
    const longWinners = longTrades.filter(t => (t.pnl || 0) > 0);
    const shortWinners = shortTrades.filter(t => (t.pnl || 0) > 0);

    const longWinRate = longTrades.length > 0 ? (longWinners.length / longTrades.length) * 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? (shortWinners.length / shortTrades.length) * 100 : 0;

    const avgHoldingMinutes = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.holding || 0) / 60000, 0) / closedTrades.length
      : 0;

    return {
      params,
      metrics: {
        totalTrades: closedTrades.length,
        winRate: result.winRate,
        rrRatio,
        netPnlPercent: result.netPnlPercent,
        netPnlUsdt: result.netPnl,
        avgWin,
        avgLoss,
        stopOutRate: closedTrades.length > 0 ? (stoppedOut.length / closedTrades.length) * 100 : 0,
        tp1HitRate: closedTrades.length > 0 ? (tp1Hits / closedTrades.length) * 100 : 0,
        avgHoldingMinutes,
        longWinRate,
        shortWinRate,
        longTrades: longTrades.length,
        shortTrades: shortTrades.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save results to files
   */
  private saveResults(): void {
    const timestamp = new Date().toISOString().split('T')[0];

    // Save JSON
    const jsonPath = path.join(process.cwd(), `whale-calibration-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved: ${jsonPath}`);

    // Save Markdown report
    const mdPath = path.join(process.cwd(), `whale-calibration-${timestamp}.md`);
    const mdContent = this.generateMarkdownReport();
    fs.writeFileSync(mdPath, mdContent);
    console.log(`📊 Report saved: ${mdPath}`);
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(): string {
    const sorted = [...this.results].sort((a, b) => b.metrics.rrRatio - a.metrics.rrRatio);

    let md = `# 🐋 WhaleHunter Calibration Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Total Combinations Tested:** ${this.results.length}\n\n`;
    md += `---\n\n`;

    md += `## 🏆 Top 20 Results (by R/R Ratio)\n\n`;
    md += `| Rank | TP% | SL Mult | Conf% | BREAK | DISAPP | Trades | WR% | R/R | PnL% | Avg Win | Avg Loss | Stop% | L WR% | S WR% |\n`;
    md += `|------|-----|---------|-------|-------|--------|--------|-----|-----|------|---------|----------|-------|-------|-------|\n`;

    sorted.slice(0, 20).forEach((r, i) => {
      const breakIcon = r.params.wallBreakEnabled ? '✅' : '❌';
      const disappIcon = r.params.wallDisappearanceEnabled ? '✅' : '❌';

      md += `| ${i + 1} | ${r.params.takeProfitPercent} | ${r.params.stopLossAtrMultiplier} | ${r.params.minConfidenceToEnter} | ${breakIcon} | ${disappIcon} | ${r.metrics.totalTrades} | ${r.metrics.winRate.toFixed(1)} | **${r.metrics.rrRatio.toFixed(2)}x** | ${r.metrics.netPnlPercent.toFixed(2)} | +${r.metrics.avgWin.toFixed(2)} | -${r.metrics.avgLoss.toFixed(2)} | ${r.metrics.stopOutRate.toFixed(1)} | ${r.metrics.longWinRate.toFixed(1)} | ${r.metrics.shortWinRate.toFixed(1)} |\n`;
    });

    md += `\n---\n\n`;

    md += `## 📊 Detailed Top 10 Results\n\n`;

    sorted.slice(0, 10).forEach((r, i) => {
      md += `### ${i + 1}. R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}%\n\n`;
      md += `**Parameters:**\n`;
      md += `- Single TP Target: **${r.params.takeProfitPercent}%**\n`;
      md += `- Stop Loss: **${r.params.stopLossAtrMultiplier}x ATR**\n`;
      md += `- Min Confidence: **${r.params.minConfidenceToEnter}%**\n`;
      md += `- WALL_BREAK: ${r.params.wallBreakEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
      md += `- WALL_DISAPPEARANCE: ${r.params.wallDisappearanceEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
      md += `\n`;

      md += `**Performance:**\n`;
      md += `- Total Trades: ${r.metrics.totalTrades} (LONG: ${r.metrics.longTrades} | SHORT: ${r.metrics.shortTrades})\n`;
      md += `- Win Rate: **${r.metrics.winRate.toFixed(1)}%** (LONG: ${r.metrics.longWinRate.toFixed(1)}% | SHORT: ${r.metrics.shortWinRate.toFixed(1)}%)\n`;
      md += `- R/R Ratio: **${r.metrics.rrRatio.toFixed(2)}x** ⭐\n`;
      md += `- Net PnL: **${r.metrics.netPnlPercent.toFixed(2)}%** (${r.metrics.netPnlUsdt.toFixed(2)} USDT)\n`;
      md += `- Avg Win: +${r.metrics.avgWin.toFixed(2)} USDT\n`;
      md += `- Avg Loss: -${r.metrics.avgLoss.toFixed(2)} USDT\n`;
      md += `- Stop-Out Rate: ${r.metrics.stopOutRate.toFixed(1)}%\n`;
      md += `- TP1 Hit Rate: ${r.metrics.tp1HitRate.toFixed(1)}%\n`;
      md += `- Avg Holding: ${r.metrics.avgHoldingMinutes.toFixed(1)} min\n\n`;

      md += `---\n\n`;
    });

    // Add analysis section
    md += `## 📈 Analysis\n\n`;

    // Best TP%
    const bestByTP = this.groupByParam('takeProfitPercent');
    md += `### Best Take Profit %\n\n`;
    md += `| TP% | Avg R/R | Avg WR% | Avg PnL% | Count |\n`;
    md += `|-----|---------|---------|----------|-------|\n`;
    Object.entries(bestByTP)
      .sort((a, b) => b[1].avgRR - a[1].avgRR)
      .forEach(([tp, stats]) => {
        md += `| ${tp} | ${stats.avgRR.toFixed(2)}x | ${stats.avgWR.toFixed(1)}% | ${stats.avgPnL.toFixed(2)}% | ${stats.count} |\n`;
      });
    md += `\n`;

    // Best SL Multiplier
    const bestBySL = this.groupByParam('stopLossAtrMultiplier');
    md += `### Best Stop Loss Multiplier\n\n`;
    md += `| SL Mult | Avg R/R | Avg WR% | Avg PnL% | Count |\n`;
    md += `|---------|---------|---------|----------|-------|\n`;
    Object.entries(bestBySL)
      .sort((a, b) => b[1].avgRR - a[1].avgRR)
      .forEach(([sl, stats]) => {
        md += `| ${sl} | ${stats.avgRR.toFixed(2)}x | ${stats.avgWR.toFixed(1)}% | ${stats.avgPnL.toFixed(2)}% | ${stats.count} |\n`;
      });
    md += `\n`;

    // Best Confidence
    const bestByConf = this.groupByParam('minConfidenceToEnter');
    md += `### Best Confidence Threshold\n\n`;
    md += `| Conf% | Avg R/R | Avg WR% | Avg PnL% | Count |\n`;
    md += `|-------|---------|---------|----------|-------|\n`;
    Object.entries(bestByConf)
      .sort((a, b) => b[1].avgRR - a[1].avgRR)
      .forEach(([conf, stats]) => {
        md += `| ${conf} | ${stats.avgRR.toFixed(2)}x | ${stats.avgWR.toFixed(1)}% | ${stats.avgPnL.toFixed(2)}% | ${stats.count} |\n`;
      });
    md += `\n`;

    return md;
  }

  /**
   * Group results by parameter value
   */
  private groupByParam(paramName: string): Record<string, { avgRR: number; avgWR: number; avgPnL: number; count: number }> {
    const groups: Record<string, CalibrationResult[]> = {};

    for (const result of this.results) {
      const value = String(result.params[paramName]);
      if (!groups[value]) {
        groups[value] = [];
      }
      groups[value].push(result);
    }

    const stats: Record<string, { avgRR: number; avgWR: number; avgPnL: number; count: number }> = {};

    for (const [value, results] of Object.entries(groups)) {
      const avgRR = results.reduce((sum, r) => sum + r.metrics.rrRatio, 0) / results.length;
      const avgWR = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;
      const avgPnL = results.reduce((sum, r) => sum + r.metrics.netPnlPercent, 0) / results.length;

      stats[value] = {
        avgRR,
        avgWR,
        avgPnL,
        count: results.length,
      };
    }

    return stats;
  }

  /**
   * Print summary to console
   */
  private printSummary(): void {
    console.log('\n\n🏆 WHALE CALIBRATION SUMMARY\n');
    console.log('='.repeat(100));

    const sorted = [...this.results].sort((a, b) => b.metrics.rrRatio - a.metrics.rrRatio);
    const best = sorted[0];

    if (!best) {
      console.log('No results available');
      return;
    }

    console.log('\n🥇 BEST CONFIGURATION (by R/R Ratio):\n');
    console.log(`Take Profit: ${best.params.takeProfitPercent}%`);
    console.log(`Stop Loss: ${best.params.stopLossAtrMultiplier}x ATR`);
    console.log(`Min Confidence: ${best.params.minConfidenceToEnter}%`);
    console.log(`WALL_BREAK: ${best.params.wallBreakEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`WALL_DISAPPEARANCE: ${best.params.wallDisappearanceEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('');
    console.log(`📊 Metrics:`);
    console.log(`  - Trades: ${best.metrics.totalTrades} (LONG: ${best.metrics.longTrades} | SHORT: ${best.metrics.shortTrades})`);
    console.log(`  - Win Rate: ${best.metrics.winRate.toFixed(1)}% (LONG: ${best.metrics.longWinRate.toFixed(1)}% | SHORT: ${best.metrics.shortWinRate.toFixed(1)}%)`);
    console.log(`  - R/R Ratio: ${best.metrics.rrRatio.toFixed(2)}x ⭐`);
    console.log(`  - Net PnL: ${best.metrics.netPnlPercent.toFixed(2)}% (${best.metrics.netPnlUsdt.toFixed(2)} USDT)`);
    console.log(`  - Avg Win: +${best.metrics.avgWin.toFixed(2)} USDT`);
    console.log(`  - Avg Loss: -${best.metrics.avgLoss.toFixed(2)} USDT`);
    console.log(`  - Stop-Out Rate: ${best.metrics.stopOutRate.toFixed(1)}%`);
    console.log(`  - TP1 Hit Rate: ${best.metrics.tp1HitRate.toFixed(1)}%`);
    console.log(`  - Avg Holding: ${best.metrics.avgHoldingMinutes.toFixed(1)} min`);

    console.log('\n' + '='.repeat(100));

    // Show top 5
    console.log('\n📈 Top 5 Configurations:\n');
    sorted.slice(0, 5).forEach((r, i) => {
      console.log(`${i + 1}. TP:${r.params.takeProfitPercent}% | SL:${r.params.stopLossAtrMultiplier}x | Conf:${r.params.minConfidenceToEnter}% | R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}% | PnL ${r.metrics.netPnlPercent.toFixed(2)}%`);
    });

    console.log('\n✅ Whale Calibration complete!\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const calibrator = new WhaleCalibrator();
  await calibrator.calibrate();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
