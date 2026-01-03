/**
 * Analyze All Scalping Strategies
 *
 * Collects trade journals from all 5 deployed strategies and generates
 * a comprehensive statistics report.
 *
 * Usage:
 *   npx ts-node scripts/analyze-all-strategies.ts
 *   npx ts-node scripts/analyze-all-strategies.ts --output=report.md
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface Trade {
  tradeId: string;
  sessionId?: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  exitType?: string;
  size: number;
  pnl?: number;
  pnlPercent?: number;
  stopLoss?: number;
  takeProfit?: number | number[];
  tpHit?: number;
  holdingTimeMs?: number;
  entryReason?: {
    strategy: string;
    confidence: number;
    patterns?: string[];
    indicators?: {
      rsi?: { entry: number; primary: number; trend1: number };
      ema?: { entry: string; primary: string; trend1: string };
      atr?: { entry: number; primary: number };
    };
    levels?: {
      nearest: { price: number; type: string; strength: number };
      distance: number;
    };
    context?: {
      btcCorrelation?: number;
      fundingRate?: number;
      flatMarketScore?: number;
    };
  };
}

interface StrategyStats {
  strategyName: string;
  symbol: string;
  folder: string;
  ignored: boolean;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossPnL: number;
  netPnL: number;
  fees: number;
  longTrades: number;
  shortTrades: number;
  longWins: number;
  shortWins: number;
  longWinRate: number;
  shortWinRate: number;
  avgHoldingTime: number;
  stopOuts: number;
  stopOutRate: number;
  tpHits: number;
  tpHitRate: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  losingTrades: Trade[];
}

interface AllStats {
  generatedAt: string;
  strategies: StrategyStats[];
  overall: {
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    totalNetPnL: number;
    totalFees: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STRATEGY_CONFIGS = [
  // Traditional Strategies
  {
    name: 'Whale Hunter',
    symbol: 'APEXUSDT',
    folder: 'D:/src/Edison - weight',
    ignored: false, // Now enabled
  },
  {
    name: 'Block (LevelBased)',
    symbol: 'APEXUSDT',
    folder: 'D:/src/Edison - block',
    ignored: false,
  },
  // Scalping Strategies
  {
    name: 'Micro-Wall',
    symbol: 'SUIUSDT',
    folder: 'D:/src/Edison - microwall',
    ignored: true, // Disabled - no trades
  },
  {
    name: 'Tick Delta',
    symbol: 'STRKUSDT',
    folder: 'D:/src/Edison - tickdelta',
    ignored: false, // Now enabled
  },
  {
    name: 'Ladder TP',
    symbol: 'HYPEUSDT',
    folder: 'D:/src/Edison - laddertp',
    ignored: false,
  },
  {
    name: 'Limit Order',
    symbol: 'ADAUSDT',
    folder: 'D:/src/Edison - limitorder',
    ignored: false,
  },
  {
    name: 'Order Flow',
    symbol: 'XLMUSDT',
    folder: 'D:/src/Edison - orderflow',
    ignored: false, // Now enabled
  },
];

// Bybit fees
const TAKER_FEE = 0.0006; // 0.06%
const MAKER_FEE = 0.0001; // 0.01%

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load trade journal from file and map to Trade interface
 */
