/**
 * Optimize LevelBased Strategy Parameters
 *
 * Tests different parameter combinations to find optimal:
 * - maxDistancePercent (distance from price to level)
 * - minTouchesRequired (how many times level touched)
 * - stopLossAtrMultiplier (SL size)
 * - takeProfitPercent (TP levels)
 * - minConfidenceLong / minConfidenceShort
 *
 * Uses XRP historical data from Nov 27 - Dec 4
 */

import * as fs from 'fs';
import * as path from 'path';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TestResult {
  params: {
    maxDistancePercent: number;
    minTouchesRequired: number;
    stopLossAtrMultiplier: number;
    takeProfitPercent: number[];
    minConfidenceLong: number;
    minConfidenceShort: number;
  };
  metrics: {
    totalTrades: number;
    longTrades: number;
    shortTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    longWinRate: number;
    shortWinRate: number;
    rrRatio: number;
    netPnL: number;
    avgWin: number;
    avgLoss: number;
  };
}

// Load 1m candlestick data
const dataPath = path.join(__dirname, '../data/historical/XRPUSDT_1m_2025-11-27_2025-12-04.json');
const candles: Candle[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('\n' + '='.repeat(100));
console.log('🚀 LevelBased Strategy Optimizer');
console.log('='.repeat(100));
console.log(`\n📊 Loaded ${candles.length} candles from XRP data\n`);

// Calculate ATR
function calculateATR(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      atr.push(0);
      continue;
    }

    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;

    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

    if (i < period) {
      atr.push(tr);
    } else {
      const prevATR = atr[i - 1];
      const newATR = (prevATR * (period - 1) + tr) / period;
      atr.push(newATR);
    }
  }

  return atr;
}

// Find support/resistance levels using swing points
function findLevels(candles: Candle[], lookback: number = 50): { support: number[], resistance: number[] } {
  const support: number[] = [];
  const resistance: number[] = [];

  for (let i = lookback; i < candles.length; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = Math.max(0, i - lookback); j <= Math.min(i + lookback, candles.length - 1); j++) {
      if (j !== i) {
        if (candles[j].high > candles[i].high) isSwingHigh = false;
        if (candles[j].low < candles[i].low) isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      resistance.push(candles[i].high);
    }
    if (isSwingLow) {
      support.push(candles[i].low);
    }
  }

  return { support, resistance };
}

// Find nearest level
function findNearestLevel(price: number, levels: number[], maxDistance: number): number | null {
  let nearest: number | null = null;
  let minDist = Infinity;

  for (const level of levels) {
    const dist = Math.abs(price - level) / price * 100;
    if (dist < maxDistance && dist < minDist) {
      minDist = dist;
      nearest = level;
    }
  }

  return nearest;
}

