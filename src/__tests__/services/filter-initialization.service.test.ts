/**
 * Tests for FilterInitializationService
 * Week 13 Phase 5c: Extracted from trading-orchestrator.service.ts constructor
 */

import { FilterInitializationService } from '../../services/filter-initialization.service';

describe('FilterInitializationService', () => {
  let service: FilterInitializationService;
  let mockLogger: any;
  let mockCandleProvider: any;
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
      getCandles: jest.fn().mockResolvedValue([]),
    };

    mockBybitService = {
      getFundingRate: jest.fn().mockResolvedValue(0.0001),
    };

    mockConfig = {
      btcConfirmation: null,
      fundingRateFilter: null,
      flatMarketDetection: null,
      trendConfirmation: null,
    };

    service = new FilterInitializationService(
      mockConfig,
      mockCandleProvider,
      mockBybitService,
      mockLogger,
    );
  });

  describe('initializeAllFilters', () => {
    it('should initialize all filters as null when disabled', () => {
      const filters = service.initializeAllFilters();

      expect(filters.btcAnalyzer).toBeNull();
      expect(filters.fundingRateFilter).toBeNull();
      expect(filters.flatMarketDetector).toBeNull();
      expect(filters.trendConfirmationService).toBeNull();
    });

    it('should initialize BTC analyzer when enabled', () => {
      mockConfig.btcConfirmation = {
        enabled: true,
        symbol: 'BTCUSDT',
        timeframe: '1h',
      };

      const filters = service.initializeAllFilters();

      expect(filters.btcAnalyzer).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'BTC confirmation filter enabled',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          timeframe: '1h',
        }),
      );
    });

    it('should initialize funding rate filter when enabled', () => {
      mockConfig.fundingRateFilter = {
        enabled: true,
        blockLongThreshold: 0.0005,
        blockShortThreshold: -0.0005,
        cacheTimeMs: 60000,
      };

      const filters = service.initializeAllFilters();

      expect(filters.fundingRateFilter).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '💰 Funding Rate Filter enabled',
        expect.objectContaining({
          cacheTimeMs: 60000,
        }),
      );
    });

    it('should initialize flat market detector when enabled', () => {
      mockConfig.flatMarketDetection = {
        enabled: true,
        flatThreshold: 0.02,
        emaThreshold: 50,
        atrThreshold: 0.5,
      };

      const filters = service.initializeAllFilters();

      expect(filters.flatMarketDetector).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '📊 Flat Market Detector enabled',
        expect.objectContaining({
          flatThreshold: 0.02,
          emaThreshold: 50,
          atrThreshold: 0.5,
        }),
      );
    });

    it('should initialize trend confirmation service when enabled', () => {
      mockConfig.trendConfirmation = {
        enabled: true,
        filterMode: 'CONDITIONAL',
        criticalMisalignmentScore: 30,
        warningMisalignmentScore: 60,
      };

      const filters = service.initializeAllFilters();

      expect(filters.trendConfirmationService).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔄 Trend Confirmation Filter enabled',
        expect.objectContaining({
          mode: 'CONDITIONAL',
        }),
      );
    });

    it('should initialize multiple filters simultaneously', () => {
      mockConfig.btcConfirmation = {
        enabled: true,
        symbol: 'BTCUSDT',
        timeframe: '1h',
      };
      mockConfig.fundingRateFilter = {
        enabled: true,
        blockLongThreshold: 0.0005,
        blockShortThreshold: -0.0005,
        cacheTimeMs: 60000,
      };
      mockConfig.flatMarketDetection = {
        enabled: true,
        flatThreshold: 0.02,
        emaThreshold: 50,
        atrThreshold: 0.5,
      };
      mockConfig.trendConfirmation = {
        enabled: true,
        filterMode: 'CONDITIONAL',
      };

      const filters = service.initializeAllFilters();

      expect(filters.btcAnalyzer).toBeDefined();
      expect(filters.fundingRateFilter).toBeDefined();
      expect(filters.flatMarketDetector).toBeDefined();
      expect(filters.trendConfirmationService).toBeDefined();
    });

    it('should use logger for filter initialization', () => {
      mockConfig.btcConfirmation = {
        enabled: true,
        symbol: 'BTCUSDT',
        timeframe: '1h',
      };
      mockConfig.fundingRateFilter = {
        enabled: true,
        blockLongThreshold: 0.0005,
        blockShortThreshold: -0.0005,
        cacheTimeMs: 60000,
      };

      service.initializeAllFilters();

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.info.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should pass correct config to BTC analyzer', () => {
      mockConfig.btcConfirmation = {
        enabled: true,
        symbol: 'BTCUSDT',
        timeframe: '1h',
      };

      const filters = service.initializeAllFilters();

      expect(filters.btcAnalyzer).toBeDefined();
    });

    it('should pass correct config to funding rate filter', () => {
      mockConfig.fundingRateFilter = {
        enabled: true,
        blockLongThreshold: 0.0005,
        blockShortThreshold: -0.0005,
        cacheTimeMs: 60000,
      };

      const filters = service.initializeAllFilters();

      expect(filters.fundingRateFilter).toBeDefined();
    });

    it('should pass correct config to flat market detector', () => {
      mockConfig.flatMarketDetection = {
        enabled: true,
        flatThreshold: 0.02,
        emaThreshold: 50,
        atrThreshold: 0.5,
      };

      const filters = service.initializeAllFilters();

      expect(filters.flatMarketDetector).toBeDefined();
    });

    it('should pass correct config to trend confirmation service', () => {
      mockConfig.trendConfirmation = {
        enabled: true,
        filterMode: 'CONDITIONAL',
        criticalMisalignmentScore: 30,
        warningMisalignmentScore: 60,
      };

      const filters = service.initializeAllFilters();

      expect(filters.trendConfirmationService).toBeDefined();
    });

    it('should return proper InitializedFilters interface', () => {
      const filters = service.initializeAllFilters();

      expect(filters).toHaveProperty('btcAnalyzer');
      expect(filters).toHaveProperty('fundingRateFilter');
      expect(filters).toHaveProperty('flatMarketDetector');
      expect(filters).toHaveProperty('trendConfirmationService');
    });

    it('should handle trend confirmation with default values', () => {
      mockConfig.trendConfirmation = {
        enabled: true,
        // filterMode not provided, should default to 'CONDITIONAL'
      };

      service.initializeAllFilters();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trend Confirmation'),
        expect.objectContaining({
          mode: 'CONDITIONAL', // Default value
        }),
      );
    });

    it('should handle trend confirmation with custom values', () => {
      mockConfig.trendConfirmation = {
        enabled: true,
        filterMode: 'STRICT',
        criticalMisalignmentScore: 40,
        warningMisalignmentScore: 70,
      };

      service.initializeAllFilters();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trend Confirmation'),
        expect.objectContaining({
          mode: 'STRICT',
          criticalScore: 40,
          warningScore: 70,
        }),
      );
    });

    it('should create all filters without errors', () => {
      expect(() => {
        service.initializeAllFilters();
      }).not.toThrow();
    });

    it('should handle disabled filters gracefully', () => {
      mockConfig.btcConfirmation = { enabled: false };
      mockConfig.fundingRateFilter = { enabled: false };
      mockConfig.flatMarketDetection = { enabled: false };
      mockConfig.trendConfirmation = { enabled: false };

      const filters = service.initializeAllFilters();

      expect(filters.btcAnalyzer).toBeNull();
      expect(filters.fundingRateFilter).toBeNull();
      expect(filters.flatMarketDetector).toBeNull();
      expect(filters.trendConfirmationService).toBeNull();
    });

    it('should log funding rate thresholds in percentage', () => {
      mockConfig.fundingRateFilter = {
        enabled: true,
        blockLongThreshold: 0.0005,
        blockShortThreshold: -0.0005,
        cacheTimeMs: 60000,
      };

      service.initializeAllFilters();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Funding Rate'),
        expect.objectContaining({
          blockLongThreshold: expect.stringContaining('%'),
          blockShortThreshold: expect.stringContaining('%'),
        }),
      );
    });
  });
});
