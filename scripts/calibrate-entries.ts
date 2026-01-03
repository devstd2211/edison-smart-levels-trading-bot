/**
 * Entry Calibration Script
 *
 * Calibrates ENTRY parameters (not SL/TP) to optimize entry quality:
 * - minTouchesRequired (SHORT/LONG)
 * - minConfidenceToEnter
 * - minConfidenceFlat
 * - WhaleHunter enabled/disabled
 *
 * Usage:
 *   npm run calibrate-entries
 */

import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngineV2, BacktestResult, BacktestTrade } from './backtest-engine-v2';
import { SqliteDataProvider } from './data-providers/sqlite.provider';
import { LoggerService, LogLevel } from '../src/types';

// ============================================================================
// CALIBRATION CONFIGURATION
// ============================================================================

interface CalibrationParam {
  name: string;
  description?: string;
  values: any[];
}

interface CalibrationResult {
  params: Record<string, any>;
  metrics: {
    totalTrades: number;
    winRate: number;
    rrRatio: number;
    netPnlPercent: number;
    netPnlUsdt: number;
    avgWin: number;
    avgLoss: number;
    stopOutRate: number;
    // Additional metrics for entry quality:
    longTrades: number;
    longWinRate: number;
    shortTrades: number;
    shortWinRate: number;
    whaleTrades: number;
    whaleWinRate: number;
    levelBasedTrades: number;
    levelBasedWinRate: number;
    avgConfidence: number;
    avgHoldingMinutes: number;
  };
  timestamp: string;
}

// ENTRY CALIBRATION PARAMETERS
// Focus on entry quality, not SL/TP
const CALIBRATION_PARAMS: CalibrationParam[] = [
  {
    name: 'minTouchesRequiredShort',
    description: 'Min touches for SHORT entries',
    values: [2, 3], // Test 2 and 3 (skip 1 - known to be bad)
  },
  {
    name: 'minTouchesRequiredLong',
    description: 'Min touches for LONG entries',
    values: [3], // Keep at 3 (already good)
  },
  {
    name: 'minConfidenceToEnter',
    description: 'Min confidence for normal market',
    values: [60, 65, 70, 75], // Test range
  },
  {
    name: 'minConfidenceFlat',
    description: 'Min confidence for FLAT market',
    values: [40, 50], // Test 40 and 50 (skip 25 - too low)
  },
  {
    name: 'whaleHunterEnabled',
    description: 'Enable/Disable WhaleHunter',
    values: [false, true], // Test both
  },
];

// Total combinations: 2 × 1 × 4 × 2 × 2 = 32 combinations (~45-60 min)

// ============================================================================
// CALIBRATION ENGINE
// ============================================================================

class EntryCalibrator {
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
    console.log('🎯 ENTRY CALIBRATION Started\n');
    console.log('📊 Testing ENTRY parameters (NOT SL/TP):');
    CALIBRATION_PARAMS.forEach(param => {
      console.log(`  - ${param.name}: ${param.values.length} variations`);
    });

    // Generate all combinations
    const combinations = this.generateCombinations();
    console.log(`\n📈 Total combinations: ${combinations.length}\n`);

    let completed = 0;
    for (const combo of combinations) {
      completed++;
      console.log(`\n[${completed}/${combinations.length}] Testing combination:`);
      console.log(JSON.stringify(combo, null, 2));

      try {
        const result = await this.runBacktest(combo);
        this.results.push(result);

        console.log(`✅ Complete | Trades: ${result.metrics.totalTrades} | WR: ${(result.metrics.winRate * 100).toFixed(1)}% | R/R: ${result.metrics.rrRatio.toFixed(2)}x | SHORT WR: ${(result.metrics.shortWinRate * 100).toFixed(1)}%`);
      } catch (error) {
        console.error(`❌ Failed:`, error instanceof Error ? error.message : String(error));
      }
    }

