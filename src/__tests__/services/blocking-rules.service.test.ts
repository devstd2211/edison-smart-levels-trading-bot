/**
 * Blocking Rules Service Tests
 */

import { BlockingRulesService, BlockingRulesConfig, BlockingContext } from '../../services/blocking-rules.service';
import { LoggerService, LogLevel, SignalDirection, Candle } from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createCandles = (count: number, price: number = 100): Candle[] => {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: price,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: 1000,
    });
  }
  return candles;
};

const defaultConfig: BlockingRulesConfig = {
  maxDistanceToEmaPercent: 5.5,
  cooldownPeriodMs: 10000,
  minCandles5m: 100,
  volumeMinMultiplierTrend: 0.5,
  volumeMinMultiplierLevel: 0.3,
  minDropFromAthForLong: 0.2,
  enableAthProtection: true,
  enableVolumeChecks: true,
  enableWickChecks: true,
};

const createContext = (overrides?: Partial<BlockingContext>): BlockingContext => ({
  direction: SignalDirection.LONG,
  strategy: 'TrendFollowing',
  candles: createCandles(150),
  currentPrice: 100,
  ema50: 100,
  rsi: 50,
  hasActivePosition: false,
  lastSignalTime: Date.now() - 20000, // 20 sec ago (outside cooldown)
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('BlockingRulesService', () => {
  let service: BlockingRulesService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    service = new BlockingRulesService(defaultConfig, logger);
  });

  // TEST 1-2: GLOBAL_1 - Insufficient data
  describe('GLOBAL_1: Insufficient data', () => {
    it('should block if not enough candles', async () => {
      const context = createContext({
        candles: createCandles(50), // < 100
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('GLOBAL_1');
      expect(result.reason).toContain('Insufficient data');
    });

    it('should allow if enough candles', async () => {
      const context = createContext({
        candles: createCandles(150), // > 100
      });

      const result = await service.checkBlockingRules(context);

      // Should pass GLOBAL_1 (may fail other checks)
      expect(result.blockId).not.toBe('GLOBAL_1');
    });
  });

  // TEST 3-4: GLOBAL_2 - EMA distance
  describe('GLOBAL_2: EMA distance', () => {
    it('should block if distance > 5.5%', async () => {
      const context = createContext({
        currentPrice: 106, // 6% from EMA
        ema50: 100,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('GLOBAL_2');
      expect(result.reason).toContain('EMA distance');
    });

    it('should allow if distance < 5.5%', async () => {
      const context = createContext({
        currentPrice: 105, // 5% from EMA
        ema50: 100,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blockId).not.toBe('GLOBAL_2');
    });
  });

  // TEST 5-6: GLOBAL_3 - Active position
  describe('GLOBAL_3: Active position limit', () => {
    it('should block if active position exists', async () => {
      const context = createContext({
        hasActivePosition: true,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('GLOBAL_3');
      expect(result.reason).toContain('Active position');
    });

    it('should allow if no active position', async () => {
      const context = createContext({
        hasActivePosition: false,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blockId).not.toBe('GLOBAL_3');
    });
  });

  // TEST 7-8: GLOBAL_4 - Cooldown period
  describe('GLOBAL_4: Cooldown period', () => {
    it('should block if within cooldown period', async () => {
      const context = createContext({
        lastSignalTime: Date.now() - 5000, // 5 sec ago (< 10 sec)
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('GLOBAL_4');
      expect(result.reason).toContain('Cooldown');
    });

    it('should allow if outside cooldown period', async () => {
      const context = createContext({
        lastSignalTime: Date.now() - 15000, // 15 sec ago (> 10 sec)
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blockId).not.toBe('GLOBAL_4');
    });
  });

  // TEST 9-10: Volume checks
  describe('Volume checks', () => {
    it('should block if low volume for TrendFollowing', async () => {
      // Create candles with low volume
      const candles = createCandles(150);
      candles[candles.length - 1].volume = 400; // Current volume = 400, avg = ~1000 → ratio 0.4 < 0.5

      const context = createContext({
        strategy: 'TrendFollowing',
        candles,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('VOL_TREND_1');
      expect(result.reason).toContain('Low volume');
    });

    it('should NOT block volume check if disabled', async () => {
      const configNoVolume = { ...defaultConfig, enableVolumeChecks: false };
      const serviceNoVolume = new BlockingRulesService(configNoVolume, logger);

      const candles = createCandles(150);
      candles[candles.length - 1].volume = 400; // Low volume

      const context = createContext({
        candles,
      });

      const result = await serviceNoVolume.checkBlockingRules(context);

      expect(result.blockId).not.toBe('VOL_TREND_1');
    });
  });

  // TEST 11-12: Wick checks
  describe('Wick checks', () => {
    it('should block LONG if large upper wick detected', async () => {
      const candles = createCandles(150);
      // Add candle with large upper wick
      candles[candles.length - 1] = {
        timestamp: Date.now(),
        open: 100,
        high: 110, // Large upper wick
        low: 99,
        close: 101,
        volume: 1000,
      };

      const context = createContext({
        direction: SignalDirection.LONG,
        candles,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('WICK_LONG');
      expect(result.reason).toContain('wick');
    });

    it('should NOT block wick check if disabled', async () => {
      const configNoWick = { ...defaultConfig, enableWickChecks: false };
      const serviceNoWick = new BlockingRulesService(configNoWick, logger);

      const candles = createCandles(150);
      candles[candles.length - 1] = {
        timestamp: Date.now(),
        open: 100,
        high: 110, // Large upper wick
        low: 99,
        close: 101,
        volume: 1000,
      };

      const context = createContext({
        direction: SignalDirection.LONG,
        candles,
      });

      const result = await serviceNoWick.checkBlockingRules(context);

      expect(result.blockId).not.toBe('WICK_LONG');
    });
  });

  // TEST 13-14: ATH protection
  describe('ATH protection', () => {
    it('should block LONG if too close to ATH', async () => {
      // Create candles where max high is 100
      const candles: Candle[] = [];
      for (let i = 0; i < 300; i++) {
        candles.push({
          timestamp: Date.now() - (300 - i) * 60000,
          open: 99,
          high: i === 150 ? 100 : 99.5, // High at index 150 = 100
          low: 98,
          close: 99,
          volume: 1000,
        });
      }

      const context = createContext({
        direction: SignalDirection.LONG,
        strategy: 'TrendFollowing',
        candles,
        currentPrice: 99.85, // Drop from 100: (100-99.85)/100 = 0.15% < 0.2%
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(true);
      expect(result.blockId).toBe('ATH_LONG');
      expect(result.reason).toContain('ATH');
    });

    it('should NOT apply ATH protection to SHORT signals', async () => {
      const candles = createCandles(300, 100);
      candles[candles.length - 100].high = 100.1;

      const context = createContext({
        direction: SignalDirection.SHORT, // SHORT signal
        strategy: 'TrendFollowing',
        candles,
        currentPrice: 100,
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blockId).not.toBe('ATH_LONG');
    });
  });

  // TEST 15: No blocks (happy path)
  describe('No blocks', () => {
    it('should allow signal if all checks pass', async () => {
      const context = createContext({
        candles: createCandles(150),
        currentPrice: 102, // 2% from EMA (< 5.5%)
        ema50: 100,
        hasActivePosition: false,
        lastSignalTime: Date.now() - 20000, // 20 sec ago
      });

      const result = await service.checkBlockingRules(context);

      expect(result.blocked).toBe(false);
      expect(result.blockId).toBeUndefined();
    });
  });
});
