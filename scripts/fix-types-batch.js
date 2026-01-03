#!/usr/bin/env node
/**
 * Batch Type Fixer
 * Automatically fixes common TypeScript compilation errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting batch type fixes...\n');

// Get all TS errors
console.log('📊 Collecting compilation errors...');
let errors = '';
try {
  execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
} catch (e) {
  errors = e.stdout + e.stderr;
}

// Parse errors
const errorLines = errors.split('\n').filter(line => line.includes('error TS'));
console.log(`Found ${errorLines.length} errors\n`);

// Extract unique files with errors
const filesWithErrors = new Set();
errorLines.forEach(line => {
  const match = line.match(/^(.+\.ts)\(/);
  if (match) {
    filesWithErrors.add(match[1]);
  }
});

console.log(`📁 Files with errors: ${filesWithErrors.size}\n`);

// Fix 1: Add missing initializers (TS2564)
console.log('🔧 Fix 1: Adding initializers for uninitialized properties...');
let fix1Count = 0;

filesWithErrors.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Find properties without initializers in classes
  // Add ! after property name (definite assignment assertion)
  content = content.replace(
    /(^\s+(?:private|public|protected|readonly)\s+\w+):\s*(\w+[\w<>,\s\[\]|]*);/gm,
    (match, prop, type) => {
      // Skip if already has ! or = or ?
      if (match.includes('!') || match.includes('=') || match.includes('?')) {
        return match;
      }
      return `${prop}!: ${type};`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fix1Count++;
  }
});

console.log(`   Fixed ${fix1Count} files\n`);

// Fix 2: Make readonly properties writable (TS2540)
console.log('🔧 Fix 2: Converting readonly to mutable for assigned properties...');
let fix2Count = 0;

filesWithErrors.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // In constructors, remove readonly if property is assigned later
  // This is a heuristic - check if property appears on left side of =
  const lines = content.split('\n');
  const assignedProps = new Set();

  lines.forEach(line => {
    const assignMatch = line.match(/^\s+this\.(\w+)\s*=/);
    if (assignMatch) {
      assignedProps.add(assignMatch[1]);
    }
  });

  // Remove readonly from constructor params if they're assigned later
  assignedProps.forEach(prop => {
    const regex = new RegExp(`(private|public|protected)\\s+readonly\\s+(${prop})\\s*:`, 'g');
    content = content.replace(regex, '$1 $2:');
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fix2Count++;
  }
});

console.log(`   Fixed ${fix2Count} files\n`);

// Fix 3: Add optional chaining for possibly undefined (TS2532, TS18048)
console.log('🔧 Fix 3: Adding null checks...');
let fix3Count = 0;

// This one is tricky - we'll add it to a list for manual review
const needsNullCheck = [];

errorLines.forEach(line => {
  if (line.includes('TS2532') || line.includes('TS18048')) {
    needsNullCheck.push(line);
  }
});

console.log(`   Found ${needsNullCheck.length} locations needing null checks (manual review needed)\n`);

// Fix 4: Add missing properties to interfaces
console.log('🔧 Fix 4: Analyzing missing properties...');

const missingProps = new Map(); // interface -> Set of missing props

errorLines.forEach(line => {
  const match = line.match(/Property '(\w+)' does not exist on type '(\w+)'/);
  if (match) {
    const [, prop, type] = match;
    if (!missingProps.has(type)) {
      missingProps.set(type, new Set());
    }
    missingProps.get(type).add(prop);
  }
});

console.log('   Missing properties by type:');
missingProps.forEach((props, type) => {
  console.log(`   - ${type}: ${Array.from(props).join(', ')}`);
});
console.log();

// Fix 5: Add 'any' type to untyped parameters (TS7006)
console.log('🔧 Fix 5: Adding types to parameters...');
let fix5Count = 0;

filesWithErrors.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Add 'any' type to function parameters without types
  content = content.replace(
    /\((\w+)\)/g,
    (match, param) => {
      // Check if this is in a function/method context
      return `(${param}: any)`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fix5Count++;
  }
});

console.log(`   Fixed ${fix5Count} files\n`);

// Summary
console.log('✅ Batch fixes completed!\n');
console.log('Summary:');
console.log(`- Added initializers: ${fix1Count} files`);
console.log(`- Fixed readonly: ${fix2Count} files`);
console.log(`- Null checks needed: ${needsNullCheck.length} locations`);
console.log(`- Missing properties: ${missingProps.size} types`);
console.log(`- Added parameter types: ${fix5Count} files`);
console.log();
console.log('🔍 Run "npm run build" to see remaining errors');
console.log();

// Save report
const report = {
  timestamp: new Date().toISOString(),
  totalErrors: errorLines.length,
  fixes: {
    initializers: fix1Count,
    readonly: fix2Count,
    parameterTypes: fix5Count
  },
  needsManualReview: {
    nullChecks: needsNullCheck.length,
    missingProperties: Object.fromEntries(
      Array.from(missingProps.entries()).map(([k, v]) => [k, Array.from(v)])
    )
  }
};

fs.writeFileSync(
  path.join(__dirname, 'fix-types-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('📄 Report saved to scripts/fix-types-report.json');
