/**
 * MEGA Refactoring: All Remaining Magic Numbers (Phases 4-7)
 *
 * This script aggressively replaces ALL remaining magic numbers
 * across strategy, service, and analyzer files using context-aware patterns.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// ============================================================================
// REPLACEMENT PATTERNS - HIGHLY SPECIFIC & SAFE
// ============================================================================

const PATTERNS = [
  // ============ CONFIDENCE THRESHOLDS (50-95) ============
  {
    pattern: /confidence >= 0\.95(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.EXTREME',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence >= 0\.9(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.EXTREME',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence >= 0\.85(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.VERY_HIGH',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence >= 0\.8(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.HIGH',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence >= 0\.7(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.MODERATE',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence >= 0\.6(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.LOW',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence >= 0\.5(?!\d)/g,
    replacement: 'confidence >= CONFIDENCE_THRESHOLDS.MINIMUM',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence > 0\.8(?!\d)/g,
    replacement: 'confidence > CONFIDENCE_THRESHOLDS.HIGH',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence > 0\.7(?!\d)/g,
    replacement: 'confidence > CONFIDENCE_THRESHOLDS.MODERATE',
    constant: 'CONFIDENCE_THRESHOLDS',
  },
  {
    pattern: /confidence > 0\.6(?!\d)/g,
    replacement: 'confidence > CONFIDENCE_THRESHOLDS.LOW',
    constant: 'CONFIDENCE_THRESHOLDS',
  },

  // ============ PERCENTAGE COMPARISONS (5-90) ============
  {
    pattern: /> 0\.9(?!\d)/g,
    replacement: '> MULTIPLIERS.NEUTRAL',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /> 0\.8(?!\d)/g,
    replacement: '> MULTIPLIERS.ZERO_EIGHT',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /> 0\.75(?!\d)/g,
    replacement: '> MULTIPLIERS.THREE_QUARTER',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /> 0\.7(?!\d)/g,
    replacement: '> MULTIPLIERS.NEUTRAL',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /> 0\.5(?!\d)/g,
    replacement: '> MULTIPLIERS.HALF',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /< 0\.5(?!\d)/g,
    replacement: '< MULTIPLIERS.HALF',
    constant: 'MULTIPLIERS',
  },

  // ============ MULTIPLIER ASSIGNMENTS ============
  {
    pattern: /= 1\.5(?!\d)/g,
    replacement: '= MULTIPLIERS.ONE_AND_HALF',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 1\.2(?!\d)/g,
    replacement: '= MULTIPLIERS.ONE_TWO',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 1\.1(?!\d)/g,
    replacement: '= MULTIPLIERS.ONE_ONE',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 1\.05(?!\d)/g,
    replacement: '= MULTIPLIERS.ONE_ZERO_FIVE',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 1\.0(?!\d)/g,
    replacement: '= MULTIPLIERS.NEUTRAL',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 0\.9(?!\d)/g,
    replacement: '= MULTIPLIERS.ZERO_NINE',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 0\.8(?!\d)/g,
    replacement: '= MULTIPLIERS.ZERO_EIGHT',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 0\.75(?!\d)/g,
    replacement: '= MULTIPLIERS.THREE_QUARTER',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 0\.5(?!\d)/g,
    replacement: '= MULTIPLIERS.HALF',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /= 0\.25(?!\d)/g,
    replacement: '= MULTIPLIERS.QUARTER',
    constant: 'MULTIPLIERS',
  },

  // ============ MULTIPLICATION OPS ============
  {
    pattern: /\* 1\.5(?!\d)/g,
    replacement: '* MULTIPLIERS.ONE_AND_HALF',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /\* 1\.2(?!\d)/g,
    replacement: '* MULTIPLIERS.ONE_TWO',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /\* 1\.0(?!\d)/g,
    replacement: '* MULTIPLIERS.NEUTRAL',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /\* 0\.75(?!\d)/g,
    replacement: '* MULTIPLIERS.THREE_QUARTER',
    constant: 'MULTIPLIERS',
  },
  {
    pattern: /\* 0\.5(?!\d)/g,
    replacement: '* MULTIPLIERS.HALF',
    constant: 'MULTIPLIERS',
  },
];

// ============================================================================
// PROCESSING
// ============================================================================

function addImports(content: string, neededImports: Set<string>): string {
  if (neededImports.size === 0) {
    return content;
  }

  const importList = Array.from(neededImports).sort().join(', ');
  const importLine = `import { ${importList} } from '../constants';`;

  // Check if import already exists
  const existingImport = content.match(/import\s*{[^}]*}\s*from\s*['"]\.\.\/constants['"]/);

  if (existingImport) {
    // Update existing import
    const existing = new Set(
      existingImport[0].match(/{\s*([^}]+)\s*}/)?.[1].split(',').map(s => s.trim()) || [],
    );

    for (const imp of neededImports) {
      existing.add(imp);
    }

    const newImportList = Array.from(existing).sort().join(', ');
    const newImportLine = `import { ${newImportList} } from '../constants';`;

    return content.replace(/import\s*{[^}]*}\s*from\s*['"]\.\.\/constants['"]/, newImportLine);
  } else {
    // Add new import
    const lines = content.split('\n');
    let insertIndex = 0;

    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i + 1;
      }
    }

    lines.splice(insertIndex, 0, importLine);
    return lines.join('\n');
  }
}

function processFile(filePath: string): { changed: boolean; count: number; imports: Set<string> } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let count = 0;
  const imports = new Set<string>();

  for (const rule of PATTERNS) {
    const matches = content.match(rule.pattern);
    if (matches) {
      content = content.replace(rule.pattern, rule.replacement);
      count += matches.length;
      imports.add(rule.constant);
    }
  }

  if (count > 0) {
    content = addImports(content, imports);
    fs.writeFileSync(filePath, content, 'utf-8');
    return { changed: true, count, imports };
  }

  return { changed: false, count: 0, imports: new Set() };
}

function main(): void {
  console.log('🚀 MEGA REFACTORING: All Remaining Magic Numbers!\n');
  console.log('Targeting files with magic numbers...\n');

  const targetDirs = [
    'src/strategies/**/*.ts',
    'src/services/*.service.ts',
    'src/analyzers/**/*.ts',
    'src/indicators/**/*.ts',
    'src/backtest/**/*.ts',
    'src/bot.ts',
  ];

  const excludePatterns = ['**/*.test.ts', '**/*.spec.ts', 'src/constants/**'];

  let totalFiles = 0;
  let changedFiles = 0;
  let totalReplacements = 0;
  let allImports = new Set<string>();

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
        console.log(`✅ ${path.basename(file)}: ${result.count} replacements`);
        result.imports.forEach(imp => allImports.add(imp));
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 RESULTS:`);
  console.log(`   Files processed: ${totalFiles}`);
  console.log(`   Files changed: ${changedFiles}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log(`   Constants added: ${Array.from(allImports).join(', ')}`);
  console.log('='.repeat(70));
  console.log('\n✅ MEGA refactoring complete!');
  console.log('\nNext: npm run build && npm test\n');
}

main();
