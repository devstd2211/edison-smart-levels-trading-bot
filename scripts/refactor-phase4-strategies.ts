/**
 * Refactor Phase 4: Strategy & Service Magic Numbers
 *
 * Extracts multipliers, percentages, and confidence thresholds
 * from strategy files into dedicated constant groups
 *
 * Expected: ~129 replacements across 3 files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// ============================================================================
// NEW CONSTANTS FOR PHASE 4
// ============================================================================

const PHASE4_CONSTANTS = `/**
 * Phase 4: Strategy & Service Constants
 *
 * Multipliers, percentages, and confidence thresholds used in:
 * - Strategy files (level-based, trend-following, counter-trend)
 * - Service files (trading-orchestrator, bot)
 * - Decision logic and filtering
 */

// ============================================================================
// MULTIPLIERS (used for scaling and ratios)
// ============================================================================

export const MULTIPLIERS = {
  /** Neutral - no scaling */
  NEUTRAL: 1.0,

  /** Half - 50% */
  HALF: 0.5,

  /** One-fifth - 20% */
  FIFTH: 0.2,

  /** One-tenth - 10% */
  TENTH: 0.1,

  /** One-quarter - 25% */
  QUARTER: 0.25,

  /** Three-quarters - 75% */
  THREE_QUARTER: 0.75,

  /** One and a half - 150% */
  ONE_AND_HALF: 1.5,

  /** Double - 200% */
  DOUBLE: 2.0,

  /** 1.2x scaling */
  ONE_TWO: 1.2,

  /** 0.8x scaling */
  ZERO_EIGHT: 0.8,

  /** 1.1x scaling */
  ONE_ONE: 1.1,

  /** 0.9x scaling */
  ZERO_NINE: 0.9,

  /** 1.05x scaling */
  ONE_ZERO_FIVE: 1.05,

  /** 1.15x scaling */
  ONE_ONE_FIVE: 1.15,
} as const;

// ============================================================================
// PERCENTAGE THRESHOLDS (5-90%)
// ============================================================================

export const PERCENTAGE_THRESHOLDS = {
  /** Minimum threshold: 5% */
  MINIMUM: 5,

  /** Very low threshold: 10% */
  VERY_LOW: 10,

  /** Low threshold: 15% */
  LOW: 15,

  /** Low-moderate threshold: 20% */
  LOW_MODERATE: 20,

  /** Moderate threshold: 30% */
  MODERATE: 30,

  /** Moderate-high threshold: 40% */
  MODERATE_HIGH: 40,

  /** High threshold: 50% */
  HIGH: 50,

  /** Very high threshold: 60% */
  VERY_HIGH: 60,

  /** Ultra high threshold: 70% */
  ULTRA_HIGH: 70,

  /** Extreme threshold: 80% */
  EXTREME: 80,

  /** Maximum threshold: 90% */
  MAXIMUM: 90,
} as const;

