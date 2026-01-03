/**
 * Refactor Remaining Magic Numbers - Phase 3
 *
 * Phase 3: Context-specific analyzer constants and configuration thresholds
 * Handles thresholds, periods, ratios that are business logic specific
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// ============================================================================
// REPLACEMENT RULES BY FILE PATTERN
// ============================================================================

const REPLACEMENTS = [
  // BTC Analyzer - Price change thresholds and momentum calculations
  {
    file: /btc\.analyzer\.ts$/,
    patterns: [
      { from: /const threshold = 0\.1/, to: 'const threshold = BTC_ANALYZER_CONSTANTS.NEUTRAL_THRESHOLD' },
      { from: /const reducedThreshold = this\.config\.minimumMomentum \* 0\.7/, to: 'const reducedThreshold = this.config.minimumMomentum * BTC_ANALYZER_CONSTANTS.MOMENTUM_REDUCTION_FACTOR' },
      { from: /const period = this\.config\.correlationPeriod \|\| 50/, to: 'const period = this.config.correlationPeriod ?? BTC_ANALYZER_CONSTANTS.DEFAULT_CORRELATION_PERIOD' },
      { from: /toFixed\(3\)/g, to: 'toFixed(DECIMAL_PLACES.PERCENT)' },
    ],
    imports: ['BTC_ANALYZER_CONSTANTS', 'DECIMAL_PLACES'],
  },

  // Chart Patterns Detector - Touch counts and formation patterns
  {
    file: /chart-patterns\.detector\.ts$/,
    patterns: [
      { from: /touches\.length >= 2/g, to: 'touches.length >= CHART_PATTERN_CONSTANTS.MIN_TOUCHES' },
      { from: /touches\.length >= 3/g, to: 'touches.length >= CHART_PATTERN_CONSTANTS.MIN_TOUCHES_STRONG' },
    ],
    imports: ['CHART_PATTERN_CONSTANTS'],
  },

  // Breakout Predictor - Threshold percentages and multipliers
  {
    file: /breakout-predictor\.ts$/,
    patterns: [
      { from: /0\.3([^0-9.])/g, to: 'BREAKOUT_CONSTANTS.TP_SCALP$1' },
      { from: /0\.5([^0-9.])/g, to: 'BREAKOUT_CONSTANTS.TP_MODERATE$1' },
      { from: /1\.5([^0-9.])/g, to: 'BREAKOUT_CONSTANTS.SL_MULTIPLIER$1' },
    ],
    imports: ['BREAKOUT_CONSTANTS'],
  },

  // Context Analyzer - Session times and analysis windows
  {
    file: /context\.analyzer\.ts$/,
    patterns: [
      { from: /currentHour >= 13 && currentHour < 21/g, to: 'currentHour >= CONTEXT_ANALYZER_CONSTANTS.LONDON_START && currentHour < CONTEXT_ANALYZER_CONSTANTS.NEWYORK_END' },
      { from: /Math\.max\(\.\.\.moves\)/g, to: 'Math.max(...moves)' }, // Keep as is, not magic
    ],
    imports: ['CONTEXT_ANALYZER_CONSTANTS'],
  },

  // Correlation Calculator - Coefficient thresholds
  {
    file: /correlation\.calculator\.ts$/,
    patterns: [
      { from: /return 0\.3/g, to: 'return CORRELATION_CONSTANTS.STRENGTH_WEAK' },
      { from: /return 0\.6/g, to: 'return CORRELATION_CONSTANTS.STRENGTH_MODERATE' },
      { from: /return 0\.8/g, to: 'return CORRELATION_CONSTANTS.STRENGTH_STRONG' },
    ],
    imports: ['CORRELATION_CONSTANTS'],
  },
];

// ============================================================================
// NEW ANALYZER CONSTANTS
// ============================================================================

const NEW_CONSTANTS_FILE = `src/constants/analyzer-constants.ts`;

const NEW_CONSTANTS_CONTENT = `/**
 * Analyzer-Specific Constants
 *
 * Technical thresholds, periods, and multipliers for each analyzer.
 * These are fixed values that define the behavior of analyzers.
 *
 * RULE: Don't add configurable parameters here!
 * Use config.json for business-level configuration:
 * - RSI periods, thresholds, confidence levels
 * - Strategy entry/exit parameters
 * - Risk management multipliers
 *
 * Only add here if it's a TECHNICAL constant that won't change:
 * - Default analysis periods
 * - Standard deviation multipliers
 * - Mathematical thresholds (like neutral zones)
 */

