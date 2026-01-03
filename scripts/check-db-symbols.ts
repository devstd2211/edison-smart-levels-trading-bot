
import * as path from 'path';
import sqlite3 from 'sqlite3';

/**
 * This script connects to the SQLite database and lists all tables.
 * The table names should correspond to the available symbols for backtesting.
 */
async function listDatabaseTables() {
  console.log('--- Checking available tables (symbols) in SQLite DB ---');

  const dbPath = path.join(__dirname, '../data/market-data-multi.db');
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error(`Error opening database: ${err.message}`);
      return;
    }
    console.log('Successfully connected to the database.');
  });

  const sql = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`;

  db.all(sql, [], (err, rows: { name: string }[]) => {
    if (err) {
      console.error(`Error running query: ${err.message}`);
      db.close();
      return;
    }

    console.log('\nAvailable tables:');
    if (rows.length === 0) {
      console.log('No tables found.');
    } else {
      rows.forEach((row) => {
        console.log(`- ${row.name}`);
      });
    }

    console.log('\nUse one of these table names (e.g., the part before "_1m") as the symbol in scripts.');
    db.close();
  });
}

listDatabaseTables().catch(console.error);
