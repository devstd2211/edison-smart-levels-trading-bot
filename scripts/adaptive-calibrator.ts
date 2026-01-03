/**
 * Adaptive Parameter Calibrator for Whale Hunter
 *
 * Automatically adjusts Whale Hunter parameters based on recent trading results.
 *
 * Logic:
 * - After STOP_LOSS → Tighten parameters (increase confidence, wall size, duration)
 * - After WIN → Lock parameters (successful config)
 * - After multiple wins → Relax slightly (capture more opportunities)
 *
 * Parameters adjusted:
 * - minConfidence (70% → 75% → 80% → 85%)
 * - minWallSize (8% → 10% → 12% → 15%)
 * - minWallDuration (45s → 90s → 120s → 180s)
 *
 * Usage:
 *   npm run calibrate
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
  openedAt: string | number;
  entryCondition?: {
    signal?: {
      type: string;
      confidence: number;
      reason: string;
    };
  };
  exitCondition?: {
    exitType: string;
  };
}

interface ParameterSet {
  minConfidence: number;
  minWallSize: number;
  minWallDuration: number; // seconds
}

interface CalibrationHistory {
  timestamp: string;
  reason: string;
  previousParams: ParameterSet;
  newParams: ParameterSet;
  recentResults: string; // e.g., "LLL" = 3 losses
}

// ============================================================================
// PARAMETER PRESETS
// ============================================================================

const PRESETS: ParameterSet[] = [
  // Very relaxed - catches many whales, but lower quality
  { minConfidence: 70, minWallSize: 8, minWallDuration: 45 },

  // Relaxed - good balance
  { minConfidence: 75, minWallSize: 10, minWallDuration: 90 },

  // Moderate - current default
  { minConfidence: 75, minWallSize: 12, minWallDuration: 90 },

  // Strict - filter out noise
  { minConfidence: 80, minWallSize: 15, minWallDuration: 180 },

  // Very strict - only best whales
  { minConfidence: 85, minWallSize: 18, minWallDuration: 240 },
];

// ============================================================================
// CALIBRATION LOGIC
// ============================================================================

function getRecentWhaleTrades(allTrades: JournalTrade[], lookback: number = 10): JournalTrade[] {
  const whaleTrades = allTrades
    .filter((t) => t.status === 'CLOSED')
    .filter((t) => t.entryCondition?.signal?.type?.includes('WHALE'))
    .sort((a, b) => {
      const timeA = typeof a.openedAt === 'number' ? a.openedAt : new Date(a.openedAt).getTime();
      const timeB = typeof b.openedAt === 'number' ? b.openedAt : new Date(b.openedAt).getTime();
      return timeB - timeA; // Newest first
    });

  return whaleTrades.slice(0, lookback);
}

function analyzePattern(trades: JournalTrade[]): string {
  // Convert to W/L pattern (e.g., "LWWL")
  return trades
    .map((t) => {
      if (t.exitCondition?.exitType === 'STOP_LOSS') return 'L';
      if (t.realizedPnL > 0) return 'W';
      return 'L';
    })
    .join('');
}

function getCurrentPresetIndex(params: ParameterSet): number {
  // Find closest preset
  for (let i = 0; i < PRESETS.length; i++) {
    const preset = PRESETS[i];
    if (
      preset.minConfidence === params.minConfidence &&
      preset.minWallSize === params.minWallSize &&
      preset.minWallDuration === params.minWallDuration
    ) {
      return i;
    }
  }

  // Find closest by confidence
  for (let i = 0; i < PRESETS.length; i++) {
    if (PRESETS[i].minConfidence >= params.minConfidence) {
      return i;
    }
  }

  return 2; // Default to moderate
}

function calibrateParameters(recentTrades: JournalTrade[], currentParams: ParameterSet): {
  newParams: ParameterSet;
  reason: string;
} {
  if (recentTrades.length === 0) {
    return { newParams: currentParams, reason: 'No recent trades' };
  }

  const pattern = analyzePattern(recentTrades);
  const currentPresetIdx = getCurrentPresetIndex(currentParams);

  // Calculate recent performance
  const stopLosses = recentTrades.filter((t) => t.exitCondition?.exitType === 'STOP_LOSS').length;
  const wins = recentTrades.filter((t) => t.realizedPnL > 0).length;
  const winRate = wins / recentTrades.length;

  console.log('');
  console.log('📊 Recent Performance:');
  console.log(`   Pattern: ${pattern}`);
  console.log(`   Wins: ${wins}/${recentTrades.length} (${(winRate * 100).toFixed(1)}%)`);
  console.log(`   Stop Losses: ${stopLosses}`);
  console.log('');

  // RULE 1: After 2+ consecutive stop losses → TIGHTEN
  if (pattern.startsWith('LL') && currentPresetIdx < PRESETS.length - 1) {
    return {
      newParams: PRESETS[currentPresetIdx + 1],
      reason: `2+ consecutive stop losses → tightening parameters (preset ${currentPresetIdx} → ${currentPresetIdx + 1})`,
    };
  }

  // RULE 2: Win rate < 50% → TIGHTEN
  if (winRate < 0.5 && currentPresetIdx < PRESETS.length - 1) {
    return {
      newParams: PRESETS[currentPresetIdx + 1],
      reason: `Low win rate (${(winRate * 100).toFixed(1)}%) → tightening parameters`,
    };
  }

  // RULE 3: After 3+ consecutive wins → RELAX (capture more opportunities)
  if (pattern.startsWith('WWW') && currentPresetIdx > 0) {
    return {
      newParams: PRESETS[currentPresetIdx - 1],
      reason: `3+ consecutive wins → relaxing parameters to capture more opportunities`,
    };
  }

  // RULE 4: Win rate > 70% → RELAX
  if (winRate > 0.7 && currentPresetIdx > 0) {
    return {
      newParams: PRESETS[currentPresetIdx - 1],
      reason: `High win rate (${(winRate * 100).toFixed(1)}%) → relaxing parameters`,
    };
  }

  // RULE 5: No change needed
  return {
    newParams: currentParams,
    reason: `Parameters working (${(winRate * 100).toFixed(1)}% WR) → keeping current config`,
  };
}

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

function readCurrentConfig(): ParameterSet {
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const whaleHunter = config.whaleHunter || {};
  const detector = whaleHunter.detector?.modes || {};

  return {
    minConfidence: whaleHunter.minConfidence || 75,
    minWallSize: detector.wallBreak?.minWallSize || 12,
    minWallDuration: (detector.wallDisappearance?.minWallDuration || 90000) / 1000, // Convert ms to seconds
  };
}

function updateConfig(newParams: ParameterSet): void {
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Update whaleHunter
  config.whaleHunter.minConfidence = newParams.minConfidence;
  config.whaleHunter.detector.modes.wallBreak.minWallSize = newParams.minWallSize;
  config.whaleHunter.detector.modes.wallDisappearance.minWallSize = newParams.minWallSize + 4; // 4% higher for disappearance
  config.whaleHunter.detector.modes.wallDisappearance.minWallDuration = newParams.minWallDuration * 1000; // Convert seconds to ms

  // Update whaleHunterFollow (same params)
  config.whaleHunterFollow.minConfidence = newParams.minConfidence;
  config.whaleHunterFollow.detector.modes.wallBreak.minWallSize = newParams.minWallSize;
  config.whaleHunterFollow.detector.modes.wallDisappearance.minWallSize = newParams.minWallSize + 4;
  config.whaleHunterFollow.detector.modes.wallDisappearance.minWallDuration = newParams.minWallDuration * 1000;

  // Write back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function saveCalibrationHistory(entry: CalibrationHistory): void {
  const historyPath = path.join(__dirname, '../data/calibration-history.json');

  let history: CalibrationHistory[] = [];
  if (fs.existsSync(historyPath)) {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }

  history.push(entry);

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 ADAPTIVE PARAMETER CALIBRATOR (Whale Hunter)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Load all journal files
  const dataDir = path.join(__dirname, '../data');
  const journalFiles = fs
    .readdirSync(dataDir)
    .filter((f) => f.includes('journal') && f.endsWith('.json') && !f.includes('calibration'))
    .map((f) => path.join(dataDir, f));

  if (journalFiles.length === 0) {
    console.error('❌ No journal files found');
    process.exit(1);
  }

  // Load and merge trades
  let allTrades: JournalTrade[] = [];
  journalFiles.forEach((file) => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) {
        allTrades = allTrades.concat(data);
      }
    } catch (err) {
      // Ignore
    }
  });

  // Remove duplicates
  const uniqueTrades = new Map<string, JournalTrade>();
  allTrades.forEach((t) => uniqueTrades.set(t.id, t));
  allTrades = Array.from(uniqueTrades.values());

  // Get recent whale trades
  const recentWhaleTrades = getRecentWhaleTrades(allTrades, 10);

  console.log(`📖 Loaded ${allTrades.length} total trades`);
  console.log(`🐋 Found ${recentWhaleTrades.length} recent Whale Hunter trades`);
  console.log('');

  // Read current config
  const currentParams = readCurrentConfig();

  console.log('📝 Current Parameters:');
  console.log(`   minConfidence: ${currentParams.minConfidence}%`);
  console.log(`   minWallSize: ${currentParams.minWallSize}%`);
  console.log(`   minWallDuration: ${currentParams.minWallDuration}s`);
  console.log('');

  // Calibrate
  const { newParams, reason } = calibrateParameters(recentWhaleTrades, currentParams);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 CALIBRATION RESULT:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Reason: ${reason}`);
  console.log('');

  // Check if params changed
  const paramsChanged =
    newParams.minConfidence !== currentParams.minConfidence ||
    newParams.minWallSize !== currentParams.minWallSize ||
    newParams.minWallDuration !== currentParams.minWallDuration;

  if (paramsChanged) {
    console.log('🔧 NEW Parameters:');
    console.log(`   minConfidence: ${currentParams.minConfidence}% → ${newParams.minConfidence}%`);
    console.log(`   minWallSize: ${currentParams.minWallSize}% → ${newParams.minWallSize}%`);
    console.log(`   minWallDuration: ${currentParams.minWallDuration}s → ${newParams.minWallDuration}s`);
    console.log('');

    // Save calibration history
    const pattern = analyzePattern(recentWhaleTrades);
    saveCalibrationHistory({
      timestamp: new Date().toISOString(),
      reason,
      previousParams: currentParams,
      newParams,
      recentResults: pattern,
    });

    console.log('💾 Calibration history saved to data/calibration-history.json');
    console.log('');

    // Ask user to apply
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️  MANUAL ACTION REQUIRED:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('To apply new parameters:');
    console.log('1. Review the changes above');
    console.log('2. Update config.json manually OR run: npm run calibrate:apply');
    console.log('3. Restart the bot');
    console.log('');
    console.log('Or to apply automatically, uncomment updateConfig() call in calibrator code.');
    console.log('');

    // Auto-apply (commented out for safety)
    // updateConfig(newParams);
    // console.log('✅ Config updated automatically!');
  } else {
    console.log('✅ No parameter changes needed - current config is performing well');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Calibration complete!');
  console.log('═══════════════════════════════════════════════════════════');
}

// Run
main();
