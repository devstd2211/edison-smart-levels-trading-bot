/**
 * JSON Data Provider
 *
 * Reads historical candle data from JSON files in data/historical/
 * Existing format: SYMBOL_TIMEFRAME_START_END.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { IDataProvider, TimeframeData } from './base.provider';
import { Candle } from '../../types';

export class JsonDataProvider implements IDataProvider {
  private dataDir: string;

  constructor(dataDir: string = path.join(__dirname, '../../../data/historical')) {
    this.dataDir = dataDir;
  }

  /**
   * Load candles from JSON files
   */
  async loadCandles(symbol: string, startTime?: number, endTime?: number): Promise<TimeframeData> {
    console.log(`📥 Loading data from JSON files (${this.dataDir})...`);

    // Find JSON files for each timeframe
    const files = fs.readdirSync(this.dataDir);

    const candles1mFile = files.find((f) => f.includes(symbol) && f.includes('_1m_') && f.endsWith('.json'));
    const candles5mFile = files.find((f) => f.includes(symbol) && f.includes('_5m_') && f.endsWith('.json'));
    const candles15mFile = files.find((f) => f.includes(symbol) && f.includes('_15m_') && f.endsWith('.json'));

    if (!candles1mFile || !candles5mFile || !candles15mFile) {
      throw new Error(
        `Missing JSON files for ${symbol}. Found: 1m=${!!candles1mFile}, 5m=${!!candles5mFile}, 15m=${!!candles15mFile}`,
      );
    }

    console.log(`  - 1m: ${candles1mFile}`);
    console.log(`  - 5m: ${candles5mFile}`);
    console.log(`  - 15m: ${candles15mFile}`);

    // Load and parse JSON files
    const candles1m = JSON.parse(fs.readFileSync(path.join(this.dataDir, candles1mFile), 'utf-8'));
    const candles5m = JSON.parse(fs.readFileSync(path.join(this.dataDir, candles5mFile), 'utf-8'));
    const candles15m = JSON.parse(fs.readFileSync(path.join(this.dataDir, candles15mFile), 'utf-8'));

    // Filter by time range if provided
    const filterByTime = (candles: Candle[]) => {
      return candles.filter((c) => {
        if (startTime && c.timestamp < startTime) {
          return false;
        }
        if (endTime && c.timestamp > endTime) {
          return false;
        }
        return true;
      });
    };

    const filtered1m = startTime || endTime ? filterByTime(candles1m) : candles1m;
    const filtered5m = startTime || endTime ? filterByTime(candles5m) : candles5m;
    const filtered15m = startTime || endTime ? filterByTime(candles15m) : candles15m;

    console.log(`✅ Loaded: ${filtered1m.length} 1m, ${filtered5m.length} 5m, ${filtered15m.length} 15m candles`);

    return {
      candles1m: filtered1m,
      candles5m: filtered5m,
      candles15m: filtered15m,
    };
  }

  getSourceName(): string {
    return 'JSON Files';
  }
}
