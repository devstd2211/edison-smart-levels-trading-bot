/**
 * Refactor Remaining Magic Numbers
 *
 * Phase 2: Handle context-specific magic numbers that need config or custom constants
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// ============================================================================
// REMAINING MAGIC NUMBERS - Context Specific
// ============================================================================

const REPLACEMENTS = [
  // Session detector - Trading session hours (UTC)
  {
    file: /session-detector\.ts/,
    patterns: [
      { from: /currentHour\s*===\s*13/g, to: 'currentHour === TIMEZONE_OFFSETS.LONDON_START' },
      { from: /currentHour\s*===\s*8/g, to: 'currentHour === TIMEZONE_OFFSETS.TOKYO_START' },
      { from: /currentHour\s*===\s*16/g, to: 'currentHour === TIMEZONE_OFFSETS.LONDON_END' },
      { from: /currentHour\s*===\s*21/g, to: 'currentHour === TIMEZONE_OFFSETS.NEW_YORK_END' },
      { from: /currentHour\s*<\s*13/g, to: 'currentHour < TIMEZONE_OFFSETS.LONDON_START' },
      { from: /currentHour\s*>\s*13/g, to: 'currentHour > TIMEZONE_OFFSETS.LONDON_START' },
      { from: /currentHour\s*>\s*21/g, to: 'currentHour > TIMEZONE_OFFSETS.NEW_YORK_END' },
      { from: /currentHour\s*<\s*8/g, to: 'currentHour < TIMEZONE_OFFSETS.TOKYO_START' },
      { from: /1\.5/g, to: 'SESSION_SL_MULTIPLIERS.OVERLAP' },
      { from: /1\.8/g, to: 'SESSION_SL_MULTIPLIERS.OVERLAP' },
    ],
    imports: ['TIMEZONE_OFFSETS', 'SESSION_SL_MULTIPLIERS'],
  },

  // Whale hunter - Risk reward multipliers
  {
    file: /whale-hunter\.strategy\.ts/,
    patterns: [
      { from: /0\.3([^0-9.])/g, to: 'RISK_THRESHOLDS.TP_SCALP$1' },
      { from: /0\.6([^0-9.])/g, to: 'RISK_THRESHOLDS.TP_CONSERVATIVE$1' },
      { from: /1\.5([^0-9.])/g, to: 'RISK_THRESHOLDS.SL_CONSERVATIVE$1' },
      { from: /1\.2([^0-9.])/g, to: 'RISK_THRESHOLDS.SL_MODERATE$1' },
    ],
    imports: ['RISK_THRESHOLDS'],
  },

  // Confidence helper - Thresholds
  {
    file: /confidence\.helper\.ts/,
    patterns: [
      { from: /0\.5([^0-9.])/g, to: 'CONFIDENCE_WEIGHTS.MODERATE$1' },
      { from: /0\.8([^0-9.])/g, to: 'CONFIDENCE_WEIGHTS.HIGH$1' },
    ],
    imports: ['CONFIDENCE_WEIGHTS'],
  },

  // Compound interest - Percentages
  {
    file: /compound-interest\.helpers\.ts/,
    patterns: [
      { from: /\s\|\s100([^0-9.])/g, to: ' | PERCENT_MULTIPLIER$1' },
      { from: /\/100([^0-9.])/g, to: '/ PERCENT_MULTIPLIER$1' },
    ],
    imports: ['PERCENT_MULTIPLIER'],
  },

  // Timeframe validator - Minutes to milliseconds
  {
    file: /timeframe-validator\.ts/,
    patterns: [
      { from: /60\s*\*/g, to: '(TIME_UNITS.MINUTE / TIME_UNITS.SECOND) *' },
      { from: /1000([^0-9])/g, to: 'TIME_UNITS.SECOND$1' },
    ],
    imports: ['TIME_UNITS'],
  },
];

// ============================================================================
// NEW CONSTANTS FOR REMAINING MAGIC NUMBERS
// ============================================================================

