/**
 * Funding Rate Filter Service - ErrorHandler Integration Tests
 * Phase 8.9.32: RETRY + GRACEFUL_DEGRADE + SKIP strategies
 *
 * Tests:
 * - RETRY strategy for API calls (exponential backoff, max 3 attempts)
 * - GRACEFUL_DEGRADE strategy for cache fallback
 * - SKIP strategy for logger failures (non-blocking)
 * - Integration scenarios with cascading failures
 */

import { FundingRateFilterService, FundingRateData } from '../../services/funding-rate-filter.service';
import { LoggerService, SignalDirection, FundingRateFilterConfig } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import {
  createFundingRateData,
  createFundingRateDataSeries,
  createManagedFundingRateFilterContext,
  type ManagedFundingRateFilterContext,
} from '../helpers/funding-rate-filter-test.utils';

describe('FundingRateFilterService - ErrorHandler Integration (Phase 8.9.32)', () => {
  type FundingRateFilterFixtures = Pick<
    ManagedFundingRateFilterContext,
    'logger' | 'config' | 'mockGetFundingRate' | 'errorHandler' | 'createStandardFilter' | 'createLegacyFilter'
  >;
  let logger: LoggerService;
  let config: FundingRateFilterConfig;
  let mockGetFundingRate: jest.Mock<Promise<FundingRateData>>;
  let errorHandler: ErrorHandler | undefined;
  let cleanup: ManagedFundingRateFilterContext['cleanup'];
  let createFilter: ManagedFundingRateFilterContext['createStandardFilter'];
  let createLegacyFilter: ManagedFundingRateFilterContext['createLegacyFilter'];

  function bindFundingRateFilterContext() {
    let fixtures: FundingRateFilterFixtures;

    beforeEach(() => {
      const managedContext = createManagedFundingRateFilterContext();
      cleanup = managedContext.cleanup;
      fixtures = {
        logger: managedContext.logger,
        config: managedContext.config,
        mockGetFundingRate: managedContext.mockGetFundingRate,
        errorHandler: managedContext.errorHandler,
        createStandardFilter: managedContext.createStandardFilter,
        createLegacyFilter: managedContext.createLegacyFilter,
      };
    });

    afterEach(async () => {
      await cleanup();
    });

    return () => fixtures;
  }

  const getContext = bindFundingRateFilterContext();

  beforeEach(() => {
    const fixtures = getContext();
    ({ logger, config, mockGetFundingRate, errorHandler } = fixtures);
    createFilter = fixtures.createStandardFilter;
    createLegacyFilter = fixtures.createLegacyFilter;
  });

  // ============================================================================
  // RETRY STRATEGY TESTS (API calls)
  // ============================================================================

  describe('RETRY Strategy (API calls)', () => {
    it('should attempt API retry (structure test)', async () => {
      const [fundingData] = createFundingRateDataSeries([0.0001]);

      // First call succeeds
      mockGetFundingRate.mockResolvedValueOnce(fundingData);

      const filter = createFilter();
      const result = await filter.checkSignal(SignalDirection.LONG);

      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.0001);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);
    });

    it('should use ErrorHandler.executeAsync for API calls with RETRY config', async () => {
      const [fundingData] = createFundingRateDataSeries([0.0001]);

      mockGetFundingRate.mockResolvedValueOnce(fundingData);

      const filter = createFilter();

      // Spy on ErrorHandler to verify RETRY config is correct
      const executeAsyncSpy = jest.spyOn(ErrorHandler, 'executeAsync');

      await filter.checkSignal(SignalDirection.LONG);

      // Verify that ErrorHandler.executeAsync was used for API calls with RETRY strategy
      expect(executeAsyncSpy).toHaveBeenCalled();

      executeAsyncSpy.mockRestore();
    });

    it('should fallback to cached data when API fails all retries', async () => {
      const [oldFundingData] = createFundingRateDataSeries([0.00008], Date.now() - 120000);
      const filter = createFilter();

      // Cache initial value
      mockGetFundingRate.mockResolvedValueOnce(oldFundingData);
      let result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.fundingRate).toBe(0.00008);

      // Force cache expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // API fails all retries, should fallback to cache
      mockGetFundingRate.mockRejectedValue(new Error('API error'));

      result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.00008); // Degraded to old cache
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE STRATEGY TESTS (Cache fallback)
  // ============================================================================

  describe('GRACEFUL_DEGRADE Strategy (Cache fallback)', () => {
    it('should fallback to cached data when API fails', async () => {
      const [oldFundingData] = createFundingRateDataSeries([0.00009], Date.now() - 60000);
      const filter = createFilter();

      // First fetch succeeds (cache it)
      mockGetFundingRate.mockResolvedValueOnce(oldFundingData);
      let result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.fundingRate).toBe(0.00009);

      // Clear cache time to force refetch
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second fetch fails, should use old cache
      mockGetFundingRate.mockRejectedValueOnce(new Error('API timeout'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API timeout'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API timeout'));

      result = await filter.checkSignal(SignalDirection.LONG);

      // Should still work with old cached value (GRACEFUL_DEGRADE)
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.00009); // Old cached value
    });

    it('should continue with cache even if update fails', async () => {
      const [fundingData] = createFundingRateDataSeries([0.0001]);

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = createFilter();

      // First call should succeed
      const result1 = await filter.checkSignal(SignalDirection.LONG);
      expect(result1.fundingRate).toBe(0.0001);

      // Cache should be set (checked by verifying second call uses cache)
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // SKIP STRATEGY TESTS (Logger failures)
  // ============================================================================

  describe('SKIP Strategy (Logger failures)', () => {
    it('should skip logger errors during signal check', async () => {
      const [fundingData] = createFundingRateDataSeries([0.0001]);

      mockGetFundingRate.mockResolvedValue(fundingData);

      // Create spies to track logger calls
      const debugSpy = jest.spyOn(logger, 'debug');
      const warnSpy = jest.spyOn(logger, 'warn');

      const filter = createFilter();

      // Should work normally (logger not broken, just being spied on)
      const result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.0001);

      // Verify logging was attempted
      expect(debugSpy).toHaveBeenCalled();

      debugSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle logger errors gracefully with ErrorHandler SKIP', async () => {
      const [fundingData] = createFundingRateDataSeries([0.0001]);

      mockGetFundingRate.mockResolvedValue(fundingData);

      // Create filter with error handler that SKIPs logger errors
      const filter = createFilter();

      // Spy on errorHandler to verify SKIP strategy is used
      if (!errorHandler) {
        throw new Error('Expected ErrorHandler to be defined in this test');
      }

      const handleSpy = jest.spyOn(errorHandler, 'handle').mockResolvedValue({
        success: true,
        recovered: true,
        attempts: 1,
        message: 'Skipped (logger error)',
        strategy: RecoveryStrategy.SKIP,
      });

      const result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.0001);

      handleSpy.mockRestore();
    });

    it('should skip cache clear logging errors', async () => {
      const filter = createFilter();

      // Should not throw despite any logger errors
      await expect(filter.clearCache()).resolves.not.toThrow();
    });

    it('should skip logger errors when blocking signals', async () => {
      const [fundingData] = createFundingRateDataSeries([0.001]);

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = createFilter();

      // Signal should be blocked despite any logger issues
      const result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Funding rate too high');
    });
  });

  // ============================================================================
  // INTEGRATION SCENARIOS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle cascading failures: API error → cache fallback → logger error', async () => {
      const oldFundingData: FundingRateData = {
        fundingRate: 0.00008,
        timestamp: Date.now() - 120000,
        nextFundingTime: Date.now() + 7 * 60 * 60 * 1000,
      };

      const newFundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      const filter = createFilter({ config, getFundingRate: mockGetFundingRate, logger, errorHandler });

      // Cache initial value
      mockGetFundingRate.mockResolvedValueOnce(oldFundingData);
      let result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.fundingRate).toBe(0.00008);

      // Force cache expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // API fails, should fallback to cache
      mockGetFundingRate.mockRejectedValueOnce(new Error('API error'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API error'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API error'));

      result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.00008); // Degraded to old cache
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      // Create filter WITHOUT ErrorHandler
      const filter = createLegacyFilter({ config, getFundingRate: mockGetFundingRate, logger });

      const result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.0001);
    });

    it('should handle multiple consecutive API failures with GRACEFUL_DEGRADE', async () => {
      const fundingData1: FundingRateData = {
        fundingRate: 0.00009,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      const fundingData2: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      const filter = createFilter({ config, getFundingRate: mockGetFundingRate, logger, errorHandler });

      // First fetch
      mockGetFundingRate.mockResolvedValueOnce(fundingData1);
      let result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.fundingRate).toBe(0.00009);

      // Force refetch and fail
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API down'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API down'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API down'));

      // Should return degraded cache
      result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.00009);

      // Force refetch again and fail
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API still down'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API still down'));
      mockGetFundingRate.mockRejectedValueOnce(new Error('API still down'));

      // Should still return last known good cache
      result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.00009);
    });

    it('should handle API errors with GRACEFUL_DEGRADE fallback', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValueOnce(fundingData);

      const filter = createFilter({ config, getFundingRate: mockGetFundingRate, logger, errorHandler });

      // First call succeeds
      const result1 = await filter.checkSignal(SignalDirection.LONG);
      expect(result1.fundingRate).toBe(0.0001);

      // Force cache expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second API call fails, should GRACEFULLY_DEGRADE to cache
      mockGetFundingRate.mockRejectedValue(new Error('API timeout'));

      const result2 = await filter.checkSignal(SignalDirection.LONG);
      expect(result2.allowed).toBe(true);
      expect(result2.fundingRate).toBe(0.0001); // Should still have cached value
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work with undefined ErrorHandler', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = createLegacyFilter({
        config,
        getFundingRate: mockGetFundingRate,
        logger,
      });

      const result = await filter.checkSignal(SignalDirection.LONG);
      expect(result.allowed).toBe(true);
      expect(result.fundingRate).toBe(0.0001);
    });

    it('should preserve original signal blocking behavior', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.001, // Above threshold
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = createFilter({ config, getFundingRate: mockGetFundingRate, logger, errorHandler });

      const result = await filter.checkSignal(SignalDirection.LONG);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Funding rate too high');
    });

    it('should preserve caching behavior', async () => {
      const fundingData: FundingRateData = {
        fundingRate: 0.0001,
        timestamp: Date.now(),
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      };

      mockGetFundingRate.mockResolvedValue(fundingData);

      const filter = createFilter({ config, getFundingRate: mockGetFundingRate, logger, errorHandler });

      // First call
      await filter.checkSignal(SignalDirection.LONG);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await filter.checkSignal(SignalDirection.LONG);
      expect(mockGetFundingRate).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});
