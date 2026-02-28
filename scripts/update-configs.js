/**
 * Update all configs in configs/ folder with dataSubscriptions
 * Replaces old tradingMode system with explicit data subscription flags
 */

const fs = require('fs');
const path = require('path');

const configsDir = path.join(__dirname, '..', 'configs');

// Define dataSubscriptions for each config based on strategy requirements
const DATA_SUBSCRIPTIONS = {
  'config-block.json': {
    candles: { enabled: true, calculateIndicators: true },
    orderbook: { enabled: false, updateIntervalMs: 5000 },
    ticks: { enabled: false, calculateDelta: false },
  },
  'config-weight.json': {
    candles: { enabled: true, calculateIndicators: true },
    orderbook: { enabled: true, updateIntervalMs: 100 }, // Fast for whale
    ticks: { enabled: false, calculateDelta: false },
  },
  'config-microwall.json': {
    candles: { enabled: true, calculateIndicators: false },
    orderbook: { enabled: true, updateIntervalMs: 1000 },
    ticks: { enabled: false, calculateDelta: false },
  },
  'config-tickdelta.json': {
    candles: { enabled: true, calculateIndicators: false },
    orderbook: { enabled: false, updateIntervalMs: 5000 },
    ticks: { enabled: true, calculateDelta: true }, // Needs ticks + delta
  },
  'config-laddertp.json': {
    candles: { enabled: true, calculateIndicators: true }, // Wrapper uses levelBased
    orderbook: { enabled: false, updateIntervalMs: 5000 },
    ticks: { enabled: false, calculateDelta: false },
  },
  'config-limitorder.json': {
    candles: { enabled: true, calculateIndicators: true }, // Wrapper uses levelBased
    orderbook: { enabled: false, updateIntervalMs: 5000 },
    ticks: { enabled: false, calculateDelta: false },
  },
  'config-orderflow.json': {
    candles: { enabled: true, calculateIndicators: false },
    orderbook: { enabled: true, updateIntervalMs: 500 },
    ticks: { enabled: false, calculateDelta: false }, // Only orderbook (OrderFlowAnalyzer)
  },
};

console.log('='.repeat(80));
console.log('UPDATING CONFIGS - Adding dataSubscriptions');
console.log('='.repeat(80));

Object.keys(DATA_SUBSCRIPTIONS).forEach((filename) => {
  const filePath = path.join(configsDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`\n❌ ${filename} - NOT FOUND (skipping)`);
    return;
  }

  console.log(`\n📄 ${filename}`);

  // Read config
  const cfg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Remove old system.tradingMode if exists
  if (cfg.system?.tradingMode) {
    console.log(`  • Removing old system.tradingMode: ${cfg.system.tradingMode}`);
    delete cfg.system.tradingMode;
  }

  // Add dataSubscriptions
  cfg.dataSubscriptions = DATA_SUBSCRIPTIONS[filename];
  console.log(`  • Added dataSubscriptions:`);
  console.log(`    - candles: ${cfg.dataSubscriptions.candles.enabled ? '✅' : '❌'} (indicators: ${cfg.dataSubscriptions.candles.calculateIndicators ? '✅' : '❌'})`);
  console.log(`    - orderbook: ${cfg.dataSubscriptions.orderbook.enabled ? '✅' : '❌'} (throttle: ${cfg.dataSubscriptions.orderbook.updateIntervalMs}ms)`);
  console.log(`    - ticks: ${cfg.dataSubscriptions.ticks.enabled ? '✅' : '❌'} (delta: ${cfg.dataSubscriptions.ticks.calculateDelta ? '✅' : '❌'})`);

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf-8');
  console.log(`  ✅ Updated successfully`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ ALL CONFIGS UPDATED');
console.log('='.repeat(80));

