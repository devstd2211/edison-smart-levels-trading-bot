/**
 * Deep Pattern Analysis - Find common traits in losing trades
 * Analyze: sources, confidence, entry reasons, SL distance, etc.
 */

import * as fs from 'fs';
import * as path from 'path';

interface JournalEntry {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  openedAt: number;
  closedAt?: number;
  entryCondition: {
    signal: {
      confidence: number;
      reason: string;
      stopLoss: number;
      timestamp: number;
    };
  };
  exitCondition?: {
    exitType: string;
    pnlPercent: number;
    holdingTimeMinutes: number;
    stoppedOut: boolean;
  };
  status: 'OPEN' | 'CLOSED';
}

const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');
const journalData = fs.readFileSync(journalPath, 'utf-8');
const trades: JournalEntry[] = JSON.parse(journalData);

// Filter closed trades
const closed = trades.filter(t => t.status === 'CLOSED');
const losing = closed.filter(t => (t.realizedPnL || 0) < 0);
const winning = closed.filter(t => (t.realizedPnL || 0) > 0);

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 PATTERN ANALYSIS: LOSING vs WINNING TRADES');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. CONFIDENCE DISTRIBUTION
console.log('📊 1. CONFIDENCE LEVELS');
console.log('───────────────────────────────────────────────────────────────');

const avgConfLosing = losing.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / losing.length;
const avgConfWinning = winning.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / winning.length;
const minConfLosing = Math.min(...losing.map(t => t.entryCondition.signal.confidence));
const maxConfWinning = Math.max(...winning.map(t => t.entryCondition.signal.confidence));

console.log(`Losing trades avg confidence:   ${(avgConfLosing * 100).toFixed(1)}%`);
console.log(`Winning trades avg confidence:  ${(avgConfWinning * 100).toFixed(1)}%`);
console.log(`Min confidence (losing):        ${(minConfLosing * 100).toFixed(1)}%`);
console.log(`Max confidence (winning):       ${(maxConfWinning * 100).toFixed(1)}%`);
console.log('');

// 2. ENTRY SOURCES ANALYSIS
console.log('\n📊 2. ENTRY SIGNAL SOURCES (analyzing "reason" field)');
console.log('───────────────────────────────────────────────────────────────');

