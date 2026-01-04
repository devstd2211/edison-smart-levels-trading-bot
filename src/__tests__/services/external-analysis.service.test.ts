/**
 * Tests for ExternalAnalysisService
 * Week 13 Phase 3: Extracted from trading-orchestrator.service.ts
 */

import { ExternalAnalysisService } from '../../services/external-analysis.service';
import { SignalDirection } from '../../types';

describe('ExternalAnalysisService', () => {
  let service: ExternalAnalysisService;
  let mockLogger: any;
  let mockBybitService: any;
  let mockCandleProvider: any;
  let mockBTCAnalyzer: any;
  let mockFundingRateFilter: any;
  let mockFlatMarketDetector: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBybitService = {
      getCandles: jest.fn(),
    };

    mockCandleProvider = {
      getCandles: jest.fn(),
    };

    mockBTCAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        direction: 'UP',
        momentum: 0.75,
        isAligned: true,
        reason: 'Test',
      }),
      shouldConfirm: jest.fn().mockReturnValue(true),
    };

    mockFundingRateFilter = {
      checkSignal: jest.fn().mockResolvedValue({
        allowed: true,
        fundingRate: 0.0005,
        reason: 'Within acceptable range',
      }),
    };

    mockFlatMarketDetector = {
      detect: jest.fn().mockReturnValue({
        isFlat: false,
        confidence: 0.3,
      }),
    };

    service = new ExternalAnalysisService(
      mockBybitService as any,
      mockCandleProvider as any,
      mockBTCAnalyzer as any,
      mockFundingRateFilter as any,
      mockFlatMarketDetector as any,
      mockLogger as any,
      {
        symbol: 'BTCUSDT',
        timeframe: '15',
        enabled: true,
        candleLimit: 50,
        lookbackCandles: 10,
        useCorrelation: true,
        correlationPeriod: 50,
      },
      {
        enabled: true,
        blockLongThreshold: 0.005,
        blockShortThreshold: -0.005,
      },
      {
        enabled: true,
      },
    );
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ExternalAnalysisService);
    });
  });

  describe('analyzeBTC', () => {
    it('should analyze BTC for a signal direction', async () => {
      const mockCandles = Array(50)
        .fill(null)
        .map((_, i) => ({
          open: 40000 + i,
          high: 40001 + i,
          low: 39999 + i,
          close: 40000 + i * 0.5,
          volume: 10000,
          timestamp: Date.now() - (50 - i) * 900000,
        }));

      mockBybitService.getCandles.mockResolvedValue(mockCandles);
      mockCandleProvider.getCandles.mockResolvedValue(mockCandles);

      const analysis = await service.analyzeBTC(SignalDirection.LONG);

      expect(analysis).toBeDefined();
      expect(analysis?.direction).toBe('UP');
      expect(mockBybitService.getCandles).toHaveBeenCalledWith('BTCUSDT', '15', 50);
    });

    it('should return null if BTC analyzer not available', async () => {
      const serviceWithoutBTC = new ExternalAnalysisService(
        mockBybitService as any,
        mockCandleProvider as any,
        null,
        mockFundingRateFilter as any,
        mockFlatMarketDetector as any,
        mockLogger as any,
      );

      const analysis = await serviceWithoutBTC.analyzeBTC(SignalDirection.LONG);

      expect(analysis).toBeNull();
    });

    it('should handle BTC analysis errors gracefully', async () => {
      mockBybitService.getCandles.mockRejectedValue(new Error('API error'));

      const analysis = await service.analyzeBTC(SignalDirection.LONG);

      expect(analysis).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('BTC analysis failed'),
        expect.any(Object),
      );
    });
  });

  describe('checkBTCConfirmation', () => {
    it('should confirm signal when BTC is aligned', async () => {
      const mockCandles = Array(50)
        .fill(null)
        .map((_, i) => ({
          open: 40000,
          high: 40001,
          low: 39999,
          close: 40000,
          volume: 10000,
          timestamp: Date.now() - (50 - i) * 900000,
        }));

      mockBybitService.getCandles.mockResolvedValue(mockCandles);
      mockCandleProvider.getCandles.mockResolvedValue(mockCandles);

      const confirmed = await service.checkBTCConfirmation(SignalDirection.LONG);

      expect(confirmed).toBe(true);
    });

    it('should still pass signal when BTC is not aligned (soft voting mode)', async () => {
      mockBTCAnalyzer.shouldConfirm.mockReturnValue(false);

      const mockCandles = Array(50)
        .fill(null)
        .map((_, i) => ({
          open: 40000,
          high: 40001,
          low: 39999,
          close: 40000,
          volume: 10000,
          timestamp: Date.now() - (50 - i) * 900000,
        }));

      mockBybitService.getCandles.mockResolvedValue(mockCandles);
      mockCandleProvider.getCandles.mockResolvedValue(mockCandles);

      const confirmed = await service.checkBTCConfirmation(SignalDirection.LONG);

      // BTC confirmation now uses soft voting through AnalyzerRegistry instead of hard blocking
      expect(confirmed).toBe(true);
    });

    it('should pass if BTC analyzer not available', async () => {
      const serviceWithoutBTC = new ExternalAnalysisService(
        mockBybitService as any,
        mockCandleProvider as any,
        null,
        mockFundingRateFilter as any,
        mockFlatMarketDetector as any,
        mockLogger as any,
      );

      const confirmed = await serviceWithoutBTC.checkBTCConfirmation(SignalDirection.LONG);

      expect(confirmed).toBe(true);
    });
  });

  describe('checkFundingRate', () => {
    it('should allow signal when funding rate is acceptable', async () => {
      const allowed = await service.checkFundingRate(SignalDirection.LONG);

      expect(allowed).toBe(true);
      expect(mockFundingRateFilter.checkSignal).toHaveBeenCalledWith(SignalDirection.LONG);
    });

    it('should block signal when funding rate is too high', async () => {
      mockFundingRateFilter.checkSignal.mockResolvedValue({
        allowed: false,
        fundingRate: 0.01,
        reason: 'Funding rate too high',
      });

      const allowed = await service.checkFundingRate(SignalDirection.LONG);

      expect(allowed).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Funding Rate Filter BLOCKED'),
        expect.any(Object),
      );
    });

    it('should pass if funding rate filter not available', async () => {
      const serviceWithoutFunding = new ExternalAnalysisService(
        mockBybitService as any,
        mockCandleProvider as any,
        mockBTCAnalyzer as any,
        null,
        mockFlatMarketDetector as any,
        mockLogger as any,
      );

      const allowed = await serviceWithoutFunding.checkFundingRate(SignalDirection.LONG);

      expect(allowed).toBe(true);
    });

    it('should pass on error (fail open)', async () => {
      mockFundingRateFilter.checkSignal.mockRejectedValue(new Error('API error'));

      const allowed = await service.checkFundingRate(SignalDirection.LONG);

      expect(allowed).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Funding rate check failed'),
        expect.any(Object),
      );
    });
  });

  describe('detectFlatMarket', () => {
    it('should detect flat market when enabled', () => {
      const mockContext = {
        timestamp: Date.now(),
        trend: 'NEUTRAL',
        marketStructure: null,
        atrPercent: 1.5,
        emaDistance: 0.2,
        ema50: 100,
        atrModifier: 1.0,
        emaModifier: 1.0,
        trendModifier: 1.0,
        overallModifier: 1.0,
        isValidContext: true,
        blockedBy: [],
        warnings: [],
      } as any;

      const mockCandles = Array(50)
        .fill(null)
        .map((_, i) => ({
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000,
          timestamp: Date.now() - (50 - i) * 300000,
        }));

      const result = service.detectFlatMarket(mockCandles, mockContext, 99, 101);

      expect(result).toBeDefined();
      expect(result?.isFlat).toBe(false);
      expect(result?.confidence).toBe(0.3);
    });

    it('should return null if flat market detector not available', () => {
      const serviceWithoutFlat = new ExternalAnalysisService(
        mockBybitService as any,
        mockCandleProvider as any,
        mockBTCAnalyzer as any,
        mockFundingRateFilter as any,
        null,
        mockLogger as any,
      );

      const mockContext = {} as any;
      const mockCandles: any[] = [];

      const result = serviceWithoutFlat.detectFlatMarket(mockCandles, mockContext, 100, 100);

      expect(result).toBeNull();
    });

    it('should handle detection errors gracefully', () => {
      mockFlatMarketDetector.detect.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      const mockContext = {
        timestamp: Date.now(),
        trend: 'NEUTRAL',
      } as any;

      const result = service.detectFlatMarket([], mockContext, 100, 100);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Flat market detection failed'),
        expect.any(Object),
      );
    });
  });
});
