/**
 * Strategy Calibration Script
 *
 * Automatically tests multiple parameter combinations to find optimal settings
 * for R/R ratio, Win Rate, and profitability.
 *
 * Usage:
 *   npx ts-node scripts/calibrate-strategy.ts              // Use SQLite (default)
 *   npx ts-node scripts/calibrate-strategy.ts --source json // Use JSON files
 *   npx ts-node scripts/calibrate-strategy.ts --weights     // Weight calibration mode
 */

import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngineV2, BacktestResult, BacktestTrade } from './backtest-engine-v2';
import { SqliteDataProvider } from './data-providers/sqlite.provider';
import { JsonDataProvider } from './data-providers/json.provider';
import { LoggerService, LogLevel } from '../src/types';

// ============================================================================
// CALIBRATION CONFIGURATION
// ============================================================================

// Check command-line arguments for mode
const CALIBRATE_WEIGHTS = process.argv.includes('--weights');
const USE_JSON_SOURCE = process.argv.includes('--source') && process.argv.includes('json');

interface CalibrationParam {
  name: string;
  description?: string; // Optional description
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
    tp2HitRate: number;
    tp3HitRate: number;
    avgHoldingMinutes: number;
  };
  timestamp: string;
}

// Parameters to test (depends on mode)
const CALIBRATION_PARAMS: CalibrationParam[] = CALIBRATE_WEIGHTS
  ? [
      // WEIGHT CALIBRATION MODE
      // Test different weight bonuses (weightSystem ALWAYS ON)
      {
        name: 'strategies',
        description: 'WhaleHunter enabled/disabled (LevelBased always active)',
        values: [
          { levelBased: true, whaleHunter: false },   // LevelBased only
          { levelBased: true, whaleHunter: true },    // Both
        ],
      },
      {
        name: 'takeProfits',
        description: 'TP levels configuration',
        values: [
          // Current (baseline)
          [
            { level: 1, percent: 0.6, sizePercent: 50.0 },
            { level: 2, percent: 1.0, sizePercent: 30.0 },
            { level: 3, percent: 1.5, sizePercent: 20.0 },
          ],
          // Wider TPs
          [
            { level: 1, percent: 0.8, sizePercent: 50.0 },
            { level: 2, percent: 1.3, sizePercent: 30.0 },
            { level: 3, percent: 2.0, sizePercent: 20.0 },
          ],
        ],
      },
      {
        name: 'stopLossMultiplier',
        values: [0.5, 0.7, 1.0, 1.5], // Test smaller SL for SHORT
      },
      {
        name: 'stopLossMultiplierLong',
        values: [0.5, 0.7, 1.0, 1.5], // Test smaller SL for LONG
      },
      {
        name: 'weightMatrixThreshold',
        values: [60],
      },
      {
        name: 'weightSystemEnabled',
        description: 'Weight System (ALWAYS ON in this mode)',
        values: [true], // ALWAYS ON
      },
      {
        name: 'strongLevelBonus',
        description: 'Bonus for strong levels (3+ touches)',
        values: [0.30, 0.40, 0.50], // Test 3 variants
      },
      {
        name: 'rsiExtremeBonus',
        description: 'Bonus for extreme RSI',
        values: [0.15, 0.20], // Test 2 variants
      },
    ]
  : [
      // STANDARD CALIBRATION MODE (no weights)
      // Test strategies/TPs/SL with weightSystem ALWAYS OFF
      {
        name: 'strategies',
        description: 'WhaleHunter enabled/disabled (LevelBased always active)',
        values: [
          { levelBased: true, whaleHunter: false },
          { levelBased: true, whaleHunter: true },
        ],
      },
      {
        name: 'takeProfits',
        description: 'TP levels configuration',
        values: [
          [
            { level: 1, percent: 0.6, sizePercent: 50.0 },
            { level: 2, percent: 1.0, sizePercent: 30.0 },
            { level: 3, percent: 1.5, sizePercent: 20.0 },
          ],
          [
            { level: 1, percent: 0.8, sizePercent: 50.0 },
            { level: 2, percent: 1.3, sizePercent: 30.0 },
            { level: 3, percent: 2.0, sizePercent: 20.0 },
          ],
        ],
      },
      {
        name: 'stopLossMultiplier',
        values: [0.5, 0.7, 1.0, 1.5], // Test smaller SL for SHORT
      },
      {
        name: 'stopLossMultiplierLong',
        values: [0.5, 0.7, 1.0, 1.5], // Test smaller SL for LONG
      },
      {
        name: 'weightMatrixThreshold',
        values: [60],
      },
      {
        name: 'weightSystemEnabled',
        description: 'Weight System (ALWAYS OFF in standard mode)',
        values: [false], // ALWAYS OFF
      },
      {
        name: 'strongLevelBonus',
        description: 'Not used in standard mode',
        values: [0.40], // Default value (ignored)
      },
      {
        name: 'rsiExtremeBonus',
        description: 'Not used in standard mode',
        values: [0.20], // Default value (ignored)
      },
    ];

