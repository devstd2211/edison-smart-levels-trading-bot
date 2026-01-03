/**
 * Optimize EdgeReversals Strategy Parameters
 *
 * Tests different parameter combinations to find optimal:
 * - minConfidence
 * - rsiThreshold
 * - stopLossAtrMultiplier
 * - takeProfitPercent
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
    minConfidence: number;
    rsiThreshold: number;
    stopLossAtrMultiplier: number;
    takeProfitPercent: number;
  };
  metrics: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
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
console.log('🚀 EdgeReversals Strategy Optimizer');
console.log('='.repeat(100));
console.log(`\n📊 Loaded ${candles.length} candles\n`);

// Calculate RSI
function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(50);
      continue;
    }

    let gains = 0;
    let losses = 0;

    for (let j = i - period; j < i; j++) {
      const change = prices[j + 1] - prices[j];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiValue = 100 - (100 / (1 + rs));

    rsi.push(rsiValue);
  }

  return rsi;
}

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

// Test parameter combination
function testParameters(params: {
  minConfidence: number;
  rsiThreshold: number;
  stopLossAtrMultiplier: number;
  takeProfitPercent: number;
}): TestResult {
  const closes = candles.map(c => c.close);
  const rsi = calculateRSI(closes);
  const atr = calculateATR(candles);

  let wins = 0;
  let losses = 0;
  let totalWin = 0;
  let totalLoss = 0;

  // Simulate trades: RSI oversold (< threshold) = potential reversal
  for (let i = 14; i < candles.length - 5; i++) {
    const currentRSI = rsi[i];
    const currentPrice = candles[i].close;
    const atrValue = atr[i];

    // Entry condition: RSI < threshold (oversold)
    if (currentRSI < params.rsiThreshold) {
      // Calculate TP and SL
      const sl = currentPrice - (atrValue * params.stopLossAtrMultiplier);
      const tp = currentPrice + (currentPrice * params.takeProfitPercent / 100);

      // Look ahead 5 candles
      let hitTP = false;
      let hitSL = false;

      for (let j = i + 1; j < Math.min(i + 5, candles.length); j++) {
        if (candles[j].high >= tp) {
          hitTP = true;
          const pnl = (tp - currentPrice) / currentPrice * 100 - 0.12; // -0.12% fees
          totalWin += pnl;
          wins++;
          break;
        }
        if (candles[j].low <= sl) {
          hitSL = true;
          const pnl = (sl - currentPrice) / currentPrice * 100 - 0.12;
          totalLoss += pnl;
          losses++;
          break;
        }
      }

      // If neither hit in 5 candles, assume SL
      if (!hitTP && !hitSL) {
        const pnl = (candles[i + 4].close - currentPrice) / currentPrice * 100 - 0.12;
        if (pnl > 0) {
          wins++;
          totalWin += pnl;
        } else {
          losses++;
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
      wins,
      losses,
      winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      rrRatio,
      netPnL: totalWin + totalLoss,
      avgWin,
      avgLoss,
    },
  };
}

// Test combinations
const results: TestResult[] = [];

const minConfidenceValues = [45, 50, 54, 60, 70];
const rsiThresholdValues = [25, 30, 35, 40, 45];
const stopLossMultiplierValues = [1.0, 1.2, 1.5, 2.0];
const takeProfitPercentValues = [0.3, 0.4, 0.5, 0.6, 0.7];

let tested = 0;
const total = minConfidenceValues.length *
              rsiThresholdValues.length *
              stopLossMultiplierValues.length *
              takeProfitPercentValues.length;

for (const minConf of minConfidenceValues) {
  for (const rsiThresh of rsiThresholdValues) {
    for (const slMult of stopLossMultiplierValues) {
      for (const tp of takeProfitPercentValues) {
        tested++;
        const result = testParameters({
          minConfidence: minConf,
          rsiThreshold: rsiThresh,
          stopLossAtrMultiplier: slMult,
          takeProfitPercent: tp,
        });

        if (result.metrics.totalTrades > 0) {
          results.push(result);
        }

        if (tested % 10 === 0) {
          process.stdout.write(`\r[${tested}/${total}] Testing...`);
        }
      }
    }
  }
}

console.log(`\r✅ Tested ${tested} combinations\n`);

// Sort by R/R ratio and win rate
results.sort((a, b) => {
  const scoreA = a.metrics.rrRatio * (a.metrics.winRate / 100);
  const scoreB = b.metrics.rrRatio * (b.metrics.winRate / 100);
  return scoreB - scoreA;
});

// Display top 15 results
console.log('='.repeat(100));
console.log('🏆 TOP 15 PARAMETER COMBINATIONS');
console.log('='.repeat(100) + '\n');

for (let i = 0; i < Math.min(15, results.length); i++) {
  const r = results[i];
  console.log(`\n${i + 1}. R/R: ${r.metrics.rrRatio.toFixed(2)}x | WR: ${r.metrics.winRate.toFixed(1)}% | PnL: ${r.metrics.netPnL.toFixed(2)}%`);
  console.log(`   Parameters:`);
  console.log(`   - minConfidence: ${r.params.minConfidence}`);
  console.log(`   - rsiThreshold: ${r.params.rsiThreshold}`);
  console.log(`   - stopLossAtrMultiplier: ${r.params.stopLossAtrMultiplier}`);
  console.log(`   - takeProfitPercent: ${r.params.takeProfitPercent}`);
  console.log(`   Statistics:`);
  console.log(`   - Trades: ${r.metrics.totalTrades} (${r.metrics.wins}W/${r.metrics.losses}L)`);
  console.log(`   - Avg Win: ${r.metrics.avgWin.toFixed(3)}% | Avg Loss: ${r.metrics.avgLoss.toFixed(3)}%`);
}

// Save results to file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputFile = path.join(__dirname, `../edge-optimization-results-${timestamp}.json`);
fs.writeFileSync(outputFile, JSON.stringify(results.slice(0, 20), null, 2));

console.log(`\n✅ Top 20 results saved to: ${outputFile}\n`);
