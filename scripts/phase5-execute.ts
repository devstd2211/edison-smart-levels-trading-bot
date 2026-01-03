/**
 * Phase 5: Aggressive Pattern Replacements for ~40-50 more errors
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const AGGRESSIVE_PATTERNS = [
  // ============ DECIMAL ASSIGNMENTS ============
  { from: /:\s*1\.0\s*[,}]/g, to: ': MULTIPLIERS.NEUTRAL,' },
  { from: /:\s*0\.5\s*[,}]/g, to: ': MULTIPLIERS.HALF,' },
  { from: /:\s*0\.75\s*[,}]/g, to: ': MULTIPLIERS.THREE_QUARTER,' },
  { from: /:\s*0\.8\s*[,}]/g, to: ': MULTIPLIERS.ZERO_EIGHT,' },
  { from: /:\s*0\.9\s*[,}]/g, to: ': MULTIPLIERS.ZERO_NINE,' },
  { from: /:\s*1\.5\s*[,}]/g, to: ': MULTIPLIERS.ONE_AND_HALF,' },
  { from: /:\s*0\.25\s*[,}]/g, to: ': MULTIPLIERS.QUARTER,' },

  // ============ PERCENTAGE VALUES ============
  { from: /:\s*0\.3\s*[,}]/g, to: ': PERCENTAGE_THRESHOLDS.MODERATE,' },
  { from: /:\s*0\.4\s*[,}]/g, to: ': PERCENTAGE_THRESHOLDS.MODERATE_HIGH,' },
  { from: /:\s*0\.15\s*[,}]/g, to: ': PERCENTAGE_THRESHOLDS.VERY_LOW,' },
  { from: /:\s*0\.2\s*[,}]/g, to: ': PERCENTAGE_THRESHOLDS.LOW_MODERATE,' },
  { from: /:\s*0\.6\s*[,}]/g, to: ': CONFIDENCE_THRESHOLDS.LOW,' },
  { from: /:\s*0\.7\s*[,}]/g, to: ': CONFIDENCE_THRESHOLDS.MODERATE,' },

  // ============ COMPARISON PATTERNS (very safe) ============
  { from: /> 0\.7\b/g, to: '> CONFIDENCE_THRESHOLDS.MODERATE' },
  { from: /> 0\.5\b/g, to: '> MULTIPLIERS.HALF' },
  { from: /> 0\.8\b/g, to: '> MULTIPLIERS.ZERO_EIGHT' },
  { from: /< 0\.5\b/g, to: '< MULTIPLIERS.HALF' },
  { from: /< 0\.3\b/g, to: '< PERCENTAGE_THRESHOLDS.MODERATE' },

  // ============ ARRAY ELEMENT PATTERNS ============
  { from: /\[\s*0\.5\s*\]/g, to: '[MULTIPLIERS.HALF]' },
  { from: /\[\s*1\.0\s*\]/g, to: '[MULTIPLIERS.NEUTRAL]' },
  { from: /\[\s*0\.75\s*\]/g, to: '[MULTIPLIERS.THREE_QUARTER]' },
];

function addImport(content: string, constant: string): string {
  if (content.includes(constant)) return content;

  const match = content.match(/import\s*{([^}]*)}\s*from\s*['"]\.\.\/constants['"]/);

  if (match) {
    const imports = match[1].split(',').map(s => s.trim()).filter(s => s);
    if (!imports.includes(constant)) {
      imports.push(constant);
      const newImports = imports.sort().join(', ');
      return content.replace(
        /import\s*{[^}]*}\s*from\s*['"]\.\.\/constants['"]/,
        `import { ${newImports} } from '../constants'`
      );
    }
  }
  return content;
}

function processFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let count = 0;
  const imports = new Set<string>();

  for (const rule of AGGRESSIVE_PATTERNS) {
    const matches = content.match(rule.from);
    if (matches) {
      content = content.replace(rule.from, rule.to);
      count += matches.length;

      // Determine which imports needed
      if (rule.to.includes('MULTIPLIERS')) imports.add('MULTIPLIERS');
      if (rule.to.includes('CONFIDENCE_THRESHOLDS')) imports.add('CONFIDENCE_THRESHOLDS');
      if (rule.to.includes('PERCENTAGE_THRESHOLDS')) imports.add('PERCENTAGE_THRESHOLDS');
    }
  }

  if (count > 0) {
    for (const imp of imports) {
      content = addImport(content, imp);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${path.basename(filePath).padEnd(40)} ${count} replacements`);
  }

  return count;
}

function main(): void {
  console.log('⚡ PHASE 5: AGGRESSIVE FINAL PUSH!\n');

  const files = glob.sync('src/**/*.ts', {
    ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/constants/**'],
  });

  let total = 0;
  let changed = 0;

  for (const file of files) {
    const count = processFile(file);
    if (count > 0) {
      changed++;
      total += count;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Phase 5 Results: ${changed} files, ${total} replacements`);
  console.log('='.repeat(70) + '\n');
}

main();
