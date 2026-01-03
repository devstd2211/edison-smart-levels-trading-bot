#!/usr/bin/env ts-node

/**
 * Analyze remaining magic numbers in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const MAGIC_NUMBER_REGEX = /\/\*\s*no-magic-numbers:\s*next-line\s*\*\/|No magic number:/;

interface MagicNumberInfo {
  file: string;
  line: number;
  value: string;
  context: string;
}

interface FileStats {
  file: string;
  count: number;
  values: { [key: string]: number };
}

function extractMagicNumbers(filePath: string): MagicNumberInfo[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const magicNumbers: MagicNumberInfo[] = [];

    // Look for patterns like: 1000, 0.5, -1, 2.5, etc.
    const numberRegex = /(?:^|[^\w.])([-+]?\d+\.?\d*|[-+]?\d*\.\d+)(?:[^\w.]|$)/g;

    lines.forEach((line, lineIndex) => {
      // Skip comments and strings
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Check if line explicitly allows magic numbers
      if (line.includes('// eslint-disable') || line.includes('no-magic-numbers: next-line')) {
        return;
      }

      const matches = line.matchAll(numberRegex);
      for (const match of matches) {
        const value = match[1];
        // Skip 0, 1, -1 (these are ignored in ESLint config)
        if (['0', '1', '-1', '2', '3', '4'].includes(value)) {
          continue;
        }

        magicNumbers.push({
          file: filePath,
          line: lineIndex + 1,
          value,
          context: line.trim().substring(0, 100),
        });
      }
    });

    return magicNumbers;
  } catch {
    return [];
  }
}

function analyzeAllFiles(): FileStats[] {
  const sourceFiles = glob.sync('src/**/*.ts', {
    ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/constants/**'],
  });

  const fileStats: FileStats[] = [];

  for (const file of sourceFiles) {
    const magicNumbers = extractMagicNumbers(file);
    if (magicNumbers.length > 0) {
      const values: { [key: string]: number } = {};
      magicNumbers.forEach(mn => {
        values[mn.value] = (values[mn.value] || 0) + 1;
      });

      fileStats.push({
        file,
        count: magicNumbers.length,
        values,
      });
    }
  }

  return fileStats.sort((a, b) => b.count - a.count);
}

function main(): void {
  console.log('🔍 Analyzing Magic Numbers in Source Code...\n');

  const stats = analyzeAllFiles();

  console.log('📊 Top 20 Files with Most Magic Numbers:\n');

  let totalCount = 0;
  const allValues: { [key: string]: number } = {};

  stats.slice(0, 20).forEach((stat, index) => {
    const num = (index + 1).toString().padStart(2);
    console.log(`${num}) ${stat.file}`);
    console.log(`    ${stat.count} magic numbers`);
    const values = Object.keys(stat.values).slice(0, 5).join(', ');
    console.log(`    Values: ${values}`);
    console.log();

    totalCount += stat.count;
    Object.entries(stat.values).forEach(([val, cnt]) => {
      allValues[val] = (allValues[val] || 0) + cnt;
    });
  });

  const totalFiles = stats.length;
  const totalMagic = stats.reduce((sum, s) => sum + s.count, 0);

  console.log('='.repeat(70));
  console.log('\n📈 SUMMARY:\n');
  console.log(`Total files with magic numbers: ${totalFiles}`);
  console.log(`Total magic number occurrences: ${totalMagic}`);

  console.log('\n🔢 Most Common Magic Numbers:\n');

  Object.entries(allValues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([value, count]) => {
      const padVal = value.padStart(8);
      const padCnt = count.toString().padStart(3);
      console.log(`  ${padVal}: ${padCnt}x`);
    });

  console.log('\n✅ Analysis complete!');
}

main();
