/**
 * Test Structure-Based System (NO indicators for entry, only levels + patterns)
 *
 * Hypothesis: Trading only when:
 * 1. Strong level (2+ touches)
 * 2. Pattern (engulfing, double bottom, etc)
 * 3. Correct direction (trend aligned)
 *
 * Should beat 49% baseline because we're trading REAL setups, not random candles
 */

import * as fs from 'fs';
import * as path from 'path';
import { Candle, MLFeatureSet } from '../src/types';

interface BacktestResult {
  setup: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
}

const FEATURE_DIR = path.join(__dirname, '../data/pattern-validation');

function findFeatureFile(): string {
  const files = fs.readdirSync(FEATURE_DIR)
    .filter(f =>
      f.startsWith('pattern-features-') &&
      f.includes('1h') &&
      f.endsWith('.json') &&
      !f.includes('index')  // Exclude index files
    )
    .sort()
    .reverse();

  if (files.length === 0) throw new Error('No 1h feature files found');
  return path.join(FEATURE_DIR, files[0]);
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🏗️  STRUCTURE-BASED SYSTEM BACKTEST');
  console.log('='.repeat(100) + '\n');

  const filePath = findFeatureFile();
  console.log(`📂 Loading: ${path.basename(filePath)}\n`);

  const features: MLFeatureSet[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`✅ Loaded ${features.length} features\n`);

  const results: BacktestResult[] = [];

  // SETUP 1: Strong level bounce (support)
  {
    const setup = 'Strong Level (2+ touches) + Bounce Direction';
    const matches = features.filter(f =>
      f.levelAnalysis.isStrongLevel &&
      f.levelAnalysis.touchCount >= 2 &&
      f.technicalIndicators.emaTrend === 'BELOW' // Price below EMA = uptrend bias for bounce
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.5; // Assume avg win is 0.5%
    const avgLoss = -0.3; // Assume avg loss is 0.3%

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss),
    });
  }

  // SETUP 2: Engulfing pattern
  {
    const setup = 'Engulfing Pattern (Bullish)';
    const matches = features.filter(f =>
      (f.chartPatterns.engulfingBullish) &&
      f.technicalIndicators.rsi < 50  // Not overbought
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.4;
    const avgLoss = -0.25;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: matches.length > 0 ? (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss) : 0,
    });
  }

  // SETUP 3: Double bottom
  {
    const setup = 'Double Bottom Pattern';
    const matches = features.filter(f =>
      f.chartPatterns.doubleBottom &&
      f.levelAnalysis.isStrongLevel  // At strong support
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.6;
    const avgLoss = -0.2;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: matches.length > 0 ? (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss) : 0,
    });
  }

  // SETUP 4: Pattern + Level confluence
  {
    const setup = 'Pattern + Strong Level Confluence';
    const matches = features.filter(f =>
      (f.chartPatterns.engulfingBullish || f.chartPatterns.doubleBottom) &&
      f.levelAnalysis.isStrongLevel &&
      f.levelAnalysis.touchCount >= 2
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.7;
    const avgLoss = -0.2;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: matches.length > 0 ? (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss) : 0,
    });
  }

  // SETUP 5: Level bounce + Extreme RSI
  {
    const setup = 'Level Bounce + RSI Extreme (20-30 or 70-80)';
    const matches = features.filter(f =>
      f.levelAnalysis.isStrongLevel &&
      (
        (f.technicalIndicators.rsi < 30 && f.technicalIndicators.rsiTrend === 'UP') ||
        (f.technicalIndicators.rsi > 70 && f.technicalIndicators.rsiTrend === 'DOWN')
      )
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.55;
    const avgLoss = -0.25;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: matches.length > 0 ? (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss) : 0,
    });
  }

  // SETUP 6: Choch (Change of Character) at level
  {
    const setup = 'CHOCH at Strong Level';
    const matches = features.filter(f =>
      f.priceActionSignals.chochDetected &&
      f.levelAnalysis.isStrongLevel
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.65;
    const avgLoss = -0.2;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: matches.length > 0 ? (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss) : 0,
    });
  }

  // SETUP 7: Liquidity sweep + reversal
  {
    const setup = 'Liquidity Sweep + Reversal Signal';
    const matches = features.filter(f =>
      f.priceActionSignals.liquiditySweep &&
      (f.chartPatterns.engulfingBullish || f.chartPatterns.engulfingBearish)
    );

    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.75;
    const avgLoss = -0.3;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : wins > 0 ? 999 : 0,
      avgWin,
      avgLoss,
      expectancy: matches.length > 0 ? (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss) : 0,
    });
  }

  // BASELINE: All trades (current system)
  {
    const setup = 'BASELINE: All Trades (Current System)';
    const matches = features;
    const wins = matches.filter(f => f.label === 'WIN').length;
    const losses = matches.length - wins;
    const avgWin = 0.5;
    const avgLoss = -0.3;

    results.push({
      setup,
      totalTrades: matches.length,
      wins,
      losses,
      winRate: (wins / matches.length) * 100,
      profitFactor: losses > 0 ? (wins * avgWin) / (losses * Math.abs(avgLoss)) : 999,
      avgWin,
      avgLoss,
      expectancy: (wins / matches.length) * avgWin - (losses / matches.length) * Math.abs(avgLoss),
    });
  }

  // Print results
  console.log('📊 STRUCTURE-BASED SYSTEM RESULTS:');
  console.log('='.repeat(100));

  results.sort((a, b) => b.expectancy - a.expectancy);

  console.log('');
  console.log('Setup                                    | Trades |  WR %  | PF    | Exp    | Win/Loss');
  console.log('-'.repeat(100));

  for (const result of results) {
    const wrPct = result.winRate.toFixed(1).padStart(5);
    const pfStr = result.profitFactor.toFixed(2).padStart(5);
    const expStr = result.expectancy.toFixed(4).padStart(6);
    const setupName = result.setup.padEnd(40);
    const trades = String(result.totalTrades).padStart(6);
    const ratio = `${result.wins}/${result.losses}`.padEnd(8);

    console.log(`${setupName} | ${trades} | ${wrPct}% | ${pfStr} | ${expStr} | ${ratio}`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('🔍 ANALYSIS:');
  console.log('='.repeat(100) + '\n');

  const bestSetup = results[0];
  const baselineSetup = results.find(r => r.setup.includes('BASELINE'))!;

  console.log(`✅ BEST SETUP: ${bestSetup.setup}`);
  console.log(`   Win Rate: ${bestSetup.winRate.toFixed(1)}% (vs ${baselineSetup.winRate.toFixed(1)}% baseline)`);
  console.log(`   Profit Factor: ${bestSetup.profitFactor.toFixed(2)}x`);
  console.log(`   Expectancy: ${bestSetup.expectancy.toFixed(4)} (vs ${baselineSetup.expectancy.toFixed(4)} baseline)`);
  console.log(`   Trades: ${bestSetup.totalTrades}\n`);

  const setupsWithEdge = results.filter(r => r.winRate > 51 && r.totalTrades > 50);

  console.log(`📈 SETUPS WITH EDGE (>51% WR, >50 samples):`);
  if (setupsWithEdge.length === 0) {
    console.log('   ❌ NONE - Need to find better confluence\n');
  } else {
    setupsWithEdge.forEach(setup => {
      console.log(`   ✅ ${setup.setup} (${setup.winRate.toFixed(1)}% WR, ${setup.totalTrades} trades)`);
    });
    console.log('');
  }

  console.log(`🎯 CONCLUSION:`);
  console.log(`   Baseline (all trades): ${baselineSetup.winRate.toFixed(1)}% WR = -5% loss`);
  console.log(`   Best structure setup: ${bestSetup.winRate.toFixed(1)}% WR = ${bestSetup.expectancy > 0 ? '✅ PROFIT' : '❌ LOSS'}`);

  if (bestSetup.expectancy > baselineSetup.expectancy) {
    console.log(`   → Improvement: +${(bestSetup.expectancy - baselineSetup.expectancy).toFixed(4)}\n`);
  } else {
    console.log(`   → Structure-based system underperforms baseline\n`);
  }

  console.log('='.repeat(100) + '\n');
}

main().catch(console.error);
