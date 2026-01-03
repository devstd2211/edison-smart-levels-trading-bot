/**
 * TickDelta Calibration with TICK DATA
 *
 * Tests different minDeltaRatio and stopLossAtrMultiplier values
 * using REAL trade ticks from market-data-multi.db
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel } from '../src/types';
import { BacktestEngineV2, BacktestConfig } from '../src/backtest/backtest-engine-v2';
import { SqliteDataProvider } from '../src/backtest/data-providers/sqlite.provider';

// ============================================================================
// CALIBRATION PARAMETERS
// ============================================================================

interface CalibrationParam {
  minDeltaRatio: number;
  stopLossAtrMultiplier: number;
  takeProfitPercent: number;
}

// Test 6 combinations
const CALIBRATION_PARAMS: CalibrationParam[] = [
  // Original (failing)
  { minDeltaRatio: 2.5, stopLossAtrMultiplier: 0.7, takeProfitPercent: 0.25 },

  // Test higher delta ratio (more selective)
  { minDeltaRatio: 3.0, stopLossAtrMultiplier: 0.7, takeProfitPercent: 0.25 },
  { minDeltaRatio: 3.5, stopLossAtrMultiplier: 0.7, takeProfitPercent: 0.25 },

  // Test looser SL (give room to move)
  { minDeltaRatio: 2.5, stopLossAtrMultiplier: 1.0, takeProfitPercent: 0.25 },
  { minDeltaRatio: 2.5, stopLossAtrMultiplier: 1.5, takeProfitPercent: 0.25 },

  // Test combo: tight delta + loose SL
  { minDeltaRatio: 3.5, stopLossAtrMultiplier: 1.0, takeProfitPercent: 0.30 },
];

// ============================================================================
// MAIN CALIBRATION LOGIC
// ============================================================================

async function runCalibration() {
  const logger = new LoggerService(LogLevel.INFO, './logs', false);

  // Load config
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  TickDelta Calibration WITH TICK DATA                        ║');
  console.log('║  Testing different parameter combinations                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Symbol: ${config.exchange.symbol}`);
  console.log(`🔍 Testing ${CALIBRATION_PARAMS.length} parameter combinations\n`);

  // Load data
  const dataProvider = new SqliteDataProvider();
  let candles1m: any[], candles5m: any[], candles15m: any[];
  try {
    const data = await dataProvider.loadCandles(config.exchange.symbol);
    candles1m = data.candles1m as any[];
    candles5m = data.candles5m as any[];
    candles15m = data.candles15m as any[];
  } catch (error) {
    console.error('❌ Failed to load data:', error);
    process.exit(1);
  }

  console.log(`✅ Loaded: ${candles1m.length} 1m, ${candles5m.length} 5m, ${candles15m.length} 15m candles\n`);

  const results: any[] = [];

  // Run calibration
  for (let idx = 0; idx < CALIBRATION_PARAMS.length; idx++) {
    const params = CALIBRATION_PARAMS[idx];

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔧 TEST ${idx + 1}/${CALIBRATION_PARAMS.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    console.log(`Parameters:`);
    console.log(`  minDeltaRatio: ${params.minDeltaRatio}`);
    console.log(`  stopLossAtrMultiplier: ${params.stopLossAtrMultiplier}`);
    console.log(`  takeProfitPercent: ${params.takeProfitPercent}`);

    // Update config
    config.scalping.tickDelta.analyzer.minDeltaRatio = params.minDeltaRatio;
    config.trading.stopLossAtrMultiplier = params.stopLossAtrMultiplier;
    config.scalping.tickDelta.takeProfitPercent = params.takeProfitPercent;

    // Run backtest
    try {
      const backtestConfig: BacktestConfig = {
        config,
        initialBalance: 30,
        symbol: config.exchange.symbol,
        positionSizeUsdt: 10,
        leverage: config.trading.leverage,
        takerFee: 0.0006,
        makerFee: 0.0001,
      };

      const engine = new BacktestEngineV2(backtestConfig);
      const result = await engine.run(candles1m, candles5m, candles15m, dataProvider);

      console.log(`\n✅ Results:`);
      console.log(`  Total Trades: ${result.totalTrades}`);
      console.log(`  Win Rate: ${(result.winRate * 100).toFixed(1)}%`);
      console.log(`  PnL: ${result.netPnl.toFixed(4)} USDT`);
      console.log(`  W/L Ratio: ${(result.avgWin / Math.abs(result.avgLoss)).toFixed(2)}:1`);

      results.push({
        params,
        result,
      });
    } catch (error: any) {
      console.error(`❌ Backtest failed:`, error.message);
      results.push({
        params,
        error: error.message,
      });
    }
  }

  // === RESULTS SUMMARY ===
  console.log(`\n\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  CALIBRATION SUMMARY (sorted by PnL)                         ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const sortedResults = results
    .filter((r) => r.result)
    .sort((a, b) => b.result.netPnl - a.result.netPnl);

  sortedResults.forEach((item, idx) => {
    const { params, result } = item;
    const wlRatio = (result.avgWin / Math.abs(result.avgLoss)).toFixed(2);
    console.log(
      `${idx + 1}. deltaRatio=${params.minDeltaRatio} | SL=${params.stopLossAtrMultiplier} | TP=${params.takeProfitPercent}%`,
    );
    console.log(
      `   Trades: ${result.totalTrades} | WR: ${(result.winRate * 100).toFixed(1)}% | PnL: ${result.netPnl.toFixed(4)} USDT | W/L: ${wlRatio}x`,
    );
  });

  // Save results
  const outputFile = `tickdelta-calibration-ticks-${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  // Recommend best
  if (sortedResults.length > 0) {
    const best = sortedResults[0];
    console.log(`\n🏆 BEST CONFIG:`);
    console.log(`  minDeltaRatio: ${best.params.minDeltaRatio}`);
    console.log(`  stopLossAtrMultiplier: ${best.params.stopLossAtrMultiplier}`);
    console.log(`  takeProfitPercent: ${best.params.takeProfitPercent}`);
    console.log(`  → Update config.json with these values and re-deploy!`);
  }
}

// Run
runCalibration().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
