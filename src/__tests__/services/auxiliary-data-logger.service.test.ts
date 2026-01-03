/**
 * Tests for AuxiliaryDataLogger Service
 */

import { AuxiliaryDataLogger } from '../../services/auxiliary-data-logger.service';
import { BybitService } from '../../services/bybit';
import { CandleProvider } from '../../providers/candle.provider';
import { LoggerService, LogLevel, Config, SignalDirection, Candle, TimeframeRole } from '../../types';

const createTestConfig = (orderBookEnabled: boolean, volumeEnabled: boolean): Config => ({
  exchange: { symbol: 'APTUSDT', testnet: true, apiKey: '', apiSecret: '' },
  riskManagement: { stopLossPercent: 2, takeProfits: [], maxPositions: 1, leverage: 10, positionSizePercent: 10 },
  timeframes: { entry: '5m', primary: '15m', trend1: '1h', trend2: '4h', context: '1d' },
  indicators: { rsi: { period: 14, overbought: 70, oversold: 30 }, ema: { fastPeriod: 9, slowPeriod: 21 }, atr: { period: 14, multiplier: 1.5 }, zigzag: { depth: 5, deviation: 0.5 } },
  strategy: { name: 'test', minConfidence: 70 },
  orderBook: orderBookEnabled ? { enabled: true, depth: 50, wallThreshold: 0.1, imbalanceThreshold: 1.5, updateIntervalMs: 5000, useWebSocket: false } : undefined,
  volume: volumeEnabled ? { enabled: true, priceBuckets: 20, hvnThreshold: 1.5, lvnThreshold: 0.5 } : undefined,
  logging: { level: 'ERROR', console: false, file: true },
} as any);

const createMockCandle = (price: number, timestamp: number): Candle => ({
  timestamp, open: price, high: price * 1.01, low: price * 0.99, close: price, volume: 10000,
});

describe('AuxiliaryDataLogger', () => {
  let logger: LoggerService;
  let mockBybitService: jest.Mocked<BybitService>;
  let mockCandleProvider: jest.Mocked<CandleProvider>;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    mockBybitService = { getOrderBook: jest.fn() } as any;
    mockCandleProvider = { getCandles: jest.fn() } as any;
  });

  describe('logAnalysis() - both disabled', () => {
    it('should do nothing when both analyzers disabled', async () => {
      const config = createTestConfig(false, false);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      await auxLogger.logAnalysis(100, SignalDirection.LONG);

      expect(mockBybitService.getOrderBook).not.toHaveBeenCalled();
      expect(mockCandleProvider.getCandles).not.toHaveBeenCalled();
    });
  });

  describe('logAnalysis() - orderBook only', () => {
    it('should log orderBook when enabled', async () => {
      const config = createTestConfig(true, false);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      mockBybitService.getOrderBook.mockResolvedValue({
        bids: [{ price: 100, size: 1000 }, { price: 99, size: 1500 }],
        asks: [{ price: 101, size: 1200 }, { price: 102, size: 1800 }],
        timestamp: Date.now(),
      });

      await auxLogger.logAnalysis(100, SignalDirection.LONG);

      expect(mockBybitService.getOrderBook).toHaveBeenCalledWith('APTUSDT', 50);
      expect(mockCandleProvider.getCandles).not.toHaveBeenCalled();
    });
  });

  describe('logAnalysis() - volume only', () => {
    it('should log volume when enabled', async () => {
      const config = createTestConfig(false, true);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      const candles = Array.from({ length: 50 }, (_, i) => createMockCandle(100 + i, Date.now() - i * 60000));
      mockCandleProvider.getCandles.mockResolvedValue(candles);

      await auxLogger.logAnalysis(100, SignalDirection.LONG);

      expect(mockCandleProvider.getCandles).toHaveBeenCalledWith(TimeframeRole.PRIMARY);
      expect(mockBybitService.getOrderBook).not.toHaveBeenCalled();
    });
  });

  describe('logAnalysis() - both enabled', () => {
    it('should log both orderBook and volume', async () => {
      const config = createTestConfig(true, true);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      mockBybitService.getOrderBook.mockResolvedValue({
        bids: [{ price: 100, size: 1000 }],
        asks: [{ price: 101, size: 1200 }],
        timestamp: Date.now(),
      });

      const candles = [createMockCandle(100, Date.now())];
      mockCandleProvider.getCandles.mockResolvedValue(candles);

      await auxLogger.logAnalysis(100, SignalDirection.LONG);

      expect(mockBybitService.getOrderBook).toHaveBeenCalled();
      expect(mockCandleProvider.getCandles).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should not throw when orderBook fetch fails', async () => {
      const config = createTestConfig(true, false);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      mockBybitService.getOrderBook.mockRejectedValue(new Error('Network error'));

      await expect(auxLogger.logAnalysis(100, SignalDirection.LONG)).resolves.not.toThrow();
    });

    it('should not throw when volume fetch fails', async () => {
      const config = createTestConfig(false, true);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      mockCandleProvider.getCandles.mockRejectedValue(new Error('Network error'));

      await expect(auxLogger.logAnalysis(100, SignalDirection.LONG)).resolves.not.toThrow();
    });

    it('should not throw when candles empty for volume', async () => {
      const config = createTestConfig(false, true);
      const auxLogger = new AuxiliaryDataLogger(mockBybitService, mockCandleProvider, config, logger);

      mockCandleProvider.getCandles.mockResolvedValue([]);

      await expect(auxLogger.logAnalysis(100, SignalDirection.LONG)).resolves.not.toThrow();
    });
  });
});