// Test parameter combination
function testParameters(params: {
  maxDistancePercent: number;
  minTouchesRequired: number;
  stopLossAtrMultiplier: number;
  takeProfitPercent: number[];
  minConfidenceLong: number;
  minConfidenceShort: number;
}): TestResult {
  const atr = calculateATR(candles);
  const { support, resistance } = findLevels(candles, 50);

  let wins = 0;
  let losses = 0;
  let longWins = 0;
  let longLosses = 0;
  let shortWins = 0;
  let shortLosses = 0;
  let totalWin = 0;
  let totalLoss = 0;

  // Simulate trades
  for (let i = 50; i < candles.length - 20; i++) {
    const currentPrice = candles[i].close;
    const atrValue = atr[i];

    // Check for support (LONG setup)
    const nearestSupport = findNearestLevel(currentPrice, support, params.maxDistancePercent);
    if (nearestSupport && currentPrice > nearestSupport * 0.995) { // Close to support
      const sl = currentPrice - (atrValue * params.stopLossAtrMultiplier);
      const tp1 = currentPrice + (currentPrice * params.takeProfitPercent[0] / 100);
      const tp2 = currentPrice + (currentPrice * params.takeProfitPercent[1] / 100);
      const tp3 = currentPrice + (currentPrice * params.takeProfitPercent[2] / 100);

      // Look ahead 20 candles
      let hitTP = false;
      let hitSL = false;

      for (let j = i + 1; j < Math.min(i + 20, candles.length); j++) {
        if (candles[j].high >= tp3) {
          hitTP = true;
          const pnl = (tp3 - currentPrice) / currentPrice * 100 - 0.12;
          totalWin += pnl;
          wins++;
          longWins++;
          break;
        } else if (candles[j].high >= tp2) {
          hitTP = true;
          const pnl = (tp2 - currentPrice) / currentPrice * 100 - 0.12;
          totalWin += pnl;
          wins++;
          longWins++;
          break;
        } else if (candles[j].high >= tp1) {
          hitTP = true;
          const pnl = (tp1 - currentPrice) / currentPrice * 100 - 0.12;
          totalWin += pnl;
          wins++;
          longWins++;
          break;
        }
        if (candles[j].low <= sl) {
          hitSL = true;
          const pnl = (sl - currentPrice) / currentPrice * 100 - 0.12;
          totalLoss += pnl;
          losses++;
          longLosses++;
          break;
        }
      }

      if (!hitTP && !hitSL) {
        const pnl = (candles[i + 19].close - currentPrice) / currentPrice * 100 - 0.12;
        if (pnl > 0) {
          wins++;
          longWins++;
          totalWin += pnl;
        } else {
          losses++;
          longLosses++;
          totalLoss += pnl;
        }
      }
    }

    // Check for resistance (SHORT setup)
    const nearestResistance = findNearestLevel(currentPrice, resistance, params.maxDistancePercent);
    if (nearestResistance && currentPrice < nearestResistance * 1.005) { // Close to resistance
      const sl = currentPrice + (atrValue * params.stopLossAtrMultiplier);
      const tp1 = currentPrice - (currentPrice * params.takeProfitPercent[0] / 100);
      const tp2 = currentPrice - (currentPrice * params.takeProfitPercent[1] / 100);
      const tp3 = currentPrice - (currentPrice * params.takeProfitPercent[2] / 100);

      // Look ahead 20 candles
      let hitTP = false;
      let hitSL = false;

      for (let j = i + 1; j < Math.min(i + 20, candles.length); j++) {
        if (candles[j].low <= tp3) {
          hitTP = true;
          const pnl = (currentPrice - tp3) / currentPrice * 100 - 0.12;
          totalWin += pnl;
          wins++;
          shortWins++;
          break;
        } else if (candles[j].low <= tp2) {
          hitTP = true;
          const pnl = (currentPrice - tp2) / currentPrice * 100 - 0.12;
          totalWin += pnl;
          wins++;
          shortWins++;
          break;
        } else if (candles[j].low <= tp1) {
          hitTP = true;
          const pnl = (currentPrice - tp1) / currentPrice * 100 - 0.12;
          totalWin += pnl;
          wins++;
          shortWins++;
          break;
        }
        if (candles[j].high >= sl) {
          hitSL = true;
          const pnl = (currentPrice - sl) / currentPrice * 100 - 0.12;
          totalLoss += pnl;
          losses++;
          shortLosses++;
          break;
        }
      }

      if (!hitTP && !hitSL) {
        const pnl = (currentPrice - candles[i + 19].close) / currentPrice * 100 - 0.12;
        if (pnl > 0) {
          wins++;
          shortWins++;
          totalWin += pnl;
        } else {
          losses++;
          shortLosses++;
          totalLoss += pnl;
        }
      }
    }
  }

  const totalTrades = wins + losses;
  const avgWin = wins > 0 ? totalWin / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;
  const rrRatio = avgWin === 0 || avgLoss === 0 ? 0 : Math.abs(avgWin / avgLoss);

  return {
    params,
    metrics: {
      totalTrades,
      longTrades: longWins + longLosses,
      shortTrades: shortWins + shortLosses,
      wins,
      losses,
      winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      longWinRate: (longWins + longLosses) > 0 ? (longWins / (longWins + longLosses)) * 100 : 0,
      shortWinRate: (shortWins + shortLosses) > 0 ? (shortWins / (shortWins + shortLosses)) * 100 : 0,
      rrRatio,
      netPnL: totalWin + totalLoss,
      avgWin,
      avgLoss,
    },
  };
}

// Test combinations
const results: TestResult[] = [];

const maxDistanceValues = [0.5, 1.0, 1.5, 2.0, 2.5];
const minTouchesValues = [2, 3, 4];
const stopLossMultiplierValues = [1.0, 1.2, 1.5];
const takeProfitCombos = [
  [0.5, 1.0, 1.5],
  [0.6, 1.2, 2.0],
  [0.8, 1.3, 2.0],
  [1.0, 1.5, 2.5],
];
const minConfidenceValues = [70, 75, 80, 85];

