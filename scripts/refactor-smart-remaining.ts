/**
 * Smart Refactoring: Safe Magic Number Replacements
 *
 * Only replaces in runtime contexts, avoids type literals
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const PATTERNS = [
  // ============ SAFE: Comparisons (confidence >= 0.X) ============
  { from: /confidence >= 0\.95(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.EXTREME', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence >= 0\.9(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.EXTREME', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence >= 0\.85(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.VERY_HIGH', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence >= 0\.8(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.HIGH', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence >= 0\.7(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence >= 0\.6(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.LOW', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence >= 0\.5(?!\d)/g, to: 'confidence >= CONFIDENCE_THRESHOLDS.MINIMUM', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence > 0\.8(?!\d)/g, to: 'confidence > CONFIDENCE_THRESHOLDS.HIGH', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence > 0\.7(?!\d)/g, to: 'confidence > CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /confidence > 0\.6(?!\d)/g, to: 'confidence > CONFIDENCE_THRESHOLDS.LOW', constant: 'CONFIDENCE_THRESHOLDS' },

  // ============ SAFE: Less than comparisons ============
  { from: /value < 0\.5(?!\d)/g, to: 'value < MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },
  { from: /\) < 0\.5(?!\d)/g, to: ') < MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },

  // ============ SAFE: Array/Object patterns ============
  { from: /sizePercent: 0\.5(?!\d)/g, to: 'sizePercent: MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },
  { from: /sizePercent: 0\.75(?!\d)/g, to: 'sizePercent: MULTIPLIERS.THREE_QUARTER', constant: 'MULTIPLIERS' },
  { from: /sizePercent: 0\.25(?!\d)/g, to: 'sizePercent: MULTIPLIERS.QUARTER', constant: 'MULTIPLIERS' },

  // ============ SAFE: Arithmetic in conditions ============
  { from: /\(1\.0 -/g, to: '(MULTIPLIERS.NEUTRAL -', constant: 'MULTIPLIERS' },
  { from: /- 0\.5\)/g, to: '- MULTIPLIERS.HALF)', constant: 'MULTIPLIERS' },

  // ============ SAFE: Specific variable names ============
  { from: /const threshold = 0\.5(?!\d)/g, to: 'const threshold = MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },
  { from: /const factor = 0\.75(?!\d)/g, to: 'const factor = MULTIPLIERS.THREE_QUARTER', constant: 'MULTIPLIERS' },
  { from: /const ratio = 0\.5(?!\d)/g, to: 'const ratio = MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },
  { from: /const multiplier = 1\.5(?!\d)/g, to: 'const multiplier = MULTIPLIERS.ONE_AND_HALF', constant: 'MULTIPLIERS' },
];

function addImports(content: string, neededImports: Set<string>): string {
  if (neededImports.size === 0) {
    return content;
  }

  const importList = Array.from(neededImports).sort().join(', ');
  const existingImport = content.match(/import\s*{([^}]*)}\s*from\s*['"]\.\.\/constants['"]/);

  if (existingImport) {
    const existing = new Set(
      existingImport[1].split(',').map(s => s.trim()).filter(s => s),
    );
    neededImports.forEach(imp => existing.add(imp));
    const newList = Array.from(existing).sort().join(', ');
    return content.replace(
      /import\s*{[^}]*}\s*from\s*['"]\.\.\/constants['"]/,
      `import { ${newList} } from '../constants'`,
    );
  } else {
    const lines = content.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i + 1;
      }
    }
    lines.splice(insertIndex, 0, `import { ${importList} } from '../constants';`);
    return lines.join('\n');
  }
}

function processFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let count = 0;
  const imports = new Set<string>();

  for (const rule of PATTERNS) {
    const matches = content.match(rule.from);
    if (matches) {
      content = content.replace(rule.from, rule.to);
      count += matches.length;
      imports.add(rule.constant);
    }
  }

  if (count > 0) {
    content = addImports(content, imports);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${path.basename(filePath)}: ${count} replacements`);
  }

  return count;
}

function main(): void {
  console.log('🧠 SMART REFACTORING: Safe Magic Number Replacements\n');

  const files = glob.sync('src/**/*.ts', {
    ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/constants/**'],
  });

  let totalReplacements = 0;
  let changedFiles = 0;

  for (const file of files) {
    const count = processFile(file);
    if (count > 0) {
      changedFiles++;
      totalReplacements += count;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Results: ${changedFiles} files changed, ${totalReplacements} replacements`);
  console.log('='.repeat(70) + '\n');
}

main();
