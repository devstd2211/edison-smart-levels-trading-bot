#!/usr/bin/env node

/**
 * Calibration Deployment Wrapper for npm
 *
 * Wraps the batch file logic in Node.js to properly pass parameters
 * from npm scripts.
 *
 * Usage: node deploy-calibration-wrapper.js <strategy>
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const strategy = process.argv[2];

if (!strategy) {
  console.log('\nCalibration Deployment Script');
  console.log('='.repeat(80));
  console.log('\nUsage: node deploy-calibration-wrapper.js <strategy>\n');
  console.log('Available strategies:');
  console.log('  - block         (LevelBased entry - MAIN STRATEGY for block bot)');
  console.log('  - microwall     (Micro-Wall scalping)');
  console.log('  - tickdelta     (Tick Delta scalping)');
  console.log('  - laddertp      (Ladder TP scalping)');
  console.log('  - limitorder    (Limit Order scalping)');
  console.log('  - orderflow     (Order Flow scalping)');
  console.log('  - weight        (WhaleHunter weight-based filtering)');
  console.log('\nExamples:');
  console.log('  node deploy-calibration-wrapper.js microwall');
  console.log('  npm run deploy:calibration:tickdelta\n');
  process.exit(1);
}

const validStrategies = ['block', 'microwall', 'tickdelta', 'laddertp', 'limitorder', 'orderflow', 'weight'];

if (!validStrategies.includes(strategy.toLowerCase())) {
  console.log(`\nERROR: Unknown strategy "${strategy}"\n`);
  console.log('Available strategies: ' + validStrategies.join(', ') + '\n');
  process.exit(1);
}

// Call the deploy-calibration.js script
const deployScript = path.join(__dirname, 'deploy-calibration.js');
const rootDir = path.dirname(__dirname);
const calibrationRoot = path.join(path.dirname(rootDir), 'Edison - calibration', strategy);
const dataSourceDir = path.join(path.dirname(rootDir), 'Edison - data-collector', 'data');

// Create directories if they don't exist
const dataDir = path.join(calibrationRoot, 'data');
const logsDir = path.join(calibrationRoot, 'logs');

if (!fs.existsSync(calibrationRoot)) {
  fs.mkdirSync(calibrationRoot, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('\n' + '='.repeat(80));
console.log(`Deploying Calibration Environment for: ${strategy}`);
console.log('='.repeat(80) + '\n');

try {
  // Execute the deploy script
  execSync(`node "${deployScript}" "${strategy}" "${calibrationRoot}" "${dataSourceDir}"`, {
    stdio: 'inherit',
    cwd: rootDir
  });

  console.log('\n' + '='.repeat(80));
  console.log('Calibration environment ready!');
  console.log('='.repeat(80) + '\n');
  console.log(`Next steps:\n`);
  console.log(`  1. cd "${calibrationRoot}"`);
  console.log('  2. npm install (if needed)');
  console.log('  3. run-calibration.bat\n');
  console.log(`Or run directly:`);
  console.log(`  cd "${calibrationRoot}" && run-calibration.bat\n`);

  process.exit(0);
} catch (error) {
  console.error('\nERROR: Deployment failed!');
  console.error(error.message);
  process.exit(1);
}
