#!/usr/bin/env ts-node

/**
 * Analyze magic number violations from ESLint output
 */

import { execSync } from 'child_process';
import * as path from 'path';

interface MagicNumberViolation {
  file: string;
  line: number;
  value: number;
}

interface MagicNumberSummary {
  value: number;
  count: number;
  files: Set<string>;
}

function main(): void {
  console.log('🔍 Running ESLint to find magic numbers...\n');

  // Run ESLint
  let lintOutput = '';
  try {
    lintOutput = execSync('npm run lint:quiet 2>&1', {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: any) {
    // ESLint returns non-zero exit code when there are errors, but we still get the output
    lintOutput = error.stdout || '';
  }

  // Parse violations
  const violations: MagicNumberViolation[] = [];
  const lines = lintOutput.split('\n');

  let currentFile = '';
  for (const line of lines) {
    // Check if this is a file path line (starts with drive letter on Windows)
    if (/^[A-Z]:\\/.test(line)) {
      currentFile = line.trim();
    } else if (line.includes('No magic number:')) {
      // Parse the magic number violation
      const match = line.match(/(\d+):(\d+)\s+error\s+No magic number:\s+([-\d.]+)/);
      if (match && currentFile) {
        const lineNum = parseInt(match[1], 10);
        const value = parseFloat(match[3]);
        const fileName = path.basename(currentFile);

        violations.push({
          file: fileName,
          line: lineNum,
          value,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ No magic number violations found!');
    return;
  }

  // Group by value
  const byValue = new Map<number, MagicNumberSummary>();
  for (const v of violations) {
    if (!byValue.has(v.value)) {
      byValue.set(v.value, {
        value: v.value,
        count: 0,
        files: new Set(),
      });
    }
    const summary = byValue.get(v.value)!;
    summary.count++;
    summary.files.add(v.file);
  }

  // Convert to array and sort by count descending
  const summaries = Array.from(byValue.values()).sort((a, b) => b.count - a.count);

  // Print top 40
  console.log('VALUE       | COUNT | FILES (first 5)');
  console.log('------------|-------|---------------------------------------------');

  for (let i = 0; i < Math.min(40, summaries.length); i++) {
    const item = summaries[i];
    const valueStr = item.value.toString().padEnd(11);
    const countStr = item.count.toString().padStart(5);
    const filesArray = Array.from(item.files).sort();
    const filesStr = filesArray.slice(0, 5).join(', ');
    console.log(`${valueStr} | ${countStr} | ${filesStr}`);
  }

  console.log('\n===========================================');
  console.log(`Total unique values: ${summaries.length}`);
  console.log(`Total violations: ${violations.length}`);
  console.log('===========================================');

  // Show breakdown by category
  console.log('\n📊 Breakdown by Category:\n');

  const percentages = summaries.filter(s => s.value > 0 && s.value < 1);
  const integers = summaries.filter(s => s.value >= 1 && Number.isInteger(s.value));
  const negatives = summaries.filter(s => s.value < 0);

  console.log(`Percentages (0-1): ${percentages.reduce((sum, s) => sum + s.count, 0)} violations`);
  console.log(`Integers (≥1): ${integers.reduce((sum, s) => sum + s.count, 0)} violations`);
  console.log(`Negatives (<0): ${negatives.reduce((sum, s) => sum + s.count, 0)} violations`);
}

main();
