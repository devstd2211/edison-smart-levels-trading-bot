/**
 * Analyze Trades By Time of Day
 * Group trades by hour to find which times are profitable/unprofitable
 */

import * as fs from 'fs';
import * as path from 'path';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

interface TradeData {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  openedAt: number;
  status: 'OPEN' | 'CLOSED';
  realizedPnL?: number;
  exitCondition?: {
    exitType: string;
    holdingTimeMinutes: number;
  };
}

const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

const journalData = fs.readFileSync(journalPath, 'utf-8');
const trades: TradeData[] = JSON.parse(journalData);

// Group by hour (UTC)
const byHour: Map<number, TradeData[]> = new Map();

trades.forEach((trade) => {
  const date = new Date(trade.openedAt);
  const hour = date.getUTCHours();

  if (!byHour.has(hour)) {
    byHour.set(hour, []);
  }
  byHour.get(hour)!.push(trade);
});

// Analyze each hour
const hours = Array.from(byHour.keys()).sort((a, b) => a - b);

console.log('═══════════════════════════════════════════════════════════════');
console.log(`${ICONS.chart} TRADES BY HOUR (UTC)`);
console.log('═══════════════════════════════════════════════════════════════\n');

const hourStats = hours.map(hour => {
  const hoursData = byHour.get(hour)!;
  const closed = hoursData.filter(t => t.status === 'CLOSED');
  const profitable = closed.filter(t => (t.realizedPnL || 0) > 0);
  const losing = closed.filter(t => (t.realizedPnL || 0) < 0);
  const totalPnL = closed.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

  const winRate = closed.length > 0 ? (profitable.length / closed.length) * 100 : 0;

  console.log(`\n${'═'.repeat(63)}`);
  console.log(`${ICONS.one_oclock} HOUR ${hour.toString().padStart(2, '0')}:00 UTC (${hour + 3}:00 MSK)`);
  console.log(`${'═'.repeat(63)}`);
  console.log(`Total Trades:     ${hoursData.length}`);
  console.log(`Closed:           ${closed.length}`);
  console.log(`Profitable:       ${profitable.length} (${winRate.toFixed(1)}%)`);
  console.log(`Losing:           ${losing.length}`);
  console.log(`Total PnL:        ${totalPnL.toFixed(2)} USDT`);
  console.log('');

  // List trades
  hoursData.forEach(trade => {
    const timeStr = new Date(trade.openedAt).toISOString();
    const pnl = trade.realizedPnL ? `${trade.realizedPnL > 0 ? '✅' : '❌'} ${trade.realizedPnL.toFixed(2)}` : `${ICONS.hourglass} OPEN`;
    const holding = trade.exitCondition ? `${trade.exitCondition.holdingTimeMinutes.toFixed(0)}m` : '-';

    console.log(`  ${trade.id.padEnd(30)} | ${holding.padStart(3)} | ${pnl.padStart(10)}`);
  });

  return { hour, count: hoursData.length, closed: closed.length, winRate, totalPnL };
});

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log(`${ICONS.chart_up} SUMMARY BY HOUR`);
console.log('═══════════════════════════════════════════════════════════════\n');

hourStats.forEach(stat => {
  const status = stat.totalPnL > 0 ? `${ICONS.success}` : `${ICONS.error}`;
  console.log(`Hour ${stat.hour.toString().padStart(2, '0')}:00 (MSK ${(stat.hour + 3).toString().padStart(2, '0')}:00) | ${stat.count} trades | Win: ${stat.winRate.toFixed(0)}% | PnL: ${status} ${stat.totalPnL.toFixed(2)} USDT`);
});

// Find best/worst hours
const sortedByPnL = [...hourStats].sort((a, b) => b.totalPnL - a.totalPnL);
const bestHour = sortedByPnL[0];
const worstHour = sortedByPnL[sortedByPnL.length - 1];

console.log('\n' + '═'.repeat(63));
console.log(`
${ICONS.success} BEST HOUR:  ${bestHour.hour.toString().padStart(2, '0')}:00 UTC (${(bestHour.hour + 3).toString().padStart(2, '0')}:00 MSK) | ${bestHour.totalPnL.toFixed(2)} USDT`);
console.log(`${ICONS.error} WORST HOUR: ${worstHour.hour.toString().padStart(2, '0')}:00 UTC (${(worstHour.hour + 3).toString().padStart(2, '0')}:00 MSK) | ${worstHour.totalPnL.toFixed(2)} USDT`);

