/**
 * Phase 5 Extra Pass: Integer value replacements
 */
import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';

const PATTERNS = [
  { from: /= 50(?![0-9])/g, to: '= CONFIDENCE_THRESHOLDS.MODERATE', imp: 'CONFIDENCE_THRESHOLDS' },
  { from: /= 70(?![0-9])/g, to: '= CONFIDENCE_THRESHOLDS.MODERATE', imp: 'CONFIDENCE_THRESHOLDS' },
  { from: /= 20(?![0-9])/g, to: '= PERCENTAGE_THRESHOLDS.LOW_MODERATE', imp: 'PERCENTAGE_THRESHOLDS' },
  { from: /= 30(?![0-9])/g, to: '= PERCENTAGE_THRESHOLDS.MODERATE', imp: 'PERCENTAGE_THRESHOLDS' },
  { from: /= 40(?![0-9])/g, to: '= PERCENTAGE_THRESHOLDS.MODERATE_HIGH', imp: 'PERCENTAGE_THRESHOLDS' },
  { from: /= 60(?![0-9])/g, to: '= PERCENTAGE_THRESHOLDS.VERY_HIGH', imp: 'PERCENTAGE_THRESHOLDS' },
];

function addImport(content: string, imp: string): string {
  if (content.includes(imp)) return content;
  const match = content.match(/import\s*{([^}]*)}\s*from\s*['"]\.\.\/constants['"]/);
  if (!match) return content;
  const existing = match[1].split(',').map(s => s.trim()).filter(s => s);
  existing.push(imp);
  const list = Array.from(new Set(existing)).sort().join(', ');
  return content.replace(/import\s*{[^}]*}\s*from\s*['"]\.\.\/constants['"]/,
    `import { ${list} } from '../constants'`);
}

let total = 0;
const files = glob.sync('src/**/*.ts', {
  ignore: ['src/**/*.test.ts', '**/*.spec.ts', 'src/constants/**'],
});

for (const f of files) {
  let c = fs.readFileSync(f, 'utf-8');
  let count = 0;
  const imports = new Set<string>();

  for (const p of PATTERNS) {
    const m = c.match(p.from);
    if (m) {
      c = c.replace(p.from, p.to);
      count += m.length;
      imports.add(p.imp);
    }
  }

  if (count > 0) {
    for (const imp of imports) {
      c = addImport(c, imp);
    }
    fs.writeFileSync(f, c);
    console.log(`✅ ${path.basename(f).padEnd(40)} +${count}`);
    total += count;
  }
}

console.log(`\n📊 Extra replacements: ${total}\n`);