let tested = 0;
const total = maxDistanceValues.length *
              minTouchesValues.length *
              stopLossMultiplierValues.length *
              takeProfitCombos.length *
              minConfidenceValues.length;

for (const maxDist of maxDistanceValues) {
  for (const minTouches of minTouchesValues) {
    for (const slMult of stopLossMultiplierValues) {
      for (const tpCombo of takeProfitCombos) {
        for (const minConf of minConfidenceValues) {
          tested++;
          const result = testParameters({
            maxDistancePercent: maxDist,
            minTouchesRequired: minTouches,
            stopLossAtrMultiplier: slMult,
            takeProfitPercent: tpCombo,
            minConfidenceLong: minConf,
            minConfidenceShort: minConf,
          });

          if (result.metrics.totalTrades > 5) {
            results.push(result);
          }

          if (tested % 50 === 0) {
            process.stdout.write(`\r[${tested}/${total}] Testing... Found ${results.length} valid combos`);
          }
        }
      }
    }
  }
}

console.log(`\r✅ Tested ${tested} combinations, found ${results.length} valid\n`);

// Sort by R/R ratio and win rate (combined score)
results.sort((a, b) => {
  const scoreA = a.metrics.rrRatio * (a.metrics.winRate / 100) * (1 + a.metrics.netPnL / 100);
  const scoreB = b.metrics.rrRatio * (b.metrics.winRate / 100) * (1 + b.metrics.netPnL / 100);
  return scoreB - scoreA;
});

// Display top 20 results
console.log('='.repeat(120));
console.log('🏆 TOP 20 PARAMETER COMBINATIONS');
console.log('='.repeat(120) + '\n');

for (let i = 0; i < Math.min(20, results.length); i++) {
  const r = results[i];
  console.log(`\n${i + 1}. R/R: ${r.metrics.rrRatio.toFixed(2)}x | WR: ${r.metrics.winRate.toFixed(1)}% | PnL: ${r.metrics.netPnL.toFixed(2)}%`);
  console.log(`   Long: ${r.metrics.longWinRate.toFixed(1)}% WR | Short: ${r.metrics.shortWinRate.toFixed(1)}% WR`);
  console.log(`   Parameters:`);
  console.log(`   - maxDistancePercent: ${r.params.maxDistancePercent}`);
  console.log(`   - minTouchesRequired: ${r.params.minTouchesRequired}`);
  console.log(`   - stopLossAtrMultiplier: ${r.params.stopLossAtrMultiplier}`);
  console.log(`   - takeProfitPercent: [${r.params.takeProfitPercent.join(', ')}]`);
  console.log(`   - minConfidence: ${r.params.minConfidenceLong}`);
  console.log(`   Statistics:`);
  console.log(`   - Total Trades: ${r.metrics.totalTrades} (LONG: ${r.metrics.longTrades} | SHORT: ${r.metrics.shortTrades})`);
  console.log(`   - Wins: ${r.metrics.wins} | Losses: ${r.metrics.losses}`);
  console.log(`   - Avg Win: ${r.metrics.avgWin.toFixed(3)}% | Avg Loss: ${r.metrics.avgLoss.toFixed(3)}%`);
}

// Save results to file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputFile = path.join(__dirname, `../level-based-optimization-results-${timestamp}.json`);
fs.writeFileSync(outputFile, JSON.stringify(results.slice(0, 50), null, 2));

console.log(`\n✅ Top 50 results saved to: ${outputFile}\n`);

// Print best config as JSON
if (results.length > 0) {
  const best = results[0];
  console.log('='.repeat(120));
  console.log('💎 BEST CONFIG (готов к копированию в config.json):');
  console.log('='.repeat(120));
  console.log(`\n{
  "levelBased": {
    "enabled": true,
    "maxDistancePercent": ${best.params.maxDistancePercent},
    "minTouchesRequired": ${best.params.minTouchesRequired},
    "stopLossAtrMultiplier": ${best.params.stopLossAtrMultiplier},
    "longEntry": {
      "enabled": true,
      "minConfidence": ${best.params.minConfidenceLong}
    },
    "shortEntry": {
      "enabled": true,
      "minConfidence": ${best.params.minConfidenceShort}
    },
    "takeProfitPercent": [${best.params.takeProfitPercent.join(', ')}],
    "takeProfitSizePercent": [50, 30, 20]
  }
}\n`);
}
