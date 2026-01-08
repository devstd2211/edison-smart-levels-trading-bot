/**
 * Find which indicators are responsible for false confidence in losing trades
 * Parse logs and match with trade journal to find indicator patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface LossingTrade {
  id: string;
  timestamp: number;
  confidence: number;
  reason: string;
}

// Parse trade journal
const journalPath = path.join(__dirname, '../data/trade-journal.json');
const journalData = fs.readFileSync(journalPath, 'utf-8');
const trades: any[] = JSON.parse(journalData);

const closedLosing = trades.filter(
  t => t.status === 'CLOSED' && (t.realizedPnL || 0) < 0
);

const losingTrades: LossingTrade[] = closedLosing.map(t => ({
  id: t.id,
  timestamp: Math.floor(t.openedAt / 1000), // Convert to seconds for easier matching
  confidence: t.entryCondition.signal.confidence,
  reason: t.entryCondition.signal.reason,
}));

console.log(`Found ${losingTrades.length} losing trades\n`);

// Now parse logs to find what indicators were active during losing entries
const logFiles = [
  path.join(__dirname, '../logs/trading-bot-2026-01-07.log'),
  path.join(__dirname, '../logs/trading-bot-2026-01-08.log'),
];

interface IndicatorData {
  name: string;
  confidence: number;
  direction: string;
  weight: number;
}

interface TradeIndicators {
  tradeId: string;
  timestamp: number;
  confidence: number;
  winners: IndicatorData[];
  losers: IndicatorData[];
  mainWinner?: string;
}

const tradeIndicators: Map<string, TradeIndicators> = new Map();

async function parseLogs() {
  for (const logFile of logFiles) {
    if (!fs.existsSync(logFile)) continue;

    const fileStream = fs.createReadStream(logFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let currentTrade: TradeIndicators | null = null;
    let matchedTimestamp = -1;

    for await (const line of rl) {
      // Look for weighted voting results
      if (line.includes('Weighted Voting Result')) {
        const match = line.match(/\[([^\]]+)\]/);
        if (!match) continue;

        const timestamp = Math.floor(new Date(match[1]).getTime() / 1000);

        // Check if this timestamp matches any losing trade
        const matchingTrade = losingTrades.find(t => {
          // Within 5 seconds
          return Math.abs(t.timestamp - timestamp) < 5;
        });

        if (matchingTrade && !tradeIndicators.has(matchingTrade.id)) {
          currentTrade = {
            tradeId: matchingTrade.id,
            timestamp: matchingTrade.timestamp,
            confidence: matchingTrade.confidence,
            winners: [],
            losers: [],
          };

          matchedTimestamp = timestamp;
        }
      }

      // Collect analyzer signals BEFORE weighted voting
      if (
        currentTrade &&
        line.includes('AnalyzerSignal') &&
        Math.abs(Math.floor(new Date(line.match(/\[([^\]]+)\]/)![1]).getTime() / 1000) - matchedTimestamp) < 2
      ) {
        try {
          const jsonMatch = line.match(/\|(.+)$/);
          if (!jsonMatch) continue;

          const data = JSON.parse(jsonMatch[1]);
          const indicator: IndicatorData = {
            name: data.source,
            confidence: data.confidence,
            direction: data.direction,
            weight: data.weight,
          };

          // Check if this agreed with winning direction
          if (currentTrade && data.direction === currentTrade.tradeId.split('_')[1] ? 'LONG' : 'SHORT') {
            currentTrade.winners.push(indicator);
          } else {
            currentTrade.losers.push(indicator);
          }
        } catch (e) {
          // Skip parse errors
        }
      }

      // Check for final entry decision
      if (currentTrade && line.includes('Trade entry recorded') && line.includes(currentTrade.tradeId)) {
        const sourceMatch = currentTrade.tradeId.match(/_(Buy|Sell)_/);
        if (sourceMatch) {
          const direction = sourceMatch[1] === 'Buy' ? 'LONG' : 'SHORT';

          // Find dominant winner
          if (currentTrade.winners.length > 0) {
            currentTrade.mainWinner = currentTrade.winners.reduce((a, b) =>
              a.confidence > b.confidence ? a : b
            ).name;
          }
        }

        tradeIndicators.set(currentTrade.tradeId, currentTrade);
        currentTrade = null;
      }
    }
  }
}

parseLogs().then(() => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 INDICATORS IN LOSING TRADES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Analyze which indicators were responsible
  const indicatorStats: Map<
    string,
    { count: number; avgConfidence: number; wins: number; losses: number }
  > = new Map();

  tradeIndicators.forEach(trade => {
    // Track main winner
    if (trade.mainWinner) {
      if (!indicatorStats.has(trade.mainWinner)) {
        indicatorStats.set(trade.mainWinner, { count: 0, avgConfidence: 0, wins: 0, losses: 0 });
      }
      const stat = indicatorStats.get(trade.mainWinner)!;
      stat.count++;
      stat.losses++; // It's a losing trade
      stat.avgConfidence += trade.confidence;
    }
  });

  // Print results
  console.log('🔴 Indicators that dominated LOSING entries:\n');

  Array.from(indicatorStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, stat]) => {
      const avgConf = stat.avgConfidence / stat.count;
      console.log(`❌ ${name.padEnd(20)} | ${stat.count} losses | Avg Confidence: ${(avgConf * 100).toFixed(1)}%`);
    });

  // Detail view
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 DETAILED LOSING TRADES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  Array.from(tradeIndicators.values())
    .sort((a, b) => b.confidence - a.confidence)
    .forEach(trade => {
      console.log(`\n${trade.tradeId}`);
      console.log(`  Confidence: ${(trade.confidence * 100).toFixed(1)}%`);
      console.log(`  Main Winner: ${trade.mainWinner}`);

      if (trade.winners.length > 0) {
        console.log(`  ✅ Agreed indicators (${trade.winners.length}):`);
        trade.winners
          .sort((a, b) => b.confidence - a.confidence)
          .forEach(ind => {
            console.log(`     - ${ind.name.padEnd(20)} ${ind.direction} ${ind.confidence.toFixed(1)}% (w${ind.weight.toFixed(2)})`);
          });
      }

      if (trade.losers.length > 0) {
        console.log(`  ❌ Disagreed indicators (${trade.losers.length}):`);
        trade.losers
          .sort((a, b) => b.confidence - a.confidence)
          .forEach(ind => {
            console.log(`     - ${ind.name.padEnd(20)} ${ind.direction} ${ind.confidence.toFixed(1)}% (w${ind.weight.toFixed(2)})`);
          });
      }
    });
});