// ============================================================================
// BTC ANALYZER CONSTANTS
// ============================================================================

export const BTC_ANALYZER_CONSTANTS = {
  /** Neutral zone threshold (±0.1% price change) */
  NEUTRAL_THRESHOLD: 0.1,

  /** Momentum reduction factor for moderate correlation (70% of minimum) */
  MOMENTUM_REDUCTION_FACTOR: 0.7,

  /** Default correlation lookback period if not configured */
  DEFAULT_CORRELATION_PERIOD: 50,
} as const;

// ============================================================================
// CHART PATTERN CONSTANTS
// ============================================================================

export const CHART_PATTERN_CONSTANTS = {
  /** Minimum touches required to form a pattern */
  MIN_TOUCHES: 2,

  /** Minimum touches for strong/reliable patterns */
  MIN_TOUCHES_STRONG: 3,

  /** Maximum percentage variance in pattern (e.g., 0.5% tolerance) */
  MAX_VARIANCE_PERCENT: 0.5,

  /** Minimum pattern strength (0-1) */
  MIN_PATTERN_STRENGTH: 0.6,
} as const;

// ============================================================================
// BREAKOUT PREDICTOR CONSTANTS
// ============================================================================

export const BREAKOUT_CONSTANTS = {
  /** Scalp TP target: 0.3% */
  TP_SCALP: 0.3,

  /** Moderate TP target: 0.5% */
  TP_MODERATE: 0.5,

  /** Stop Loss multiplier for breakout */
  SL_MULTIPLIER: 1.5,

  /** Minimum volume ratio to confirm breakout */
  MIN_VOLUME_RATIO: 1.2,
} as const;

// ============================================================================
// CONTEXT ANALYZER CONSTANTS
// ============================================================================

export const CONTEXT_ANALYZER_CONSTANTS = {
  /** London session start (UTC hour) */
  LONDON_START: 13,

  /** New York session end (UTC hour) */
  NEWYORK_END: 21,

  /** Minimum context strength (0-1) */
  MIN_CONTEXT_STRENGTH: 0.5,
} as const;

// ============================================================================
// CORRELATION CONSTANTS
// ============================================================================

export const CORRELATION_CONSTANTS = {
  /** Weak correlation strength (0-0.5) */
  STRENGTH_WEAK: 0.3,

  /** Moderate correlation strength (0.5-0.7) */
  STRENGTH_MODERATE: 0.6,

  /** Strong correlation strength (0.7-1.0) */
  STRENGTH_STRONG: 0.8,

  /** Very strong correlation (0.9-1.0) */
  STRENGTH_VERY_STRONG: 0.9,
} as const;

// ============================================================================
// SUPPORT/RESISTANCE CONSTANTS
// ============================================================================

export const SUPPORT_RESISTANCE_CONSTANTS = {
  /** Minimum price distance for level validation (0.01%) */
  MIN_DISTANCE_PERCENT: 0.01,

  /** Strong level requires minimum touches */
  MIN_TOUCHES_STRONG: 3,

  /** Weak level minimum touches */
  MIN_TOUCHES_WEAK: 2,

  /** Level strength multiplier for each touch */
  STRENGTH_PER_TOUCH: 0.2,
} as const;

// ============================================================================
// VOLUME ANALYSIS CONSTANTS
// ============================================================================

