/**
 * Scalping Strategies Calibration Script
 *
 * Automatically tests multiple parameter combinations to find optimal settings
 * for all 5 scalping strategies.
 *
 * Usage:
 *   npm run calibrate:microwall
 *   npm run calibrate:tickdelta
 *   npm run calibrate:laddertp
 *   npm run calibrate:limitorder
 *   npm run calibrate:orderflow
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

type StrategyName = 'microwall' | 'tickdelta' | 'laddertp' | 'limitorder' | 'orderflow';

// ============================================================================
// PARAMETER DEFINITIONS PER STRATEGY
// ============================================================================

const STRATEGY_PARAMS: Record<StrategyName, CalibrationParam[]> = {
  // Phase 1: Scalping Micro-Wall
  microwall: [
    {
      name: 'takeProfitPercent',
      description: 'Single TP target',
      values: [0.15, 0.20, 0.25, 0.30],
    },
    {
      name: 'stopLossPercent',
      description: 'Stop Loss %',
      values: [0.08, 0.10, 0.12],
    },
    {
      name: 'minConfidence',
      description: 'Min confidence threshold',
      values: [40, 50, 60],
    },
    {
      name: 'detector.minWallSizePercent',
      description: 'Min wall size % of orderbook',
      values: [0.5, 1.0, 1.5],
    },
  ],

  // Phase 2: Scalping Tick Delta
  tickdelta: [
    {
      name: 'takeProfitPercent',
      description: 'Single TP target',
      values: [0.20, 0.25, 0.30, 0.35],
    },
    {
      name: 'stopLossPercent',
      description: 'Stop Loss %',
      values: [0.08, 0.10, 0.12],
    },
    {
      name: 'minConfidence',
      description: 'Min confidence threshold',
      values: [75, 80, 85],
    },
    {
      name: 'analyzer.minDeltaRatio',
      description: 'Min delta ratio (buy/sell)',
      values: [2.0, 2.5, 3.0, 3.5],
    },
    {
      name: 'analyzer.minTickCount',
      description: 'Min ticks in window',
      values: [15, 20, 25, 30],
    },
    {
      name: 'analyzer.minVolumeUSDT',
      description: 'Min volume USDT',
      values: [500, 1000, 1500, 2000],
    },
  ],

  // Phase 3: Scalping Ladder TP
  laddertp: [
    {
      name: 'tp1Percent',
      description: 'TP1 target',
      values: [0.10, 0.15, 0.20],
    },
    {
      name: 'tp2Percent',
      description: 'TP2 target',
      values: [0.20, 0.25, 0.30],
    },
    {
      name: 'tp3Percent',
      description: 'TP3 target',
      values: [0.30, 0.40, 0.50],
    },
    {
      name: 'stopLossPercent',
      description: 'Stop Loss %',
      values: [0.10, 0.15, 0.20],
    },
    {
      name: 'minConfidence',
      description: 'Min confidence threshold',
      values: [70, 75, 80],
    },
  ],

  // Phase 4: Scalping Limit Order (Execution Wrapper)
  limitorder: [
    {
      name: 'minConfidence',
      description: 'Min confidence threshold',
      values: [60, 70, 75, 80],
    },
    {
      name: 'executor.timeoutMs',
      description: 'Limit order timeout (ms)',
      values: [3000, 5000, 7000],
    },
    {
      name: 'executor.slippagePercent',
      description: 'Max slippage %',
      values: [0.01, 0.02, 0.03],
    },
    {
      name: 'executor.maxRetries',
      description: 'Max retry attempts',
      values: [1, 2],
    },
  ],

  // Phase 5: Scalping Order Flow
  orderflow: [
    {
      name: 'takeProfitPercent',
      description: 'Single TP target',
      values: [0.08, 0.10, 0.12, 0.15],
    },
    {
      name: 'stopLossPercent',
      description: 'Stop Loss %',
      values: [0.04, 0.05, 0.06, 0.08],
    },
    {
      name: 'minConfidence',
      description: 'Min confidence threshold',
      values: [70, 75, 80, 85],
    },
    {
      name: 'analyzer.aggressiveBuyThreshold',
      description: 'Aggressive buy threshold',
      values: [2.5, 3.0, 3.5],
    },
  ],
};

const STRATEGY_CONFIG_PATHS: Record<StrategyName, string> = {
  microwall: 'configs/config-microwall.json',
  xrpusdt: 'configs/config-xrpusdt.json',
  laddertp: 'configs/config-laddertp.json',
  limitorder: 'configs/config-limitorder.json',
  orderflow: 'configs/config-orderflow.json',
};

const STRATEGY_NAMES: Record<StrategyName, string> = {
  microwall: 'scalpingMicroWall',
  xrpusdt: 'scalpingTickDelta',
  laddertp: 'scalpingLadderTp',
  limitorder: 'scalpingLimitOrder',
  orderflow: 'scalpingOrderFlow',
};

// ============================================================================
// PARALLEL EXECUTION CONFIGURATION
// ============================================================================

// Number of parallel backtests (1 = sequential, 2-4 = parallel)
// ⚠️ WARNING: SQLite may have issues with >2 concurrent reads
const PARALLEL_JOBS = 1; // Sequential execution - fixes race condition in result ordering

// ============================================================================
// CALIBRATION RUNNER
// ============================================================================

async function runCalibration(strategyType: StrategyName): Promise<void> {
  const logger = new LoggerService(LogLevel.ERROR, './logs', false);
  const params = STRATEGY_PARAMS[strategyType];
  const strategyName = STRATEGY_NAMES[strategyType];

  // Determine config path - use root config.json if it exists (for calibration folder)
  // Otherwise use configs/config-{strategy}.json (for master branch)
  let configPath = STRATEGY_CONFIG_PATHS[strategyType];
  if (fs.existsSync('./config.json')) {
    configPath = './config.json';
    console.log('Using config.json from root (calibration mode)');
  } else {
    console.log(`Using config from ${configPath} (master mode)`);
  }

  // Load config early to get the symbol
  const config = loadConfig(configPath);
  const symbol = (config as any).exchange?.symbol || 'APEXUSDT';

  console.log('========================================');
  console.log(`📊 ${strategyType.toUpperCase()} STRATEGY CALIBRATION`);
  console.log(`Symbol: ${symbol} (7 days)`);
  console.log('========================================\n');

  console.log(`⚡ Parallel jobs: ${PARALLEL_JOBS}\n`);
  console.log(`Parameters to test:`);
  params.forEach((p) => {
    console.log(`  - ${p.name}: ${p.values.length} values`);
  });

  const totalCombinations = params.reduce((acc, p) => acc * p.values.length, 1);
  const estimatedMinutes = Math.round((totalCombinations * 2) / PARALLEL_JOBS);
  console.log(`\nTotal combinations: ${totalCombinations}`);
  console.log(`Estimated time: ${estimatedMinutes} minutes (${(estimatedMinutes / 60).toFixed(1)} hours)\n`);

  // ============================================================================
  // 🚀 OPTIMIZATION: Load data ONCE (cache for all combinations)
  // ============================================================================
  console.log('📦 Loading data from SQLite (cached for all combinations)...');

  // Try market-data-multi.db first (from data-collector), then market-data.db (single symbol)
  let dbPath = './data/market-data.db';
  if (fs.existsSync('./data/market-data-multi.db')) {
    dbPath = './data/market-data-multi.db';
  }
  console.log(`📥 Using database: ${dbPath}`);

  const provider = new SqliteDataProvider(dbPath);

  // symbol is already defined above from config
  const endTime = Date.now();
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000;

  const timeframeData = await provider.loadCandles(symbol, startTime, endTime);

  if (timeframeData.candles1m.length === 0) {
    console.log(`  ✗ No data available for ${symbol}`);
    await provider.close();
    process.exit(1);
  }

  console.log(`  ✓ Loaded ${timeframeData.candles1m.length} 1m candles`);
  console.log(`  ✓ Loaded ${timeframeData.candles5m.length} 5m candles`);
  console.log(`  ✓ Loaded ${timeframeData.candles15m.length} 15m candles\n`);

  // Generate all parameter combinations
  const combinations = generateCombinations(params);
  const results: CalibrationResult[] = [];

  let completed = 0;

  // Process in batches for parallel execution
  for (let i = 0; i < combinations.length; i += PARALLEL_JOBS) {
    const batch = combinations.slice(i, i + PARALLEL_JOBS);

    // Run batch in parallel
    const batchPromises = batch.map(async (combo, batchIndex) => {
      const globalIndex = i + batchIndex + 1;
      console.log(`\n[${globalIndex}/${totalCombinations}] Testing combination:`);
      Object.entries(combo).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });

      try {
        const config = loadConfig(configPath);

        // ============================================================================
        // 🔧 FIX: Disable ALL scalping strategies first
        // ============================================================================
        if (config.scalpingMicroWall) config.scalpingMicroWall.enabled = false;
        if (config.scalpingTickDelta) config.scalpingTickDelta.enabled = false;
        if (config.scalpingOrderFlow) config.scalpingOrderFlow.enabled = false;
        if (config.scalpingLadderTp) config.scalpingLadderTp.enabled = false;
        if (config.scalpingLimitOrder) config.scalpingLimitOrder.enabled = false;

        // Enable ONLY the strategy being calibrated
        const strategyConfig = (config as any)[strategyName];
        if (!strategyConfig) {
          console.log(`  ✗ Strategy ${strategyName} not found in config`);
          return null;
        }
        strategyConfig.enabled = true;

        // Apply parameters to the strategy
        applyParameters(config, strategyName, combo);

        // Wrap config in BacktestConfig structure
        const backtestConfig = {
          symbol: symbol, // Use symbol from config (STRKUSDT for TickDelta, etc)
          initialBalance: 1000,
          positionSizeUsdt: 100,
          leverage: config.trading.leverage || 10,
          takerFee: 0.0006, // Bybit taker fee
          makerFee: 0.0001, // Bybit maker fee
          config: config, // Full config.json
        };

        // ============================================================================
        // 🚀 OPTIMIZATION: Reuse cached data (no reload!)
        // ============================================================================
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
          `  ✓ [${globalIndex}] Trades: ${metrics.totalTrades} | WR: ${metrics.winRate.toFixed(1)}% | R/R: ${metrics.rrRatio.toFixed(2)}x`
        );

        completed++;
        return calibrationResult;
      } catch (error) {
        console.error(`  ✗ [${globalIndex}] Error:`, error instanceof Error ? error.message : String(error));
        completed++;
        return null;
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Add non-null results to results array
    batchResults.forEach((result) => {
      if (result !== null) {
        results.push(result);
      }
    });

    console.log(`\n💾 Progress: ${completed}/${totalCombinations} combinations tested\n`);
  }

  // ============================================================================
  // 🚀 OPTIMIZATION: Close provider AFTER all combinations
  // ============================================================================
  try {
    // Close with timeout to prevent hanging
    await Promise.race([
      provider.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Provider close timeout')), 5000))
    ]);
    console.log('✅ SQLite provider closed\n');
  } catch (error) {
    console.log('⚠️  Provider close timed out or failed, continuing anyway\n');
  }

  // Sort by R/R ratio (descending)
  results.sort((a, b) => b.metrics.rrRatio - a.metrics.rrRatio);

  // Save results
  saveResults(strategyType, results);

  // Print top 10
  printTopResults(results.slice(0, 10));

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

function applyParameters(config: Config, strategyName: string, params: Record<string, any>): void {
  const strategy = (config as any)[strategyName];
  if (!strategy) {
    throw new Error(`Strategy ${strategyName} not found in config`);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (key.includes('.')) {
      // Nested property (e.g., analyzer.minDeltaRatio)
      const [parent, child] = key.split('.');
      if (!strategy[parent]) strategy[parent] = {};
      strategy[parent][child] = value;
    } else {
      strategy[key] = value;
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
    tp1HitRate: 0, // TODO: Extract from trades
    avgHoldingMinutes: 0, // TODO: Calculate from trades
    longWinRate: longTrades.length > 0 ? (longTrades.filter((t) => t.pnl > 0).length / longTrades.length) * 100 : 0,
    shortWinRate: shortTrades.length > 0 ? (shortTrades.filter((t) => t.pnl > 0).length / shortTrades.length) * 100 : 0,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
  };
}

function saveResults(strategyType: StrategyName, results: CalibrationResult[]): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `calibration-${strategyType}-${timestamp}.json`;
  const filepath = path.join(process.cwd(), filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n📄 Results saved to: ${filename}`);
}

function printTopResults(results: CalibrationResult[]): void {
  console.log('\n========================================');
  console.log('🏆 TOP 10 CONFIGURATIONS');
  console.log('========================================\n');

  results.forEach((r, index) => {
    console.log(`### ${index + 1}. R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}%`);
    console.log(`\nParameters:`);
    Object.entries(r.params).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
    console.log(`\nPerformance:`);
    console.log(`  - Total Trades: ${r.metrics.totalTrades} (LONG: ${r.metrics.longTrades} | SHORT: ${r.metrics.shortTrades})`);
    console.log(`  - Win Rate: ${r.metrics.winRate.toFixed(1)}% (LONG: ${r.metrics.longWinRate.toFixed(1)}% | SHORT: ${r.metrics.shortWinRate.toFixed(1)}%)`);
    console.log(`  - Net PnL: ${r.metrics.netPnlPercent >= 0 ? '+' : ''}${r.metrics.netPnlPercent.toFixed(2)}% (${r.metrics.netPnlUsdt.toFixed(2)} USDT)`);
    console.log(`  - Stop-Out Rate: ${r.metrics.stopOutRate.toFixed(1)}%`);
    console.log('');
  });
}

// ============================================================================
// MAIN
// ============================================================================

const strategyArg = process.argv[2] as StrategyName;

if (!strategyArg || !Object.keys(STRATEGY_PARAMS).includes(strategyArg)) {
  console.error('Usage: npm run calibrate:scalping [strategy]');
  console.error('Available strategies: microwall, tickdelta, laddertp, limitorder, orderflow');
  process.exit(1);
}

runCalibration(strategyArg).catch((error) => {
  console.error('Calibration failed:', error);
  process.exit(1);
});
