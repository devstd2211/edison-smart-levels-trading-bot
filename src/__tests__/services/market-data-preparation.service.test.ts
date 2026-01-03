/**
 * Tests for MarketDataPreparationService
 * Week 13: Extracted from trading-orchestrator.service.ts
 */

import { MarketDataPreparationService } from '../../services/market-data-preparation.service';
import { TrendBias } from '../../types';

describe('MarketDataPreparationService', () => {
  let service: MarketDataPreparationService;
  let mockLogger: any;
  let mockCandleProvider: any;
  let mockTimeframeProvider: any;
  let mockBybitService: any;
  let mockConfig: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCandleProvider = {
      getCandles: jest.fn(),
    };

    mockTimeframeProvider = {};
    mockBybitService = {
      getServerTime: jest.fn(),
    };

    mockConfig = {
      indicators: {},
    };

    const mockRSIAnalyzer = {
      calculateAll: jest.fn().mockResolvedValue({
        primary: 50,
        trend1: 45,
      }),
    };

    const mockEMAAnalyzer = {
      calculateAll: jest.fn().mockResolvedValue({
        primary: { fast: 100, slow: 105 },
        trend1: { fast: 98, slow: 103 },
      }),
    };

    const mockATRIndicator = {
      calculate: jest.fn().mockReturnValue(150),
    };

    const mockZigZagIndicator = {
      findSwingPoints: jest.fn().mockReturnValue({
        swingHighs: [],
        swingLows: [],
      }),
    };

    const mockLiquidityDetector = {
      analyze: jest.fn().mockReturnValue(null),
    };

    const mockDivergenceDetector = {
      detect: jest.fn().mockReturnValue(null),
    };

    const mockBreakoutPredictor = {
      predict: jest.fn().mockReturnValue({
        direction: 'UP',
        confidence: 65,
        factors: { emaTrend: 0.5, rsiMomentum: 0.4, volumeStrength: 0.6 },
        reason: 'Test',
      }),
    };

    service = new MarketDataPreparationService(
      mockConfig,
      mockCandleProvider as any,
      mockTimeframeProvider as any,
      mockBybitService as any,
      mockLogger as any,
      mockRSIAnalyzer as any,
      mockEMAAnalyzer as any,
      mockATRIndicator as any,
      mockZigZagIndicator as any,
      mockLiquidityDetector as any,
      mockDivergenceDetector as any,
      mockBreakoutPredictor as any,
    );
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(MarketDataPreparationService);
    });
  });

  describe('setCurrentOrderbook', () => {
    it('should set orderbook without errors', () => {
      const mockOrderbook = {
        bids: [[100, 10]],
        asks: [[101, 10]],
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        updateId: 1,
      } as any;

      service.setCurrentOrderbook(mockOrderbook);
      expect(service).toBeDefined();
    });
  });

  describe('setCurrentContext', () => {
    it('should set context without errors', () => {
      const mockContext = {
        timestamp: Date.now(),
        trend: TrendBias.BULLISH,
        marketStructure: null,
        atrPercent: 2.5,
        emaDistance: 0.5,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      };
      service.setCurrentContext(mockContext);
      expect(service).toBeDefined();
    });
  });

  describe('syncTimeWithExchange', () => {
    it('should sync time with exchange', async () => {
      mockBybitService.getServerTime.mockResolvedValue(Date.now() - 1000);
      await service.syncTimeWithExchange();
      expect(mockBybitService.getServerTime).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      mockBybitService.getServerTime.mockRejectedValue(new Error('Connection error'));
      await service.syncTimeWithExchange();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
