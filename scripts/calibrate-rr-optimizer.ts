/**
 * TP/SL R/R Optimizer for Level-Based Strategies
 *
 * Optimizes TP/SL ratios to achieve 2:1 minimum R/R for:
 * - TickDelta (XRPUSDT)
 * - Block (BTCUSDT)
 *
 * Usage:
 *   npm run calibrate:rr-optimizer tickdelta
 *   npm run calibrate:rr-optimizer block
 */

import * as fs from 'fs';
import * as path from 'path';

import { BacktestEngineV2, BacktestResult } from '../src/backtest/backtest-engine-v2';
import { SqliteDataProvider } from '../src/backtest/data-providers/sqlite.provider';
import { LoggerService, LogLevel, Config } from '../src/types';

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
    rrRatio: number;
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

type StrategyType = 'tickdelta' | 'block';

// ============================================================================
// STRATEGY CONFIGURATIONS
// ============================================================================

interface StrategyConfig {
  name: string;
  symbol: string;
  configPath: string;
  params: CalibrationParam[];
}

const STRATEGIES: Record<StrategyType, StrategyConfig> = {
  // TickDelta: XRPUSDT - Currently 4.45x R/R with 100% stop outs
  // Target: 2:1 R/R, reduce stop outs to <50%
  tickdelta: {
    name: 'TickDelta Strategy (XRPUSDT)',
    symbol: 'XRPUSDT',
    configPath: 'configs/config-xrpusdt.json',
    params: [
      {
        name: 'stopLossAtrMultiplier',
        description: 'Stop Loss ATR Multiplier (widen SL to reduce stop outs)',
        values: [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5],
      },
      {
        name: 'takeProfits[0].percent',
        description: 'TP1 Target % (reduce from aggressive 4.2%)',
        values: [1.0, 1.5, 2.0, 2.5, 3.0],
      },
    ],
  },

  // Block: BTCUSDT - Currently 1.11x R/R, need to improve
  // Target: 2:1 R/R minimum, maintain 50%+ win rate
  block: {
    name: 'Block Strategy (BTCUSDT)',
    symbol: 'BTCUSDT',
    configPath: 'configs/config-block.json',
    params: [
      {
        name: 'stopLossAtrMultiplier',
        description: 'Stop Loss ATR Multiplier (optimize for 2:1 R/R)',
        values: [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5],
      },
      {
        name: 'takeProfits[0].percent',
        description: 'TP1 Target % (increase from 0.6% to improve R/R)',
        values: [0.8, 1.0, 1.2, 1.5, 2.0, 2.5],
      },
    ],
  },
};

// ============================================================================
// PARALLEL EXECUTION CONFIGURATION
// ============================================================================

const PARALLEL_JOBS = 1; // Sequential - SQLite race condition fix

// ============================================================================
// CALIBRATION RUNNER
// ============================================================================

