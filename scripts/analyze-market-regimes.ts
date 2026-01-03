/**
 * Market Regime Analyzer
 *
 * Analyzes trade journal to identify which market regimes favor LONG vs SHORT trades.
 * Groups trades by market conditions (TRENDING_UP, TRENDING_DOWN, NEUTRAL, VOLATILE)
 * and shows performance statistics for each regime.
 *
 * This helps identify:
 * - When to favor LONG (bullish market)
 * - When to favor SHORT (bearish market)
 * - When to stay out (choppy/volatile)
 * - Optimal parameters for each regime
 *
 * Usage:
 *   npx ts-node scripts/analyze-market-regimes.ts [path/to/journal.json]
 *   npm run analyze-regimes
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface JournalTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  realizedPnL: number;
  openedAt: string;
  closedAt?: string;
  entryPrice: number;
  exitPrice?: number;
  entryCondition?: {
    signal?: {
      type: string;
      confidence: number;
      reason: string;
    };
    indicators?: {
      primary?: {
        ema20?: number;
        ema50?: number;
        rsi?: number;
        atr?: number;
      };
    };
  };
  exitCondition?: {
    exitType: string;
  };
}

type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'NEUTRAL' | 'VOLATILE' | 'UNKNOWN';

interface RegimeStats {
  regime: MarketRegime;
  trades: number;
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
  longPnL: number;
  shortPnL: number;
  avgATR: number;
  avgRSI: number;
}

// ============================================================================
// MARKET REGIME DETECTION
// ============================================================================

function detectMarketRegime(trade: JournalTrade): MarketRegime {
  const indicators = trade.entryCondition?.indicators?.primary;
  if (!indicators) return 'UNKNOWN';

  const { ema20, ema50, rsi, atr } = indicators;
  const entryPrice = trade.entryPrice;

  // Need EMA data for regime detection
  if (ema20 === undefined || ema50 === undefined || !entryPrice) {
    return 'UNKNOWN';
  }

  // Calculate EMA distance (%)
  const emaDistance = Math.abs((ema20 - ema50) / ema50) * 100;

  // Calculate price distance from EMAs
  const priceAboveEMA20 = ((entryPrice - ema20) / ema20) * 100;
  const priceAboveEMA50 = ((entryPrice - ema50) / ema50) * 100;

  // ATR volatility check (if available)
  const atrPercent = atr ? (atr / entryPrice) * 100 : 0;
  const isVolatile = atr && atrPercent > 2.5; // >2.5% ATR = volatile

  // VOLATILE: High ATR regardless of trend
  if (isVolatile) {
    return 'VOLATILE';
  }

  // NEUTRAL: EMAs very close (<0.3%), price near both EMAs
  if (emaDistance < 0.3 && Math.abs(priceAboveEMA20) < 0.5) {
    return 'NEUTRAL';
  }

  // TRENDING UP: EMA20 > EMA50, price above both EMAs
  if (ema20 > ema50 && priceAboveEMA20 > 0 && priceAboveEMA50 > 0) {
    return 'TRENDING_UP';
  }

  // TRENDING DOWN: EMA20 < EMA50, price below both EMAs
  if (ema20 < ema50 && priceAboveEMA20 < 0 && priceAboveEMA50 < 0) {
    return 'TRENDING_DOWN';
  }

  // Mixed signals = NEUTRAL
  return 'NEUTRAL';
}

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

function calculateRegimeStats(trades: JournalTrade[], regime: MarketRegime): RegimeStats {
  const regimeTrades = trades.filter((t) => detectMarketRegime(t) === regime);

  if (regimeTrades.length === 0) {
    return {
      regime,
      trades: 0,
      longTrades: 0,
      shortTrades: 0,
      longWinRate: 0,
      shortWinRate: 0,
      longPnL: 0,
      shortPnL: 0,
      avgATR: 0,
      avgRSI: 0,
    };
  }

  const longs = regimeTrades.filter((t) => t.side === 'LONG');
  const shorts = regimeTrades.filter((t) => t.side === 'SHORT');

  const longWins = longs.filter((t) => t.realizedPnL > 0).length;
  const shortWins = shorts.filter((t) => t.realizedPnL > 0).length;

  const longPnL = longs.reduce((sum, t) => sum + t.realizedPnL, 0);
  const shortPnL = shorts.reduce((sum, t) => sum + t.realizedPnL, 0);

  const longWinRate = longs.length > 0 ? (longWins / longs.length) * 100 : 0;
  const shortWinRate = shorts.length > 0 ? (shortWins / shorts.length) * 100 : 0;

  // Calculate average ATR and RSI
  const atrs = regimeTrades
    .map((t) => t.entryCondition?.indicators?.primary?.atr)
    .filter((atr) => atr !== undefined) as number[];
  const avgATR = atrs.length > 0 ? atrs.reduce((sum, atr) => sum + atr, 0) / atrs.length : 0;

  const rsis = regimeTrades
    .map((t) => t.entryCondition?.indicators?.primary?.rsi)
    .filter((rsi) => rsi !== undefined) as number[];
  const avgRSI = rsis.length > 0 ? rsis.reduce((sum, rsi) => sum + rsi, 0) / rsis.length : 0;

  return {
    regime,
    trades: regimeTrades.length,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longWinRate,
    shortWinRate,
    longPnL,
    shortPnL,
    avgATR,
    avgRSI,
  };
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function generateRecommendations(stats: RegimeStats[]): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS BY MARKET REGIME:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  stats.forEach((stat) => {
    if (stat.trades === 0) return; // Skip regimes with no data

    console.log(`📊 **${stat.regime}** (${stat.trades} trades)`);
    console.log('───────────────────────────────────────────────────────────');

    const longProfitable = stat.longWinRate >= 55 && stat.longPnL > 0;
    const shortProfitable = stat.shortWinRate >= 55 && stat.shortPnL > 0;

    // Determine best direction
    if (longProfitable && !shortProfitable) {
      console.log('✅ **FAVOR LONG ONLY**');
      console.log(`   - LONG Win Rate: ${stat.longWinRate.toFixed(1)}% ✅`);
      console.log(`   - LONG PnL: ${stat.longPnL >= 0 ? '+' : ''}${stat.longPnL.toFixed(2)} USDT`);
      console.log(`   - SHORT Win Rate: ${stat.shortWinRate.toFixed(1)}% ❌`);
      console.log(`   - SHORT PnL: ${stat.shortPnL >= 0 ? '+' : ''}${stat.shortPnL.toFixed(2)} USDT`);
      console.log('');
      console.log('   💡 Recommended Config:');
      console.log('   ```json');
      console.log('   {');
      console.log('     "levelBased": {');
      console.log('       "allowShort": false,  // Disable SHORT in this regime');
      console.log('       "maxDistancePercent": 0.4');
      console.log('     }');
      console.log('   }');
      console.log('   ```');
    } else if (shortProfitable && !longProfitable) {
      console.log('✅ **FAVOR SHORT ONLY**');
      console.log(`   - SHORT Win Rate: ${stat.shortWinRate.toFixed(1)}% ✅`);
      console.log(`   - SHORT PnL: ${stat.shortPnL >= 0 ? '+' : ''}${stat.shortPnL.toFixed(2)} USDT`);
      console.log(`   - LONG Win Rate: ${stat.longWinRate.toFixed(1)}% ❌`);
      console.log(`   - LONG PnL: ${stat.longPnL >= 0 ? '+' : ''}${stat.longPnL.toFixed(2)} USDT`);
      console.log('');
      console.log('   💡 Recommended Config:');
      console.log('   ```json');
      console.log('   {');
      console.log('     "levelBased": {');
      console.log('       "allowLong": false,  // Disable LONG in this regime');
      console.log('       "maxDistancePercent": 0.3');
      console.log('     }');
      console.log('   }');
      console.log('   ```');
    } else if (longProfitable && shortProfitable) {
      console.log('✅ **BOTH DIRECTIONS WORK**');
      console.log(`   - LONG: ${stat.longWinRate.toFixed(1)}% WR, ${stat.longPnL >= 0 ? '+' : ''}${stat.longPnL.toFixed(2)} USDT`);
      console.log(`   - SHORT: ${stat.shortWinRate.toFixed(1)}% WR, ${stat.shortPnL >= 0 ? '+' : ''}${stat.shortPnL.toFixed(2)} USDT`);
      console.log('');
      console.log('   💡 Continue trading both directions');
    } else {
      console.log('⚠️ **BOTH DIRECTIONS STRUGGLING**');
      console.log(`   - LONG: ${stat.longWinRate.toFixed(1)}% WR, ${stat.longPnL >= 0 ? '+' : ''}${stat.longPnL.toFixed(2)} USDT ❌`);
      console.log(`   - SHORT: ${stat.shortWinRate.toFixed(1)}% WR, ${stat.shortPnL >= 0 ? '+' : ''}${stat.shortPnL.toFixed(2)} USDT ❌`);
      console.log('');
      console.log('   💡 Recommended Action:');
      if (stat.regime === 'VOLATILE') {
        console.log('   - VOLATILE market → Widen stops OR sit out');
        console.log('   - Increase stopLossAtrMultiplier: 0.7 → 1.0');
      } else if (stat.regime === 'NEUTRAL') {
        console.log('   - NEUTRAL market → Use tighter levels, micro-profits');
        console.log('   - Reduce maxDistance: 0.5% → 0.3%');
        console.log('   - Use quick TPs: 0.4% / 0.7% / 1.2%');
      } else {
        console.log('   - Review entry conditions and filters');
      }
    }

    console.log('');
  });
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  // Get journal path(s)
  const dataDir = path.join(__dirname, '../data');
  const journalFiles = fs
    .readdirSync(dataDir)
    .filter((f) => f.includes('journal') && f.endsWith('.json'))
    .map((f) => path.join(dataDir, f));

  if (journalFiles.length === 0) {
    console.error('❌ No journal files found in data directory');
    process.exit(1);
  }

  console.log(`Found ${journalFiles.length} journal files:`);
  journalFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));
  console.log('');

  // Load and merge all journals
  let journal: JournalTrade[] = [];
  journalFiles.forEach((file) => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) {
        journal = journal.concat(data);
      }
    } catch (err) {
      console.warn(`⚠️  Could not load ${path.basename(file)}: ${err}`);
    }
  });

  // Remove duplicates by ID
  const uniqueTrades = new Map<string, JournalTrade>();
  journal.forEach((t) => uniqueTrades.set(t.id, t));
  journal = Array.from(uniqueTrades.values());

  // Filter CLOSED trades only
  const closedTrades = journal.filter((t) => t.status === 'CLOSED');

  if (closedTrades.length === 0) {
    console.log('ℹ️  No closed trades found in journal');
    return;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 MARKET REGIME ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Analyzing ${closedTrades.length} closed trades...`);
  console.log('');

  // Calculate stats for each regime
  const regimes: MarketRegime[] = ['TRENDING_UP', 'TRENDING_DOWN', 'NEUTRAL', 'VOLATILE', 'UNKNOWN'];
  const stats = regimes.map((regime) => calculateRegimeStats(closedTrades, regime));

  // Print stats table
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📈 REGIME STATISTICS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  stats.forEach((stat) => {
    if (stat.trades === 0) {
      console.log(`${stat.regime}: No trades`);
      return;
    }

    console.log(`${stat.regime}:`);
    console.log(`  Trades: ${stat.trades} (LONG: ${stat.longTrades}, SHORT: ${stat.shortTrades})`);
    console.log(`  LONG Win Rate: ${stat.longWinRate.toFixed(1)}% | PnL: ${stat.longPnL >= 0 ? '+' : ''}${stat.longPnL.toFixed(2)} USDT`);
    console.log(`  SHORT Win Rate: ${stat.shortWinRate.toFixed(1)}% | PnL: ${stat.shortPnL >= 0 ? '+' : ''}${stat.shortPnL.toFixed(2)} USDT`);
    console.log(`  Avg ATR: ${((stat.avgATR / closedTrades[0].entryPrice) * 100).toFixed(2)}%`);
    console.log(`  Avg RSI: ${stat.avgRSI.toFixed(1)}`);
    console.log('');
  });

  // Generate recommendations
  generateRecommendations(stats);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Analysis complete!');
  console.log('═══════════════════════════════════════════════════════════');
}

// Run
main();
