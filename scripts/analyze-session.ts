/**
 * Analyze Session Script
 *
 * Analyzes a single trading session with detailed statistics:
 * - Session info (ID, duration, symbol, version)
 * - Overall performance (trades, win rate, PnL, W/L ratio)
 * - Strategy breakdown
 * - Direction breakdown (LONG/SHORT)
 * - Average holding time
 *
 * Usage:
 *   npm run analyze-session                    # Analyze last/current session
 *   npm run analyze-session session_ID         # Analyze specific session
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
const SEPARATOR = '━'.repeat(70);

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(startTime: string, endTime: string | null): string {
  if (!endTime) {
    return 'ACTIVE';
  }

  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatHoldingTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// ANALYSIS
// ============================================================================

function analyzeSession(session: Session): void {
  console.log('');
  console.log(SEPARATOR);
  console.log(`📊 Session Analysis: ${session.sessionId}`);
  console.log(SEPARATOR);
  console.log('');

  // Session Info
  console.log('📋 Session Info:');
  console.log(`  Started:  ${formatTime(session.startTime)}`);
  if (session.endTime) {
    console.log(`  Ended:    ${formatTime(session.endTime)}`);
  } else {
    console.log(`  Ended:    ACTIVE`);
  }
  console.log(`  Duration: ${formatDuration(session.startTime, session.endTime)}`);
  console.log(`  Symbol:   ${session.symbol}`);
  console.log(`  Version:  ${session.version}`);
  console.log('');

  // Overall Performance
  const { summary } = session;

  console.log('📈 Overall Performance:');
  console.log(`  Total Trades:   ${summary.totalTrades}`);
  console.log(`  Wins:           ${summary.wins} (${summary.winRate.toFixed(1)}%)`);
  console.log(`  Losses:         ${summary.losses}`);
  console.log(`  Total PnL:      ${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)} USDT`);
  console.log(`  Avg Win:        +${summary.avgWin.toFixed(2)} USDT`);
  console.log(`  Avg Loss:       ${summary.avgLoss.toFixed(2)} USDT`);
  console.log(`  W/L Ratio:      ${summary.wlRatio.toFixed(2)}x`);
  console.log(`  Stop-out Rate:  ${summary.stopOutRate.toFixed(1)}%`);
  console.log(`  Avg Hold Time:  ${formatHoldingTime(summary.avgHoldingTimeMs)}`);
  console.log('');

  // By Strategy
  if (Object.keys(summary.byStrategy).length > 0) {
    console.log('📊 By Strategy:');
    for (const [strategyType, stats] of Object.entries(summary.byStrategy)) {
      console.log(`  ${strategyType}:`);
      console.log(`    Trades:   ${stats.count} (${stats.wins}W / ${stats.losses}L)`);
      console.log(`    Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`    Total PnL: ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} USDT`);
    }
    console.log('');
  }

  // By Direction
  if (Object.keys(summary.byDirection).length > 0) {
    console.log('📊 By Direction:');
    for (const [direction, stats] of Object.entries(summary.byDirection)) {
      if (stats.count === 0) continue;
      console.log(`  ${direction}:`);
      console.log(`    Trades:   ${stats.count} (${stats.wins}W / ${stats.losses}L)`);
      console.log(`    Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`    Total PnL: ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} USDT`);
    }
    console.log('');
  }

  // Recent Trades (last 5)
  if (session.trades.length > 0) {
    console.log('📝 Recent Trades (last 5):');
    const recentTrades = session.trades.slice(-5);
    for (const trade of recentTrades) {
      const pnlStr = trade.pnl >= 0 ? `+${trade.pnl.toFixed(2)}` : trade.pnl.toFixed(2);
      const pnlColor = trade.pnl >= 0 ? '✅' : '❌';
      console.log(`  ${pnlColor} ${trade.direction} | ${trade.entryCondition.signal.type} | ${pnlStr} USDT (${trade.pnlPercent.toFixed(2)}%) | ${trade.exitType}`);
    }
    console.log('');
  }

  console.log(SEPARATOR);
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const sessionId = args[0];

  // Load session database
  const filePath = path.join(DEFAULT_DATA_DIR, SESSION_STATS_FILE);

  if (!fs.existsSync(filePath)) {
    console.error('❌ Session stats file not found:', filePath);
    console.error('   Run the bot first to generate session data.');
    process.exit(1);
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  const database: SessionDatabase = JSON.parse(data);

  if (database.sessions.length === 0) {
    console.error('❌ No sessions found in database.');
    process.exit(1);
  }

  // Find session
  let session: Session | null = null;

  if (sessionId) {
    // Analyze specific session
    session = database.sessions.find((s) => s.sessionId === sessionId) || null;

    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      console.error('\nAvailable sessions:');
      for (const s of database.sessions) {
        console.error(`  - ${s.sessionId} (${formatTime(s.startTime)})`);
      }
      process.exit(1);
    }
  } else {
    // Analyze last/current session
    session = database.sessions[database.sessions.length - 1];
    console.log(`ℹ️  Analyzing last session: ${session.sessionId}`);
  }

  // Analyze session
  analyzeSession(session);
}

// ============================================================================
// RUN
// ============================================================================

main();