// Total combinations:
// STANDARD MODE (no --weights): 2 × 2 × 1 × 2 × 1 = 8 combinations (~15-20 min)
// WEIGHT MODE (--weights): 2 × 2 × 1 × 2 × 1 × 3 × 2 = 48 combinations (~90-100 min)

// ============================================================================
// CALIBRATION ENGINE
// ============================================================================

class StrategyCalibrator {
  private logger: LoggerService;
  private dataProvider: SqliteDataProvider | JsonDataProvider;
  private results: CalibrationResult[] = [];

  constructor() {
    this.logger = new LoggerService(LogLevel.ERROR, './logs', false);

    if (USE_JSON_SOURCE) {
      // Use JSON data provider
      console.log('📁 Using JSON data source');
      this.dataProvider = new JsonDataProvider('./data/historical');
    } else {
      // Use SQLite data provider (default)
      // Try market-data-multi.db first (from data-collector), then market-data.db (single symbol)
      let dbPath = './data/market-data.db';
      if (fs.existsSync('./data/market-data-multi.db')) {
        dbPath = './data/market-data-multi.db';
      }
      console.log(`📁 Using SQLite data source: ${dbPath}`);
      this.dataProvider = new SqliteDataProvider(dbPath);
    }
  }

  /**
   * Run calibration for all parameter combinations
   */
  async calibrate(): Promise<void> {
    console.log('🎯 Strategy Calibration Started\n');
    console.log(`📊 Mode: ${CALIBRATE_WEIGHTS ? '⚖️  WEIGHT CALIBRATION' : '📈 STANDARD CALIBRATION (no weights)'}\n`);
    console.log('📊 Testing parameters:');
    CALIBRATION_PARAMS.forEach(param => {
      if (param.description && !param.description.includes('Not used')) {
        console.log(`  - ${param.name}: ${param.values.length} variations`);
      }
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

        console.log(`✅ Result: WR=${result.metrics.winRate.toFixed(1)}% | R/R=${result.metrics.rrRatio.toFixed(2)}x | PnL=${result.metrics.netPnlPercent.toFixed(2)}%`);
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

    // Get symbol from config (allows easy switching between pairs)
    const symbol = config.exchange?.symbol || 'BTCUSDT';

    // Apply parameters
    // Note: LevelBased doesn't have enabled flag (always active via StrategyCoordinator)
    // WhaleHunter is at root level with enabled flag
    config.whaleHunter.enabled = params.strategies.whaleHunter;
    config.strategies.levelBased.takeProfits = params.takeProfits;
    config.strategies.levelBased.stopLossAtrMultiplier = params.stopLossMultiplier;
    config.strategies.levelBased.stopLossAtrMultiplierLong = params.stopLossMultiplierLong;
    config.weightMatrix.minConfidenceToEnter = params.weightMatrixThreshold;

    // Apply weight system parameters
    config.strategy.weightSystem.enabled = params.weightSystemEnabled;
    if (params.weightSystemEnabled) {
      // Apply weight bonuses (only when system is enabled)
      config.strategy.weightSystem.levelStrengthWeights.strongLevelBonus = params.strongLevelBonus;
      config.strategy.weightSystem.rsiWeights.extremeBonus = params.rsiExtremeBonus;
      config.strategy.weightSystem.rsiWeights.strongBonus = params.rsiExtremeBonus * 0.75; // 75% of extreme
      config.strategy.weightSystem.rsiWeights.moderateBonus = params.rsiExtremeBonus * 0.50; // 50% of extreme
    }

    // Load data
    let startTime: number | undefined;
    let endTime: number | undefined;

    if (!USE_JSON_SOURCE) {
      // For SQLite: load last 7 days for speed
      endTime = Date.now(); // Use current time
      startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days back
    }
    // For JSON: load all available data (no time filtering)

    const timeframeData = await this.dataProvider.loadCandles(symbol, startTime, endTime);

    if (timeframeData.candles1m.length === 0) {
      throw new Error('No 1m candles loaded');
    }

    // Wrap config in BacktestConfig structure
    const backtestConfig = {
      symbol: symbol, // Use symbol from config
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
      USE_JSON_SOURCE ? undefined : (this.dataProvider as SqliteDataProvider) // Pass dataProvider for orderbook loading (SQLite only)
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

    // Count TP hits (from exitReason)
    const tp1Hits = closedTrades.filter(t => t.exitReason?.includes('TP1')).length;
    const tp2Hits = closedTrades.filter(t => t.exitReason?.includes('TP2')).length;
    const tp3Hits = closedTrades.filter(t => t.exitReason?.includes('TP3')).length;

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
        tp2HitRate: closedTrades.length > 0 ? (tp2Hits / closedTrades.length) * 100 : 0,
        tp3HitRate: closedTrades.length > 0 ? (tp3Hits / closedTrades.length) * 100 : 0,
        avgHoldingMinutes,
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
    const jsonPath = path.join(process.cwd(), `calibration-results-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved: ${jsonPath}`);

    // Save Markdown report
    const mdPath = path.join(process.cwd(), `calibration-report-${timestamp}.md`);
    const mdContent = this.generateMarkdownReport();
    fs.writeFileSync(mdPath, mdContent);
    console.log(`📊 Report saved: ${mdPath}`);
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(): string {
    const sorted = [...this.results].sort((a, b) => b.metrics.rrRatio - a.metrics.rrRatio);

    let md = `# Strategy Calibration Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Total Combinations Tested:** ${this.results.length}\n\n`;
    md += `---\n\n`;

    md += `## 🏆 Top 10 Results (by R/R Ratio)\n\n`;
    md += `**Legend:** WM = Weight Matrix | WS = Weight System | LvlBonus = Strong Level Bonus | RSI = RSI Extreme Bonus\n\n`;
    md += `| Rank | Strategies | TPs | SL Short | SL Long | WM | WS | LvlBonus | RSI | Trades | WR | R/R | PnL% |\n`;
    md += `|------|-----------|-----|----------|---------|-------|-------|----------|-----|--------|----|----|------|\n`;

    sorted.slice(0, 10).forEach((r, i) => {
      const strat = r.params.strategies.levelBased && r.params.strategies.whaleHunter ? 'Both'
        : r.params.strategies.levelBased ? 'LB'
          : 'WH';
      const tps = `${r.params.takeProfits[0].percent}/${r.params.takeProfits[1].percent}/${r.params.takeProfits[2].percent}`;
      const ws = r.params.weightSystemEnabled ? '✅' : '❌';
      const lvlBonus = r.params.weightSystemEnabled ? `${(r.params.strongLevelBonus * 100).toFixed(0)}%` : '-';
      const rsiBonus = r.params.weightSystemEnabled ? `${(r.params.rsiExtremeBonus * 100).toFixed(0)}%` : '-';

      md += `| ${i + 1} | ${strat} | ${tps} | ${r.params.stopLossMultiplier} | ${r.params.stopLossMultiplierLong} | ${r.params.weightMatrixThreshold}% | ${ws} | ${lvlBonus} | ${rsiBonus} | ${r.metrics.totalTrades} | ${r.metrics.winRate.toFixed(1)}% | **${r.metrics.rrRatio.toFixed(2)}x** | ${r.metrics.netPnlPercent.toFixed(2)}% |\n`;
    });

    md += `\n---\n\n`;

    md += `## 📊 Detailed Results\n\n`;

    sorted.forEach((r, i) => {
      const strat = r.params.strategies.levelBased && r.params.strategies.whaleHunter ? 'Both'
        : r.params.strategies.levelBased ? 'LevelBased'
          : 'WhaleHunter';

      md += `### ${i + 1}. ${strat} | R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}%\n\n`;
      md += `**Parameters:**\n`;
      md += `- Take Profits: ${r.params.takeProfits[0].percent}% / ${r.params.takeProfits[1].percent}% / ${r.params.takeProfits[2].percent}%\n`;
      md += `- SL Multiplier (SHORT): ${r.params.stopLossMultiplier}x ATR\n`;
      md += `- SL Multiplier (LONG): ${r.params.stopLossMultiplierLong}x ATR\n`;
      md += `- Weight Matrix Threshold: ${r.params.weightMatrixThreshold}%\n`;
      if (r.params.weightSystemEnabled) {
        md += `- Weight System: ✅ ENABLED\n`;
        md += `  - Strong Level Bonus: +${(r.params.strongLevelBonus * 100).toFixed(0)}% (3+ touches)\n`;
        md += `  - RSI Extreme Bonus: +${(r.params.rsiExtremeBonus * 100).toFixed(0)}%\n`;
        md += `  - RSI Strong Bonus: +${(r.params.rsiExtremeBonus * 0.75 * 100).toFixed(0)}%\n`;
      } else {
        md += `- Weight System: ❌ DISABLED\n`;
      }
      md += `\n`;

      md += `**Performance:**\n`;
      md += `- Total Trades: ${r.metrics.totalTrades}\n`;
      md += `- Win Rate: ${r.metrics.winRate.toFixed(1)}%\n`;
      md += `- R/R Ratio: **${r.metrics.rrRatio.toFixed(2)}x**\n`;
      md += `- Net PnL: ${r.metrics.netPnlPercent.toFixed(2)}% (${r.metrics.netPnlUsdt.toFixed(2)} USDT)\n`;
      md += `- Avg Win: +${r.metrics.avgWin.toFixed(2)} USDT\n`;
      md += `- Avg Loss: -${r.metrics.avgLoss.toFixed(2)} USDT\n`;
      md += `- Stop-Out Rate: ${r.metrics.stopOutRate.toFixed(1)}%\n`;
      md += `- TP Hit Rates: TP1 ${r.metrics.tp1HitRate.toFixed(1)}% | TP2 ${r.metrics.tp2HitRate.toFixed(1)}% | TP3 ${r.metrics.tp3HitRate.toFixed(1)}%\n`;
      md += `- Avg Holding: ${r.metrics.avgHoldingMinutes.toFixed(1)} min\n\n`;

      md += `---\n\n`;
    });

    return md;
  }

  /**
   * Print summary to console
   */
  private printSummary(): void {
    console.log('\n\n🏆 CALIBRATION SUMMARY\n');
    console.log('='.repeat(80));

    const sorted = [...this.results].sort((a, b) => b.metrics.rrRatio - a.metrics.rrRatio);
    const best = sorted[0];

    if (!best) {
      console.log('No results available');
      return;
    }

    console.log('\n🥇 BEST CONFIGURATION (by R/R Ratio):\n');
    console.log(`Strategies: ${best.params.strategies.levelBased ? 'LevelBased' : ''} ${best.params.strategies.whaleHunter ? 'WhaleHunter' : ''}`);
    console.log(`Take Profits: ${best.params.takeProfits[0].percent}% / ${best.params.takeProfits[1].percent}% / ${best.params.takeProfits[2].percent}%`);
    console.log(`SL Multiplier (SHORT): ${best.params.stopLossMultiplier}x`);
    console.log(`SL Multiplier (LONG): ${best.params.stopLossMultiplierLong}x`);
    console.log(`Weight Matrix: ${best.params.weightMatrixThreshold}%`);
    if (best.params.weightSystemEnabled) {
      console.log(`Weight System: ✅ ENABLED`);
      console.log(`  - Strong Level Bonus: +${(best.params.strongLevelBonus * 100).toFixed(0)}%`);
      console.log(`  - RSI Extreme Bonus: +${(best.params.rsiExtremeBonus * 100).toFixed(0)}%`);
    } else {
      console.log(`Weight System: ❌ DISABLED`);
    }
    console.log('');
    console.log(`📊 Metrics:`);
    console.log(`  - Trades: ${best.metrics.totalTrades}`);
    console.log(`  - Win Rate: ${best.metrics.winRate.toFixed(1)}%`);
    console.log(`  - R/R Ratio: ${best.metrics.rrRatio.toFixed(2)}x ⭐`);
    console.log(`  - Net PnL: ${best.metrics.netPnlPercent.toFixed(2)}% (${best.metrics.netPnlUsdt.toFixed(2)} USDT)`);
    console.log(`  - Avg Win: +${best.metrics.avgWin.toFixed(2)} USDT`);
    console.log(`  - Avg Loss: -${best.metrics.avgLoss.toFixed(2)} USDT`);
    console.log(`  - Stop-Out Rate: ${best.metrics.stopOutRate.toFixed(1)}%`);
    console.log(`  - TP3 Hit Rate: ${best.metrics.tp3HitRate.toFixed(1)}%`);

    console.log('\n' + '='.repeat(80));

    // Show top 5
    console.log('\n📈 Top 5 Configurations:\n');
    sorted.slice(0, 5).forEach((r, i) => {
      const strat = r.params.strategies.levelBased && r.params.strategies.whaleHunter ? 'Both'
        : r.params.strategies.levelBased ? 'LB'
          : 'WH';
      console.log(`${i + 1}. ${strat} | R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}% | PnL ${r.metrics.netPnlPercent.toFixed(2)}%`);
    });

    console.log('\n✅ Calibration complete!\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const calibrator = new StrategyCalibrator();
  await calibrator.calibrate();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