const NEW_CONSTANTS = `
// ============================================================================
// SESSION-BASED SL MULTIPLIERS
// ============================================================================

export const SESSION_SL_MULTIPLIERS = {
  ASIAN: 1.0,
  LONDON: 1.5,
  NEW_YORK: 1.5,
  OVERLAP: 1.8,
} as const;

// ============================================================================
// RISK THRESHOLDS (TP/SL percentages)
// ============================================================================

export const RISK_THRESHOLDS = {
  TP_SCALP: 0.15,
  TP_AGGRESSIVE: 0.25,
  TP_STANDARD: 0.4,
  TP_CONSERVATIVE: 0.6,

  SL_TIGHT: 0.5,
  SL_STANDARD: 1.0,
  SL_MODERATE: 1.2,
  SL_CONSERVATIVE: 1.5,
} as const;

// ============================================================================
// CONFIDENCE WEIGHTS
// ============================================================================

export const CONFIDENCE_WEIGHTS = {
  LOW: 0.3,
  MODERATE: 0.5,
  HIGH: 0.8,
  VERY_HIGH: 0.9,
} as const;
`;

// ============================================================================
// FUNCTIONS
// ============================================================================

function extractExistingImports(content: string): Set<string> {
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]\.\.\/constants['"]/;
  const match = content.match(importRegex);
  if (!match) return new Set();
  return new Set(match[1].split(',').map(s => s.trim()));
}

function addConstantsImport(content: string, neededImports: string[]): string {
  if (neededImports.length === 0) return content;

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
    if (!rule.file.test(filePath)) continue;

    for (const pattern of rule.patterns) {
      const matches = content.match(pattern.from);
      if (matches) {
        console.log(`   ✓ ${pattern.from}: ${matches.length} occurrences`);
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

function updateConstants(): void {
  const constantsFile = 'src/constants/index.ts';

  console.log(`\n📝 Updating ${constantsFile}...`);

  let content = fs.readFileSync(constantsFile, 'utf-8');

  // Check if constants already exist
  if (content.includes('SESSION_SL_MULTIPLIERS')) {
    console.log('   ⚠️  Constants already exist, skipping');
    return;
  }

  // Add new constants before export default
  const exportDefaultIndex = content.lastIndexOf('export default');
  if (exportDefaultIndex === -1) {
    console.log('   ❌ Cannot find export default');
    return;
  }

  content =
    content.substring(0, exportDefaultIndex) +
    NEW_CONSTANTS +
    '\n\n' +
    content.substring(exportDefaultIndex);

  // Update export default to include new constants
  content = content.replace(
    /export default \{([\s\S]*?)\};/,
    `export default {$1
  SESSION_SL_MULTIPLIERS,
  RISK_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
};`,
  );

  fs.writeFileSync(constantsFile, content, 'utf-8');
  console.log('   ✅ Constants updated!');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const targetDirs = [
    'src/strategies/**/*.ts',
    'src/services/**/*.ts',
    'src/utils/**/*.ts',
  ];

  const excludePatterns = ['**/*.test.ts', '**/*.spec.ts', 'src/constants/**'];

  console.log('🔧 Phase 2: Refactoring Remaining Magic Numbers...\n');
  console.log('Patterns to replace:');
  console.log('  • Session hours (8, 13, 16, 21) → TIMEZONE_OFFSETS');
  console.log('  • SL multipliers (1.5, 1.8, 1.2) → SESSION_SL_MULTIPLIERS');
  console.log('  • TP percentages (0.3, 0.6) → RISK_THRESHOLDS');
  console.log('  • Confidence weights (0.5, 0.8) → CONFIDENCE_WEIGHTS');
  console.log('  • Percentages (100) → PERCENT_MULTIPLIER\n');

  // Update constants file first
  updateConstants();

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
  console.log('\n✅ Phase 2 refactoring complete!');
  console.log('\nNext steps:');
  console.log('  1. npm run build       # Check for compilation errors');
  console.log('  2. npm run lint:quiet  # Check for remaining issues\n');
}

main();
