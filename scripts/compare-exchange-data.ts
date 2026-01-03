#!/usr/bin/env ts-node

/**
 * Compare Bybit Exchange Data with Bot Trade Journal
 *
 * Parses raw exchange data and compares it with bot's trade journal
 * to verify accuracy of PnL calculations and trade recording.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface BybitTrade {
  symbol: string;
  quantity: number;
  price: number;
  feeRate: number;
  feeAmount: number;
  side: 'Open Long' | 'Close Long' | 'Open Short' | 'Close Short';
  orderType: string;
  orderId: string;
  timestamp: Date;
}

interface Position {
  entryTime: Date;
  exitTime: Date;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryFee: number;
  exitFee: number;
  pnlGross: number;
  pnlNet: number;
}

// ============================================================================
// PARSING
// ============================================================================

function parseBybitData(filePath: string): BybitTrade[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  const trades: BybitTrade[] = [];

  for (const line of lines) {
    // Skip funding lines
    if (line.includes('Финансирование')) {
      continue;
    }

    const parts = line.split(/\s{2,}/); // Split by 2+ spaces

    if (parts.length < 9) {
      console.warn('Skipping malformed line:', line);
      continue;
    }

    // Parse fields
    const symbol = parts[0].trim();
    const qtyStr = parts[2].split('/')[0].trim(); // "29.0/29.0" -> "29.0"
    const priceStr = parts[3].split('/')[0].trim(); // "1.1604/1.1604" or "1.1494/Рынок"
    const feeRateStr = parts[4].trim().replace('%', '');
    const feeAmountStr = parts[5].trim();
    const sideStr = parts[6].trim(); // "Закрыть Long" or "Открыть Short"
    const orderTypeStr = parts[7].trim();
    const orderId = parts[8].trim();
    const timestampStr = parts[9].trim();

    const quantity = parseFloat(qtyStr);
    const price = parseFloat(priceStr);
    const feeRate = parseFloat(feeRateStr);
    const feeAmount = parseFloat(feeAmountStr);

    // Convert Russian to English
    let side: 'Open Long' | 'Close Long' | 'Open Short' | 'Close Short';
    if (sideStr.includes('Закрыть') && sideStr.includes('Long')) {
      side = 'Close Long';
    } else if (sideStr.includes('Открыть') && sideStr.includes('Long')) {
      side = 'Open Long';
    } else if (sideStr.includes('Закрыть') && sideStr.includes('Short')) {
      side = 'Close Short';
    } else if (sideStr.includes('Открыть') && sideStr.includes('Short')) {
      side = 'Open Short';
    } else {
      console.warn(`Unknown side: ${sideStr}`);
      continue;
    }

    // Parse timestamp (format: "2025-10-24 01:59:18")
    const [datePart, timePart] = timestampStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    const timestamp = new Date(year, month - 1, day, hour, minute, second);

    trades.push({
      symbol,
      quantity,
      price,
      feeRate,
      feeAmount,
      side,
      orderType: orderTypeStr,
      orderId,
      timestamp,
    });
  }

  return trades;
}

// ============================================================================
// POSITION MATCHING
// ============================================================================

function matchPositions(trades: BybitTrade[]): Position[] {
  const positions: Position[] = [];

  // Sort by timestamp
  trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let i = 0;
  while (i < trades.length) {
    const trade = trades[i];

    // Find opening trade
    if (trade.side === 'Open Long' || trade.side === 'Open Short') {
      const side = trade.side === 'Open Long' ? 'LONG' : 'SHORT';
      const expectedCloseType = side === 'LONG' ? 'Close Long' : 'Close Short';

      // Find all closes for this position (partial + full)
      const closes: BybitTrade[] = [];
      let j = i + 1;
      let remainingQty = trade.quantity;

      while (j < trades.length && remainingQty > 0.1) {
        const nextTrade = trades[j];

        if (nextTrade.side === expectedCloseType) {
          closes.push(nextTrade);
          remainingQty -= nextTrade.quantity;
        }

        j++;
      }

      if (closes.length > 0) {
        // Calculate weighted exit price
        const totalExitQty = closes.reduce((sum, c) => sum + c.quantity, 0);
        const weightedExitPrice = closes.reduce((sum, c) => sum + c.price * c.quantity, 0) / totalExitQty;
        const exitFee = closes.reduce((sum, c) => sum + c.feeAmount, 0);
        const lastClose = closes[closes.length - 1];

        // Calculate PnL
        const entryValue = trade.quantity * trade.price;
        const exitValue = totalExitQty * weightedExitPrice;

        let pnlGross: number;
        if (side === 'LONG') {
          pnlGross = exitValue - entryValue;
        } else {
          pnlGross = entryValue - exitValue;
        }

        const totalFees = trade.feeAmount + exitFee;
        const pnlNet = pnlGross - totalFees;

        positions.push({
          entryTime: trade.timestamp,
          exitTime: lastClose.timestamp,
          side,
          entryPrice: trade.price,
          exitPrice: weightedExitPrice,
          quantity: trade.quantity,
          entryFee: trade.feeAmount,
          exitFee,
          pnlGross,
          pnlNet,
        });
      }
    }

    i++;
  }

  return positions;
}

// ============================================================================
// COMPARISON
// ============================================================================

function compareWithJournal(exchangePositions: Position[], journalPath: string) {
  const journalContent = fs.readFileSync(journalPath, 'utf-8');
  const journal = JSON.parse(journalContent);

  // Journal is an array, not an object with .trades
  const journalTrades = Array.isArray(journal)
    ? journal.filter((t: any) => t.status === 'CLOSED')
    : journal.trades?.filter((t: any) => t.status === 'CLOSED') || [];

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 EXCHANGE DATA vs BOT JOURNAL COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Exchange Positions: ${exchangePositions.length}`);
  console.log(`Journal Trades:     ${journalTrades.length}`);
  console.log(`Difference:         ${Math.abs(exchangePositions.length - journalTrades.length)}`);

  // Calculate totals
  const exchangeTotalPnL = exchangePositions.reduce((sum, p) => sum + p.pnlNet, 0);
  const exchangeTotalFees = exchangePositions.reduce((sum, p) => sum + p.entryFee + p.exitFee, 0);

  const journalTotalPnL = journalTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('💰 PnL COMPARISON:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Exchange Total PnL (net): ${exchangeTotalPnL.toFixed(4)} USDT`);
  console.log(`Exchange Total Fees:      ${exchangeTotalFees.toFixed(4)} USDT`);
  console.log(`Journal Total PnL (net):  ${journalTotalPnL.toFixed(4)} USDT`);
  console.log(`Difference:               ${Math.abs(exchangeTotalPnL - journalTotalPnL).toFixed(4)} USDT`);

  const pnlAccuracy = ((1 - Math.abs(exchangeTotalPnL - journalTotalPnL) / Math.abs(exchangeTotalPnL)) * 100).toFixed(2);
  console.log(`Accuracy:                 ${pnlAccuracy}%`);

  // Side breakdown
  const exchangeLong = exchangePositions.filter(p => p.side === 'LONG');
  const exchangeShort = exchangePositions.filter(p => p.side === 'SHORT');

  const journalLong = journalTrades.filter((t: any) => t.side === 'LONG');
  const journalShort = journalTrades.filter((t: any) => t.side === 'SHORT');

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📊 LONG vs SHORT:');
  console.log('───────────────────────────────────────────────────────────────');

  const exchangeLongPnL = exchangeLong.reduce((sum, p) => sum + p.pnlNet, 0);
  const exchangeShortPnL = exchangeShort.reduce((sum, p) => sum + p.pnlNet, 0);
  const journalLongPnL = journalLong.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);
  const journalShortPnL = journalShort.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);

  console.log(`\nLONG:`);
  console.log(`  Exchange: ${exchangeLong.length} trades | PnL: ${exchangeLongPnL.toFixed(4)} USDT`);
  console.log(`  Journal:  ${journalLong.length} trades | PnL: ${journalLongPnL.toFixed(4)} USDT`);
  console.log(`  Diff:     ${Math.abs(exchangeLongPnL - journalLongPnL).toFixed(4)} USDT`);

  console.log(`\nSHORT:`);
  console.log(`  Exchange: ${exchangeShort.length} trades | PnL: ${exchangeShortPnL.toFixed(4)} USDT`);
  console.log(`  Journal:  ${journalShort.length} trades | PnL: ${journalShortPnL.toFixed(4)} USDT`);
  console.log(`  Diff:     ${Math.abs(exchangeShortPnL - journalShortPnL).toFixed(4)} USDT`);

  // Show first 5 positions side-by-side
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('🔍 SAMPLE POSITIONS (First 5):');
  console.log('───────────────────────────────────────────────────────────────');

  for (let i = 0; i < Math.min(5, exchangePositions.length); i++) {
    const exPos = exchangePositions[i];

    console.log(`\n${i + 1}. EXCHANGE POSITION:`);
    console.log(`   Time:  ${exPos.entryTime.toLocaleString()} → ${exPos.exitTime.toLocaleString()}`);
    console.log(`   Side:  ${exPos.side}`);
    console.log(`   Entry: ${exPos.entryPrice} | Exit: ${exPos.exitPrice.toFixed(4)}`);
    console.log(`   Qty:   ${exPos.quantity}`);
    console.log(`   Fees:  ${(exPos.entryFee + exPos.exitFee).toFixed(4)} USDT`);
    console.log(`   PnL:   ${exPos.pnlNet.toFixed(4)} USDT`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const bybitDataPath = path.join(__dirname, '../data/bybit-trades-raw.txt');
  const journalPath = path.join(__dirname, '../data/trade-journal.json');

  console.log('🔍 Parsing Bybit exchange data...');
  const trades = parseBybitData(bybitDataPath);
  console.log(`✅ Parsed ${trades.length} trades`);

  console.log('\n🔗 Matching positions...');
  const positions = matchPositions(trades);
  console.log(`✅ Matched ${positions.length} positions`);

  compareWithJournal(positions, journalPath);
}

main();
