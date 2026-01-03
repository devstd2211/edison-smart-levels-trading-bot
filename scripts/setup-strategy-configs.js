#!/usr/bin/env node
/**
 * Configure all 5 strategy configs
 * Each config will have only one strategy enabled
 */

const fs = require('fs');
const path = require('path');

const configsDir = path.join(__dirname, '..', 'configs');

// Strategy configurations
const strategies = [
  { file: 'config-microwall.json', symbol: 'SUIUSDT', strategy: 'scalpingMicroWall' },
  { file: 'config-tickdelta.json', symbol: 'STRKUSDT', strategy: 'scalpingTickDelta' },
  { file: 'config-laddertp.json', symbol: 'HYPEUSDT', strategy: 'scalpingLadderTp' },
  { file: 'config-limitorder.json', symbol: 'ADAUSDT', strategy: 'scalpingLimitOrder' },
  { file: 'config-orderflow.json', symbol: 'XLMUSDT', strategy: 'scalpingOrderFlow' },
];

function updateConfig(filePath, symbol, enabledStrategy) {
  console.log(`\nConfiguring ${path.basename(filePath)} for ${symbol} with ${enabledStrategy}...`);

  // Read config
  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Update symbol
  config.exchange.symbol = symbol;

  // Set mode to SCALPING (in both locations for compatibility)
  config.mode = 'SCALPING';
  if (config.system) {
    config.system.tradingMode = 'SCALPING';
  }

  // Disable all main strategies
  if (config.strategies) {
    if (config.strategies.trendFollowing) config.strategies.trendFollowing.enabled = false;
    if (config.strategies.levelBased) config.strategies.levelBased.enabled = false;
    if (config.strategies.counterTrend) config.strategies.counterTrend.enabled = false;
  }

  // Disable whale strategies
  if (config.whaleHunter) config.whaleHunter.enabled = false;
  if (config.whaleHunterFollow) config.whaleHunterFollow.enabled = false;

  // Disable all scalping strategies
  if (config.scalpingMicroWall) config.scalpingMicroWall.enabled = false;
  if (config.scalpingLimitOrder) config.scalpingLimitOrder.enabled = false;
  if (config.scalpingLadderTp) config.scalpingLadderTp.enabled = false;
  if (config.scalpingTickDelta) config.scalpingTickDelta.enabled = false;
  if (config.scalpingOrderFlow) config.scalpingOrderFlow.enabled = false;

  // Enable the target strategy
  if (config[enabledStrategy]) {
    config[enabledStrategy].enabled = true;
  } else {
    console.error(`  ✗ Strategy ${enabledStrategy} not found in config!`);
    return;
  }

  // Save updated config
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');

  console.log(`  ✓ Updated ${path.basename(filePath)}`);
}

// Main
console.log('\n========================================');
console.log('Configuring Strategy Configs');
console.log('========================================');

strategies.forEach(({ file, symbol, strategy }) => {
  const filePath = path.join(configsDir, file);
  updateConfig(filePath, symbol, strategy);
});

console.log('\n========================================');
console.log('All configs configured!');
console.log('========================================\n');
