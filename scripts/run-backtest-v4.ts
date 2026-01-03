/**
 * Backtest V4 Runner - PHASE 4 Clean Backtest
 *
 * Simple runner for BacktestEngineV4 that:
 * - Uses PHASE 4 config (12 params only)
 * - Loads SQLite data
 * - No legacy code, no костыли
 *
 * Usage:
 *   npm run backtest:v4
 */

import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngineV4, BacktestConfig } from '../src/backtest/backtest-engine-v4';
import { SqliteDataProvider } from '../src/backtest/data-providers/sqlite.provider';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 BACKTEST V4 (PHASE 4 Clean Architecture)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Load and validate PHASE 4 config
    const configPath = path.join(__dirname, '../configs/config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config not found: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Legacy validation disabled to support modern structured config
    console.log('✅ Config loaded. Legacy validation skipped.');
    console.log(`   Symbol: ${config.exchange.symbol}`);
    console.log(`   Timeframe: ${config.exchange.timeframe}m`);
    // The rest of the validation is skipped as it relies on a legacy flat config structure.
    // The new structured config is validated by the services that consume it.
    console.log(``);

    // Load candles from SQLite
    console.log('📥 Loading candles from SQLite (market-data-multi.db)...');
    const dbPath = path.join(__dirname, '../data/market-data-multi.db');
    const dataProvider = new SqliteDataProvider(dbPath);
    const { candles1m, candles5m, candles15m } = await dataProvider.loadCandles(config.exchange.symbol);

    console.log(`✅ Loaded: ${candles1m.length} 1m, ${candles5m.length} 5m, ${candles15m.length} 15m candles\n`);

    // Create backtest config
    const backtestConfig: BacktestConfig = {
      symbol: config.exchange.symbol,
      initialBalance: 30,
      positionSizeUsdt: 10,
      leverage: config.risk.leverage,
      takerFee: 0.00055,
      makerFee: 0.0002,
      config,
    };

    // Run backtest
    console.log('🚀 Starting backtest...\n');
    const engine = new BacktestEngineV4(backtestConfig);
    const result = await engine.run(candles1m, candles5m, candles15m);

    // Print results
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 BACKTEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (result.summary) {
      console.log(`Total Trades:     ${result.summary.totalTrades}`);
      console.log(`Win Rate:         ${(result.summary.winRate * 100).toFixed(1)}%`);
      console.log(`Total PnL:        ${result.summary.totalPnL.toFixed(2)} USDT`);
      console.log(`Avg Win:          ${result.summary.avgWin.toFixed(2)} USDT`);
      console.log(`Avg Loss:         ${result.summary.avgLoss.toFixed(2)} USDT`);
      console.log(`Profit Factor:    ${result.summary.profitFactor.toFixed(2)}`);
      console.log(`Max Drawdown:     ${result.summary.maxDrawdown.toFixed(2)}%`);
    }

    console.log('\n✅ Backtest completed successfully\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
