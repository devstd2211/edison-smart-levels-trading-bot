
import * as path from 'path';
import { SqliteDataProvider } from '../src/backtest/data-providers/sqlite.provider';
import { ZigZagIndicator } from '../src/indicators/zigzag.indicator';
import { Candle } from '../src/types';

/**
 * This script demonstrates the "repainting" nature of the ZigZag indicator.
 *
 * It processes candles one by one and shows how the "last known" swing point
 * only appears many candles after it actually occurred.
 */
async function demonstrateRepainting() {
  console.log('--- ZigZag Repainting Demonstration ---');

  const ZIGZAG_LENGTH = 10;
  const SYMBOL = 'XRPUSDT'; // Symbol specified by user, format corrected after DB check
  const MAX_CANDLES_TO_PROCESS = 200;

  // 1. Load candle data from the database
  const dbPath = path.join(__dirname, '../data/market-data-multi.db');
  const dataProvider = new SqliteDataProvider(dbPath);
  const allCandles = (await dataProvider.loadCandles(SYMBOL)).candles1m;

  if (allCandles.length < MAX_CANDLES_TO_PROCESS) {
    console.error(`Not enough candle data. Found ${allCandles.length}, but need at least ${MAX_CANDLES_TO_PROCESS}.`);
    return;
  }

  console.log(`Loaded ${allCandles.length} candles for ${SYMBOL}.`);
  console.log(`Using ZigZag length: ${ZIGZAG_LENGTH}`);
  console.log('Processing candles one by one...\n');
  console.log(
    'Timestamp of Current Candle | Timestamp of Last Swing Low (can change!) | Timestamp of Last Swing High (can change!)'
  );
  console.log('---------------------------------------------------------------------------------------------------------');


  // 2. Instantiate the indicator
  const indicator = new ZigZagIndicator(ZIGZAG_LENGTH);

  let lastReportedLowTimestamp = 0;
  let lastReportedHighTimestamp = 0;

  // 3. Loop through a slice of candles, simulating real-time data arrival
  for (let i = ZIGZAG_LENGTH * 2 + 1; i < MAX_CANDLES_TO_PROCESS; i++) {
    const currentCandleHistory = allCandles.slice(0, i);
    const currentCandle = currentCandleHistory[currentCandleHistory.length - 1];

    // On each new candle, we re-calculate the "last" swing points based on the available history
    const lastLow = indicator.getLastSwingLow(currentCandleHistory);
    const lastHigh = indicator.getLastSwingHigh(currentCandleHistory);

    const lowTimestamp = lastLow?.timestamp ?? 0;
    const highTimestamp = lastHigh?.timestamp ?? 0;

    // Check if the "last known" swing point has changed
    const lowChanged = lowTimestamp !== lastReportedLowTimestamp;
    const highChanged = highTimestamp !== lastReportedHighTimestamp;
    
    if (lowChanged || highChanged) {
        const lowTs = new Date(lowTimestamp).toISOString();
        const highTs = new Date(highTimestamp).toISOString();
        const currentTs = new Date(currentCandle.timestamp).toISOString();

        console.log(`${currentTs} | ${lowTs} | ${highTs}`);

        if (lowChanged) lastReportedLowTimestamp = lowTimestamp;
        if (highChanged) lastReportedHighTimestamp = highTimestamp;
    }
  }

  console.log('\n--- Demonstration Complete ---');
  console.log('Observe how the timestamps for the last swing low/high do not appear immediately.');
  console.log('A swing point is only identified "in the past" after ZIGZAG_LENGTH candles have passed.');
  console.log('This is "repainting" and leads to flawed trading decisions.');
}

demonstrateRepainting().catch(console.error);
