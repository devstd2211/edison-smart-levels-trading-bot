/**
 * Loss Pattern Analysis V2 - Adapted for actual journal structure
 */

import * as fs from 'fs';
import * as path from 'path';

interface Trade {
  id: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  openedAt: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  status: string;
  entryCondition: {
    signal: {
      type: string;
      confidence: number;
      stopLoss: number;
      takeProfits: Array<{ level: number; price: number; hit: boolean }>;
    };
  };
  exitCondition?: {
    exitType: string;
    timestamp: number;
    pnlUsdt: number;
    pnlPercent: number;
    tpLevelsHit?: number[];
  };
}

function main() {
  const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

  console.log(`📖 Loading journal: ${journalPath}\n`);
  const trades: Trade[] = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

  const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.exitCondition);
  const losers = closedTrades.filter(t => (t.exitCondition?.pnlUsdt || 0) < 0);
  const winners = closedTrades.filter(t => (t.exitCondition?.pnlUsdt || 0) >= 0);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 LOSS PATTERN ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Closed:  ${closedTrades.length}`);
  console.log(`Winners:       ${winners.length} (${((winners.length/closedTrades.length)*100).toFixed(1)}%)`);
  console.log(`Losers:        ${losers.length} (${((losers.length/closedTrades.length)*100).toFixed(1)}%)\n`);

  if (losers.length === 0) {
    console.log('✅ No losing trades found!');
    return;
  }

  const longLosers = losers.filter(t => t.side === 'LONG');
  const shortLosers = losers.filter(t => t.side === 'SHORT');

  const totalLoss = losers.reduce((sum, t) => sum + (t.exitCondition?.pnlUsdt || 0), 0);
  console.log(`Total Loss: ${totalLoss.toFixed(4)} USDT\n`);

  // LONG Analysis
  if (longLosers.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log('📉 LONG LOSING TRADES (' + longLosers.length + ' trades)');
    console.log('───────────────────────────────────────────────────────────────\n');
    analyzeSide(longLosers);
  }

  // SHORT Analysis
  if (shortLosers.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('📉 SHORT LOSING TRADES (' + shortLosers.length + ' trades)');
    console.log('───────────────────────────────────────────────────────────────\n');
    analyzeSide(shortLosers);
  }

  // Recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 KEY FINDINGS & RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  generateRecommendations(losers, winners);
}

function analyzeSide(trades: Trade[]) {
  const totalLoss = trades.reduce((sum, t) => sum + (t.exitCondition?.pnlUsdt || 0), 0);
  const avgLoss = totalLoss / trades.length;

  console.log(`Total Loss:   ${totalLoss.toFixed(4)} USDT`);
  console.log(`Average Loss: ${avgLoss.toFixed(4)} USDT\n`);

  // Exit type distribution
  console.log('🔍 Exit Types:');
  const byExitType = groupBy(trades, t => t.exitCondition?.exitType || 'UNKNOWN');
  Object.entries(byExitType).forEach(([type, trades]) => {
    const loss = trades.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0);
    console.log(`  ${type.padEnd(20)} ${trades.length.toString().padStart(3)} | ${loss.toFixed(4)} USDT`);
  });

  // Strategy distribution
  console.log('\n🔍 Strategy:');
  const byStrategy = groupBy(trades, t => t.entryCondition.signal.type);
  Object.entries(byStrategy).forEach(([strategy, trades]) => {
    const loss = trades.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0);
    const avgConf = trades.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / trades.length;
    console.log(`  ${strategy.padEnd(20)} ${trades.length.toString().padStart(3)} | ${loss.toFixed(4)} USDT | Conf: ${(avgConf * 100).toFixed(1)}%`);
  });

  // Confidence levels
  console.log('\n🔍 Confidence Levels:');
  const lowConf = trades.filter(t => t.entryCondition.signal.confidence < 0.80);
  const medConf = trades.filter(t => t.entryCondition.signal.confidence >= 0.80 && t.entryCondition.signal.confidence < 0.90);
  const highConf = trades.filter(t => t.entryCondition.signal.confidence >= 0.90);

  console.log(`  < 80%:  ${lowConf.length.toString().padStart(3)} | ${lowConf.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0).toFixed(4)} USDT`);
  console.log(`  80-90%: ${medConf.length.toString().padStart(3)} | ${medConf.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0).toFixed(4)} USDT`);
  console.log(`  > 90%:  ${highConf.length.toString().padStart(3)} | ${highConf.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0).toFixed(4)} USDT`);

  // Quick stop outs
  console.log('\n🔍 Holding Time (Stop Loss exits only):');
  const slTrades = trades.filter(t => t.exitCondition?.exitType === 'STOP_LOSS');

  if (slTrades.length > 0) {
    const quickStops = slTrades.filter(t => {
      const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
      return holdTime < 5;
    });

    const medStops = slTrades.filter(t => {
      const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
      return holdTime >= 5 && holdTime < 15;
    });

    const slowStops = slTrades.filter(t => {
      const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
      return holdTime >= 15;
    });

    console.log(`  < 5 min:  ${quickStops.length.toString().padStart(3)} | ${quickStops.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0).toFixed(4)} USDT ⚠️ BAD ENTRY!`);
    console.log(`  5-15 min: ${medStops.length.toString().padStart(3)} | ${medStops.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0).toFixed(4)} USDT`);
    console.log(`  > 15 min: ${slowStops.length.toString().padStart(3)} | ${slowStops.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0).toFixed(4)} USDT`);
  }

  // Worst trades
  console.log('\n🔍 Top 5 Worst:');
  const worst = [...trades].sort((a, b) => (a.exitCondition?.pnlUsdt || 0) - (b.exitCondition?.pnlUsdt || 0)).slice(0, 5);
  worst.forEach((t, i) => {
    const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
    const strategy = t.entryCondition.signal.type;
    const conf = t.entryCondition.signal.confidence;
    console.log(`  ${(i+1)}. ${t.id.slice(0,15)}... | ${(t.exitCondition?.pnlUsdt || 0).toFixed(4)} USDT | ${strategy} | Conf: ${(conf * 100).toFixed(0)}% | ${holdTime.toFixed(1)}min`);
  });
}

function generateRecommendations(losers: Trade[], winners: Trade[]) {
  const recs: string[] = [];

  // Check confidence delta
  const loserAvgConf = losers.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / losers.length;
  const winnerAvgConf = winners.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / winners.length;

  console.log(`Avg Confidence: Losers ${(loserAvgConf * 100).toFixed(1)}% vs Winners ${(winnerAvgConf * 100).toFixed(1)}%`);

  if ((winnerAvgConf - loserAvgConf) > 0.05) {
    recs.push(`⚠️ RAISE CONFIDENCE THRESHOLD: Winners avg ${(winnerAvgConf * 100).toFixed(1)}%, losers ${(loserAvgConf * 100).toFixed(1)}%. Consider requiring > ${Math.ceil(loserAvgConf * 100 + 5)}%`);
  }

  // Quick stop outs
  const slLosers = losers.filter(t => t.exitCondition?.exitType === 'STOP_LOSS');
  const quickStops = slLosers.filter(t => {
    const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
    return holdTime < 5;
  });

  if (quickStops.length > slLosers.length * 0.3) {
    const quickLoss = quickStops.reduce((s, t) => s + (t.exitCondition?.pnlUsdt || 0), 0);
    recs.push(`⚠️ TOO MANY QUICK STOP OUTS: ${quickStops.length}/${slLosers.length} (${((quickStops.length/slLosers.length)*100).toFixed(1)}%) stopped < 5min. Loss: ${quickLoss.toFixed(4)} USDT. BAD ENTRY TIMING!`);
  }

  // Strategy performance
  const losersByStrategy = groupBy(losers, t => t.entryCondition.signal.type);
  const winnersByStrategy = groupBy(winners, t => t.entryCondition.signal.type);

  console.log('\nStrategy Win Rates:');
  const allStrategies = new Set([...Object.keys(losersByStrategy), ...Object.keys(winnersByStrategy)]);
  allStrategies.forEach(strategy => {
    const lCount = (losersByStrategy[strategy] || []).length;
    const wCount = (winnersByStrategy[strategy] || []).length;
    const winRate = wCount / (lCount + wCount) * 100;
    console.log(`  ${strategy.padEnd(20)} ${winRate.toFixed(1)}% (${wCount}W / ${lCount}L)`);

    if (winRate < 40) {
      recs.push(`⚠️ POOR STRATEGY: ${strategy} only ${winRate.toFixed(1)}% win rate. Consider disabling or fixing.`);
    }
  });

  // LONG vs SHORT
  const longLosers = losers.filter(t => t.side === 'LONG');
  const shortLosers = losers.filter(t => t.side === 'SHORT');
  const longWinners = winners.filter(t => t.side === 'LONG');
  const shortWinners = winners.filter(t => t.side === 'SHORT');

  const longWinRate = longWinners.length / (longLosers.length + longWinners.length) * 100;
  const shortWinRate = shortWinners.length / (shortLosers.length + shortWinners.length) * 100;

  console.log('\nDirectional Performance:');
  console.log(`  LONG:  ${longWinRate.toFixed(1)}% (${longWinners.length}W / ${longLosers.length}L)`);
  console.log(`  SHORT: ${shortWinRate.toFixed(1)}% (${shortWinners.length}W / ${shortLosers.length}L)`);

  if (Math.abs(longWinRate - shortWinRate) > 20) {
    const worse = longWinRate < shortWinRate ? 'LONG' : 'SHORT';
    const worseRate = longWinRate < shortWinRate ? longWinRate : shortWinRate;
    recs.push(`⚠️ DIRECTIONAL BIAS: ${worse} underperforming (${worseRate.toFixed(1)}% vs ${worse === 'LONG' ? shortWinRate.toFixed(1) : longWinRate.toFixed(1)}%). Review ${worse} filters.`);
  }

  // Output
  console.log('\nRecommendations:');
  if (recs.length === 0) {
    console.log('  ✅ No critical issues. Keep monitoring.\n');
  } else {
    recs.forEach((rec, i) => console.log(`  ${i+1}. ${rec}`));
    console.log('');
  }
}

function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

main();