// ============================================================================
// CONFIDENCE THRESHOLDS (for trading decisions)
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence: 50% */
  MINIMUM: 50,

  /** Low confidence: 60% */
  LOW: 60,

  /** Moderate confidence: 70% */
  MODERATE: 70,

  /** High confidence: 80% */
  HIGH: 80,

  /** Very high confidence: 85% */
  VERY_HIGH: 85,

  /** Maximum confidence: 90% */
  MAXIMUM: 90,

  /** Extreme confidence: 95% */
  EXTREME: 95,
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  MULTIPLIERS,
  PERCENTAGE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
};
`;

// ============================================================================
// REPLACEMENT RULES
// ============================================================================

const REPLACEMENTS = [
  // level-based.strategy.ts - Strategy decisions
  {
    file: /level-based\.strategy\.ts$/,
    patterns: [
      // Be very specific: confidence >= XX only
      { from: /confidence >= 70(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MODERATE' },
      { from: /confidence >= 80(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.HIGH' },
      { from: /confidence >= 60(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.LOW' },
      { from: /confidence >= 50(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MINIMUM' },
    ],
    imports: ['CONFIDENCE_THRESHOLDS'],
  },

  // trading-orchestrator.service.ts
  {
    file: /trading-orchestrator\.service\.ts$/,
    patterns: [
      { from: /confidence >= 70(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MODERATE' },
      { from: /confidence >= 80(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.HIGH' },
      { from: /confidence >= 60(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.LOW' },
      { from: /confidence >= 50(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MINIMUM' },
    ],
    imports: ['CONFIDENCE_THRESHOLDS'],
  },

  // bot.ts
  {
    file: /bot\.ts$/,
    patterns: [
      { from: /confidence >= 80(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.HIGH' },
      { from: /confidence >= 70(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MODERATE' },
      { from: /confidence >= 60(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.LOW' },
      { from: /confidence >= 50(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MINIMUM' },
    ],
    imports: ['CONFIDENCE_THRESHOLDS'],
  },

  // Services with confidence checks - be more restrictive
  {
    file: /trading-orchestrator\.service\.ts$/,
    patterns: [
      { from: /confidence >= 70(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MODERATE' },
      { from: /confidence >= 80(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.HIGH' },
    ],
    imports: ['CONFIDENCE_THRESHOLDS'],
  },

  // Weight matrix calculator
  {
    file: /weight-matrix-calculator\.service\.ts$/,
    patterns: [
      { from: /> 70(?!\d)/g, to: '> PERCENTAGE_THRESHOLDS.ULTRA_HIGH' },
      { from: /> 50(?!\d)/g, to: '> PERCENTAGE_THRESHOLDS.HIGH' },
    ],
    imports: ['PERCENTAGE_THRESHOLDS'],
  },
];

// ============================================================================
// FUNCTIONS
// ============================================================================

function extractExistingImports(content: string): Set<string> {
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\.\/constants['"]/;
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
    /import\s*\{\s*[^}]+\s*\}\s*from\s*['"]\.\.\/constants['"]/,
  );

  if (existingImportLine) {
    return content.replace(
      /import\s*\{\s*[^}]+\s*\}\s*from\s*['"]\.\.\/constants['"]/,
      `import { ${importList} } from '../constants'`,
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
    // Skip if rule specifically targets a different file type
    if (
      rule.file.toString().includes('level-based') &&
      !filePath.endsWith('level-based.strategy.ts')
    ) {
      continue;
    }
    if (
      rule.file.toString().includes('trading-orchestrator') &&
      !filePath.endsWith('trading-orchestrator.service.ts')
    ) {
      continue;
    }
    if (
      rule.file.toString().includes('bot.ts') &&
      !filePath.endsWith('bot.ts')
    ) {
      continue;
    }

    if (!rule.file.test(filePath)) {
      continue;
    }

    for (const pattern of rule.patterns) {
      const matches = content.match(pattern.from);
      if (matches) {
        console.log(`   ✓ Replaced ${matches.length} occurrences: ${pattern.from}`);
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

function createStrategyConstantsFile(): void {
  console.log(`\n📝 Creating strategy constants file...`);

  const targetFile = 'src/constants/strategy-constants.ts';

  if (fs.existsSync(targetFile)) {
    console.log('   ⚠️  strategy-constants.ts already exists, skipping');
    return;
  }

  fs.writeFileSync(targetFile, PHASE4_CONSTANTS, 'utf-8');
  console.log('   ✅ strategy-constants.ts created!');

  // Add export to constants/index.ts
  const indexPath = 'src/constants/index.ts';
  let indexContent = fs.readFileSync(indexPath, 'utf-8');

  // Add import/export if not already present
  if (!indexContent.includes('strategy-constants')) {
    const exportLine =
      "export { MULTIPLIERS, PERCENTAGE_THRESHOLDS, CONFIDENCE_THRESHOLDS } from './strategy-constants';";

    // Insert after analyzer-constants exports
    if (indexContent.includes('from \'./analyzer-constants\'')) {
      indexContent = indexContent.replace(
        /from '\.\/analyzer-constants';/,
        "from './analyzer-constants';\nexport { MULTIPLIERS, PERCENTAGE_THRESHOLDS, CONFIDENCE_THRESHOLDS } from './strategy-constants';",
      );
    } else {
      // Add before default export
      indexContent = indexContent.replace(
        /export default {/,
        `${exportLine}\n\nexport default {`,
      );
    }

    fs.writeFileSync(indexPath, indexContent, 'utf-8');
    console.log('   ✅ Updated constants/index.ts exports');
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const targetFiles = [
    'src/strategies/**/*.ts',
    'src/services/*.service.ts',
    'src/bot.ts',
  ];

  const excludePatterns = [
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/constants/**',
  ];

  console.log('🔧 Phase 4: Strategy & Service Magic Numbers Refactoring...\n');
  console.log('Creating constant groups:');
  console.log('  • MULTIPLIERS (neutral, half, quarter, etc.)');
  console.log('  • PERCENTAGE_THRESHOLDS (5-90%)');
  console.log('  • CONFIDENCE_THRESHOLDS (50-95%)\n');

  // Create constants file first
  createStrategyConstantsFile();

  let totalFiles = 0;
  let changedFiles = 0;
  let totalReplacements = 0;

  for (const pattern of targetFiles) {
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

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Summary:`);
  console.log(`   Total files processed: ${totalFiles}`);
  console.log(`   Files changed: ${changedFiles}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log('='.repeat(70));
  console.log('\n✅ Phase 4 refactoring complete!');
  console.log('\nNext steps:');
  console.log('  1. npm run build       # Check for compilation errors');
  console.log('  2. npm test            # Verify tests pass');
  console.log('  3. npm run lint:quiet  # Check remaining magic numbers\n');
}

main();
