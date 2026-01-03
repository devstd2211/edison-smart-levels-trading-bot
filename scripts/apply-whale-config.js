const fs = require('fs');
const path = require('path');

// Read the config
const configPath = path.join(__dirname, '..', 'configs', 'config-weight.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 1. Enable whaleHunter with calibrated parameters (Nov 19 Rank #1)
config.whaleHunter = {
  enabled: true,
  priority: 1,
  minConfidence: 60,
  minConfidenceLong: 60,
  minConfidenceShort: 60,
  enableLong: true,
  enableShort: true,
  requireTrendAlignment: true,
  stopLossAtrMultiplier: 0.5,
  requireMultipleSignals: false,
  cooldownMs: 25000,
  maxAtrPercent: 3,
  blockLongInDowntrend: true,
  trendInversion: {
    enabled: true,
    strongTrendThreshold: 0.5,
    neutralZoneThreshold: 0.3,
    blockAgainstTrend: false
  },
  takeProfitPercent: 0.3,
  takeProfitPercentLongDowntrend: 0.3,
  dynamicTakeProfit: {
    enabled: false,
    maxTPPercent: 1,
    wallSizeBased: {
      enabled: false,
      threshold: 20,
      multiplier: 1.2
    },
    atrBased: {
      enabled: false,
      threshold: 2,
      multiplier: 1.15
    }
  },
  detector: {
    modes: {
      wallBreak: {
        enabled: false,
        minWallSize: 7,
        breakConfirmationMs: 3000,
        maxConfidence: 85
      },
      wallDisappearance: {
        enabled: false,
        minWallSize: 9,
        minWallDuration: 15000,
        wallGoneThresholdMs: 15000,
        maxConfidence: 80
      },
      imbalanceSpike: {
        enabled: true,
        minRatioChange: 0.25,
        detectionWindow: 5000,
        maxConfidence: 90
      }
    },
    maxImbalanceHistory: 20,
    wallExpiryMs: 60000,
    breakExpiryMs: 300000
  }
};

// 2. Disable whaleHunterFollow
config.whaleHunterFollow = {
  enabled: false
};

// 3. Disable all traditional strategies
config.strategies.trendFollowing.enabled = false;
config.strategies.levelBased.enabled = false;
config.strategies.counterTrend.enabled = false;

// 4. Disable all scalping strategies
config.scalpingMicroWall.enabled = false;
config.scalpingLimitOrder.enabled = false;
config.scalpingTickDelta.enabled = false;
config.scalpingLadderTp.enabled = false;
config.scalpingOrderFlow.enabled = false;

// Write back
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✅ Whale config applied successfully!');
console.log('   - whaleHunter: ENABLED (TP: 0.3%, SL: 0.5x ATR, Confidence: 60%)');
console.log('   - Only IMBALANCE_SPIKE mode enabled');
console.log('   - All other strategies: DISABLED');
