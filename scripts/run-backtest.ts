/**
 * Backtest Runner
 *
 * Run backtest using REAL bot classes (V2 Engine)
 *
 * Usage:
 *   npm run backtest                    # Use JSON files (default)
 *   npm run backtest -- --source json   # Use JSON files (explicit)
 *   npm run backtest -- --source sqlite # Use SQLite database
 */

import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngineV4 as BacktestEngine, BacktestConfig, BacktestResult } from '../src/backtest/backtest-engine-v4';
import { IDataProvider, JsonDataProvider, SqliteDataProvider } from '../src/backtest/data-providers';

// ============================================================================
// TYPES
// ============================================================================

type DataSource = 'json' | 'sqlite';

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 BACKTEST V2 (Real Bot Emulation)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Parse command line arguments
  const args = process.argv.slice(2);

  console.log(args);

  const dataSource = parseDataSource(args);
  const configPath = parseConfigPath(args);

  console.log(`📦 Data Source: ${dataSource.toUpperCase()}`);
  console.log(`📋 Config: ${configPath}\n`);

  // Create data provider based on source
  const dataProvider = createDataProvider(dataSource);

  // Load config
  const fullConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(__dirname, '../' + configPath);
  console.log(`📋 Loading config from: ${fullConfigPath}`);
  const configRaw = fs.readFileSync(fullConfigPath, 'utf-8');
  const config = JSON.parse(configRaw);
  const symbol = config.exchange.symbol;
  console.log(`🔍 DEBUG: Config keys:`, Object.keys(config).slice(0, 15));
  console.log(`🔍 DEBUG: Has btcConfirmation?`, 'btcConfirmation' in config);


  // Load data using provider
  console.log(`\n📊 Loading ${symbol} candles...`);
  const { candles1m, candles5m, candles15m } = await dataProvider.loadCandles(symbol);
  console.log(`✅ Loaded: ${candles1m.length} 1m candles, ${candles5m.length} 5m, ${candles15m.length} 15m`);

  // Load BTC data for correlation analysis (if enabled)
  let btcCandles1m: typeof candles1m = [];
  console.log(`\n🔍 DEBUG: btcConfirmation config:`, config.btcConfirmation);
  if (config.btcConfirmation?.enabled) {
    console.log(`\n🔗 BTC Correlation Enabled - Loading BTC data...`);
    try {
      const btcData = await dataProvider.loadCandles('BTCUSDT');
      btcCandles1m = btcData.candles1m;
      console.log(`✅ Loaded BTC: ${btcData.candles1m.length} 1m, ${btcData.candles5m.length} 5m, ${btcData.candles15m.length} 15m candles`);
      console.log(`📌 BTC & ${symbol} data synchronized for correlation analysis`);
    } catch (err) {
      console.warn(`⚠️  BTC data not available - BTC confirmation will be disabled`);
      console.error(`Error details:`, err);
    }
  } else {
    console.log(`⚠️  BTC Correlation NOT enabled in config`);
  }

  // Build backtest config
  const backtestConfig: BacktestConfig = {
    symbol: config.exchange.symbol,
    initialBalance: 30, // USDT
    positionSizeUsdt: 10, // USDT per trade
    leverage: config.trading.leverage,
    takerFee: 0.00055, // 0.055%
    makerFee: 0.0002,  // 0.02%
    config: config, // Full config for strategy
  };

  // Run backtest
  const engine = new BacktestEngine(backtestConfig);
  const result = await engine.run(
    candles1m,
    candles5m,
    candles15m,
    btcCandles1m
  );

  // Print results
  printResults(result);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(__dirname, '../data/backtest', `backtest_v2_${timestamp}.json`);
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to: ${resultsPath}`);

  // Cleanup: close database connection if using SQLite
  if (dataProvider instanceof SqliteDataProvider) {
    await dataProvider.close();
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse data source from command line arguments
 */
function parseDataSource(args: string[]): DataSource {
  const sourceIndex = args.indexOf('--source');

  if (sourceIndex === -1 || sourceIndex === args.length - 1) {
    return 'json'; // Default to JSON
  }

  const source = args[sourceIndex + 1].toLowerCase();

  if (source === 'json' || source === 'sqlite') {
    return source;
  }

  console.warn(`⚠️  Invalid data source: ${source}. Using default (json)`);
  return 'json';
}

/**
 * Parse config path from command line arguments
 */
function parseConfigPath(args: string[]): string {
  const configIndex = args.indexOf('--config');

  if (configIndex === -1 || configIndex === args.length - 1) {
    return 'configs/config.json'; // Default to configs/config.json (not root)
  }

  return args[configIndex + 1];
}

/**
 * Create data provider based on source type
 */
function createDataProvider(source: DataSource): IDataProvider {
  switch (source) {
    case 'json':
      return new JsonDataProvider();
    case 'sqlite':
      return new SqliteDataProvider();
    default:
      throw new Error(`Unknown data source: ${source}`);
  }
}

function printResults(result: BacktestResult) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 BACKTEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!result.summary || !result.config) {
    console.error('❌ Invalid result structure');
    return;
  }

  const initialBalance = result.config.initialBalance;
  const finalBalance = initialBalance + result.summary.totalPnL;
  const winRate = result.summary.winRate;
  const totalTrades = result.summary.totalTrades;
  const winningTrades = Math.round((winRate / 100) * totalTrades);
  const losingTrades = totalTrades - winningTrades;

  console.log('💰 Performance:');
  console.log(`├─ Symbol: ${result.config.symbol}`);
  console.log(`├─ Initial Balance: ${initialBalance.toFixed(2)} USDT`);
  console.log(`├─ Final Balance: ${finalBalance.toFixed(2)} USDT`);
  console.log(`├─ Total PnL: ${result.summary.totalPnL.toFixed(2)} USDT`);
  console.log(`└─ PnL %: ${((result.summary.totalPnL / initialBalance) * 100).toFixed(2)}%\n`);

  console.log('📈 Statistics:');
  console.log(`├─ Total Trades: ${totalTrades}`);
  console.log(`├─ Winning Trades: ${winningTrades} (${winRate.toFixed(1)}%)`);
  console.log(`├─ Losing Trades: ${losingTrades} (${(100 - winRate).toFixed(1)}%)`);

  const winLossRatio = losingTrades > 0 ? winningTrades / losingTrades : winningTrades;
  console.log(`├─ Win/Loss Ratio: ${winLossRatio.toFixed(2)}:1`);
  console.log(`├─ Profit Factor: ${result.summary.profitFactor.toFixed(2)}`);
  console.log(`├─ Avg Win: ${result.summary.avgWin.toFixed(4)} USDT`);
  console.log(`├─ Avg Loss: ${result.summary.avgLoss.toFixed(4)} USDT`);
  console.log(`└─ Max Drawdown: ${result.summary.maxDrawdown.toFixed(2)} USDT\n`);

  // By direction
  const longs = result.trades.filter((t: any) => t.side === 'LONG');
  const shorts = result.trades.filter((t: any) => t.side === 'SHORT');
  const longWins = longs.filter((t: any) => (t.pnl || 0) > 0).length;
  const shortWins = shorts.filter((t: any) => (t.pnl || 0) > 0).length;
  const longPnl = longs.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
  const shortPnl = shorts.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);

  console.log('📊 By Direction:');
  console.log(`├─ LONG: ${longs.length} trades | ${longWins} wins (${longs.length > 0 ? ((longWins / longs.length) * 100).toFixed(1) : 0}%) | PnL: ${longPnl.toFixed(4)} USDT`);
  console.log(`└─ SHORT: ${shorts.length} trades | ${shortWins} wins (${shorts.length > 0 ? ((shortWins / shorts.length) * 100).toFixed(1) : 0}%) | PnL: ${shortPnl.toFixed(4)} USDT\n`);

  // Show first 10 trades
  if (result.trades.length > 0) {
    console.log('📋 Sample Trades (first 10):');
    for (let i = 0; i < Math.min(10, result.trades.length); i++) {
      const trade = result.trades[i];
      const duration = ((trade.exitTime - trade.entryTime) / 60000).toFixed(1);
      console.log(`\n${i + 1}. ${trade.side} | ${new Date(trade.entryTime).toISOString().slice(11, 19)}`);
      console.log(`   Entry: ${trade.entryPrice.toFixed(4)} | Exit: ${trade.exitPrice.toFixed(4)}`);
      console.log(`   PnL: ${trade.pnl.toFixed(4)} USDT (${trade.pnlPercent.toFixed(2)}%) | Duration: ${duration} min`);
    }
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
