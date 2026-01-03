#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = process.argv[2] || './data/market-data-multi.db';

console.log(`Checking database: ${dbPath}\n`);

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database file not found: ${dbPath}`);
  process.exit(1);
}

const stats = fs.statSync(dbPath);
console.log(`💾 Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
});

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ Error getting tables:', err);
    db.close();
    process.exit(1);
  }

  console.log('📊 Tables in database:');
  if (tables.length === 0) {
    console.log('  (no tables found)');
    db.close();
    process.exit(0);
  } else {
    tables.forEach(t => console.log(`  - ${t.name}`));
  }

  // Get count for each timeframe and symbol
  console.log('\n📈 Data for APEXUSDT:');

  const timeframes = ['1m', '5m', '15m'];
  let completed = 0;

  timeframes.forEach(timeframe => {
    db.get(`SELECT COUNT(*) as count FROM candles WHERE symbol = 'APEXUSDT' AND timeframe = ?`, [timeframe], (err, row) => {
      if (err) {
        console.log(`  ${timeframe}: ❌ ERROR - ${err.message}`);
      } else {
        console.log(`  ${timeframe}: ${row.count} candles`);
      }
      completed++;
      if (completed === timeframes.length) {
        // Get all symbols with data
        console.log('\n📊 All symbols in database:');
        db.all("SELECT DISTINCT symbol FROM candles ORDER BY symbol", (err, rows) => {
          if (err) {
            console.log('  ❌ Error listing symbols');
          } else if (rows.length === 0) {
            console.log('  (no symbols found)');
          } else {
            rows.forEach(r => console.log(`  - ${r.symbol}`));
          }
          db.close();
          process.exit(0);
        });
      }
    });
  });
});
