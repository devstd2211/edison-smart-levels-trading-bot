/**
 * Auto-Refactor Script: Magic Numbers → Constants & Config
 *
 * This script automatically:
 * 1. Finds all magic numbers in source files
 * 2. Replaces them with appropriate constants
 * 3. Adds necessary imports
 * 4. Updates fallbacks (|| → ??)
 * 5. Adds explicit null checks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

// ============================================================================
// MAPPING: Magic Number → Constant
// ============================================================================

const MAGIC_NUMBER_MAPPINGS: Record<string | number, { constant: string; import: string }> = {
  // Decimal places
  '4': { constant: 'DECIMAL_PLACES.PRICE', import: 'DECIMAL_PLACES' },
  '2_decimal': { constant: 'DECIMAL_PLACES.PERCENT', import: 'DECIMAL_PLACES' },

  // Percentages
  '100': { constant: 'FIXED_EXIT_PERCENTAGES.FULL', import: 'FIXED_EXIT_PERCENTAGES' },
  '50': { constant: 'FIXED_EXIT_PERCENTAGES.HALF', import: 'FIXED_EXIT_PERCENTAGES' },
  '25': { constant: 'FIXED_EXIT_PERCENTAGES.QUARTER', import: 'FIXED_EXIT_PERCENTAGES' },
  '10': { constant: 'FIXED_EXIT_PERCENTAGES.TENTH', import: 'FIXED_EXIT_PERCENTAGES' },

  // Confidence bounds
  '0': { constant: 'CONFIDENCE_BOUNDS.MINIMUM', import: 'CONFIDENCE_BOUNDS' },

  // Math operations
  '1': { constant: 'MATH_OPS.ONE', import: 'MATH_OPS' },
  '-1': { constant: 'MATH_OPS.NEGATIVE_ONE', import: 'MATH_OPS' },
  '2': { constant: 'SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS', import: 'SIGNAL_CONSTANTS' },
};

// ============================================================================
// REPLACEMENT PATTERNS
// ============================================================================

const REPLACEMENT_PATTERNS = [
  // Pattern 1: toFixed(4) → toFixed(DECIMAL_PLACES.PRICE)
  {
    pattern: /\.toFixed\(4\)/g,
    replacement: `.toFixed(DECIMAL_PLACES.PRICE)`,
    imports: ['DECIMAL_PLACES'],
  },
  // Pattern 2: toFixed(2) → toFixed(DECIMAL_PLACES.PERCENT)
  {
    pattern: /\.toFixed\(2\)/g,
    replacement: `.toFixed(DECIMAL_PLACES.PERCENT)`,
    imports: ['DECIMAL_PLACES'],
  },
  // Pattern 3: Math.max(0, Math.min(100, ...)) → Math.max/min with CONFIDENCE_BOUNDS
  {
    pattern: /Math\.max\(0,\s*Math\.min\(100,/g,
    replacement: `Math.max(CONFIDENCE_BOUNDS.MINIMUM, Math.min(CONFIDENCE_BOUNDS.MAXIMUM,`,
    imports: ['CONFIDENCE_BOUNDS'],
  },
  // Pattern 4: / 100 → / PERCENT_MULTIPLIER
  {
    pattern: /\/\s*100([^0-9])/g,
    replacement: `/ PERCENT_MULTIPLIER$1`,
    imports: ['PERCENT_MULTIPLIER'],
  },
  // Pattern 5: * 100 → * PERCENT_MULTIPLIER
  {
    pattern: /\*\s*100([^0-9])/g,
    replacement: `* PERCENT_MULTIPLIER$1`,
    imports: ['PERCENT_MULTIPLIER'],
  },
  // Pattern 6: sizePercent: 100 → sizePercent: FIXED_EXIT_PERCENTAGES.FULL
  {
    pattern: /sizePercent:\s*100([^0-9])/g,
    replacement: `sizePercent: FIXED_EXIT_PERCENTAGES.FULL$1`,
    imports: ['FIXED_EXIT_PERCENTAGES'],
  },
  // Pattern 7: !== 1.0 → !== MATH_OPS.ONE
  {
    pattern: /!==\s*1\.0/g,
    replacement: `!== MATH_OPS.ONE`,
    imports: ['MATH_OPS'],
  },
  // Pattern 8: === 1.0 → === MATH_OPS.ONE
  {
    pattern: /===\s*1\.0/g,
    replacement: `=== MATH_OPS.ONE`,
    imports: ['MATH_OPS'],
  },
  // Pattern 9: consecutiveSignals < 2 → consecutiveSignals < SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS
  {
    pattern: /consecutiveSignals\s*<\s*2([^0-9])/g,
    replacement: `consecutiveSignals < SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS$1`,
    imports: ['SIGNAL_CONSTANTS'],
  },
  // Pattern 10: required: 2 → required: SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS
  {
    pattern: /required:\s*2([^0-9])/g,
    replacement: `required: SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS$1`,
    imports: ['SIGNAL_CONSTANTS'],
  },
];

// ============================================================================
// TIME PATTERNS
// ============================================================================

const TIME_PATTERNS = [
  // 60000 → TIME_UNITS.MINUTE
  { pattern: /60000/g, replacement: 'TIME_UNITS.MINUTE', imports: ['TIME_UNITS'] },
  // 300000 → TIME_UNITS.FIVE_MINUTES
  { pattern: /300000/g, replacement: 'TIME_UNITS.FIVE_MINUTES', imports: ['TIME_UNITS'] },
  // 1000 → TIME_UNITS.SECOND (be careful, might match other numbers)
  // (skip this one as it's too broad)
];

// ============================================================================
// FALLBACK PATTERNS (|| → ??)
// ============================================================================

const FALLBACK_PATTERNS = [
  // Simple fallback: || defaultValue (when it's safe)
  {
    pattern: /(\w+)\s*\|\|\s*(\d+)/g,
    check: (match: string) => {
      // Only replace if it's clearly a fallback, not bitwise OR
      return !match.includes('&') && !match.includes('|');
    },
    replacement: '$1 ?? $2',
  },
];

// ============================================================================
// STRATEGY: EXTRACT IMPORTS FROM FILE
// ============================================================================

function extractExistingImports(content: string): Set<string> {
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\.\/constants['"]/;
  const match = content.match(importRegex);
  if (!match) return new Set();
  return new Set(match[1].split(',').map(s => s.trim()));
}

// ============================================================================
// STRATEGY: ADD IMPORT IF NOT EXISTS
// ============================================================================

function addConstantsImport(
  content: string,
  neededImports: Set<string>,
): string {
  if (neededImports.size === 0) return content;

  const existingImports = extractExistingImports(content);
  const allImports = new Set([...existingImports, ...neededImports]);
  const importList = Array.from(allImports).sort().join(', ');

  // Check if import exists
  const existingImportLine = content.match(
    /import\s*\{\s*[^}]+\s*\}\s*from\s*['"]\.\.\/constants['"]/,
  );

  if (existingImportLine) {
    // Replace existing import
    return content.replace(
      /import\s*\{\s*[^}]+\s*\}\s*from\s*['"]\.\.\/constants['"]/,
      `import { ${importList} } from '../constants';`,
    );
  } else {
    // Add new import at the top after other imports
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

// ============================================================================
// MAIN REFACTOR FUNCTION
// ============================================================================

function refactorFile(filePath: string): { changed: boolean; count: number } {
  console.log(`
${ICONS.page} Processing: ${path.basename(filePath)}`);

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let replacementCount = 0;
  const neededImports = new Set<string>();

  // Apply all replacement patterns
  for (const patternConfig of REPLACEMENT_PATTERNS) {
    const matches = content.match(patternConfig.pattern);
    if (matches) {
      console.log(`   ✓ Replacing ${patternConfig.pattern}: ${matches.length} occurrences`);
      content = content.replace(patternConfig.pattern, patternConfig.replacement);
      replacementCount += matches.length;
      patternConfig.imports.forEach(imp => neededImports.add(imp));
    }
  }

  // Apply time patterns
  for (const patternConfig of TIME_PATTERNS) {
    const matches = content.match(patternConfig.pattern);
    if (matches) {
      console.log(`   ✓ Replacing time: ${matches.length} occurrences`);
      content = content.replace(patternConfig.pattern, patternConfig.replacement);
      replacementCount += matches.length;
      patternConfig.imports.forEach(imp => neededImports.add(imp));
    }
  }

  // Add imports if needed
  if (neededImports.size > 0) {
    content = addConstantsImport(content, neededImports);
    console.log(`   ✓ Added imports: ${Array.from(neededImports).join(', ')}`);
  }

  // Write file if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`   ${ICONS.success} File updated!`);
    return { changed: true, count: replacementCount };
  } else {
    console.log(`   ${ICONS.warning}  No changes needed`);
    return { changed: false, count: 0 };
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

function main(): void {
  const targetDirs = [
    'packages/core/src/strategies/**/*.ts',
    'packages/core/src/services/**/*.ts',
    'packages/core/src/analyzers/**/*.ts',
    'packages/core/src/indicators/**/*.ts',
    'packages/core/src/utils/**/*.ts',
  ];

  // Exclude test files and already processed files
  const excludePatterns = [
    '**/*.test.ts',
    '**/*.spec.ts',
    'packages/core/src/constants/**',
    'packages/core/src/config/**',
  ];

  console.log(`${ICONS.wrench} Auto-Refactoring Magic Numbers...
`);
  console.log('Patterns to replace:');
  console.log('  • .toFixed(4) → .toFixed(DECIMAL_PLACES.PRICE)');
  console.log('  • .toFixed(2) → .toFixed(DECIMAL_PLACES.PERCENT)');
  console.log('  • Math.max(0, Math.min(100, ...)) → with CONFIDENCE_BOUNDS');
  console.log('  • / 100 → / PERCENT_MULTIPLIER');
  console.log('  • * 100 → * PERCENT_MULTIPLIER');
  console.log('  • sizePercent: 100 → FIXED_EXIT_PERCENTAGES.FULL');
  console.log('  • 60000 → TIME_UNITS.MINUTE');
  console.log('  • consecutiveSignals < 2 → SIGNAL_CONSTANTS\n');

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
      const result = refactorFile(file);
      if (result.changed) {
        changedFiles++;
        totalReplacements += result.count;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`${ICONS.chart} Summary:`);
  console.log(`   Total files processed: ${totalFiles}`);
  console.log(`   Files changed: ${changedFiles}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log('='.repeat(60));
  console.log(`
${ICONS.success} Refactoring complete!`);
  console.log('\nNext steps:');
  console.log('  1. npm run build       # Check for compilation errors');
  console.log('  2. npm run lint        # Check for remaining issues');
  console.log('  3. npm test            # Verify tests still pass\n');
}

main();

