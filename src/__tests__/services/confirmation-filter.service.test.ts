/**
 * Tests for ConfirmationFilter Service
 *
 * Tests BTC confirmation logic:
 * - confirm() - BTC enabled/disabled, aligned/not aligned
 * - analyzeBTC() - fetching candles, correlation
 */

import { ConfirmationFilter } from '../../services/confirmation-filter.service';
import { BybitService } from '../../services/bybit';
import { BTCAnalyzer, BTCAnalysis, BTCDirection } from '../../analyzers/btc.analyzer';
import {
  LoggerService,
  LogLevel,
  Config,
  SignalDirection,
  Candle,
} from '../../types';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

const createTestConfig = (btcEnabled: boolean = true, useCorrelation: boolean = false): Config => ({
  exchange: {
    symbol: 'APTUSDT',
    testnet: true,
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  } as any,
  riskManagement: {
    stopLossPercent: 2.0,
    takeProfits: [{ level: 1, percent: 1.0, sizePercent: 100 }],
    maxPositions: 1,
    leverage: 10,
    positionSizePercent: 10,
  } as any,
  timeframes: {
    entry: '5m',
    primary: '15m',
    trend1: '1h',
    trend2: '4h',
    context: '1d',
  } as any,
  indicators: {
    rsi: { period: 14, overbought: 70, oversold: 30 },
    ema: { fastPeriod: 9, slowPeriod: 21 },
    atr: { period: 14, multiplier: 1.5 },
    zigzag: { depth: 5, deviation: 0.5 },
  } as any,
  btcConfirmation: {
    enabled: btcEnabled,
    symbol: 'BTCUSDT',
    timeframe: '15m',
    lookbackCandles: 10,
    candleLimit: 50,
    useCorrelation,
    correlationPeriod: 50,
    correlationThresholds: {
      strict: 0.7,
      moderate: 0.5,
      weak: 0.3,
    },
    requireAlignment: true,
    minimumMomentum: 0.3,
    movesMaxWeight: 0.3,
    volumeMaxWeight: 0.2,
    movesDivisor: 10,
    volumeDivisor: 5,
  } as any,
  logging: { level: 'ERROR', console: false, file: true } as any,
} as any);

const createMockCandle = (price: number, timestamp: number): Candle => ({
  timestamp,
  open: price,
  high: price * 1.01,
  low: price * 0.99,
  close: price,
  volume: 10000,
});

const createMockBTCAnalysis = (
  direction: BTCDirection,
  isAligned: boolean,
  momentum: number = 0.5,
): BTCAnalysis => ({
  direction,
  momentum,
  priceChange: direction === BTCDirection.UP ? 2.5 : -2.5,
  consecutiveMoves: 5,
  volumeRatio: 1.2,
  isAligned,
  reason: isAligned ? 'BTC aligned with signal' : 'BTC not aligned with signal',
});

// ============================================================================
// TESTS
// ============================================================================

