/**
 * Analyze Missed Trading Opportunities from Logs
 *
 * Finds moments where price bounced but strategies were blocked,
 * and analyzes why opportunities were missed.
 *
 * Usage:
 *   npx ts-node scripts/analyze-missed-opportunities.ts [log-file-path]
 *   npx ts-node scripts/analyze-missed-opportunities.ts logs/trading-bot-2025-10-26.log
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

interface PricePoint {
  timestamp: string;
  price: number;
  rsi: number;
  volume: number;
  volumeRatio: number;
  trend: string;
}

interface BlockedStrategy {
  timestamp: string;
  price: number;
  strategy: string;
  reason: string;
  blockedBy: string[];
  context: any;
}

interface MissedOpportunity {
  timestamp: string;
  price: number;
  priceChange: number; // % change in next 5-15 minutes
  direction: 'LONG' | 'SHORT';
  rsi: number;
  volumeRatio: number;
  blockedStrategies: BlockedStrategy[];
  nearestLevels: any;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BOUNCE_THRESHOLD = 0.5; // % price change to consider a bounce
const ANALYSIS_WINDOW = 15; // minutes to look ahead for bounce
const MIN_RSI_OVERSOLD = 35; // RSI threshold to consider potential LONG
const MAX_RSI_OVERBOUGHT = 65; // RSI threshold to consider potential SHORT

// ============================================================================
// LOG PARSING
// ============================================================================

/**
 * Parse log file and extract structured entries
 */
function parseLogFile(filePath: string): LogEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  const entries: LogEntry[] = [];

  for (const line of lines) {
    const match = line.match(/\[(.*?)\] \[(.*?)\] (.*?)(?:\s+\|\s+(.*))?$/);
    if (!match) continue;

    const [, timestamp, level, message, dataStr] = match;

    let data = undefined;
    if (dataStr) {
      try {
        data = JSON.parse(dataStr);
      } catch (e) {
        // Not JSON, skip
      }
    }

    entries.push({ timestamp, level, message, data });
  }

  return entries;
}

/**
 * Extract price points from strategy evaluations
 */
function extractPricePoints(entries: LogEntry[]): PricePoint[] {
  const pricePoints: PricePoint[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Look for strategy evaluation entries
    if (entry.message.includes('TrendFollowing Strategy Evaluation') && entry.data) {
      const { price, rsi, trend } = entry.data;

      // Find volume check in next few entries
      let volumeRatio = 0;
      let volume = 0;
      for (let j = i + 1; j < Math.min(i + 5, entries.length); j++) {
        if (entries[j].message.includes('Volume Check') && entries[j].data) {
          volumeRatio = parseFloat(entries[j].data.volumeRatio) || 0;
          volume = parseFloat(entries[j].data.currentVolume) || 0;
          break;
        }
      }

      pricePoints.push({
        timestamp: entry.timestamp,
        price: parseFloat(price),
        rsi: parseFloat(rsi),
        volume,
        volumeRatio,
        trend
      });
    }
  }

  return pricePoints;
}

/**
 * Extract blocked strategy events
 */
function extractBlockedStrategies(entries: LogEntry[]): BlockedStrategy[] {
  const blocked: BlockedStrategy[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.message.includes('BLOCKED') && entry.data) {
      // Find the strategy evaluation before this
      let strategy = 'UNKNOWN';
      let price = 0;
      let context: any = {};

      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prev = entries[j];
        if (prev.message.includes('Strategy Evaluation') && prev.data) {
          strategy = prev.message.split(' ')[1] || 'UNKNOWN';
          price = parseFloat(prev.data.price) || 0;
          context = prev.data;
          break;
        }
      }

      blocked.push({
        timestamp: entry.timestamp,
        price,
        strategy,
        reason: entry.data.reason || entry.message,
        blockedBy: entry.data.blockedBy || [],
        context
      });
    }
  }

  return blocked;
}

/**
 * Find price bounces (potential missed opportunities)
 */
function findBounces(pricePoints: PricePoint[]): MissedOpportunity[] {
  const opportunities: MissedOpportunity[] = [];

  for (let i = 0; i < pricePoints.length - ANALYSIS_WINDOW; i++) {
    const current = pricePoints[i];

    // Look ahead for price bounce
    let maxPriceChange = 0;
    let direction: 'LONG' | 'SHORT' = 'LONG';

    for (let j = i + 1; j <= Math.min(i + ANALYSIS_WINDOW, pricePoints.length - 1); j++) {
      const future = pricePoints[j];
      const changePercent = ((future.price - current.price) / current.price) * 100;

      if (Math.abs(changePercent) > Math.abs(maxPriceChange)) {
        maxPriceChange = changePercent;
        direction = changePercent > 0 ? 'LONG' : 'SHORT';
      }
    }

    // Check if this was a missed opportunity
    const isBounce = Math.abs(maxPriceChange) >= BOUNCE_THRESHOLD;
    const isPotentialLong = direction === 'LONG' && current.rsi < MIN_RSI_OVERSOLD && current.trend === 'BULLISH';
    const isPotentialShort = direction === 'SHORT' && current.rsi > MAX_RSI_OVERBOUGHT && current.trend === 'BEARISH';

    if (isBounce && (isPotentialLong || isPotentialShort)) {
      opportunities.push({
        timestamp: current.timestamp,
        price: current.price,
        priceChange: maxPriceChange,
        direction,
        rsi: current.rsi,
        volumeRatio: current.volumeRatio,
        blockedStrategies: [],
        nearestLevels: {}
      });
    }
  }

  return opportunities;
}

