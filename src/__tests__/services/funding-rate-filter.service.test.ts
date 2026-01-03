/**
 * Funding Rate Filter Service Tests
 */

import { FundingRateFilterService, FundingRateData } from '../../services/funding-rate-filter.service';
import { LoggerService, LogLevel, SignalDirection, FundingRateFilterConfig } from '../../types';

describe('FundingRateFilterService', () => {
  let logger: LoggerService;
  let config: FundingRateFilterConfig;
  let mockGetFundingRate: jest.Mock<Promise<FundingRateData>>;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = {
      enabled: true,
      blockLongThreshold: 0.0005, // 0.05%
      blockShortThreshold: -0.0005, // -0.05%
      cacheTimeMs: 3600000, // 1 hour
    };
    mockGetFundingRate = jest.fn();
  });

  describe('checkSignal', () => {
    it('should allow LONG when funding rate is below threshold', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: 0.0001, // 0.01% (below 0.05%)
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.LONG);

      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.0001);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);
    });

    it('should block LONG when funding rate exceeds threshold', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: 0.001, // 0.1% (above 0.05%)
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.LONG);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Funding rate too high');
      expect(result.fundingRate).toBe(0.001);
    });

    it('should allow SHORT when funding rate is above threshold', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: -0.0001, // -0.01% (above -0.05%)
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.SHORT);

      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(-0.0001);
    });

    it('should block SHORT when funding rate is below threshold', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: -0.001, // -0.1% (below -0.05%)
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.SHORT);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Funding rate too low');
      expect(result.fundingRate).toBe(-0.001);
    });

    it('should always allow HOLD signals', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: 0.01, // Extreme funding rate
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.HOLD);

      expect(result.allowed).toBe(true);
      expect(mockGetFundingRate).not.toHaveBeenCalled();
    });

    it('should allow signals when filter is disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const filter = new FundingRateFilterService(disabledConfig, mockGetFundingRate, logger);

      const result = await filter.checkSignal(SignalDirection.LONG);

      expect(result.allowed).toBe(true);
      expect(mockGetFundingRate).not.toHaveBeenCalled();
    });

    it('should allow signal on API error (fail-safe)', async () => {
      mockGetFundingRate.mockRejectedValue(new Error('API error'));

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.LONG);

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Filter error');
    });
  });

  describe('caching', () => {
    it('should cache funding rate data', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);

      // First call - should fetch from API
      await filter.checkSignal(SignalDirection.LONG);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await filter.checkSignal(SignalDirection.LONG);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1); // Still 1 (cached)
    });

    it('should refetch after cache expires', async () => {
      const shortCacheConfig = { ...config, cacheTimeMs: 100 }; // 100ms cache
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = new FundingRateFilterService(shortCacheConfig, mockGetFundingRate, logger);

      // First call
      await filter.checkSignal(SignalDirection.LONG);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second call - should refetch
      await filter.checkSignal(SignalDirection.LONG);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);

      // Fetch data
      await filter.checkSignal(SignalDirection.LONG);
      expect(filter.getCachedFundingRate()).not.toBeNull();

      // Clear cache
      filter.clearCache();
      expect(filter.getCachedFundingRate()).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle zero funding rate', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: 0,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);

      const longResult = await filter.checkSignal(SignalDirection.LONG);
      expect(longResult.allowed).toBe(true);

      const shortResult = await filter.checkSignal(SignalDirection.SHORT);
      expect(shortResult.allowed).toBe(true);
    });

    it('should handle funding rate exactly at threshold', async () => {
      mockGetFundingRate.mockResolvedValue({
        fundingRate: 0.0005, // Exactly at threshold
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      });

      const filter = new FundingRateFilterService(config, mockGetFundingRate, logger);
      const result = await filter.checkSignal(SignalDirection.LONG);

      // Should be allowed (threshold is >, not >=)
      expect(result.allowed).toBe(true);
    });
  });
});