describe('ConfirmationFilter', () => {
  let filter: ConfirmationFilter;
  let mockBybitService: jest.Mocked<BybitService>;
  let config: Config;
  let logger: LoggerService;

  beforeEach(() => {
    config = createTestConfig(true, false);
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    mockBybitService = {
      getCandles: jest.fn(),
    } as any;
  });

  // ==========================================================================
  // GROUP 1: confirm() - BTC Disabled
  // ==========================================================================

  describe('confirm() - BTC disabled', () => {
    it('should return shouldConfirm=true when BTC confirmation disabled', async () => {
      // Arrange
      config = createTestConfig(false); // BTC disabled
      filter = new ConfirmationFilter(mockBybitService, config, logger);

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(true);
      expect(result.reason).toBe('BTC confirmation disabled');
      expect(result.btcAnalysis).toBeUndefined();
      expect(mockBybitService.getCandles).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 2: confirm() - BTC Enabled, Aligned
  // ==========================================================================

  describe('confirm() - BTC enabled, aligned', () => {
    beforeEach(() => {
      config = createTestConfig(true, false);
      filter = new ConfirmationFilter(mockBybitService, config, logger);
    });

    it('should return shouldConfirm=true when BTC aligned with LONG signal', async () => {
      // Arrange
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 + i * 100, Date.now() - i * 60000),
      );
      mockBybitService.getCandles.mockResolvedValue(btcCandles);

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(true);
      expect(result.btcAnalysis).toBeDefined();
      expect(result.btcAnalysis!.isAligned).toBe(true);
      expect(mockBybitService.getCandles).toHaveBeenCalledWith('BTCUSDT', '15m', 50);
    });

    it('should return shouldConfirm=true when BTC aligned with SHORT signal', async () => {
      // Arrange
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 - i * 100, Date.now() - i * 60000),
      );
      mockBybitService.getCandles.mockResolvedValue(btcCandles);

      // Act
      const result = await filter.confirm(SignalDirection.SHORT, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(true);
      expect(result.btcAnalysis).toBeDefined();
      expect(result.btcAnalysis!.isAligned).toBe(true);
    });
  });

  // ==========================================================================
  // GROUP 3: confirm() - BTC Enabled, Not Aligned
  // ==========================================================================

  describe('confirm() - BTC enabled, not aligned', () => {
    beforeEach(() => {
      config = createTestConfig(true, false);
      filter = new ConfirmationFilter(mockBybitService, config, logger);
    });

    it('should return shouldConfirm=false when BTC not aligned (LONG signal, BTC DOWN)', async () => {
      // Arrange - BTC going DOWN
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 - i * 100, Date.now() - i * 60000),
      );
      mockBybitService.getCandles.mockResolvedValue(btcCandles);

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(false);
      expect(result.btcAnalysis).toBeDefined();
      expect(result.btcAnalysis!.isAligned).toBe(false);
      expect(result.reason).toContain('NOT aligned');
    });

    it('should return shouldConfirm=false when BTC not aligned (SHORT signal, BTC UP)', async () => {
      // Arrange - BTC going UP
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 + i * 100, Date.now() - i * 60000),
      );
      mockBybitService.getCandles.mockResolvedValue(btcCandles);

      // Act
      const result = await filter.confirm(SignalDirection.SHORT, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(false);
      expect(result.btcAnalysis!.isAligned).toBe(false);
    });
  });

  // ==========================================================================
  // GROUP 4: confirm() - BTC Candles Fetch Fails (Fail-Open)
  // ==========================================================================

  describe('confirm() - BTC fetch fails (fail-open)', () => {
    beforeEach(() => {
      config = createTestConfig(true, false);
      filter = new ConfirmationFilter(mockBybitService, config, logger);
    });

    it('should return shouldConfirm=true (fail-open) when BTC candles fetch fails', async () => {
      // Arrange
      mockBybitService.getCandles.mockResolvedValue([]);

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(true);
      expect(result.reason).toContain('fail-open');
    });

    it('should return shouldConfirm=true (fail-open) when BTC fetch throws error', async () => {
      // Arrange
      mockBybitService.getCandles.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(true);
      expect(result.reason).toContain('fail-open');
    });
  });

  // ==========================================================================
  // GROUP 5: confirm() - With Correlation
  // ==========================================================================

  describe('confirm() - with correlation', () => {
    beforeEach(() => {
      config = createTestConfig(true, true); // useCorrelation = true
      filter = new ConfirmationFilter(mockBybitService, config, logger);
    });

    it('should fetch altcoin candles when useCorrelation=true', async () => {
      // Arrange
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 + i * 100, Date.now() - i * 60000),
      );
      const altCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(10 + i * 0.1, Date.now() - i * 60000),
      );

      mockBybitService.getCandles
        .mockResolvedValueOnce(btcCandles) // BTC candles
        .mockResolvedValueOnce(altCandles); // ALT candles

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(mockBybitService.getCandles).toHaveBeenCalledTimes(2);
      expect(mockBybitService.getCandles).toHaveBeenCalledWith('BTCUSDT', '15m', 50);
      expect(mockBybitService.getCandles).toHaveBeenCalledWith('APTUSDT', '15m', 50);
      expect(result.btcAnalysis).toBeDefined();
    });

    it('should continue without correlation if altcoin candles fetch fails', async () => {
      // Arrange
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 + i * 100, Date.now() - i * 60000),
      );

      mockBybitService.getCandles
        .mockResolvedValueOnce(btcCandles) // BTC candles
        .mockRejectedValueOnce(new Error('ALT fetch failed')); // ALT candles fail

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(result.shouldConfirm).toBe(true);
      expect(result.btcAnalysis).toBeDefined();
      // Should still work without correlation
    });
  });

  // ==========================================================================
  // GROUP 6: confirm() - Without Correlation
  // ==========================================================================

  describe('confirm() - without correlation', () => {
    beforeEach(() => {
      config = createTestConfig(true, false); // useCorrelation = false
      filter = new ConfirmationFilter(mockBybitService, config, logger);
    });

    it('should NOT fetch altcoin candles when useCorrelation=false', async () => {
      // Arrange
      const btcCandles = Array.from({ length: 50 }, (_, i) =>
        createMockCandle(50000 + i * 100, Date.now() - i * 60000),
      );
      mockBybitService.getCandles.mockResolvedValue(btcCandles);

      // Act
      const result = await filter.confirm(SignalDirection.LONG, 'APTUSDT');

      // Assert
      expect(mockBybitService.getCandles).toHaveBeenCalledTimes(1);
      expect(mockBybitService.getCandles).toHaveBeenCalledWith('BTCUSDT', '15m', 50);
    });
  });
});
