/**
 * Analyze all configs in configs/ folder
 * Shows which strategies are enabled in each config
 */

const fs = require('fs');
const path = require('path');

const configsDir = path.join(__dirname, '..', 'configs');
const configFiles = fs.readdirSync(configsDir).filter(f => f.endsWith('.json'));

console.log('='.repeat(80));
console.log('CONFIG ANALYSIS - Enabled Strategies');
console.log('='.repeat(80));

configFiles.forEach(file => {
  const cfg = JSON.parse(fs.readFileSync(path.join(configsDir, file), 'utf-8'));

  console.log(`\n📄 ${file}`);
  console.log('-'.repeat(80));

  // Traditional strategies
  console.log('Traditional Strategies:');
  console.log(`  • TrendFollowing:     ${cfg.strategies?.trendFollowing?.enabled ? '✅' : '❌'}`);
  console.log(`  • LevelBased:         ${cfg.strategies?.levelBased?.enabled ? '✅' : '❌'}`);
  console.log(`  • CounterTrend:       ${cfg.strategies?.counterTrend?.enabled ? '✅' : '❌'}`);

  // Whale strategies
  console.log('Whale Strategies:');
  console.log(`  • WhaleHunter:        ${cfg.whaleHunter?.enabled ? '✅' : '❌'}`);
  console.log(`  • WhaleHunterFollow:  ${cfg.whaleHunterFollow?.enabled ? '✅' : '❌'}`);

  // Scalping strategies
  console.log('Scalping Strategies:');
  console.log(`  • MicroWall:          ${cfg.scalpingMicroWall?.enabled ? '✅' : '❌'}`);
  console.log(`  • TickDelta:          ${cfg.scalpingTickDelta?.enabled ? '✅' : '❌'}`);
  console.log(`  • LadderTp:           ${cfg.scalpingLadderTp?.enabled ? '✅' : '❌'}`);
  console.log(`  • LimitOrder:         ${cfg.scalpingLimitOrder?.enabled ? '✅' : '❌'}`);
  console.log(`  • OrderFlow:          ${cfg.scalpingOrderFlow?.enabled ? '✅' : '❌'}`);

  // Data requirements
  console.log('Data Subscriptions:');
  console.log(`  • OrderBook:          ${cfg.orderBook?.enabled ? '✅' : '❌'}`);
  console.log(`  • Delta:              ${cfg.delta?.enabled ? '✅' : '❌'}`);
  console.log(`  • System.tradingMode: ${cfg.system?.tradingMode || '❌ MISSING!'}`);
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY: Data Requirements by Strategy Type');
console.log('='.repeat(80));
console.log(`
Strategy Type              | OrderBook | Ticks | Delta | Candles | RSI/EMA
---------------------------|-----------|-------|-------|---------|--------
TrendFollowing             |     ❌    |   ❌  |   ❌  |   ✅    |   ✅
LevelBased                 |     ❌    |   ❌  |   ❌  |   ✅    |   ✅
CounterTrend               |     ❌    |   ❌  |   ❌  |   ✅    |   ✅
WhaleHunter                |     ✅    |   ?   |   ?   |   ✅    |   ✅
WhaleHunterFollow          |     ✅    |   ?   |   ?   |   ✅    |   ✅
ScalpingMicroWall          |     ✅    |   ❌  |   ❌  |   ✅    |   ❌
ScalpingTickDelta          |     ❌    |   ✅  |   ✅  |   ✅    |   ❌
ScalpingLadderTp           |     ❌    |   ❌  |   ❌  |   ✅    |   ❌
ScalpingLimitOrder         |     ❌    |   ❌  |   ❌  |   ✅    |   ❌
ScalpingOrderFlow          |     ✅    |   ✅  |   ✅  |   ✅    |   ❌
`);

console.log('\n' + '='.repeat(80));
