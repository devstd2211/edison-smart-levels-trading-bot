/**
 * Test Data Helpers
 *
 * Common helper functions for creating test data
 */

import {
  Candle,
  SwingPoint,
  StrategyMarketData,
  TradingContext,
  LoggerService,
  LogLevel,
} from '../../types';
import { MULTIPLIERS } from '../../constants';

/**
 * Create a mock logger for tests
 */
export function createMockLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

/**
 * Create a simple test candle
 */
export function createTestCandle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 1000,
): Candle {
  return { timestamp, open, high, low, close, volume };
}

/**
 * Create mock swing point
 */
export function createMockSwingPoint(
  timestamp: number,
  price: number,
  type: any = 'HIGH', // SwingPointType.HIGH or 'HIGH'
): SwingPoint {
  return {
    timestamp,
    price,
    type,
  };
}

/**
 * Create mock trading context
 */
export function createMockContext(trend: any = 'NEUTRAL'): TradingContext {
  return {
    timestamp: Date.now(),
    trend,
    marketStructure: null,
    atrPercent: 0.1,
    emaDistance: MULTIPLIERS.HALF,
    ema50: 1.2,
    atrModifier: MULTIPLIERS.NEUTRAL,
    emaModifier: MULTIPLIERS.NEUTRAL,
    trendModifier: MULTIPLIERS.NEUTRAL,
    overallModifier: MULTIPLIERS.NEUTRAL,
    warnings: [],
    isValidContext: true,
    blockedBy: [],
  };
}

/**
 * Create test market data for strategy tests
 */
export function createTestMarketData(
  overrides?: Partial<StrategyMarketData>,
): StrategyMarketData {
  const defaultData: StrategyMarketData = {
    candles: [
      createTestCandle(1000, 1.0, 1.1, 0.9, 1.05),
      createTestCandle(2000, 1.05, 1.15, 1.0, 1.1),
      createTestCandle(3000, 1.1, 1.2, 1.05, 1.15),
    ],
    swingPoints: [
      createMockSwingPoint(1000, 0.9, 'LOW'),
      createMockSwingPoint(3000, 1.2, 'HIGH'),
    ],
    rsi: 50,
    ema: { fast: 1.1, slow: 1.05 },
    trend: 'NEUTRAL',
    atr: 0.01,
    timestamp: 3000,
    currentPrice: 1.15,
    context: createMockContext('NEUTRAL'),
  };

  return {
    ...defaultData,
    ...overrides,
    // Ensure context has correct trend if trend is overridden
    context: overrides?.context || createMockContext(overrides?.trend || 'NEUTRAL'),
  };
}