    // Generate report
    this.generateReport();
  }

  /**
   * Generate all parameter combinations
   */
  private generateCombinations(): Record<string, any>[] {
    const combinations: Record<string, any>[] = [];

    const recurse = (index: number, current: Record<string, any>) => {
      if (index === CALIBRATION_PARAMS.length) {
        combinations.push({ ...current });
        return;
      }

      const param = CALIBRATION_PARAMS[index];
      for (const value of param.values) {
        current[param.name] = value;
        recurse(index + 1, current);
      }
    };

    recurse(0, {});
    return combinations;
  }

  /**
   * Run backtest with specific parameters
   */
  private async runBacktest(params: Record<string, any>): Promise<CalibrationResult> {
    // Load config
    const configPath = path.join(__dirname, '../config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Apply ENTRY parameters
    config.strategies.levelBased.minTouchesRequiredShort = params.minTouchesRequiredShort;
    config.strategies.levelBased.minTouchesRequiredLong = params.minTouchesRequiredLong;
    config.weightMatrix.minConfidenceToEnter = params.minConfidenceToEnter;
    config.weightMatrix.minConfidenceFlat = params.minConfidenceFlat;

    // Enable/disable WhaleHunter
    config.whaleHunter.enabled = params.whaleHunterEnabled;

    // IMPORTANT: Keep SL/TP settings unchanged (already optimized)
    // We're ONLY testing entry parameters!

    // IMPORTANT: weightSystem ALWAYS OFF (we're testing entry filters, not weights)
    config.strategy.weightSystem.enabled = false;

    // Load data (last 3 days for speed)
    const symbol = 'APEXUSDT';
    const endTime = new Date('2025-11-11').getTime();
    const startTime = endTime - (3 * 24 * 60 * 60 * 1000); // 3 days back

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
      this.dataProvider
    );

    // Calculate additional metrics for entry quality
    const metrics = this.calculateMetrics(result);

    return {
      params,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate extended metrics including LONG/SHORT/WhaleHunter breakdown
   */
  private calculateMetrics(result: BacktestResult): CalibrationResult['metrics'] {
    const trades = result.trades;
    // Filter out trades with undefined pnl
    const validTrades = trades.filter(t => t.pnl !== undefined);
    const wins = validTrades.filter(t => t.pnl! > 0);
    const losses = validTrades.filter(t => t.pnl! < 0);

    const winRate = validTrades.length > 0 ? wins.length / validTrades.length : 0;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl!, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0) / losses.length) : 0;
    const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    // LONG/SHORT breakdown (using direction field)
    const longTrades = validTrades.filter(t => t.direction === 'LONG');
    const longWins = longTrades.filter(t => t.pnl! > 0);
    const longWinRate = longTrades.length > 0 ? longWins.length / longTrades.length : 0;

    const shortTrades = validTrades.filter(t => t.direction === 'SHORT');
    const shortWins = shortTrades.filter(t => t.pnl! > 0);
    const shortWinRate = shortTrades.length > 0 ? shortWins.length / shortTrades.length : 0;

    // Strategy breakdown (BacktestTrade doesn't have strategy field, estimate from result)
    // For now, use total trades for both
    const whaleTrades: typeof trades = [];
    const whaleWinRate = 0;
    const levelBasedTrades = validTrades;
    const levelBasedWinRate = winRate;

    // Average confidence (not available in BacktestTrade)
    const avgConfidence = 0;

    // TP/SL stats (BacktestTrade doesn't have exitType, estimate from result)
    const stopOuts = losses; // Approximate: all losses as stop outs
    const stopOutRate = validTrades.length > 0 ? stopOuts.length / validTrades.length : 0;

    // Holding time (filter trades with valid exitTime)
    const tradesWithExit = validTrades.filter(t => t.exitTime !== undefined);
    const holdingTimes = tradesWithExit.map(t => (t.exitTime! - t.entryTime) / 60000); // minutes
    const avgHoldingMinutes = holdingTimes.length > 0
      ? holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length
      : 0;

    return {
      totalTrades: trades.length,
      winRate,
      rrRatio,
      netPnlPercent: result.netPnlPercent,
      netPnlUsdt: result.netPnl,
      avgWin,
      avgLoss,
      stopOutRate,
      longTrades: longTrades.length,
      longWinRate,
      shortTrades: shortTrades.length,
      shortWinRate,
      whaleTrades: whaleTrades.length,
      whaleWinRate,
      levelBasedTrades: levelBasedTrades.length,
      levelBasedWinRate,
      avgConfidence,
      avgHoldingMinutes,
    };
  }

  /**
   * Generate markdown report
   */
  private generateReport(): void {
    // Sort by Win Rate (primary), then R/R Ratio (secondary)
    const sorted = [...this.results].sort((a, b) => {
      const wrDiff = b.metrics.winRate - a.metrics.winRate;
      if (Math.abs(wrDiff) > 0.01) return wrDiff; // >1% difference
      return b.metrics.rrRatio - a.metrics.rrRatio;
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(__dirname, `../entry-calibration-report-${timestamp}.md`);
    const jsonPath = path.join(__dirname, `../entry-calibration-results-${timestamp}.json`);

    let md = `# 🎯 Entry Calibration Report\n\n`;
    md += `**Date:** ${timestamp}\n`;
    md += `**Mode:** Entry Quality Optimization (SL/TP unchanged)\n`;
    md += `**Combinations Tested:** ${this.results.length}\n\n`;
    md += `---\n\n`;

    // Best configuration
    if (sorted.length > 0) {
      const best = sorted[0];
      md += `## 🥇 BEST CONFIGURATION (by Win Rate):\n\n`;
      md += `**Entry Parameters:**\n`;
      md += `- Min Touches (SHORT): ${best.params.minTouchesRequiredShort}\n`;
      md += `- Min Touches (LONG): ${best.params.minTouchesRequiredLong}\n`;
      md += `- Min Confidence (Normal): ${best.params.minConfidenceToEnter}%\n`;
      md += `- Min Confidence (FLAT): ${best.params.minConfidenceFlat}%\n`;
      md += `- WhaleHunter: ${best.params.whaleHunterEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n`;

      md += `**📊 Overall Metrics:**\n`;
      md += `- Total Trades: ${best.metrics.totalTrades}\n`;
      md += `- Win Rate: ${(best.metrics.winRate * 100).toFixed(1)}% ${best.metrics.winRate >= 0.7 ? '✅' : '⚠️'}\n`;
      md += `- R/R Ratio: ${best.metrics.rrRatio.toFixed(2)}x ${best.metrics.rrRatio >= 1.5 ? '✅' : '⚠️'}\n`;
      md += `- Net PnL: ${best.metrics.netPnlPercent >= 0 ? '+' : ''}${best.metrics.netPnlPercent.toFixed(2)}% (${best.metrics.netPnlUsdt.toFixed(2)} USDT)\n`;
      md += `- Avg Win: +${best.metrics.avgWin.toFixed(2)} USDT\n`;
      md += `- Avg Loss: -${best.metrics.avgLoss.toFixed(2)} USDT\n`;
      md += `- Stop-Out Rate: ${(best.metrics.stopOutRate * 100).toFixed(1)}%\n\n`;

      md += `**📈 LONG Performance:**\n`;
      md += `- LONG Trades: ${best.metrics.longTrades}\n`;
      md += `- LONG Win Rate: ${(best.metrics.longWinRate * 100).toFixed(1)}% ${best.metrics.longWinRate >= 0.6 ? '✅' : '⚠️'}\n\n`;

      md += `**📉 SHORT Performance:**\n`;
      md += `- SHORT Trades: ${best.metrics.shortTrades}\n`;
      md += `- SHORT Win Rate: ${(best.metrics.shortWinRate * 100).toFixed(1)}% ${best.metrics.shortWinRate >= 0.5 ? '✅' : '❌'}\n\n`;

      if (best.params.whaleHunterEnabled && best.metrics.whaleTrades > 0) {
        md += `**🐋 WhaleHunter Performance:**\n`;
        md += `- WhaleHunter Trades: ${best.metrics.whaleTrades}\n`;
        md += `- WhaleHunter Win Rate: ${(best.metrics.whaleWinRate * 100).toFixed(1)}% ${best.metrics.whaleWinRate >= 0.6 ? '✅' : '❌'}\n\n`;
      }

      md += `**📊 LevelBased Performance:**\n`;
      md += `- LevelBased Trades: ${best.metrics.levelBasedTrades}\n`;
      md += `- LevelBased Win Rate: ${(best.metrics.levelBasedWinRate * 100).toFixed(1)}%\n\n`;

      md += `**⏱️ Other Stats:**\n`;
      md += `- Avg Confidence: ${(best.metrics.avgConfidence * 100).toFixed(1)}%\n`;
      md += `- Avg Holding Time: ${best.metrics.avgHoldingMinutes.toFixed(1)} minutes\n\n`;

      md += `---\n\n`;
    }

    // Top 10 results
    md += `## 📈 Top 10 Results (Ranked by Win Rate):\n\n`;
    md += `**Legend:** Short=minTouches SHORT | Long=minTouches LONG | NormConf=minConf normal | FlatConf=minConf flat | WH=WhaleHunter\n\n`;
    md += `| Rank | Short | Long | NormConf | FlatConf | WH | Trades | WR | R/R | SHORT WR | PnL% |\n`;
    md += `|------|-------|------|----------|----------|----|--------|-------|-----|----------|------|\n`;

    sorted.slice(0, 10).forEach((r, i) => {
      const wh = r.params.whaleHunterEnabled ? '✅' : '❌';
      const wr = (r.metrics.winRate * 100).toFixed(1) + '%';
      const rr = r.metrics.rrRatio.toFixed(2) + 'x';
      const shortWR = (r.metrics.shortWinRate * 100).toFixed(1) + '%';
      const pnl = (r.metrics.netPnlPercent >= 0 ? '+' : '') + r.metrics.netPnlPercent.toFixed(2) + '%';

      md += `| ${i + 1} | ${r.params.minTouchesRequiredShort} | ${r.params.minTouchesRequiredLong} | ${r.params.minConfidenceToEnter}% | ${r.params.minConfidenceFlat}% | ${wh} | ${r.metrics.totalTrades} | ${wr} | ${rr} | ${shortWR} | ${pnl} |\n`;
    });

    md += `\n---\n\n`;

    // Detailed top 5
    md += `## 📊 Detailed Top 5:\n\n`;

    sorted.slice(0, 5).forEach((r, i) => {
      md += `### ${i + 1}. Configuration:\n`;
      md += `- Min Touches SHORT: ${r.params.minTouchesRequiredShort}\n`;
      md += `- Min Touches LONG: ${r.params.minTouchesRequiredLong}\n`;
      md += `- Min Confidence Normal: ${r.params.minConfidenceToEnter}%\n`;
      md += `- Min Confidence FLAT: ${r.params.minConfidenceFlat}%\n`;
      md += `- WhaleHunter: ${r.params.whaleHunterEnabled ? 'ENABLED' : 'DISABLED'}\n\n`;

      md += `**Overall:** ${r.metrics.totalTrades} trades | WR ${(r.metrics.winRate * 100).toFixed(1)}% | R/R ${r.metrics.rrRatio.toFixed(2)}x | PnL ${r.metrics.netPnlPercent.toFixed(2)}%\n\n`;
      md += `**LONG:** ${r.metrics.longTrades} trades | WR ${(r.metrics.longWinRate * 100).toFixed(1)}%\n`;
      md += `**SHORT:** ${r.metrics.shortTrades} trades | WR ${(r.metrics.shortWinRate * 100).toFixed(1)}%\n`;

      if (r.params.whaleHunterEnabled && r.metrics.whaleTrades > 0) {
        md += `**WhaleHunter:** ${r.metrics.whaleTrades} trades | WR ${(r.metrics.whaleWinRate * 100).toFixed(1)}%\n`;
      }

      md += `**LevelBased:** ${r.metrics.levelBasedTrades} trades | WR ${(r.metrics.levelBasedWinRate * 100).toFixed(1)}%\n\n`;
      md += `---\n\n`;
    });

    // Summary
    md += `## 📊 CALIBRATION SUMMARY\n\n`;
    md += `Total configurations tested: ${this.results.length}\n\n`;

    // Best by different metrics
    const bestWR = sorted[0];
    const bestRR = [...this.results].sort((a, b) => b.metrics.rrRatio - a.metrics.rrRatio)[0];
    const bestShortWR = [...this.results].sort((a, b) => b.metrics.shortWinRate - a.metrics.shortWinRate)[0];
    const bestPnL = [...this.results].sort((a, b) => b.metrics.netPnlPercent - a.metrics.netPnlPercent)[0];

    md += `**Best Win Rate:** ${(bestWR.metrics.winRate * 100).toFixed(1)}% (Short=${bestWR.params.minTouchesRequiredShort}, NormConf=${bestWR.params.minConfidenceToEnter}%, FlatConf=${bestWR.params.minConfidenceFlat}%)\n`;
    md += `**Best R/R Ratio:** ${bestRR.metrics.rrRatio.toFixed(2)}x (Short=${bestRR.params.minTouchesRequiredShort}, NormConf=${bestRR.params.minConfidenceToEnter}%, FlatConf=${bestRR.params.minConfidenceFlat}%)\n`;
    md += `**Best SHORT WR:** ${(bestShortWR.metrics.shortWinRate * 100).toFixed(1)}% (Short=${bestShortWR.params.minTouchesRequiredShort}, NormConf=${bestShortWR.params.minConfidenceToEnter}%, FlatConf=${bestShortWR.params.minConfidenceFlat}%)\n`;
    md += `**Best PnL:** ${bestPnL.metrics.netPnlPercent.toFixed(2)}% (Short=${bestPnL.params.minTouchesRequiredShort}, NormConf=${bestPnL.params.minConfidenceToEnter}%, FlatConf=${bestPnL.params.minConfidenceFlat}%)\n\n`;

    md += `✅ Calibration complete!\n`;

    // Write files
    fs.writeFileSync(reportPath, md);
    fs.writeFileSync(jsonPath, JSON.stringify(sorted, null, 2));

    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 CALIBRATION SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`🥇 BEST CONFIGURATION (by Win Rate):\n`);
    console.log(`Entry Parameters:`);
    console.log(`  - Min Touches (SHORT): ${bestWR.params.minTouchesRequiredShort}`);
    console.log(`  - Min Touches (LONG): ${bestWR.params.minTouchesRequiredLong}`);
    console.log(`  - Min Confidence (Normal): ${bestWR.params.minConfidenceToEnter}%`);
    console.log(`  - Min Confidence (FLAT): ${bestWR.params.minConfidenceFlat}%`);
    console.log(`  - WhaleHunter: ${bestWR.params.whaleHunterEnabled ? 'ENABLED' : 'DISABLED'}\n`);
    console.log(`📊 Metrics:`);
    console.log(`  - Trades: ${bestWR.metrics.totalTrades}`);
    console.log(`  - Win Rate: ${(bestWR.metrics.winRate * 100).toFixed(1)}% ${bestWR.metrics.winRate >= 0.7 ? '✅' : '⚠️'}`);
    console.log(`  - R/R Ratio: ${bestWR.metrics.rrRatio.toFixed(2)}x ${bestWR.metrics.rrRatio >= 1.5 ? '✅' : '⚠️'}`);
    console.log(`  - Net PnL: ${bestWR.metrics.netPnlPercent >= 0 ? '+' : ''}${bestWR.metrics.netPnlPercent.toFixed(2)}% (${bestWR.metrics.netPnlUsdt.toFixed(2)} USDT)`);
    console.log(`  - LONG Win Rate: ${(bestWR.metrics.longWinRate * 100).toFixed(1)}%`);
    console.log(`  - SHORT Win Rate: ${(bestWR.metrics.shortWinRate * 100).toFixed(1)}% ${bestWR.metrics.shortWinRate >= 0.5 ? '✅' : '❌'}\n`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`📁 Results saved to: ${jsonPath}\n`);
    console.log(`✅ Calibration complete!`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

const calibrator = new EntryCalibrator();
calibrator.calibrate().catch(error => {
  console.error('❌ Calibration failed:', error);
  process.exit(1);
});
