/**
 * ML Feasibility Analysis
 *
 * Analyzes trade data to determine if Machine Learning integration makes sense
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  entryPrice: number;
  exitPrice?: number;
  entryCondition?: {
    signal?: {
      type: string;
      confidence: number;
      reason?: string;
    };
  };
  exitCondition?: {
    realizedPnL: number;
    stoppedOut?: boolean;
    holdingTimeMs?: number;
    exitType?: string;
  };
}

interface MLFeasibilityReport {
  dataVolume: {
    strategy: string;
    totalTrades: number;
    closedTrades: number;
    minRequired: number;
    sufficient: boolean;
  }[];
  featureQuality: {
    hasConfidence: boolean;
    hasPatterns: boolean;
    hasIndicators: boolean;
    hasContext: boolean;
    score: number;
  };
  patterns: {
    strategy: string;
    avgWinConfidence: number;
    avgLossConfidence: number;
    confidenceDelta: number;
    isSignificant: boolean;
  }[];
  recommendation: {
    shouldUseML: boolean;
    reasons: string[];
    alternatives: string[];
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STRATEGIES = [
  {
    name: 'Limit Order',
    path: 'D:/src/Edison - limitorder/data/trade-journal.json',
    pnl: 34.94,
  },
  {
    name: 'Tick Delta',
    path: 'D:/src/Edison - tickdelta/data/trade-journal.json',
    pnl: 32.38,
  },
  {
    name: 'Block (LevelBased)',
    path: 'D:/src/Edison - block/data/trade-journal.json',
    pnl: 24.60,
  },
];

const MIN_TRADES_FOR_ML = 500; // Minimum trades needed for reliable ML

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadTrades(filePath: string): Trade[] {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error);
    return [];
  }
}

function analyzeDataVolume(strategies: typeof STRATEGIES): MLFeasibilityReport['dataVolume'] {
  return strategies.map(strat => {
    const trades = loadTrades(strat.path);
    const closed = trades.filter(t => t.status === 'CLOSED');

    return {
      strategy: strat.name,
      totalTrades: trades.length,
      closedTrades: closed.length,
      minRequired: MIN_TRADES_FOR_ML,
      sufficient: closed.length >= MIN_TRADES_FOR_ML,
    };
  });
}

function analyzeFeatureQuality(strategies: typeof STRATEGIES): MLFeasibilityReport['featureQuality'] {
  // Check first strategy with trades
  for (const strat of strategies) {
    const trades = loadTrades(strat.path);
    const sampleTrade = trades.find(t => t.status === 'CLOSED' && t.entryCondition?.signal);

    if (sampleTrade && sampleTrade.entryCondition?.signal) {
      const hasConfidence = sampleTrade.entryCondition.signal.confidence !== undefined;
      const hasPatterns = sampleTrade.entryCondition.signal.reason !== undefined;

      // Calculate score (0-100)
      let score = 0;
      if (hasConfidence) score += 40;
      if (hasPatterns) score += 30;
      // Note: indicators and context would need to be checked in actual data structure

      return {
        hasConfidence,
        hasPatterns,
        hasIndicators: false, // Would need to check actual data
        hasContext: false,
        score,
      };
    }
  }

  return {
    hasConfidence: false,
    hasPatterns: false,
    hasIndicators: false,
    hasContext: false,
    score: 0,
  };
}

function analyzeConfidencePatterns(strategies: typeof STRATEGIES): MLFeasibilityReport['patterns'] {
  const patterns: MLFeasibilityReport['patterns'] = [];

  for (const strat of strategies) {
    const trades = loadTrades(strat.path);
    const closed = trades.filter(t =>
      t.status === 'CLOSED' &&
      t.entryCondition?.signal?.confidence !== undefined &&
      t.exitCondition?.realizedPnL !== undefined
    );

    if (closed.length === 0) continue;

    const wins = closed.filter(t => t.exitCondition!.realizedPnL > 0);
    const losses = closed.filter(t => t.exitCondition!.realizedPnL <= 0);

    if (wins.length === 0 || losses.length === 0) continue;

    const avgWinConf = wins.reduce((sum, t) => sum + (t.entryCondition!.signal!.confidence * 100), 0) / wins.length;
    const avgLossConf = losses.reduce((sum, t) => sum + (t.entryCondition!.signal!.confidence * 100), 0) / losses.length;
    const delta = Math.abs(avgWinConf - avgLossConf);

    patterns.push({
      strategy: strat.name,
      avgWinConfidence: avgWinConf,
      avgLossConfidence: avgLossConf,
      confidenceDelta: delta,
      isSignificant: delta > 5, // >5% delta is significant
    });
  }

  return patterns;
}

function generateRecommendation(report: Omit<MLFeasibilityReport, 'recommendation'>): MLFeasibilityReport['recommendation'] {
  const reasons: string[] = [];
  const alternatives: string[] = [];

  // Check data volume
  const sufficientData = report.dataVolume.some(v => v.sufficient);
  if (!sufficientData) {
    reasons.push('❌ Insufficient data volume (need 500+ trades, have ' +
      Math.max(...report.dataVolume.map(v => v.closedTrades)) + ' max)');
    alternatives.push('Collect more trading data (run bots for 1-2 more weeks)');
  } else {
    reasons.push('✅ Sufficient data volume for ML training');
  }

  // Check feature quality
  if (report.featureQuality.score < 50) {
    reasons.push('❌ Limited feature set (score: ' + report.featureQuality.score + '/100)');
    alternatives.push('Enhance feature extraction (add indicators, patterns, market context)');
  } else {
    reasons.push('✅ Decent feature quality (score: ' + report.featureQuality.score + '/100)');
  }

  // Check pattern significance
  const significantPatterns = report.patterns.filter(p => p.isSignificant);
  if (significantPatterns.length === 0) {
    reasons.push('⚠️  No significant confidence patterns detected');
    alternatives.push('Rule-based calibration may be sufficient (current approach)');
  } else {
    reasons.push('✅ Significant patterns found in ' + significantPatterns.length + ' strategies');
  }

  // Check overall profitability
  const hasUnprofitableStrategies = STRATEGIES.some(s => s.pnl < 0);
  if (hasUnprofitableStrategies) {
    reasons.push('⚠️  Some strategies are unprofitable - calibration needed first');
    alternatives.push('Run calibration scripts before considering ML');
  }

  // Final decision
  const shouldUseML = sufficientData &&
                     report.featureQuality.score >= 50 &&
                     significantPatterns.length > 0 &&
                     !hasUnprofitableStrategies;

  if (!shouldUseML) {
    alternatives.push('Continue with rule-based optimization (calibration scripts)');
    alternatives.push('Focus on improving existing strategies before ML');
  }

  return {
    shouldUseML,
    reasons,
    alternatives,
  };
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🤖 ML FEASIBILITY ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Data Volume
  console.log('1️⃣  DATA VOLUME ASSESSMENT:');
  console.log('───────────────────────────────────────────────────────────────');
  const dataVolume = analyzeDataVolume(STRATEGIES);
  dataVolume.forEach(v => {
    const status = v.sufficient ? '✅' : '❌';
    console.log(`${status} ${v.strategy}:`);
    console.log(`   Total: ${v.totalTrades} | Closed: ${v.closedTrades} | Required: ${v.minRequired}`);
  });
  console.log('');

  // 2. Feature Quality
  console.log('2️⃣  FEATURE QUALITY:');
  console.log('───────────────────────────────────────────────────────────────');
  const featureQuality = analyzeFeatureQuality(STRATEGIES);
  console.log(`Confidence scores: ${featureQuality.hasConfidence ? '✅' : '❌'}`);
  console.log(`Pattern reasons: ${featureQuality.hasPatterns ? '✅' : '❌'}`);
  console.log(`Indicators: ${featureQuality.hasIndicators ? '✅' : '❌'}`);
  console.log(`Market context: ${featureQuality.hasContext ? '✅' : '❌'}`);
  console.log(`Overall Score: ${featureQuality.score}/100`);
  console.log('');

  // 3. Confidence Patterns
  console.log('3️⃣  CONFIDENCE PATTERN ANALYSIS:');
  console.log('───────────────────────────────────────────────────────────────');
  const patterns = analyzeConfidencePatterns(STRATEGIES);
  if (patterns.length === 0) {
    console.log('⚠️  No data available for pattern analysis');
  } else {
    patterns.forEach(p => {
      const status = p.isSignificant ? '✅' : '⚠️ ';
      console.log(`${status} ${p.strategy}:`);
      console.log(`   Avg Win Confidence:  ${p.avgWinConfidence.toFixed(1)}%`);
      console.log(`   Avg Loss Confidence: ${p.avgLossConfidence.toFixed(1)}%`);
      console.log(`   Delta: ${p.confidenceDelta.toFixed(1)}% ${p.isSignificant ? '(Significant!)' : ''}`);
    });
  }
  console.log('');

  // 4. Generate Recommendation
  const report: Omit<MLFeasibilityReport, 'recommendation'> = {
    dataVolume,
    featureQuality,
    patterns,
  };
  const recommendation = generateRecommendation(report);

  console.log('4️⃣  RECOMMENDATION:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('');
  console.log(`Should Use ML: ${recommendation.shouldUseML ? '✅ YES' : '❌ NOT YET'}`);
  console.log('');
  console.log('Reasons:');
  recommendation.reasons.forEach(r => console.log(`  ${r}`));
  console.log('');

  if (!recommendation.shouldUseML) {
    console.log('Alternatives (Recommended):');
    recommendation.alternatives.forEach(a => console.log(`  • ${a}`));
    console.log('');
  } else {
    console.log('💡 ML INTEGRATION SUGGESTIONS:');
    console.log('  1. Start with Supervised Learning (Classification: Win/Loss prediction)');
    console.log('  2. Features: confidence, stop-loss distance, holding time, market conditions');
    console.log('  3. Models to try: Random Forest, XGBoost, Neural Networks');
    console.log('  4. Validation: Cross-validation + walk-forward analysis');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

main();
