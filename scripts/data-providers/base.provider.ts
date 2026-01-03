/**
 * Base Data Provider Interface
 *
 * Abstraction for loading historical candle data from different sources:
 * - JSON files (existing)
 * - SQLite database (new)
 */

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeframeData {
  candles1m: CandleData[];
  candles5m: CandleData[];
  candles15m: CandleData[];
}

/**
 * Data Provider Interface
 */
export interface IDataProvider {
  /**
   * Load historical candles for multiple timeframes
   * @param symbol - Trading symbol (e.g., 'APEXUSDT')
   * @param startTime - Start timestamp (optional)
   * @param endTime - End timestamp (optional)
   * @returns TimeframeData with candles for 1m, 5m, 15m
   */
  loadCandles(symbol: string, startTime?: number, endTime?: number): Promise<TimeframeData>;

  /**
   * Get data source name (for logging)
   */
  getSourceName(): string;
}
