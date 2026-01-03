/**
 * FINAL PUSH: Targeted Magic Number Replacements
 *
 * Replaces actual magic numbers found in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const PATTERNS = [
  // ============ OBJECT/ARRAY ASSIGNMENTS ============
  { from: /: 0\.7(?![0-9])/g, to: ': CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /: 0\.75(?![0-9])/g, to: ': MULTIPLIERS.THREE_QUARTER', constant: 'MULTIPLIERS' },
  { from: /: 0\.8(?![0-9])/g, to: ': MULTIPLIERS.ZERO_EIGHT', constant: 'MULTIPLIERS' },
  { from: /: 0\.9(?![0-9])/g, to: ': MULTIPLIERS.ZERO_NINE', constant: 'MULTIPLIERS' },
  { from: /: 1\.0(?![0-9])/g, to: ': MULTIPLIERS.NEUTRAL', constant: 'MULTIPLIERS' },
  { from: /: 1\.5(?![0-9])/g, to: ': MULTIPLIERS.ONE_AND_HALF', constant: 'MULTIPLIERS' },
  { from: /: 0\.5(?![0-9])/g, to: ': MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },
  { from: /: 0\.25(?![0-9])/g, to: ': MULTIPLIERS.QUARTER', constant: 'MULTIPLIERS' },
  { from: /: 0\.3(?![0-9])/g, to: ': PERCENTAGE_THRESHOLDS.MODERATE', constant: 'PERCENTAGE_THRESHOLDS' },
  { from: /: 0\.4(?![0-9])/g, to: ': PERCENTAGE_THRESHOLDS.MODERATE_HIGH', constant: 'PERCENTAGE_THRESHOLDS' },
  { from: /: 0\.15(?![0-9])/g, to: ': PERCENTAGE_THRESHOLDS.VERY_LOW', constant: 'PERCENTAGE_THRESHOLDS' },
  { from: /: 0\.65(?![0-9])/g, to: ': CONFIDENCE_THRESHOLDS.LOW', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /: 0\.6(?![0-9])/g, to: ': CONFIDENCE_THRESHOLDS.LOW', constant: 'CONFIDENCE_THRESHOLDS' },

  // ============ TERNARY OPERATORS ============
  { from: /\? 1\.0 :/g, to: '? MULTIPLIERS.NEUTRAL :', constant: 'MULTIPLIERS' },
  { from: /\? 0\.0 :/g, to: '? MATH_OPS.ZERO :', constant: 'MATH_OPS' },

  // ============ NULL COALESCE ============
  { from: /\?\? 0\.65/g, to: '?? CONFIDENCE_THRESHOLDS.LOW', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /\?\? 0\.7/g, to: '?? CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /\?\? 0\.5/g, to: '?? MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },

  // ============ CONST/LET ASSIGNMENTS ============
  { from: /const (\w+) = 0\.7(?![0-9])/g, to: 'const $1 = CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /let (\w+) = 0\.7(?![0-9])/g, to: 'let $1 = CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /= 0\.7(?![0-9])/g, to: '= CONFIDENCE_THRESHOLDS.MODERATE', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /= 0\.8(?![0-9])/g, to: '= MULTIPLIERS.ZERO_EIGHT', constant: 'MULTIPLIERS' },
  { from: /= 0\.6(?![0-9])/g, to: '= CONFIDENCE_THRESHOLDS.LOW', constant: 'CONFIDENCE_THRESHOLDS' },
  { from: /= 0\.5(?![0-9])/g, to: '= MULTIPLIERS.HALF', constant: 'MULTIPLIERS' },
  { from: /= 1\.0(?![0-9])/g, to: '= MULTIPLIERS.NEUTRAL', constant: 'MULTIPLIERS' },
];

function addImports(content: string, neededImports: Set<string>): string {
  if (neededImports.size === 0) return content;

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
  }

  const lines = content.split('\n');
  let insertIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].startsWith('import ')) insertIndex = i + 1;
  }
  lines.splice(insertIndex, 0, `import { ${importList} } from '../constants';`);
  return lines.join('\n');
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
  console.log('🔥 FINAL PUSH: Aggressive Targeted Replacements!\n');

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
  console.log(`📊 RESULTS: ${changedFiles} files, ${totalReplacements} replacements`);
  console.log('='.repeat(70) + '\n');
}

main();