async function runCalibration(strategyType: StrategyType): Promise<void> {
  const logger = new LoggerService(LogLevel.ERROR, './logs', false);
  const strategy = STRATEGIES[strategyType];
  const params = strategy.params;

  // Always use strategy-specific config path
  const configPath = strategy.configPath;
  console.log(`Using config from ${configPath} (strategy mode)`);

  // Load config to verify strategy
  const config = loadConfig(configPath);
  const symbol = (config as any).exchange?.symbol || strategy.symbol;

  console.log('\n========================================');
  console.log(`📊 ${strategy.name.toUpperCase()} - R/R OPTIMIZATION`);
  console.log(`========================================`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Config: ${configPath}`);
  console.log(`Data period: 7 days`);
  console.log(`Target R/R: 2:1 minimum`);
  console.log('========================================\n');

  console.log(`⚡ Parallel jobs: ${PARALLEL_JOBS}\n`);
  console.log(`Parameters to test:`);
  params.forEach((p) => {
    console.log(`  - ${p.name}: ${p.values.length} values`);
    console.log(`    ${p.description}`);
  });

  const totalCombinations = params.reduce((acc, p) => acc * p.values.length, 1);
  const estimatedMinutes = Math.round((totalCombinations * 2) / PARALLEL_JOBS);
  console.log(`\nTotal combinations: ${totalCombinations}`);
  console.log(`Estimated time: ${estimatedMinutes} minutes (${(estimatedMinutes / 60).toFixed(1)} hours)\n`);

  // ============================================================================
  // 🚀 OPTIMIZATION: Load data ONCE
  // ============================================================================
  console.log('📦 Loading data from SQLite...');

  // Try market-data-multi.db first, then market-data.db
  let dbPath = './data/market-data.db';
  if (fs.existsSync('./data/market-data-multi.db')) {
    dbPath = './data/market-data-multi.db';
  }
  console.log(`📥 Using database: ${dbPath}\n`);

  const provider = new SqliteDataProvider(dbPath);

  const endTime = Date.now();
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 7 days

  const timeframeData = await provider.loadCandles(symbol, startTime, endTime);

  if (timeframeData.candles1m.length === 0) {
    console.log(`  ✗ No data available for ${symbol}`);
    await provider.close();
    process.exit(1);
  }

  console.log(`  ✓ Loaded ${timeframeData.candles1m.length} 1m candles`);
  console.log(`  ✓ Loaded ${timeframeData.candles5m.length} 5m candles`);
  console.log(`  ✓ Loaded ${timeframeData.candles15m.length} 15m candles`);
  if (timeframeData.candles30m && timeframeData.candles30m.length > 0) {
    console.log(`  ✓ Loaded ${timeframeData.candles30m.length} 30m candles`);
  }
  console.log('');

  // Generate combinations
  const combinations = generateCombinations(params);
  const results: CalibrationResult[] = [];

  let completed = 0;

  // Process combinations
  for (let i = 0; i < combinations.length; i += PARALLEL_JOBS) {
    const batch = combinations.slice(i, i + PARALLEL_JOBS);

    const batchPromises = batch.map(async (combo, batchIndex) => {
      const globalIndex = i + batchIndex + 1;
      console.log(`[${globalIndex}/${totalCombinations}] Testing:`);
      Object.entries(combo).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });

      try {
        const config = loadConfig(configPath);

        // Disable all strategies first
        if (config.strategies) {
          Object.keys(config.strategies).forEach((key) => {
            if ((config.strategies as any)[key]) {
              (config.strategies as any)[key].enabled = false;
            }
          });
        }

        // Enable levelBased strategy
        if (!config.strategies) {
          config.strategies = { levelBased: {} } as any;
        }
        const levelBased = (config.strategies as any).levelBased || {};
        levelBased.enabled = true;
        (config.strategies as any).levelBased = levelBased;

        // Apply parameters
        applyParameters(config, combo);

        // Create backtest config
        const backtestConfig = {
          symbol: symbol,
          initialBalance: 1000,
          positionSizeUsdt: 100,
          leverage: (config as any).trading?.leverage || 10,
          takerFee: 0.0006,
          makerFee: 0.0001,
          config: config,
        };

        // Run backtest with cached data
        const engine = new BacktestEngineV2(backtestConfig);
        const result = await engine.run(
          timeframeData.candles1m,
          timeframeData.candles5m,
          timeframeData.candles15m,
          provider
        );

        const metrics = calculateMetrics(result);
        const calibrationResult: CalibrationResult = {
          params: combo,
          metrics,
          timestamp: new Date().toISOString(),
        };

        console.log(
          `  ✓ Trades: ${metrics.totalTrades} | WR: ${metrics.winRate.toFixed(1)}% | R/R: ${metrics.rrRatio.toFixed(2)}x`
        );

        completed++;
        return calibrationResult;
      } catch (error) {
        console.error(`  ✗ Error:`, error instanceof Error ? error.message : String(error));
        completed++;
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach((result) => {
      if (result !== null) {
        results.push(result);
      }
    });

    console.log(`💾 Progress: ${completed}/${totalCombinations}\n`);
  }

  // Close provider
  try {
    await Promise.race([
      provider.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    console.log('✅ SQLite provider closed\n');
  } catch (error) {
    console.log('⚠️  Provider close timed out, continuing anyway\n');
  }

  // ============================================================================
  // RANKING & FILTERING
  // ============================================================================

  // Filter: R/R ≥ 2.0, Win Rate ≥ 35%, Trades ≥ 10
  const filtered = results.filter((r) => {
    const meetsRR = r.metrics.rrRatio >= 2.0;
    const meetsWR = strategyType === 'tickdelta' ? r.metrics.winRate >= 30 : r.metrics.winRate >= 45;
    const meetsTradeCount = r.metrics.totalTrades >= 10;
    const meetsProfit = r.metrics.netPnlUsdt > 0;

    return meetsRR && meetsWR && meetsTradeCount && meetsProfit;
  });

  console.log(`📊 Filtering results...`);
  console.log(`  Total combinations: ${results.length}`);
  console.log(`  R/R ≥ 2.0x: ${results.filter((r) => r.metrics.rrRatio >= 2.0).length}`);
  console.log(`  Win Rate ≥ ${strategyType === 'tickdelta' ? 30 : 45}%: ${results.filter((r) => r.metrics.winRate >= (strategyType === 'tickdelta' ? 30 : 45)).length}`);
  console.log(`  Trades ≥ 10: ${results.filter((r) => r.metrics.totalTrades >= 10).length}`);
  console.log(`  PnL > 0: ${results.filter((r) => r.metrics.netPnlUsdt > 0).length}`);
  console.log(`\n  ✓ Configurations meeting ALL criteria: ${filtered.length}\n`);

  // Sort by R/R, then Win Rate, then PnL
  filtered.sort((a, b) => {
    if (Math.abs(a.metrics.rrRatio - b.metrics.rrRatio) > 0.1) {
      return b.metrics.rrRatio - a.metrics.rrRatio;
    }
    if (Math.abs(a.metrics.winRate - b.metrics.winRate) > 5) {
      return b.metrics.winRate - a.metrics.winRate;
    }
    return b.metrics.netPnlPercent - a.metrics.netPnlPercent;
  });

  // Save results
  saveResults(strategyType, results, filtered);

  // Print top results
  printTopResults(strategyType, filtered.slice(0, 10));

  console.log('\n========================================');
  console.log('✅ CALIBRATION COMPLETE!');
  console.log('========================================\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateCombinations(params: CalibrationParam[]): Record<string, any>[] {
  if (params.length === 0) return [{}];

  const [first, ...rest] = params;
  const restCombinations = generateCombinations(rest);
  const combinations: Record<string, any>[] = [];

  for (const value of first.values) {
    for (const combo of restCombinations) {
      combinations.push({ [first.name]: value, ...combo });
    }
  }

  return combinations;
}

function loadConfig(configPath: string): Config {
  const fullPath = path.join(process.cwd(), configPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(content) as Config;
}

function applyParameters(config: Config, params: Record<string, any>): void {
  const levelBased = (config as any).strategies?.levelBased;
  if (!levelBased) {
    throw new Error('levelBased strategy not found in config');
  }

  Object.entries(params).forEach(([key, value]) => {
    if (key.includes('[') && key.includes(']')) {
      // Handle array notation like takeProfits[0].percent
      const match = key.match(/(.+?)\[(\d+)\]\.(.+)/);
      if (match) {
        const [, arrayName, index, prop] = match;
        if (!levelBased[arrayName]) {
          levelBased[arrayName] = [];
        }
        if (!levelBased[arrayName][parseInt(index)]) {
          levelBased[arrayName][parseInt(index)] = {};
        }
        levelBased[arrayName][parseInt(index)][prop] = value;
      }
    } else if (key.includes('.')) {
      // Nested property
      const [parent, child] = key.split('.');
      if (!levelBased[parent]) levelBased[parent] = {};
      levelBased[parent][child] = value;
    } else {
      levelBased[key] = value;
    }
  });
}

function calculateMetrics(result: BacktestResult): CalibrationResult['metrics'] {
  const wins = result.trades.filter((t) => t.pnl > 0);
  const losses = result.trades.filter((t) => t.pnl <= 0);
  const longTrades = result.trades.filter((t) => t.direction === 'LONG');
  const shortTrades = result.trades.filter((t) => t.direction === 'SHORT');

  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;

  return {
    totalTrades: result.trades.length,
    winRate: result.trades.length > 0 ? (wins.length / result.trades.length) * 100 : 0,
    rrRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
    netPnlPercent: result.netPnlPercent,
    netPnlUsdt: result.netPnl,
    avgWin,
    avgLoss,
    stopOutRate: result.trades.length > 0 ? (losses.length / result.trades.length) * 100 : 0,
    tp1HitRate: 0,
    avgHoldingMinutes: 0,
    longWinRate: longTrades.length > 0 ? (longTrades.filter((t) => t.pnl > 0).length / longTrades.length) * 100 : 0,
    shortWinRate: shortTrades.length > 0 ? (shortTrades.filter((t) => t.pnl > 0).length / shortTrades.length) * 100 : 0,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
  };
}

function saveResults(strategyType: StrategyType, allResults: CalibrationResult[], filteredResults: CalibrationResult[]): void {
  const timestamp = new Date().toISOString().split('T')[0];

  // Save all results
  const allFilename = `calibration-${strategyType}-${timestamp}.json`;
  const allFilepath = path.join(process.cwd(), allFilename);
  fs.writeFileSync(allFilepath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`\n📄 All results saved to: ${allFilename}`);

  // Save filtered results (meeting criteria)
  const filteredFilename = `calibration-${strategyType}-filtered-${timestamp}.json`;
  const filteredFilepath = path.join(process.cwd(), filteredFilename);
  fs.writeFileSync(filteredFilepath, JSON.stringify(filteredResults, null, 2), 'utf8');
  console.log(`📄 Filtered results saved to: ${filteredFilename}`);
}

function printTopResults(strategyType: StrategyType, results: CalibrationResult[]): void {
  console.log('\n========================================');
  console.log('🏆 TOP CONFIGURATIONS (Meeting Criteria)');
  console.log('========================================\n');

  if (results.length === 0) {
    console.log('❌ No configurations meet the criteria!\n');
    return;
  }

  results.forEach((r, index) => {
    console.log(`### ${index + 1}. R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}%\n`);
    console.log(`Parameters:`);
    Object.entries(r.params).forEach(([key, value]) => {
      const displayKey = key.replace(/\[0\]\./, ' TP1 → ');
      console.log(`  ${displayKey}: ${value}`);
    });
    console.log(`\nPerformance:`);
    console.log(`  Trades: ${r.metrics.totalTrades} (LONG: ${r.metrics.longTrades} | SHORT: ${r.metrics.shortTrades})`);
    console.log(`  Win Rate: ${r.metrics.winRate.toFixed(1)}% (LONG: ${r.metrics.longWinRate.toFixed(1)}% | SHORT: ${r.metrics.shortWinRate.toFixed(1)}%)`);
    console.log(`  Avg Win: +${r.metrics.avgWin.toFixed(2)} USDT | Avg Loss: -${r.metrics.avgLoss.toFixed(2)} USDT`);
    console.log(`  Net PnL: ${r.metrics.netPnlPercent >= 0 ? '+' : ''}${r.metrics.netPnlPercent.toFixed(2)}% (${r.metrics.netPnlUsdt.toFixed(2)} USDT)`);
    console.log(`  Stop-Out Rate: ${r.metrics.stopOutRate.toFixed(1)}%`);
    console.log('');
  });
}

// ============================================================================
// MAIN
// ============================================================================

const strategyArg = process.argv[2] as StrategyType;

if (!strategyArg || !Object.keys(STRATEGIES).includes(strategyArg)) {
  console.error('Usage: npm run calibrate:rr-optimizer [strategy]');
  console.error('Available strategies: tickdelta, block');
  process.exit(1);
}

runCalibration(strategyArg).catch((error) => {
  console.error('Calibration failed:', error);
  process.exit(1);
});
