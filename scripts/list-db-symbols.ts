
import * as path from 'path';
import sqlite3 from 'sqlite3';

/**
 * This script connects to the SQLite database and lists all unique symbols
 * found in the 'candles' table. This provides an accurate list of
 * which symbols have data available for backtesting.
 */
async function listAvailableSymbols() {
  console.log("--- Checking available symbols in 'candles' table ---");

  const dbPath = path.join(__dirname, '../data/market-data-multi.db');
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error(`Error opening database: ${err.message}`);
      return;
    }
    console.log('Successfully connected to the database.');
  });

  const sql = `SELECT DISTINCT symbol FROM candles;`;

  db.all(sql, [], (err, rows: { symbol: string }[]) => {
    if (err) {
      console.error(`Error running query: ${err.message}`);
      db.close();
      return;
    }

    console.log('\nFound symbols with data in the "candles" table:');
    if (rows.length === 0) {
      console.log('No symbols found.');
    } else {
      rows.forEach((row) => {
        console.log(`- ${row.symbol}`);
      });
    }
    
    console.log('\nPlease use one of these symbols in the test scripts.');
    db.close();
  });
}

listAvailableSymbols().catch(console.error);