const extractSources = (reason: string): string[] => {
  const match = reason.match(/Sources:\s*(.+?)(?:\s*\[|$)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(s => s.trim().split('(')[0])
    .filter(s => s.length > 0);
};

const losingSourceFreq: Map<string, number> = new Map();
const winningSourceFreq: Map<string, number> = new Map();

losing.forEach(t => {
  const sources = extractSources(t.entryCondition.signal.reason);
  sources.forEach(src => {
    losingSourceFreq.set(src, (losingSourceFreq.get(src) || 0) + 1);
  });
});

winning.forEach(t => {
  const sources = extractSources(t.entryCondition.signal.reason);
  sources.forEach(src => {
    winningSourceFreq.set(src, (winningSourceFreq.get(src) || 0) + 1);
  });
});

console.log('🔴 LOSING TRADES - Top sources:');
const losingByFreq = Array.from(losingSourceFreq.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

losingByFreq.forEach(([src, count]) => {
  const pct = ((count / losing.length) * 100).toFixed(1);
  console.log(`   ${src.padEnd(25)} ${count}/${losing.length} (${pct}%)`);
});

console.log('\n🟢 WINNING TRADES - Top sources:');
const winningByFreq = Array.from(winningSourceFreq.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

winningByFreq.forEach(([src, count]) => {
  const pct = ((count / winning.length) * 100).toFixed(1);
  console.log(`   ${src.padEnd(25)} ${count}/${winning.length} (${pct}%)`);
});

// 3. SIDE ANALYSIS (LONG vs SHORT)
console.log('\n\n📊 3. LONG vs SHORT PERFORMANCE');
console.log('───────────────────────────────────────────────────────────────');

const longLosing = losing.filter(t => t.side === 'LONG').length;
const shortLosing = losing.filter(t => t.side === 'SHORT').length;
const longWinning = winning.filter(t => t.side === 'LONG').length;
const shortWinning = winning.filter(t => t.side === 'SHORT').length;

console.log(`LONG losses:   ${longLosing}/${losing.length} (${((longLosing / losing.length) * 100).toFixed(1)}%)`);
console.log(`SHORT losses:  ${shortLosing}/${losing.length} (${((shortLosing / losing.length) * 100).toFixed(1)}%)`);
console.log(`LONG wins:     ${longWinning}/${winning.length} (${((longWinning / winning.length) * 100).toFixed(1)}%)`);
console.log(`SHORT wins:    ${shortWinning}/${winning.length} (${((shortWinning / winning.length) * 100).toFixed(1)}%)`);

const longWinRate = longWinning + longLosing > 0 ? (longWinning / (longWinning + longLosing)) * 100 : 0;
const shortWinRate = shortWinning + shortLosing > 0 ? (shortWinning / (shortWinning + shortLosing)) * 100 : 0;

console.log(`\nLONG win rate:   ${longWinRate.toFixed(1)}%`);
console.log(`SHORT win rate:  ${shortWinRate.toFixed(1)}%`);

// 4. STOP LOSS DISTANCE ANALYSIS
console.log('\n\n📊 4. STOP LOSS DISTANCE (Entry vs SL)');
console.log('───────────────────────────────────────────────────────────────');

const getSLDistance = (t: JournalEntry) => {
  return Math.abs(t.entryCondition.signal.stopLoss - t.entryPrice) / t.entryPrice * 100;
};

const avgSLDist = (trades: JournalEntry[]) =>
  trades.reduce((sum, t) => sum + getSLDistance(t), 0) / trades.length;

console.log(`Losing trades avg SL distance:   ${avgSLDist(losing).toFixed(2)}%`);
console.log(`Winning trades avg SL distance:  ${avgSLDist(winning).toFixed(2)}%`);

// Check for tight SL in losing trades
const tightSL = losing.filter(t => getSLDistance(t) < 0.8).length;
console.log(`\nLosing trades with SL < 0.8%:   ${tightSL}/${losing.length} (${((tightSL / losing.length) * 100).toFixed(1)}%)`);

// 5. HOLDING TIME ANALYSIS
console.log('\n\n📊 5. HOLDING TIME (How long in position)');
console.log('───────────────────────────────────────────────────────────────');

const avgHoldingLosing = losing.filter(t => t.exitCondition).reduce((sum, t) => sum + (t.exitCondition?.holdingTimeMinutes || 0), 0) / losing.filter(t => t.exitCondition).length;
const avgHoldingWinning = winning.filter(t => t.exitCondition).reduce((sum, t) => sum + (t.exitCondition?.holdingTimeMinutes || 0), 0) / winning.filter(t => t.exitCondition).length;

console.log(`Losing trades avg holding time:  ${avgHoldingLosing.toFixed(1)} minutes`);
console.log(`Winning trades avg holding time: ${avgHoldingWinning.toFixed(1)} minutes`);

const quickLosses = losing.filter(t => (t.exitCondition?.holdingTimeMinutes || 0) < 20).length;
console.log(`\nQuick stops (< 20 min) in losses: ${quickLosses}/${losing.length} (${((quickLosses / losing.length) * 100).toFixed(1)}%)`);

// 6. EXIT TYPE ANALYSIS
console.log('\n\n📊 6. EXIT TYPES');
console.log('───────────────────────────────────────────────────────────────');

const exitTypes: Map<string, { losing: number; winning: number }> = new Map();

losing.forEach(t => {
  const type = t.exitCondition?.exitType || 'UNKNOWN';
  if (!exitTypes.has(type)) exitTypes.set(type, { losing: 0, winning: 0 });
  exitTypes.get(type)!.losing++;
});

winning.forEach(t => {
  const type = t.exitCondition?.exitType || 'UNKNOWN';
  if (!exitTypes.has(type)) exitTypes.set(type, { losing: 0, winning: 0 });
  exitTypes.get(type)!.winning++;
});

Array.from(exitTypes.entries()).forEach(([type, stats]) => {
  const total = stats.losing + stats.winning;
  const winRate = ((stats.winning / total) * 100).toFixed(1);
  console.log(`${type.padEnd(20)} | Losses: ${stats.losing} | Wins: ${stats.winning} | Win Rate: ${winRate}%`);
});

// 7. PRICE ACTION ANALYSIS
console.log('\n\n📊 7. PRICE ACTION (Actual move vs SL distance)');
console.log('───────────────────────────────────────────────────────────────');

const shortStops = losing.filter(t => {
  const slDist = getSLDistance(t);
  const actualMove = Math.abs(t.exitPrice! - t.entryPrice) / t.entryPrice * 100;
  return actualMove < slDist * 0.9; // Hit SL quickly
}).length;

console.log(`Losing trades that hit SL < avg move: ${shortStops}/${losing.length} (${((shortStops / losing.length) * 100).toFixed(1)}%)`);
console.log('(Indicates SL is being hit despite normal price action)\n');

// SUMMARY
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🎯 KEY FINDINGS');
console.log('═══════════════════════════════════════════════════════════════\n');

const findings = [];

if (avgConfLosing < avgConfWinning - 5) {
  findings.push(`❌ Low confidence signals lose money (${(avgConfLosing * 100).toFixed(1)}% vs ${(avgConfWinning * 100).toFixed(1)}%)`);
}

if (longWinRate < shortWinRate - 15) {
  findings.push(`❌ LONG trades significantly underperform (${longWinRate.toFixed(1)}% vs ${shortWinRate.toFixed(1)}%)`);
}

if (tightSL > losing.length * 0.5) {
  findings.push(`❌ Too many tight stop losses (${tightSL}/${losing.length}) - getting stopped out by normal volatility`);
}

if (quickLosses > losing.length * 0.3) {
  findings.push(`❌ Quick exits dominate losses (${quickLosses}/${losing.length}) - not giving trades room to breathe`);
}

const mostCommonLosingSource = losingByFreq[0];
const mostCommonWinningSource = winningByFreq[0];
if (mostCommonLosingSource && mostCommonWinningSource && mostCommonLosingSource[0] !== mostCommonWinningSource[0]) {
  findings.push(`❌ Different sources for losses vs wins - ${mostCommonLosingSource[0]} dominates losses`);
}

findings.forEach((f, i) => console.log(`${i + 1}. ${f}`));
