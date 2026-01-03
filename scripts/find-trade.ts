import * as fs from 'fs';

const journal = JSON.parse(fs.readFileSync('data/trade-journal.json', 'utf-8'));

console.log('Looking for SHORT trade @ ~1.1316...\n');

// Find trade with entry ~1.131
const matchingTrades = journal.filter((t: any) =>
  Math.abs(t.entryPrice - 1.131) < 0.005 &&
  t.side === 'SHORT'
);

if (matchingTrades.length > 0) {
  console.log(`Found ${matchingTrades.length} matching trade(s):\n`);
  matchingTrades.forEach((t: any, i: number) => {
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`Trade #${i + 1}: ${t.id}`);
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`Side:           ${t.side}`);
    console.log(`Entry:          ${t.entryPrice}`);
    console.log(`Exit:           ${t.exitPrice || 'OPEN'}`);
    console.log(`Quantity:       ${t.quantity}`);
    console.log(`Leverage:       ${t.leverage}x`);
    if (t.exitCondition) {
      console.log(`Exit Type:      ${t.exitCondition.exitType}`);
      console.log(`PnL (journal):  ${t.realizedPnL?.toFixed(4)} USDT`);
      console.log(`Entry Reason:   ${t.entryCondition.signal.reason}`);
      console.log(`Confidence:     ${(t.entryCondition.signal.confidence * 100).toFixed(1)}%`);
      console.log(`Stop Loss:      ${t.entryCondition.signal.stopLoss}`);
    }
    console.log('');
  });
} else {
  console.log('❌ Trade NOT found in journal!\n');
  console.log('All SHORT trades in journal:');
  journal
    .filter((t: any) => t.side === 'SHORT')
    .forEach((t: any) => {
      console.log(`  ${t.side} @ ${t.entryPrice} → ${t.exitPrice || 'OPEN'} (${t.quantity} APEX)`);
    });
}