function loadJournal(filePath: string): Trade[] {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Journal not found: ${filePath}`);
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(content);
    const rawTrades = Array.isArray(rawData) ? rawData : rawData.trades || [];

    // Map actual journal format to expected Trade interface
    return rawTrades.map((t: any) => ({
      tradeId: t.id || t.tradeId,
      sessionId: t.sessionId,
      symbol: t.symbol,
      direction: t.side || t.direction, // Map 'side' to 'direction'
      strategy: t.entryCondition?.signal?.type || t.strategy || 'Unknown',
      entryTime: t.openedAt || t.entryTime,
      entryPrice: t.entryPrice,
      exitTime: t.closedAt || t.exitTime,
      exitPrice: t.exitPrice,
      exitType: t.exitCondition?.exitType || t.exitType,
      size: t.quantity || t.size,
      pnl: t.realizedPnL !== undefined ? t.realizedPnL : t.pnl,
      pnlPercent: t.exitCondition?.pnlPercent || t.pnlPercent,
      stopLoss: t.entryCondition?.signal?.stopLoss || t.stopLoss,
      takeProfit: t.entryCondition?.signal?.takeProfits || t.takeProfit,
      tpHit: t.exitCondition?.tpLevelsHitCount || t.tpHit,
      holdingTimeMs: t.exitCondition?.holdingTimeMs || t.holdingTimeMs,
      entryReason: t.entryReason || {
        strategy: t.entryCondition?.signal?.type || 'Unknown',
        confidence: (t.entryCondition?.signal?.confidence || 0) * 100,
        patterns: [],
        indicators: undefined,
        levels: undefined,
        context: undefined,
      },
    }));
  } catch (error) {
    console.error(`❌ Error loading journal: ${filePath}`, error);
    return [];
  }
}

/**
 * Calculate Bybit fees for a trade
 */
function calculateFees(trade: Trade): number {
  const notionalValue = trade.entryPrice * trade.size;

  // Scalping strategies typically use market orders (taker)
  const entryFee = notionalValue * TAKER_FEE;

  if (trade.exitPrice) {
    const exitNotional = trade.exitPrice * trade.size;
    const exitFee = exitNotional * TAKER_FEE;
    return entryFee + exitFee;
  }

  return entryFee;
}

/**
 * Analyze strategy trades
 */
function analyzeStrategy(
  strategyName: string,
  symbol: string,
  folder: string,
  trades: Trade[],
  ignored: boolean = false
): StrategyStats {
  const completedTrades = trades.filter(t => t.exitTime && t.pnl !== undefined);

  const wins = completedTrades.filter(t => (t.pnl || 0) > 0);
  const losses = completedTrades.filter(t => (t.pnl || 0) <= 0);

  const longTrades = completedTrades.filter(t => t.direction === 'LONG');
  const shortTrades = completedTrades.filter(t => t.direction === 'SHORT');
  const longWins = longTrades.filter(t => (t.pnl || 0) > 0);
  const shortWins = shortTrades.filter(t => (t.pnl || 0) > 0);

  const stopOuts = completedTrades.filter(t =>
    t.exitType === 'STOP_LOSS' || t.exitType?.includes('SL')
  );

  const tpHits = completedTrades.filter(t =>
    t.exitType === 'TAKE_PROFIT' || t.exitType?.includes('TP')
  );

  const grossPnL = completedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const fees = completedTrades.reduce((sum, t) => sum + calculateFees(t), 0);
  const netPnL = grossPnL - fees;

  const avgHoldingTime = completedTrades.length > 0
    ? completedTrades.reduce((sum, t) => sum + (t.holdingTimeMs || 0), 0) / completedTrades.length
    : 0;

  const avgWin = wins.length > 0
    ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length
    : 0;

  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length)
    : 0;

  return {
    strategyName,
    symbol,
    folder,
    ignored,
    totalTrades: completedTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: completedTrades.length > 0 ? (wins.length / completedTrades.length) * 100 : 0,
    grossPnL,
    netPnL,
    fees,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longWins: longWins.length,
    shortWins: shortWins.length,
    longWinRate: longTrades.length > 0 ? (longWins.length / longTrades.length) * 100 : 0,
    shortWinRate: shortTrades.length > 0 ? (shortWins.length / shortTrades.length) * 100 : 0,
    avgHoldingTime,
    stopOuts: stopOuts.length,
    stopOutRate: completedTrades.length > 0 ? (stopOuts.length / completedTrades.length) * 100 : 0,
    tpHits: tpHits.length,
    tpHitRate: completedTrades.length > 0 ? (tpHits.length / completedTrades.length) * 100 : 0,
    avgWin,
    avgLoss,
    winLossRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
    losingTrades: losses,
  };
}

/**
 * Analyze losing trades to find common patterns
 */
function analyzeLosses(stats: StrategyStats): string {
  if (stats.losingTrades.length === 0) {
    return '✅ No losing trades!';
  }

  let analysis = '';

  // Group by entry strategy
  const byStrategy: Record<string, number> = {};
  stats.losingTrades.forEach(t => {
    const strategy = t.entryReason?.strategy || 'Unknown';
    byStrategy[strategy] = (byStrategy[strategy] || 0) + 1;
  });

  analysis += '\n**By Entry Strategy:**\n';
  Object.entries(byStrategy)
    .sort(([, a], [, b]) => b - a)
    .forEach(([strategy, count]) => {
      const pct = ((count / stats.losingTrades.length) * 100).toFixed(1);
      analysis += `  - ${strategy}: ${count} losses (${pct}%)\n`;
    });

  // Group by patterns
  const patternCounts: Record<string, number> = {};
  stats.losingTrades.forEach(t => {
    const patterns = t.entryReason?.patterns || [];
    patterns.forEach(p => {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
  });

  if (Object.keys(patternCounts).length > 0) {
    analysis += '\n**Common Patterns in Losses:**\n';
    Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([pattern, count]) => {
        const pct = ((count / stats.losingTrades.length) * 100).toFixed(1);
        analysis += `  - ${pattern}: ${count} occurrences (${pct}%)\n`;
      });
  }

  // Average confidence of losing trades
  const confidences = stats.losingTrades
    .map(t => t.entryReason?.confidence)
    .filter(c => c !== undefined) as number[];

  if (confidences.length > 0) {
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    analysis += `\n**Avg Confidence of Losses:** ${avgConfidence.toFixed(1)}%\n`;

    if (avgConfidence < 70) {
      analysis += `  ⚠️ Low confidence signals → Consider increasing minConfidence threshold\n`;
    }
  }

  // Direction analysis
  const longLosses = stats.losingTrades.filter(t => t.direction === 'LONG').length;
  const shortLosses = stats.losingTrades.filter(t => t.direction === 'SHORT').length;

  analysis += `\n**By Direction:**\n`;
  analysis += `  - LONG losses: ${longLosses} (${((longLosses / stats.losingTrades.length) * 100).toFixed(1)}%)\n`;
  analysis += `  - SHORT losses: ${shortLosses} (${((shortLosses / stats.losingTrades.length) * 100).toFixed(1)}%)\n`;

  return analysis;
}

/**
 * Generate markdown report
 */
function generateReport(allStats: AllStats): string {
  let report = '# 📊 All Strategies Analysis Report\n\n';
  report += `**Generated:** ${allStats.generatedAt}\n\n`;
  report += '---\n\n';

  // Overall statistics
  report += '## 🎯 Overall Statistics\n\n';

  const ignoredCount = allStats.strategies.filter(s => s.ignored).length;
  if (ignoredCount > 0) {
    report += `> ℹ️ **Note:** ${ignoredCount} strateg${ignoredCount > 1 ? 'ies are' : 'y is'} excluded from overall statistics (marked as ⏸️ IGNORED)\n\n`;
  }

  report += '| Metric | Value |\n';
  report += '|--------|-------|\n';
  report += `| Total Trades | ${allStats.overall.totalTrades} |\n`;
  report += `| Total Wins | ${allStats.overall.totalWins} |\n`;
  report += `| Total Losses | ${allStats.overall.totalLosses} |\n`;
  report += `| Overall Win Rate | **${allStats.overall.overallWinRate.toFixed(2)}%** |\n`;
  report += `| Total Net PnL | **${allStats.overall.totalNetPnL >= 0 ? '+' : ''}${allStats.overall.totalNetPnL.toFixed(2)} USDT** |\n`;
  report += `| Total Fees Paid | ${allStats.overall.totalFees.toFixed(2)} USDT |\n`;
  report += '\n---\n\n';

  // Per-strategy breakdown
  report += '## 📈 By Strategy\n\n';

  allStats.strategies.forEach(stats => {
    const ignoredMarker = stats.ignored ? ' ⏸️ [IGNORED]' : '';
    report += `### ${stats.strategyName} (${stats.symbol})${ignoredMarker}\n\n`;

    if (stats.ignored && stats.totalTrades > 0) {
      report += '⏸️ **Strategy excluded from overall statistics**\n\n';
    }

    if (stats.totalTrades === 0) {
      report += '⚠️ **No trades yet**\n\n';
      return;
    }

    // Main stats table
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Total Trades | ${stats.totalTrades} |\n`;
    report += `| Win Rate | **${stats.winRate.toFixed(2)}%** (${stats.wins}W / ${stats.losses}L) |\n`;
    report += `| Net PnL | **${stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toFixed(2)} USDT** |\n`;
    report += `| Gross PnL | ${stats.grossPnL >= 0 ? '+' : ''}${stats.grossPnL.toFixed(2)} USDT |\n`;
    report += `| Fees | -${stats.fees.toFixed(2)} USDT |\n`;
    report += `| Avg Holding Time | ${(stats.avgHoldingTime / 1000).toFixed(1)}s |\n`;
    report += `| Stop-Out Rate | ${stats.stopOutRate.toFixed(1)}% (${stats.stopOuts}/${stats.totalTrades}) |\n`;
    report += `| TP Hit Rate | ${stats.tpHitRate.toFixed(1)}% (${stats.tpHits}/${stats.totalTrades}) |\n`;
    report += `| Avg Win | +${stats.avgWin.toFixed(2)} USDT |\n`;
    report += `| Avg Loss | -${stats.avgLoss.toFixed(2)} USDT |\n`;
    report += `| W/L Ratio | **${stats.winLossRatio.toFixed(2)}:1** |\n`;
    report += '\n';

    // Direction stats
    report += '**By Direction:**\n';
    report += `- LONG: ${stats.longTrades} trades (WR: ${stats.longWinRate.toFixed(1)}%)\n`;
    report += `- SHORT: ${stats.shortTrades} trades (WR: ${stats.shortWinRate.toFixed(1)}%)\n`;
    report += '\n';

    // Performance indicators
    report += '**Performance Indicators:**\n';

    const indicators: string[] = [];
    if (stats.winRate >= 65) indicators.push('✅ Win Rate ≥ 65%');
    else indicators.push('❌ Win Rate < 65%');

    if (stats.stopOutRate < 40) indicators.push('✅ Stop-Out Rate < 40%');
    else indicators.push('❌ Stop-Out Rate ≥ 40%');

    if (stats.winLossRatio >= 1.5) indicators.push('✅ W/L Ratio ≥ 1.5');
    else indicators.push('❌ W/L Ratio < 1.5');

    if (stats.netPnL > 0) indicators.push('✅ Net PnL Positive');
    else indicators.push('❌ Net PnL Negative');

    indicators.forEach(ind => report += `${ind}\n`);
    report += '\n';

    // Loss analysis
    if (stats.losingTrades.length > 0) {
      report += '**📉 Loss Analysis:**\n';
      report += analyzeLosses(stats);
      report += '\n';
    }

    // Recommendations
    report += '**💡 Recommendations:**\n';

    if (stats.winRate < 65) {
      report += '- ⚠️ **Win Rate too low** → Consider calibration or increase minConfidence\n';
    }

    if (stats.stopOutRate > 40) {
      report += '- ⚠️ **High Stop-Out Rate** → Consider increasing SL distance or ATR multiplier\n';
    }

    if (stats.winLossRatio < 1.5) {
      report += '- ⚠️ **Low W/L Ratio** → Optimize TP/SL ratio or entry quality\n';
    }

    if (stats.avgHoldingTime < 10000) {
      report += '- ⚠️ **Very short holding time** → May indicate SL too tight\n';
    }

    if (stats.totalTrades < 10) {
      report += '- ℹ️ **Low sample size** → Need more trades for reliable statistics\n';
    }

    if (stats.winRate >= 65 && stats.stopOutRate < 40 && stats.netPnL > 0) {
      report += '- ✅ **Strategy performing well** → Continue monitoring\n';
    }

    report += '\n---\n\n';
  });

  // Summary recommendations
  report += '## 🎯 Overall Recommendations\n\n';

  const needsCalibration = allStats.strategies.filter(s => !s.ignored && s.winRate < 65 && s.totalTrades > 10);
  const needsMoreData = allStats.strategies.filter(s => !s.ignored && s.totalTrades < 10);
  const performing = allStats.strategies.filter(s => !s.ignored && s.winRate >= 65 && s.netPnL > 0);
  const ignoredStrategies = allStats.strategies.filter(s => s.ignored);

  if (needsCalibration.length > 0) {
    report += '### ⚠️ Strategies Needing Calibration:\n\n';
    needsCalibration.forEach(s => {
      report += `- **${s.strategyName} (${s.symbol})**: WR ${s.winRate.toFixed(1)}%\n`;
      report += `  \`\`\`bash\n`;
      report += `  npm run calibrate:${s.strategyName.toLowerCase().replace(/[^a-z]/g, '')}\n`;
      report += `  \`\`\`\n`;
    });
    report += '\n';
  }

  if (needsMoreData.length > 0) {
    report += '### ℹ️ Strategies Need More Data:\n\n';
    needsMoreData.forEach(s => {
      report += `- **${s.strategyName} (${s.symbol})**: Only ${s.totalTrades} trades\n`;
    });
    report += '\n';
  }

  if (performing.length > 0) {
    report += '### ✅ Well-Performing Strategies:\n\n';
    performing.forEach(s => {
      report += `- **${s.strategyName} (${s.symbol})**: WR ${s.winRate.toFixed(1)}%, PnL +${s.netPnL.toFixed(2)} USDT\n`;
    });
    report += '\n';
  }

  if (ignoredStrategies.length > 0) {
    report += '### ⏸️ Ignored Strategies (Excluded from Overall Stats):\n\n';
    ignoredStrategies.forEach(s => {
      const pnlStr = s.totalTrades > 0
        ? ` | ${s.totalTrades} trades | WR ${s.winRate.toFixed(1)}% | PnL ${s.netPnL >= 0 ? '+' : ''}${s.netPnL.toFixed(2)} USDT`
        : ' | No trades';
      report += `- **${s.strategyName} (${s.symbol})**${pnlStr}\n`;
    });
    report += '\n';
  }

  if (allStats.overall.overallWinRate < 65) {
    report += '**⚠️ Overall win rate below target (65%) → Review and calibrate underperforming strategies**\n\n';
  } else {
    report += '**✅ Overall performance meets target (WR ≥ 65%) → Continue monitoring**\n\n';
  }

  report += '---\n\n';
  report += `**Report Location:** \`${path.join(process.cwd(), 'ALL_STRATEGIES_REPORT.md')}\`\n`;

  return report;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('📊 Analyzing all scalping strategies...\n');

  const allStats: AllStats = {
    generatedAt: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
    strategies: [],
    overall: {
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      overallWinRate: 0,
      totalNetPnL: 0,
      totalFees: 0,
    },
  };

  // Analyze each strategy
  for (const config of STRATEGY_CONFIGS) {
    const journalPath = path.join(config.folder, 'data', 'trade-journal.json');

    const ignoredMarker = config.ignored ? '⏸️ ' : '📂 ';
    console.log(`${ignoredMarker}${config.name} (${config.symbol})${config.ignored ? ' [IGNORED]' : ''}`);
    console.log(`   Loading: ${journalPath}`);

    const trades = loadJournal(journalPath);
    const stats = analyzeStrategy(config.name, config.symbol, config.folder, trades, config.ignored);

    console.log(`   ✅ ${stats.totalTrades} trades | WR: ${stats.winRate.toFixed(1)}% | PnL: ${stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toFixed(2)} USDT${config.ignored ? ' [IGNORED]' : ''}\n`);

    allStats.strategies.push(stats);

    // Accumulate overall stats (skip ignored strategies)
    if (!config.ignored) {
      allStats.overall.totalTrades += stats.totalTrades;
      allStats.overall.totalWins += stats.wins;
      allStats.overall.totalLosses += stats.losses;
      allStats.overall.totalNetPnL += stats.netPnL;
      allStats.overall.totalFees += stats.fees;
    }
  }

  // Calculate overall win rate
  if (allStats.overall.totalTrades > 0) {
    allStats.overall.overallWinRate =
      (allStats.overall.totalWins / allStats.overall.totalTrades) * 100;
  }

  // Generate report for today
  const todayReport = generateReport(allStats);

  // Get output path from args or use default
  const args = process.argv.slice(2);
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg
    ? outputArg.split('=')[1]
    : 'ALL_STRATEGIES_REPORT.md';

  const fullPath = path.resolve(process.cwd(), outputPath);

  // Check if file exists (append mode)
  let finalReport: string;
  if (fs.existsSync(fullPath)) {
    // Read existing content
    const existingContent = fs.readFileSync(fullPath, 'utf-8');

    // Extract date from today's report
    const todayDate = allStats.generatedAt.split(' ')[0];

    // Check if today's section already exists
    const dateMarker = `## 📅 ${todayDate}`;
    if (existingContent.includes(dateMarker)) {
      // Replace today's section
      const sections = existingContent.split(/^## 📅 /gm);
      const header = sections[0]; // Title + intro
      const otherSections = sections.slice(1);

      // Find and replace today's section
      const updatedSections = otherSections.map(section => {
        if (section.startsWith(todayDate)) {
          // Replace with new content (remove old date marker)
          return todayReport.replace(/^# 📊 All Strategies Analysis Report\n\n\*\*Generated:\*\* .*\n\n---\n\n/m, '');
        }
        return section;
      });

      finalReport = header + '## 📅 ' + updatedSections.join('## 📅 ');
    } else {
      // Append new day section
      // Extract everything after the first header
      const headerMatch = existingContent.match(/^# 📊 All Strategies Historical Report\n\n---\n\n/);
      if (headerMatch) {
        const header = headerMatch[0];
        const oldSections = existingContent.substring(header.length);

        // Create new section for today
        const todaySection = `## 📅 ${todayDate}\n\n` +
          todayReport.replace(/^# 📊 All Strategies Analysis Report\n\n\*\*Generated:\*\* .*\n\n---\n\n/m, '') +
          '\n---\n\n';

        finalReport = header + todaySection + oldSections;
      } else {
        // Old format file - convert to new format
        const todaySection = `## 📅 ${todayDate}\n\n` +
          todayReport.replace(/^# 📊 All Strategies Analysis Report\n\n\*\*Generated:\*\* .*\n\n---\n\n/m, '');

        finalReport = '# 📊 All Strategies Historical Report\n\n---\n\n' +
          todaySection + '\n---\n\n' +
          '## 📅 Archive\n\n' + existingContent;
      }
    }
  } else {
    // New file - create with historical format
    const todayDate = allStats.generatedAt.split(' ')[0];
    const todaySection = `## 📅 ${todayDate} (Latest)\n\n` +
      todayReport.replace(/^# 📊 All Strategies Analysis Report\n\n\*\*Generated:\*\* .*\n\n---\n\n/m, '');

    finalReport = '# 📊 All Strategies Historical Report\n\n' +
      '**This report is automatically updated daily. Latest results appear first.**\n\n' +
      '---\n\n' + todaySection;
  }

  fs.writeFileSync(fullPath, finalReport, 'utf-8');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 OVERALL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Trades:  ${allStats.overall.totalTrades}`);
  console.log(`Win Rate:      ${allStats.overall.overallWinRate.toFixed(2)}%`);
  console.log(`Net PnL:       ${allStats.overall.totalNetPnL >= 0 ? '+' : ''}${allStats.overall.totalNetPnL.toFixed(2)} USDT`);
  console.log(`Fees:          -${allStats.overall.totalFees.toFixed(2)} USDT`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`✅ Report saved to: ${fullPath}\n`);

  // Open in default markdown viewer (optional)
  if (process.platform === 'win32') {
    console.log(`💡 To view: code "${fullPath}"\n`);
  }
}

main().catch(console.error);
