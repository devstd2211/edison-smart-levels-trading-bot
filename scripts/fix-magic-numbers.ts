#!/usr/bin/env ts-node
/**
 * Script to automatically fix magic number violations
 *
 * Replaces common magic numbers with references to constants from technical.constants.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Map of magic numbers to their constant replacements
const MAGIC_NUMBER_MAP: Record<string, { constant: string; import: string }> = {
  // INTEGER_MULTIPLIERS
  '2': { constant: 'INTEGER_MULTIPLIERS.TWO', import: 'INTEGER_MULTIPLIERS' },
  '3': { constant: 'INTEGER_MULTIPLIERS.THREE', import: 'INTEGER_MULTIPLIERS' },
  '4': { constant: 'INTEGER_MULTIPLIERS.FOUR', import: 'INTEGER_MULTIPLIERS' },
  '5': { constant: 'INTEGER_MULTIPLIERS.FIVE', import: 'INTEGER_MULTIPLIERS' },
  '6': { constant: 'INTEGER_MULTIPLIERS.SIX', import: 'INTEGER_MULTIPLIERS' },
  '10': { constant: 'INTEGER_MULTIPLIERS.TEN', import: 'INTEGER_MULTIPLIERS' },
  '20': { constant: 'INTEGER_MULTIPLIERS.TWENTY', import: 'INTEGER_MULTIPLIERS' },
  '24': { constant: 'INTEGER_MULTIPLIERS.TWENTY_FOUR', import: 'INTEGER_MULTIPLIERS' },
  '30': { constant: 'INTEGER_MULTIPLIERS.THIRTY', import: 'INTEGER_MULTIPLIERS' },
  '50': { constant: 'INTEGER_MULTIPLIERS.FIFTY', import: 'INTEGER_MULTIPLIERS' },
  '60': { constant: 'INTEGER_MULTIPLIERS.SIXTY', import: 'INTEGER_MULTIPLIERS' },
  '70': { constant: 'INTEGER_MULTIPLIERS.SEVENTY', import: 'INTEGER_MULTIPLIERS' },
  '80': { constant: 'INTEGER_MULTIPLIERS.EIGHTY', import: 'INTEGER_MULTIPLIERS' },
  '100': { constant: 'INTEGER_MULTIPLIERS.ONE_HUNDRED', import: 'INTEGER_MULTIPLIERS' },
  '180': { constant: 'INTEGER_MULTIPLIERS.ONE_HUNDRED_EIGHTY', import: 'INTEGER_MULTIPLIERS' },
  '200': { constant: 'INTEGER_MULTIPLIERS.TWO_HUNDRED', import: 'INTEGER_MULTIPLIERS' },
  '500': { constant: 'INTEGER_MULTIPLIERS.FIVE_HUNDRED', import: 'INTEGER_MULTIPLIERS' },
  '1000': { constant: 'INTEGER_MULTIPLIERS.ONE_THOUSAND', import: 'INTEGER_MULTIPLIERS' },
  '5000': { constant: 'INTEGER_MULTIPLIERS.FIVE_THOUSAND', import: 'INTEGER_MULTIPLIERS' },

  // RATIO_MULTIPLIERS
  '0.25': { constant: 'RATIO_MULTIPLIERS.QUARTER', import: 'RATIO_MULTIPLIERS' },
  '0.5': { constant: 'RATIO_MULTIPLIERS.HALF', import: 'RATIO_MULTIPLIERS' },
  '0.75': { constant: 'RATIO_MULTIPLIERS.THREE_QUARTER', import: 'RATIO_MULTIPLIERS' },
  '1.0': { constant: 'RATIO_MULTIPLIERS.FULL', import: 'RATIO_MULTIPLIERS' },
  '1.1': { constant: 'RATIO_MULTIPLIERS.PLUS_10_PERCENT', import: 'RATIO_MULTIPLIERS' },
  '1.2': { constant: 'RATIO_MULTIPLIERS.PLUS_20_PERCENT', import: 'RATIO_MULTIPLIERS' },
  '1.5': { constant: 'RATIO_MULTIPLIERS.PLUS_50_PERCENT', import: 'RATIO_MULTIPLIERS' },

  // THRESHOLD_VALUES
  '0.01': { constant: 'THRESHOLD_VALUES.ONE_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.02': { constant: 'THRESHOLD_VALUES.TWO_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.03': { constant: 'THRESHOLD_VALUES.THREE_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.05': { constant: 'THRESHOLD_VALUES.FIVE_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.1': { constant: 'THRESHOLD_VALUES.TEN_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.15': { constant: 'THRESHOLD_VALUES.FIFTEEN_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.2': { constant: 'THRESHOLD_VALUES.TWENTY_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.3': { constant: 'THRESHOLD_VALUES.THIRTY_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.4': { constant: 'THRESHOLD_VALUES.FORTY_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.6': { constant: 'THRESHOLD_VALUES.SIXTY_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.7': { constant: 'THRESHOLD_VALUES.SEVENTY_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.8': { constant: 'THRESHOLD_VALUES.EIGHTY_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.85': { constant: 'THRESHOLD_VALUES.EIGHTY_FIVE_PERCENT', import: 'THRESHOLD_VALUES' },
  '0.9': { constant: 'THRESHOLD_VALUES.NINETY_PERCENT', import: 'THRESHOLD_VALUES' },

  // MULTIPLIER_VALUES
  '1.25': { constant: 'MULTIPLIER_VALUES.ONE_POINT_TWO_FIVE', import: 'MULTIPLIER_VALUES' },
  '2.0': { constant: 'MULTIPLIER_VALUES.TWO', import: 'MULTIPLIER_VALUES' },
  '2.5': { constant: 'MULTIPLIER_VALUES.TWO_POINT_FIVE', import: 'MULTIPLIER_VALUES' },
  '10.0': { constant: 'MULTIPLIER_VALUES.TEN', import: 'MULTIPLIER_VALUES' },

  // NEGATIVE_MARKERS
  '-1': { constant: 'NEGATIVE_MARKERS.MINUS_ONE', import: 'NEGATIVE_MARKERS' },
  '-2': { constant: 'NEGATIVE_MARKERS.MINUS_TWO', import: 'NEGATIVE_MARKERS' },
  '-10': { constant: 'NEGATIVE_MARKERS.MINUS_TEN', import: 'NEGATIVE_MARKERS' },
};

function fixMagicNumbers(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;
  const neededImports = new Set<string>();

  // Replace magic numbers
  for (const [magicNumber, replacement] of Object.entries(MAGIC_NUMBER_MAP)) {
    const regex = new RegExp(`\\b${magicNumber.replace('.', '\\.')}\\b`, 'g');
    if (regex.test(content)) {
      newContent = newContent.replace(regex, replacement.constant);
      neededImports.add(replacement.import);
    }
  }

  // Check if we need to add imports
  if (neededImports.size > 0) {
    // Check if constants import already exists
    const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/constants['"]/);

    if (importMatch) {
      // Add to existing import
      const existingImports = importMatch[1].split(',').map(i => i.trim());
      const allImports = [...new Set([...existingImports, ...neededImports])].sort();
      const newImportStatement = `import { ${allImports.join(', ')} } from '../constants';`;
      newContent = newContent.replace(importMatch[0], newImportStatement);
    } else {
      // Add new import at the top (after first import or at the start)
      const firstImport = content.match(/import\s+.*?;/);
      if (firstImport) {
        const insertPoint = firstImport.index! + firstImport[0].length;
        const newImport = `\nimport { ${[...neededImports].sort().join(', ')} } from '../constants';`;
        newContent = newContent.slice(0, insertPoint) + newImport + newContent.slice(insertPoint);
      }
    }
  }

  // Only write if content changed
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return true;
  }

  return false;
}

// Process files
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: ts-node fix-magic-numbers.ts <file1> <file2> ...');
  process.exit(1);
}

let fixedCount = 0;
for (const file of args) {
  if (fixMagicNumbers(file)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nTotal files fixed: ${fixedCount}/${args.length}`);
