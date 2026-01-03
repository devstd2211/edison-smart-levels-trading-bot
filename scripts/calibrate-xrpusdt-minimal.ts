/**
 * Minimal TickDelta Calibration Test
 * Tests with 1-2 hours of data to verify all parameters are being saved
 */

import * as fs from 'fs';
import * as path from 'path';

import { BacktestEngineV2, BacktestResult } from '../src/backtest/backtest-engine-v2';
import { SqliteDataProvider } from '../src/backtest/data-providers/sqlite.provider';
import { LoggerService, LogLevel, Config } from '../src/types';

interface CalibrationResult {
  params: Record<string, any>;
  metrics: {
    totalTrades: number;
    winRate: number;
    rrRatio: number;
    netPnlPercent: number;
    netPnlUsdt: number;
  };
  timestamp: string;
}

async function runMinimalTest(): Promise<void> {
  const logger = new LoggerService(LogLevel.ERROR, './logs', false);

  console.log('========================================');
  console.log('📊 TICKDELTA MINIMAL TEST (1-2 hours)');
  console.log('========================================\n');

  // Load config
  const configPath = './configs/config-xrpusdt.json';
  const fullPath = path.join(process.cwd(), configPath);
  const config = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Config;
  const symbol = (config as any).exchange?.symbol || 'STRKUSDT';

  console.log(`Symbol: ${symbol}`);
  console.log(`Testing: TP + SL combinations\n`);

  // Load data from SQLite - ONLY 1-2 hours!
  let dbPath = './data/market-data.db';
  if (fs.existsSync('./data/market-data-multi.db')) {
    dbPath = './data/market-data-multi.db';
  }
  console.log(`📥 Using database: ${dbPath}\n`);

  const provider = new SqliteDataProvider(dbPath);

  // Get data for LAST 2 HOURS only (for quick test)
  const endTime = Date.now();
  const startTime = endTime - 2 * 60 * 60 * 1000; // 2 hours

  console.log(`Loading data for: ${new Date(startTime)} to ${new Date(endTime)}\n`);

  const timeframeData = await provider.loadCandles(symbol, startTime, endTime);

  if (timeframeData.candles1m.length === 0) {
    console.log(`  ✗ No data available for ${symbol}`);
    await provider.close();
    process.exit(1);
  }

  console.log(`  ✓ Loaded ${timeframeData.candles1m.length} 1m candles`);
  console.log(`  ✓ Loaded ${timeframeData.candles5m.length} 5m candles`);
  console.log(`  ✓ Loaded ${timeframeData.candles15m.length} 15m candles\n`);

  // Test ONLY 12 combinations (3 TP x 4 SL = 12)
  const testCombos = [
    { takeProfitPercent: 0.20, stopLossPercent: 0.08, minConfidence: 75 },
    { takeProfitPercent: 0.25, stopLossPercent: 0.10, minConfidence: 80 },
    { takeProfitPercent: 0.30, stopLossPercent: 0.08, minConfidence: 85 },
    { takeProfitPercent: 0.35, stopLossPercent: 0.10, minConfidence: 75 },
    { takeProfitPercent: 0.20, stopLossPercent: 0.12, minConfidence: 80 },
    { takeProfitPercent: 0.25, stopLossPercent: 0.08, minConfidence: 85 },
  ];

  const results: CalibrationResult[] = [];

  for (let i = 0; i < testCombos.length; i++) {
    const combo = testCombos[i];
    console.log(`[${i + 1}/${testCombos.length}] Testing:`);
    console.log(`  TP=${combo.takeProfitPercent}% | SL=${combo.stopLossPercent}% | Conf=${combo.minConfidence}`);

    try {
      // Disable all strategies
      if (config.scalpingMicroWall) config.scalpingMicroWall.enabled = false;
      if (config.scalpingTickDelta) config.scalpingTickDelta.enabled = false;
      if (config.scalpingOrderFlow) config.scalpingOrderFlow.enabled = false;
      if (config.scalpingLadderTp) config.scalpingLadderTp.enabled = false;
      if (config.scalpingLimitOrder) config.scalpingLimitOrder.enabled = false;

      // Enable TickDelta and apply params
      config.scalpingTickDelta.enabled = true;
      config.scalpingTickDelta.takeProfitPercent = combo.takeProfitPercent;
      config.scalpingTickDelta.stopLossPercent = combo.stopLossPercent;
      config.scalpingTickDelta.minConfidence = combo.minConfidence;

      const backtestConfig = {
        symbol: symbol,
        initialBalance: 1000,
        positionSizeUsdt: 100,
        leverage: config.trading.leverage || 10,
        takerFee: 0.0006,
        makerFee: 0.0001,
        config: config,
      };

      const engine = new BacktestEngineV2(backtestConfig);
      const result = await engine.run(
        timeframeData.candles1m,
        timeframeData.candles5m,
        timeframeData.candles15m,
        provider
      );

      const wins = result.trades.filter((t) => t.pnl > 0);
      const losses = result.trades.filter((t) => t.pnl <= 0);
      const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;

      const calibResult: CalibrationResult = {
        params: {
          takeProfitPercent: combo.takeProfitPercent,
          stopLossPercent: combo.stopLossPercent,
          minConfidence: combo.minConfidence,
        },
        metrics: {
          totalTrades: result.trades.length,
          winRate: result.trades.length > 0 ? (wins.length / result.trades.length) * 100 : 0,
          rrRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
          netPnlPercent: result.netPnlPercent,
          netPnlUsdt: result.netPnl,
        },
        timestamp: new Date().toISOString(),
      };

      results.push(calibResult);
      console.log(`  ✓ Trades: ${result.trades.length} | WR: ${calibResult.metrics.winRate.toFixed(1)}%\n`);
    } catch (error) {
      console.error(`  ✗ Error:`, error instanceof Error ? error.message : String(error));
      console.log('');
    }
  }

  // Close provider
  try {
    await Promise.race([
      provider.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
  } catch (error) {
    console.log('⚠️  Provider close timed out, continuing\n');
  }

  // Save results
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `calibration-tickdelta-minimal-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n📄 Results saved to: ${filename}`);
  console.log(`\n✅ TEST COMPLETE!\n`);

  // Print results
  console.log('=== RESULTS ===\n');
  results.forEach((r, i) => {
    console.log(`${i + 1}. TP=${r.params.takeProfitPercent}% | SL=${r.params.stopLossPercent}% | Conf=${r.params.minConfidence}`);
    console.log(`   Trades: ${r.metrics.totalTrades} | WR: ${r.metrics.winRate.toFixed(1)}% | R/R: ${r.metrics.rrRatio.toFixed(2)}x | PnL: ${r.metrics.netPnlPercent.toFixed(2)}%\n`);
  });
}

runMinimalTest().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
