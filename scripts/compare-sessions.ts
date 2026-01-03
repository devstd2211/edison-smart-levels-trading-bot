/**
 * Compare Sessions Script
 *
 * Compares multiple trading sessions side-by-side:
 * - Win Rate comparison
 * - PnL comparison
 * - W/L Ratio comparison
 * - Stop-out Rate comparison
 * - Configuration differences
 * - Best performing session recommendation
 *
 * Usage:
 *   npm run compare-sessions session_001 session_002 session_003
 *   npm run compare-sessions                                        # Compare last 3 sessions
 *
 * Version: v3.4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { SessionDatabase, Session } from '../src/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DATA_DIR = './data';
const SESSION_STATS_FILE = 'session-stats.json';
const SEPARATOR = '━'.repeat(90);
const MIN_SESSIONS_FOR_COMPARISON = 2;
const DEFAULT_LAST_N_SESSIONS = 3;

// ============================================================================
// TYPES
// ============================================================================

interface ComparisonRow {
  metric: string;
  sessions: string[];
  bestIndex: number | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(startTime: string, endTime: string | null): string {
  if (!endTime) {
    return 'ACTIVE';
  }

  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h${minutes}m`;
}

function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

function findBestIndex(values: number[], higherIsBetter: boolean): number {
  if (values.length === 0) return -1;

  let bestIndex = 0;
  let bestValue = values[0];

  for (let i = 1; i < values.length; i++) {
    if (higherIsBetter) {
      if (values[i] > bestValue) {
        bestValue = values[i];
        bestIndex = i;
      }
    } else {
      if (values[i] < bestValue) {
        bestValue = values[i];
        bestIndex = i;
      }
    }
  }

  return bestIndex;
}

// ============================================================================
// COMPARISON
// ============================================================================

function compareSessions(sessions: Session[]): void {
  console.log('');
  console.log(SEPARATOR);
  console.log('📊 Session Comparison');
  console.log(SEPARATOR);
  console.log('');

  // Session IDs
  const sessionIds = sessions.map((s) => s.sessionId);
  const colWidth = Math.max(...sessionIds.map((id) => id.length)) + 2;

  console.log(padRight('Metric', 25) + ' | ' + sessionIds.map((id) => padRight(id, colWidth)).join(' | ') + ' | Best');
  console.log('─'.repeat(25) + '─┼─' + '─'.repeat((colWidth + 3) * sessions.length - 3) + '─┼─' + '─'.repeat(10));

  // Basic Info
  console.log(padRight('Started', 25) + ' | ' + sessions.map((s) => padRight(formatTime(s.startTime), colWidth)).join(' | ') + ' | -');
  console.log(padRight('Duration', 25) + ' | ' + sessions.map((s) => padRight(formatDuration(s.startTime, s.endTime), colWidth)).join(' | ') + ' | -');
  console.log(padRight('Symbol', 25) + ' | ' + sessions.map((s) => padRight(s.symbol, colWidth)).join(' | ') + ' | -');
  console.log('');

  // Performance Metrics
  const totalTradesValues = sessions.map((s) => s.summary.totalTrades);
  const winRateValues = sessions.map((s) => s.summary.winRate);
  const pnlValues = sessions.map((s) => s.summary.totalPnl);
  const wlRatioValues = sessions.map((s) => s.summary.wlRatio);
  const stopOutRateValues = sessions.map((s) => s.summary.stopOutRate);

  const bestWinRate = findBestIndex(winRateValues, true);
  const bestPnl = findBestIndex(pnlValues, true);
  const bestWlRatio = findBestIndex(wlRatioValues, true);
  const bestStopOutRate = findBestIndex(stopOutRateValues, false); // Lower is better

  console.log(padRight('Total Trades', 25) + ' | ' + totalTradesValues.map((v) => padRight(v.toString(), colWidth)).join(' | ') + ' | -');
  console.log(padRight('Win Rate', 25) + ' | ' + winRateValues.map((v, i) => padRight(`${v.toFixed(1)}%${i === bestWinRate ? ' ✅' : ''}`, colWidth)).join(' | ') + ` | #${bestWinRate + 1}`);
  console.log(padRight('Total PnL (USDT)', 25) + ' | ' + pnlValues.map((v, i) => padRight(`${v >= 0 ? '+' : ''}${v.toFixed(2)}${i === bestPnl ? ' ✅' : ''}`, colWidth)).join(' | ') + ` | #${bestPnl + 1}`);
  console.log(padRight('W/L Ratio', 25) + ' | ' + wlRatioValues.map((v, i) => padRight(`${v.toFixed(2)}x${i === bestWlRatio ? ' ✅' : ''}`, colWidth)).join(' | ') + ` | #${bestWlRatio + 1}`);
  console.log(padRight('Stop-out Rate', 25) + ' | ' + stopOutRateValues.map((v, i) => padRight(`${v.toFixed(1)}%${i === bestStopOutRate ? ' ✅' : ''}`, colWidth)).join(' | ') + ` | #${bestStopOutRate + 1}`);
  console.log('');

  // Configuration Comparison
  console.log('🔧 Configuration:');
  console.log('');

  // Extract key config params
  const leverageValues = sessions.map((s) => s.config.trading?.leverage || 'N/A');
  const riskPercentValues = sessions.map((s) => s.config.trading?.riskPercent || 'N/A');
  const maxDistanceValues = sessions.map((s) => s.config.strategies?.levelBased?.maxDistancePercent || 'N/A');
  const slMultiplierValues = sessions.map((s) => s.config.strategies?.levelBased?.stopLossAtrMultiplier || 'N/A');
  const slMultiplierLongValues = sessions.map((s) => s.config.strategies?.levelBased?.stopLossAtrMultiplierLong || 'N/A');

  console.log(padRight('Leverage', 25) + ' | ' + leverageValues.map((v) => padRight(String(v), colWidth)).join(' | ') + ' | -');
  console.log(padRight('Risk %', 25) + ' | ' + riskPercentValues.map((v) => padRight(String(v), colWidth)).join(' | ') + ' | -');
  console.log(padRight('Max Distance %', 25) + ' | ' + maxDistanceValues.map((v) => padRight(String(v), colWidth)).join(' | ') + ' | -');
  console.log(padRight('SL Multiplier', 25) + ' | ' + slMultiplierValues.map((v) => padRight(String(v), colWidth)).join(' | ') + ' | -');
  console.log(padRight('SL Multiplier (LONG)', 25) + ' | ' + slMultiplierLongValues.map((v) => padRight(String(v), colWidth)).join(' | ') + ' | -');
  console.log('');

  // Recommendation
  console.log(SEPARATOR);
  console.log('🎯 Recommendation:');
  console.log('');

  // Score each session (simple scoring: 1 point per "best")
  const scores = sessions.map((_, i) => {
    let score = 0;
    if (i === bestWinRate) score++;
    if (i === bestPnl) score++;
    if (i === bestWlRatio) score++;
    if (i === bestStopOutRate) score++;
    return score;
  });

  const bestOverallIndex = findBestIndex(scores, true);
  const bestSession = sessions[bestOverallIndex];

  console.log(`  Best Overall: ${bestSession.sessionId} (#${bestOverallIndex + 1})`);
  console.log(`    Win Rate: ${bestSession.summary.winRate.toFixed(1)}%`);
  console.log(`    PnL: ${bestSession.summary.totalPnl >= 0 ? '+' : ''}${bestSession.summary.totalPnl.toFixed(2)} USDT`);
  console.log(`    W/L Ratio: ${bestSession.summary.wlRatio.toFixed(2)}x`);
  console.log(`    Stop-out: ${bestSession.summary.stopOutRate.toFixed(1)}%`);
  console.log('');

  // Config recommendation
  console.log('  Suggested Config:');
  console.log(`    Leverage: ${bestSession.config.trading?.leverage || 'N/A'}`);
  console.log(`    Max Distance: ${bestSession.config.strategies?.levelBased?.maxDistancePercent || 'N/A'}%`);
  console.log(`    SL Multiplier: ${bestSession.config.strategies?.levelBased?.stopLossAtrMultiplier || 'N/A'}`);
  if (bestSession.config.strategies?.levelBased?.stopLossAtrMultiplierLong) {
    console.log(`    SL Multiplier (LONG): ${bestSession.config.strategies.levelBased.stopLossAtrMultiplierLong}`);
  }
  console.log('');
  console.log(SEPARATOR);
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  // Parse command-line arguments
  const args = process.argv.slice(2);

  // Load session database
  const filePath = path.join(DEFAULT_DATA_DIR, SESSION_STATS_FILE);

  if (!fs.existsSync(filePath)) {
    console.error('❌ Session stats file not found:', filePath);
    console.error('   Run the bot first to generate session data.');
    process.exit(1);
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  const database: SessionDatabase = JSON.parse(data);

  if (database.sessions.length < MIN_SESSIONS_FOR_COMPARISON) {
    console.error(`❌ Not enough sessions for comparison (need at least ${MIN_SESSIONS_FOR_COMPARISON}, have ${database.sessions.length}).`);
    process.exit(1);
  }

  // Find sessions
  let sessions: Session[] = [];

  if (args.length > 0) {
    // Compare specific sessions
    for (const sessionId of args) {
      const session = database.sessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        console.error(`❌ Session not found: ${sessionId}`);
        process.exit(1);
      }
      sessions.push(session);
    }
  } else {
    // Compare last N sessions
    const lastN = Math.min(DEFAULT_LAST_N_SESSIONS, database.sessions.length);
    sessions = database.sessions.slice(-lastN);
    console.log(`ℹ️  Comparing last ${lastN} sessions`);
  }

  // Compare sessions
  compareSessions(sessions);
}

// ============================================================================
// RUN
// ============================================================================

main();
