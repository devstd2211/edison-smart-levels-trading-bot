/**
 * Analyze SL Bug in Session #44
 *
 * Calculates SL distance from entry for all trades
 * Identifies anomalous SL (>1.5% for 0.8x ATR config)
 */

import * as fs from 'fs';
import * as path from 'path';

interface Trade {
  id: string;
  side: string;
  entryPrice: number;
  entryCondition?: {
    signal?: {
      stopLoss?: number;
      reason?: string;
    };
  };
  exitCondition?: {
    exitType?: string;
    stoppedOut?: boolean;
  };
  realizedPnL?: number;
}

function analyzeSLBug(journalPath: string) {
  // Read journal
  const journalData = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const trades: Trade[] = journalData;

  console.log('='.repeat(80));
  console.log('📊 SL BUG ANALYSIS - Session #44');
  console.log('='.repeat(80));
  console.log();

  // Filter trades from Session #44 (after 18:45 UTC when micro-profits config applied)
  // Timestamp: 1761590884052 (first micro-profits trade)
  const session44Trades = trades.filter(t => {
    const tradeId = t.id;
    const timestamp = parseInt(tradeId.split('_')[1]);
    return timestamp >= 1761590000000; // After 18:30 UTC
  });

  console.log(`📈 Total Session #44 trades: ${session44Trades.length}`);
  console.log();

  const anomalies: Array<{
    id: string;
    entry: number;
    sl: number;
    slDistance: number;
    stoppedOut: boolean;
    pnl: number;
    reason: string;
  }> = [];

  let totalStopOuts = 0;
  let anomalousStopOuts = 0;

  for (const trade of session44Trades) {
    const entry = trade.entryPrice;
    const sl = trade.entryCondition?.signal?.stopLoss;
    const reason = trade.entryCondition?.signal?.reason || '';

    if (!sl) continue;

    // Calculate SL distance from entry
    const slDistance = trade.side === 'SHORT'
      ? ((sl - entry) / entry) * 100
      : ((entry - sl) / entry) * 100;

    const isStoppedOut = trade.exitCondition?.stoppedOut || false;
    const pnl = trade.realizedPnL || 0;

    if (isStoppedOut) {
      totalStopOuts++;
    }

    // Anomalous SL: > 1.5% for 0.8x ATR config
    if (slDistance > 1.5) {
      anomalies.push({
        id: trade.id,
        entry,
        sl,
        slDistance,
        stoppedOut: isStoppedOut,
        pnl,
        reason,
      });

      if (isStoppedOut) {
        anomalousStopOuts++;
      }
    }
  }

  // Sort by SL distance descending
  anomalies.sort((a, b) => b.slDistance - a.slDistance);

  console.log('❌ ANOMALOUS SL (>1.5%):');
  console.log('-'.repeat(80));
  console.log();

  let totalLoss = 0;

  anomalies.forEach((a, i) => {
    console.log(`${i + 1}. ${a.id}`);
    console.log(`   Entry: ${a.entry.toFixed(4)}, SL: ${a.sl.toFixed(4)}`);
    console.log(`   SL Distance: ${a.slDistance.toFixed(2)}% ❌ (should be ~0.8-1.0%)`);
    console.log(`   Stopped Out: ${a.stoppedOut ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   PnL: ${a.pnl.toFixed(2)} USDT`);
    console.log(`   Reason: ${a.reason}`);
    console.log();

    if (a.stoppedOut) {
      totalLoss += a.pnl;
    }
  });

  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total Session #44 trades: ${session44Trades.length}`);
  console.log(`Anomalous SL (>1.5%): ${anomalies.length} (${((anomalies.length / session44Trades.length) * 100).toFixed(1)}%)`);
  console.log();
  console.log(`Total stop outs: ${totalStopOuts}`);
  console.log(`Anomalous stop outs: ${anomalousStopOuts} (${((anomalousStopOuts / totalStopOuts) * 100).toFixed(1)}%)`);
  console.log();
  console.log(`💰 Lost due to anomalous stops: ${totalLoss.toFixed(2)} USDT`);
  console.log();

  console.log('='.repeat(80));
  console.log('🐛 ROOT CAUSE');
  console.log('='.repeat(80));
  console.log();
  console.log('File: level-based.strategy.ts:527-530');
  console.log();
  console.log('❌ CURRENT CODE:');
  console.log('const stopLoss =');
  console.log('  direction === SignalDirection.SHORT');
  console.log('    ? level.price + stopLossDistance // FROM LEVEL (wrong!)');
  console.log('    : level.price - stopLossDistance;');
  console.log();
  console.log('✅ SHOULD BE:');
  console.log('const stopLoss =');
  console.log('  direction === SignalDirection.SHORT');
  console.log('    ? price + stopLossDistance // FROM ENTRY (correct!)');
  console.log('    : price - stopLossDistance;');
  console.log();
  console.log('📝 EXPLANATION:');
  console.log('When maxDistancePercent = 2.5%, entry can be 2.49% from level.');
  console.log('SL from level + 0.3% ATR = 2.49% + 0.3% = 2.8% from entry!');
  console.log();
}

// Run
const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

if (!fs.existsSync(journalPath)) {
  console.error(`❌ Journal file not found: ${journalPath}`);
  process.exit(1);
}

analyzeSLBug(journalPath);
