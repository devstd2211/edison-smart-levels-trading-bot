/**
 * Analyze Losing Trades Script
 *
 * Identifies patterns in losing trades to improve signal quality.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface JournalEntry {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  entryCondition: {
    signal: {
      type: string;
      direction: string;
      price: number;
      stopLoss: number;
      takeProfits: Array<{ level: number; price: number; percent: number }>;
      confidence: number;
      reason: string;
      timestamp: number;
    };
  };
  exitPrice?: number;
  realizedPnL?: number;
  exitCondition?: {
    exitType: string;
    price: number;
    timestamp: number;
    reason: string;
    pnlUsdt: number;
    pnlPercent: number;
    holdingTimeMinutes: number;
    stoppedOut: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

function analyzeLosingTrades(journalPath: string): void {
  console.log('🔍 Loading trade journal...');

  const journalData = fs.readFileSync(journalPath, 'utf-8');
  const trades: JournalEntry[] = JSON.parse(journalData);

  console.log(`✅ Loaded ${trades.length} trades\n`);

  // Filter losing trades
  const losingTrades = trades.filter(
    (t) => t.exitCondition && t.realizedPnL && t.realizedPnL < 0
  );

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('💔 LOSING TRADES ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Losing Trades: ${losingTrades.length}`);
  console.log(`Total Loss: ${losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0).toFixed(2)} USDT\n`);

  // Analyze each losing trade
  losingTrades.forEach((trade, idx) => {
    const signal = trade.entryCondition.signal;
    const exit = trade.exitCondition!;

    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`❌ LOSS #${idx + 1}: ${trade.id}`);
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`Side:           ${trade.side}`);
    console.log(`Strategy:       ${signal.type}`);
    console.log(`Confidence:     ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`Entry Reason:   ${signal.reason}`);
    console.log(``);
    console.log(`Entry Price:    ${trade.entryPrice}`);
    console.log(`Stop Loss:      ${signal.stopLoss} (${((Math.abs(signal.stopLoss - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2)}% away)`);
    console.log(`Exit Price:     ${trade.exitPrice}`);
    console.log(`Exit Type:      ${exit.exitType}`);
    console.log(``);
    console.log(`PnL:            ${exit.pnlUsdt.toFixed(2)} USDT (${exit.pnlPercent.toFixed(2)}%)`);
    console.log(`Holding Time:   ${exit.holdingTimeMinutes.toFixed(1)} minutes`);
    console.log(``);

    // Analyze what went wrong
    console.log(`🔎 Analysis:`);

    // Check if stopped out
    if (exit.stoppedOut) {
      console.log(`   ⚠️  Stopped out - SL hit`);

      // Check how far price moved against position
      const priceMove = trade.side === 'LONG'
        ? ((trade.exitPrice! - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - trade.exitPrice!) / trade.entryPrice) * 100;

      if (priceMove < -1) {
        console.log(`   ⚠️  Large adverse move: ${Math.abs(priceMove).toFixed(2)}%`);
      }

      // Check if SL was too tight
      const slDistance = Math.abs(signal.stopLoss - trade.entryPrice) / trade.entryPrice * 100;
      if (slDistance < 0.5) {
        console.log(`   ⚠️  Stop loss too tight: ${slDistance.toFixed(2)}%`);
      }
    }

    // Check confidence level
    if (signal.confidence < 0.8) {
      console.log(`   ⚠️  Low confidence signal: ${(signal.confidence * 100).toFixed(1)}%`);
    }

    // Check holding time
    if (exit.holdingTimeMinutes < 5) {
      console.log(`   ⚠️  Very quick stop out: ${exit.holdingTimeMinutes.toFixed(1)} min`);
    }

    console.log(``);
  });

  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`📊 PATTERNS SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // Pattern analysis
  const allStoppedOut = losingTrades.filter((t) => t.exitCondition?.stoppedOut).length;
  const avgConfidence = losingTrades.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / losingTrades.length;
  const avgHoldingTime = losingTrades.reduce((sum, t) => sum + (t.exitCondition?.holdingTimeMinutes || 0), 0) / losingTrades.length;
  const longLosses = losingTrades.filter((t) => t.side === 'LONG').length;
  const shortLosses = losingTrades.filter((t) => t.side === 'SHORT').length;

  console.log(`Stop Outs:          ${allStoppedOut}/${losingTrades.length} (${((allStoppedOut / losingTrades.length) * 100).toFixed(1)}%)`);
  console.log(`Avg Confidence:     ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`Avg Holding Time:   ${avgHoldingTime.toFixed(1)} minutes`);
  console.log(`LONG Losses:        ${longLosses} (${((longLosses / losingTrades.length) * 100).toFixed(1)}%)`);
  console.log(`SHORT Losses:       ${shortLosses} (${((shortLosses / losingTrades.length) * 100).toFixed(1)}%)`);

  console.log(``);

  // Recommendations
  console.log(`💡 RECOMMENDATIONS:`);
  console.log(`───────────────────────────────────────────────────────────────`);

  if (allStoppedOut === losingTrades.length) {
    console.log(`⚠️  ALL losses are stop outs - consider:`);
    console.log(`   - Widening stop loss distance`);
    console.log(`   - Better entry timing (wait for confirmation)`);
    console.log(`   - Adding volatility filter (ATR-based SL)`);
  }

  if (avgConfidence < 0.8) {
    console.log(`⚠️  Low average confidence - consider:`);
    console.log(`   - Raising minimum confidence threshold to 0.8+`);
    console.log(`   - Adding more confirmation filters`);
  }

  if (avgHoldingTime < 5) {
    console.log(`⚠️  Quick stop outs - consider:`);
    console.log(`   - Waiting for better entry (e.g., pullback confirmation)`);
    console.log(`   - Using limit orders instead of market orders`);
  }

  if (longLosses > shortLosses * 1.5) {
    console.log(`⚠️  LONG positions underperform - consider:`);
    console.log(`   - Stricter filters for LONG entries`);
    console.log(`   - Only LONG in strong uptrends`);
    console.log(`   - Check BTC trend before LONG`);
  }

  console.log(``);
}

// ============================================================================
// CLI
// ============================================================================

const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

if (!fs.existsSync(journalPath)) {
  console.error(`❌ Journal file not found: ${journalPath}`);
  process.exit(1);
}

analyzeLosingTrades(journalPath);
