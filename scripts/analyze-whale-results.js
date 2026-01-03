#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || './whale-calibration-2025-11-28.json';

try {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`\n📊 Whale Calibration Results Analysis`);
  console.log(`=====================================`);
  console.log(`Total results: ${data.length}`);
  console.log(`Expected: ~400 combinations`);
  console.log(`Percentage complete: ${((data.length / 400) * 100).toFixed(1)}%`);

  // Find top 5 by R/R ratio
  const sorted = [...data].sort((a, b) => (b.metrics.rrRatio || 0) - (a.metrics.rrRatio || 0));
  console.log(`\n🏆 Top 5 Results:`);
  sorted.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. R/R=${r.metrics.rrRatio.toFixed(2)}x | WR=${r.metrics.winRate.toFixed(1)}% | Trades=${r.metrics.totalTrades}`);
    console.log(`   TP=${r.params.takeProfitPercent}% | SL=${r.params.stopLossAtrMultiplier}x ATR | Conf=${r.params.minConfidenceLong}%`);
  });

  // Stats
  const withTrades = data.filter(r => r.metrics.totalTrades > 0);
  console.log(`\n📈 Statistics:`);
  console.log(`Results with trades: ${withTrades.length} (${((withTrades.length / data.length) * 100).toFixed(1)}%)`);
  console.log(`Results with 0 trades: ${data.length - withTrades.length}`);

  if (withTrades.length > 0) {
    const avgRR = withTrades.reduce((sum, r) => sum + (r.metrics.rrRatio || 0), 0) / withTrades.length;
    const avgWR = withTrades.reduce((sum, r) => sum + (r.metrics.winRate || 0), 0) / withTrades.length;
    console.log(`Avg R/R (with trades): ${avgRR.toFixed(2)}x`);
    console.log(`Avg WR (with trades): ${avgWR.toFixed(1)}%`);
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