/**
 * Find blocked strategies for each opportunity
 */
function matchBlockedStrategies(
  opportunities: MissedOpportunity[],
  blocked: BlockedStrategy[]
): MissedOpportunity[] {
  for (const opp of opportunities) {
    // Find all blocked strategies within 1 minute of opportunity
    const oppTime = new Date(opp.timestamp).getTime();

    opp.blockedStrategies = blocked.filter(b => {
      const blockTime = new Date(b.timestamp).getTime();
      const timeDiff = Math.abs(blockTime - oppTime);
      return timeDiff <= 60000; // Within 1 minute
    });
  }

  return opportunities;
}

// ============================================================================
// ANALYSIS & REPORTING
// ============================================================================

/**
 * Analyze blocking patterns
 */
function analyzeBlockingPatterns(opportunities: MissedOpportunity[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 BLOCKING PATTERNS ANALYSIS');
  console.log('='.repeat(80));

  const blockingReasons: { [key: string]: number } = {};
  const strategyBlocks: { [key: string]: number } = {};

  for (const opp of opportunities) {
    for (const block of opp.blockedStrategies) {
      // Count by strategy
      strategyBlocks[block.strategy] = (strategyBlocks[block.strategy] || 0) + 1;

      // Count by blocking reason
      for (const reason of block.blockedBy) {
        blockingReasons[reason] = (blockingReasons[reason] || 0) + 1;
      }
    }
  }

  console.log('\n🚫 Most Common Blocking Reasons:');
  const sortedReasons = Object.entries(blockingReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [reason, count] of sortedReasons) {
    console.log(`   ${count}x - ${reason}`);
  }

  console.log('\n📈 Strategies Blocked Most Often:');
  const sortedStrategies = Object.entries(strategyBlocks)
    .sort((a, b) => b[1] - a[1]);

  for (const [strategy, count] of sortedStrategies) {
    console.log(`   ${count}x - ${strategy}`);
  }
}

/**
 * Print detailed opportunity report
 */
function printOpportunityReport(opportunities: MissedOpportunity[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 MISSED OPPORTUNITIES REPORT');
  console.log('='.repeat(80));

  if (opportunities.length === 0) {
    console.log('\n✅ No significant missed opportunities found!');
    return;
  }

  console.log(`\nFound ${opportunities.length} potential missed opportunities:\n`);

  for (let i = 0; i < Math.min(20, opportunities.length); i++) {
    const opp = opportunities[i];

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`#${i + 1} | ${opp.timestamp}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`💰 Price:         ${opp.price.toFixed(4)}`);
    console.log(`📈 Bounce:        ${opp.priceChange > 0 ? '+' : ''}${opp.priceChange.toFixed(2)}% (${opp.direction})`);
    console.log(`📊 RSI:           ${opp.rsi.toFixed(2)}`);
    console.log(`📦 Volume Ratio:  ${opp.volumeRatio.toFixed(2)}x`);

    if (opp.blockedStrategies.length > 0) {
      console.log(`\n🚫 Blocked Strategies (${opp.blockedStrategies.length}):`);
      for (const block of opp.blockedStrategies) {
        console.log(`\n   Strategy: ${block.strategy}`);
        console.log(`   Blocked By: ${block.blockedBy.join(', ')}`);
        if (block.context && block.context.swingPoints !== undefined) {
          console.log(`   Swing Points: ${block.context.swingPoints}`);
        }
        if (block.context && block.context.liquidityZones !== undefined) {
          console.log(`   Liquidity Zones: ${block.context.liquidityZones}`);
        }
      }
    }
  }
}

/**
 * Print statistics summary
 */
function printStatistics(
  opportunities: MissedOpportunity[],
  pricePoints: PricePoint[]
): void {
  console.log('\n' + '='.repeat(80));
  console.log('📈 STATISTICS SUMMARY');
  console.log('='.repeat(80));

  const totalMinutes = pricePoints.length;
  const avgVolumeRatio = pricePoints.reduce((sum, p) => sum + p.volumeRatio, 0) / pricePoints.length;
  const lowVolumeMinutes = pricePoints.filter(p => p.volumeRatio < 0.5).length;

  const longOpps = opportunities.filter(o => o.direction === 'LONG');
  const shortOpps = opportunities.filter(o => o.direction === 'SHORT');

  const avgBounce = opportunities.reduce((sum, o) => sum + Math.abs(o.priceChange), 0) / opportunities.length;
  const maxBounce = Math.max(...opportunities.map(o => Math.abs(o.priceChange)));

  console.log(`\n⏱️  Total Analysis Period:      ${totalMinutes} minutes`);
  console.log(`📦 Average Volume Ratio:       ${avgVolumeRatio.toFixed(2)}x`);
  console.log(`🔇 Low Volume Minutes:         ${lowVolumeMinutes} (${((lowVolumeMinutes / totalMinutes) * 100).toFixed(1)}%)`);
  console.log(`\n🎯 Missed Opportunities:       ${opportunities.length}`);
  console.log(`   LONG:                       ${longOpps.length}`);
  console.log(`   SHORT:                      ${shortOpps.length}`);
  console.log(`\n📊 Average Bounce:             ${avgBounce.toFixed(2)}%`);
  console.log(`📊 Max Bounce:                 ${maxBounce.toFixed(2)}%`);
}

/**
 * Print actionable recommendations
 */
function printRecommendations(opportunities: MissedOpportunity[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('💡 ACTIONABLE RECOMMENDATIONS');
  console.log('='.repeat(80));

  const allBlocks = opportunities.flatMap(o => o.blockedStrategies);
  const lowVolumeBlocks = allBlocks.filter(b => b.blockedBy.includes('LOW_VOLUME')).length;
  const noLevelsBlocks = allBlocks.filter(b => b.blockedBy.includes('NO_LEVELS_WITHIN_DISTANCE')).length;
  const rsiBlocks = allBlocks.filter(b =>
    b.blockedBy.some(r => r.includes('RSI_NOT'))
  ).length;

  console.log('\nBased on analysis:\n');

  if (lowVolumeBlocks > opportunities.length * 0.5) {
    console.log('⚠️  CRITICAL: Volume filter too strict!');
    console.log('   → Consider lowering volumeRatio threshold from 0.5 to 0.3');
    console.log('   → Or add exception for strong RSI signals\n');
  }

  if (noLevelsBlocks > opportunities.length * 0.5) {
    console.log('⚠️  CRITICAL: Level detection too strict!');
    console.log('   → Reduce minTouches from 4 to 2 for support levels');
    console.log('   → Increase maxDistance from 1.5% to 2.0%');
    console.log('   → Check ZigZag swing point detection\n');
  }

  if (rsiBlocks > opportunities.length * 0.3) {
    console.log('⚠️  RSI thresholds may be too strict');
    console.log('   → CounterTrend: Consider RSI < 25 instead of < 20');
    console.log('   → Entry Scanner: Consider RSI < 35 instead of < 30\n');
  }

  if (opportunities.length === 0) {
    console.log('✅ Settings appear well-calibrated - no major missed opportunities!');
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🔍 Analyzing Missed Trading Opportunities...\n');

  // Get log file path
  const args = process.argv.slice(2);
  const logFile = args[0] || 'logs/trading-bot-' + new Date().toISOString().split('T')[0] + '.log';

  if (!fs.existsSync(logFile)) {
    console.error(`❌ Log file not found: ${logFile}`);
    console.log('\nUsage: npx ts-node scripts/analyze-missed-opportunities.ts [log-file-path]');
    process.exit(1);
  }

  console.log(`📄 Analyzing: ${logFile}\n`);

  // Parse log file
  const entries = parseLogFile(logFile);
  console.log(`✅ Parsed ${entries.length} log entries`);

  // Extract price points and blocked strategies
  const pricePoints = extractPricePoints(entries);
  console.log(`✅ Extracted ${pricePoints.length} price points`);

  const blockedStrategies = extractBlockedStrategies(entries);
  console.log(`✅ Found ${blockedStrategies.length} blocked strategy events`);

  // Find missed opportunities
  let opportunities = findBounces(pricePoints);
  console.log(`✅ Identified ${opportunities.length} potential missed opportunities`);

  // Match blocked strategies to opportunities
  opportunities = matchBlockedStrategies(opportunities, blockedStrategies);

  // Sort by bounce magnitude
  opportunities.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));

  // Print reports
  printStatistics(opportunities, pricePoints);
  analyzeBlockingPatterns(opportunities);
  printOpportunityReport(opportunities);
  printRecommendations(opportunities);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!');
  console.log('='.repeat(80) + '\n');
}

// Run if called directly
if (require.main === module) {
  main();
}

export { parseLogFile, extractPricePoints, findBounces };
