/**
 * Filter out UNKNOWN strategy trades (restored positions after restart)
 */

import * as fs from 'fs';
import * as path from 'path';

const journalPath = path.join(__dirname, '../data/trade-journal.json');
const trades = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

const unknownTrades = trades.filter((t: any) =>
  t.entryCondition?.signal?.type === 'UNKNOWN' || !t.entryCondition?.signal?.type
);

const validTrades = trades.filter((t: any) =>
  t.entryCondition?.signal?.type && t.entryCondition.signal.type !== 'UNKNOWN'
);

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 UNKNOWN TRADES FILTER');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total trades:              ${trades.length}`);
console.log(`UNKNOWN trades:            ${unknownTrades.length}`);
console.log(`Valid trades (excluding):  ${validTrades.length}\n`);

console.log('UNKNOWN trades details:');
unknownTrades.forEach((t: any) => {
  console.log(`  - ${t.id} | ${t.side} | PnL: ${t.realizedPnL?.toFixed(2) || 'N/A'} | Status: ${t.closedAt ? 'CLOSED' : 'OPEN'}`);
});

// Save filtered journal
const filteredPath = path.join(__dirname, '../data/trade-journal-filtered.json');
fs.writeFileSync(filteredPath, JSON.stringify(validTrades, null, 2));

console.log(`\n✅ Filtered journal saved to: ${filteredPath}`);
console.log(`\nNow run: npm run analyze-journal data/trade-journal-filtered.json`);