export const VOLUME_ANALYSIS_CONSTANTS = {
  /** Low volume ratio (below average) */
  RATIO_LOW: 0.5,

  /** Normal volume ratio (around average) */
  RATIO_NORMAL: 1.0,

  /** High volume ratio (above average) */
  RATIO_HIGH: 1.5,

  /** Very high volume ratio (significantly above) */
  RATIO_VERY_HIGH: 2.0,
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  BTC_ANALYZER_CONSTANTS,
  CHART_PATTERN_CONSTANTS,
  BREAKOUT_CONSTANTS,
  CONTEXT_ANALYZER_CONSTANTS,
  CORRELATION_CONSTANTS,
  SUPPORT_RESISTANCE_CONSTANTS,
  VOLUME_ANALYSIS_CONSTANTS,
};
`;

// ============================================================================
// FUNCTIONS
// ============================================================================

function extractExistingImports(content: string): Set<string> {
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\.\/constants['"];/;
  const match = content.match(importRegex);
  if (!match) {
    return new Set();
  }
  return new Set(match[1].split(',').map(s => s.trim()));
}

function addConstantsImport(content: string, neededImports: string[]): string {
  if (neededImports.length === 0) {
    return content;
  }

  const importSet = new Set(neededImports);
  const existingImports = extractExistingImports(content);
  const allImports = new Set([...existingImports, ...importSet]);
  const importList = Array.from(allImports).sort().join(', ');

  const existingImportLine = content.match(
    /import\s*\{\s*[^}]+\s*\}\s*from\s*['"]\.\.\/constants['"];/,
  );

  if (existingImportLine) {
    return content.replace(
      /import\s*\{\s*[^}]+\s*\}\s*from\s*['"]\.\.\/constants['"];/,
      `import { ${importList} } from '../constants';`,
    );
  } else {
    const lines = content.split('\n');
    let insertIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i + 1;
      } else if (lines[i].startsWith('//') || lines[i].trim() === '') {
        continue;
      } else {
        break;
      }
    }

    lines.splice(insertIndex, 0, `import { ${importList} } from '../constants';`);
    return lines.join('\n');
  }
}

function processFile(filePath: string): { changed: boolean; count: number } {
  console.log(`\n📄 Processing: ${path.basename(filePath)}`);

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let replacementCount = 0;
  const neededImports = new Set<string>();

  // Find matching replacement rules
  for (const rule of REPLACEMENTS) {
    if (!rule.file.test(filePath)) {
      continue;
    }

    for (const pattern of rule.patterns) {
      const matches = content.match(pattern.from);
      if (matches) {
        console.log(`   ✓ Replaced ${matches.length} occurrences`);
        content = content.replace(pattern.from, pattern.to);
        replacementCount += matches.length;
        rule.imports.forEach(imp => neededImports.add(imp));
      }
    }
  }

  // Add imports if needed
  if (neededImports.size > 0) {
    content = addConstantsImport(content, Array.from(neededImports));
    console.log(`   ✓ Added imports: ${Array.from(neededImports).join(', ')}`);
  }

  // Write file if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`   ✅ File updated!`);
    return { changed: true, count: replacementCount };
  } else {
    console.log(`   ⚠️  No matching patterns`);
    return { changed: false, count: 0 };
  }
}

function createAnalyzerConstantsFile(): void {
  console.log(`\n📝 Creating analyzer constants file...`);

  if (fs.existsSync(NEW_CONSTANTS_FILE)) {
    console.log('   ⚠️  analyzer-constants.ts already exists, skipping');
    return;
  }

  fs.writeFileSync(NEW_CONSTANTS_FILE, NEW_CONSTANTS_CONTENT, 'utf-8');
  console.log('   ✅ analyzer-constants.ts created!');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const targetDirs = [
    'src/analyzers/**/*.ts',
    'src/indicators/**/*.ts',
  ];

  const excludePatterns = [
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/constants/**',
  ];

  console.log('🔧 Phase 3: Context-Specific Magic Numbers Refactoring...\n');
  console.log('Creating analyzer-specific constant groups:');
  console.log('  • BTC_ANALYZER_CONSTANTS');
  console.log('  • CHART_PATTERN_CONSTANTS');
  console.log('  • BREAKOUT_CONSTANTS');
  console.log('  • CONTEXT_ANALYZER_CONSTANTS');
  console.log('  • CORRELATION_CONSTANTS');
  console.log('  • SUPPORT_RESISTANCE_CONSTANTS');
  console.log('  • VOLUME_ANALYSIS_CONSTANTS\n');

  // Create analyzer constants file first
  createAnalyzerConstantsFile();

  let totalFiles = 0;
  let changedFiles = 0;
  let totalReplacements = 0;

  for (const pattern of targetDirs) {
    const files = glob.sync(pattern, {
      ignore: excludePatterns,
      cwd: process.cwd(),
    });

    for (const file of files) {
      totalFiles++;
      const result = processFile(file);
      if (result.changed) {
        changedFiles++;
        totalReplacements += result.count;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   Total files processed: ${totalFiles}`);
  console.log(`   Files changed: ${changedFiles}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log('='.repeat(60));
  console.log('\n✅ Phase 3 refactoring complete!');
  console.log('\nNext steps:');
  console.log('  1. npm run build       # Check for compilation errors');
  console.log('  2. npm run lint:quiet  # Check for remaining issues');
  console.log('  3. Commit changes      # Once validated\n');
}

main();
