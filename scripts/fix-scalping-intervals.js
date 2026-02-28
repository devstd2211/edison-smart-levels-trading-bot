/**
 * Fix orderbook intervals for scalping strategies
 * Scalping needs FAST updates!
 */

const fs = require('fs');
const path = require('path');

const configsDir = path.join(__dirname, '..', 'configs');

// Updated intervals for scalping (MUCH FASTER!)
const SCALPING_INTERVALS = {
  'config-microwall.json': 500,   // 500ms (was 1000ms) - micro walls change fast!
  'config-orderflow.json': 500,   // 500ms (was 3000ms) - aggressive flow is FAST!
  'config-weight.json': 100,      // 100ms - whale detection ultra-fast (unchanged)
};

console.log('='.repeat(80));
console.log('FIXING SCALPING INTERVALS - Making them FASTER for real scalping');
console.log('='.repeat(80));

Object.keys(SCALPING_INTERVALS).forEach((filename) => {
  const filePath = path.join(configsDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`\n❌ ${filename} - NOT FOUND (skipping)`);
    return;
  }

  console.log(`\n📄 ${filename}`);

  // Read config
  const cfg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const oldInterval = cfg.dataSubscriptions.orderbook.updateIntervalMs;
  cfg.dataSubscriptions.orderbook.updateIntervalMs = SCALPING_INTERVALS[filename];

  console.log(`  • OrderBook interval: ${oldInterval}ms → ${SCALPING_INTERVALS[filename]}ms ⚡`);

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf-8');
  console.log(`  ✅ Updated successfully`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ SCALPING INTERVALS FIXED - Now MUCH faster!');
console.log('='.repeat(80));
console.log('\nScalping strategies now update at:');
console.log('  • MicroWall:  500ms (2x per second)');
console.log('  • OrderFlow:  500ms (2x per second)');
console.log('  • WhaleHunter: 100ms (10x per second) - ultra-fast!');

